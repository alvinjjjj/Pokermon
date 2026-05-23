import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
// ML Kit temporarily disabled for Simulator builds — re-enable for App Store build
// import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { SkeletonGrid } from '../../components/SkeletonCard';
import { JP_SERIES, POKEMON_TCG_API_KEY, POKEMON_TCG_BASE_URL } from '../../constants/config';
import { BOOSTER_SETS, BoosterSet } from '../../constants/boosterBoxes';
import { BoxPrices, getBoxPricesMap } from '../../lib/boosterPrices';
import { normalizeQuery } from '../../constants/pokemonNames';
import { useCurrency } from '../../contexts/CurrencyContext';
import { fetchHotCards, fetchHotEnCards, getCardPrice as getPPTCardPrice, pptPriceCompat, searchJPCards, searchENCards, PPTCard } from '../../lib/pokeprice';
import { supabase } from '../../lib/supabase';
import { fetchLowestPrices, LowestListing } from '../../lib/lowestPrices';
import { fetchHiresJPImages, hasReliableImage } from '../../lib/jpImages';


const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────
type PokemonCard = {
  id: string;
  name: string;
  set: { id: string; name: string; series: string };
  rarity?: string;
  number: string;
  subtypes?: string[];
  images: { small: string; large: string };
  cardmarket?: { prices?: { averageSellPrice?: number; avg30?: number; avg7?: number } };
  tcgplayer?: { id?: string; prices?: { holofoil?: { market?: number }; normal?: { market?: number } } };
  _lang?: 'EN' | 'JP';
  _jtcgPrice?: { market: number; low: number; high: number; psa9: number; psa10: number } | null;
  _pptCard?: PPTCard | null;
};

type CardPair    = [PokemonCard, PokemonCard | null];
type CardSection = { title: string; data: CardPair[]; lang: 'EN' | 'JP' };

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_KEYS = ['all', 'EX', 'GX', 'V', 'VMAX', 'ex'];
const PSA_GRADE_KEYS = ['all', 'Raw', '9', '10'];

// NOTE: Estimation multipliers (PSA_MULT_JP / PSA_MULT_EN) have been removed.
// Cards without real PPT graded data now show "pricePending" in the UI rather
// than a fabricated estimate. This means the displayed price is always either
// real eBay data (PPT) or the ungraded market price — never a multiplied guess.

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isJpCard(card: PokemonCard): boolean {
  return JP_SERIES.some(s => card.set.series === s) ||
    /[぀-ヿ一-鿿]/.test(card.name);
}

function getRawUsd(card: PokemonCard): number {
  return (
    card.cardmarket?.prices?.averageSellPrice ||
    card.tcgplayer?.prices?.holofoil?.market  ||
    card.tcgplayer?.prices?.normal?.market    ||
    0
  );
}

function toPairs(arr: PokemonCard[]): CardPair[] {
  const pairs: CardPair[] = [];
  for (let i = 0; i < arr.length; i += 2) {
    pairs.push([arr[i], arr[i + 1] ?? null]);
  }
  return pairs;
}

// JP image enrichment (parsePPTRef, fetchHiresJPImages, hasReliableImage) lives
// in lib/jpImages.ts so portfolio.tsx can reuse it to rescue already-added cards.

/** Convert a PPTCard (from PPT hot JP) into our PokemonCard shape */
function pptCardToPokemonCard(c: PPTCard): PokemonCard {
  // Use artofpkm/TCGdex hi-res if available; fall back to PPT image only if it's reliable
  const hiresUrl  = c.imageLarge && hasReliableImage(c.imageLarge) ? c.imageLarge : '';
  const thumbUrl  = c.image && hasReliableImage(c.image)           ? c.image      : '';
  const imageUrl  = hiresUrl || thumbUrl; // empty string = show placeholder in card list
  return {
    id:     `ppt_${c.tcgPlayerId || c.name.replace(/\s+/g, '_')}`,
    name:   c.name,
    set:    { id: '', name: c.setName, series: c.language === 'japanese' ? 'Scarlet & Violet (Japanese)' : 'Scarlet & Violet' },
    rarity: undefined,
    number: '',
    images: { small: imageUrl, large: imageUrl },
    _lang:  c.language === 'japanese' ? 'JP' : 'EN',
    _jtcgPrice: pptPriceCompat(c),
    _pptCard:   c,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const { convert, currency, rate } = useCurrency();
  const router = useRouter();
  const { t } = useTranslation();
  const { q: incomingQuery } = useLocalSearchParams<{ q?: string }>();

  const CATEGORIES = CATEGORY_KEYS.map(k => ({ key: k, label: k === 'all' ? t('search.catAll') : k }));
  const LANGUAGES  = [
    { label: t('search.langAll'), value: '' },
    { label: t('search.langEN'),  value: 'en' },
    { label: t('search.langJP'),  value: 'ja' },
  ];
  const PSA_GRADES = PSA_GRADE_KEYS.map(k => ({ key: k, label: k === 'all' ? t('search.psaAll') : k === 'Raw' ? 'Raw' : `PSA ${k}` }));

  const [mode, setMode]                     = useState<'cards' | 'boxes'>('cards');
  const [boxQuery, setBoxQuery]             = useState('');
  const [boxSeriesFilter, setBoxSeriesFilter] = useState('all');
  const [boxPrices, setBoxPrices]           = useState<Record<string, BoxPrices>>({});
  const [boxPricesLoading, setBoxPricesLoading] = useState(false);
  // 0 = show primary pack image, 1 = show fallback logo, 2 = show emoji
  const [boxImgErrors, setBoxImgErrors]     = useState<Record<string, number>>({});
  const [query, setQuery]                   = useState(incomingQuery ?? '');
  const [enCards, setEnCards]               = useState<PokemonCard[]>([]);
  const [jpCards, setJpCards]               = useState<PokemonCard[]>([]);
  // All fetched results (may be larger than what's displayed)
  const allJpRef  = useRef<PokemonCard[]>([]);
  const allEnRef  = useRef<PokemonCard[]>([]);
  const PAGE_SIZE = 20;
  const [hotEnCards, setHotEnCards]         = useState<PokemonCard[]>([]);
  const [hotJpCards, setHotJpCards]         = useState<PokemonCard[]>([]);
  const [loading, setLoading]               = useState(false);
  const [hotLoading, setHotLoading]         = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeLang, setActiveLang]         = useState('');
  const [activePSA, setActivePSA]           = useState('all');
  const [addedCards, setAddedCards]         = useState<Set<string>>(new Set());
  const [lowestPrices, setLowestPrices]     = useState<Record<string, LowestListing>>({});
  const [showPSAModal, setShowPSAModal]     = useState(false);
  const [selectedCard, setSelectedCard]     = useState<PokemonCard | null>(null);
  const [selectedPSA, setSelectedPSA]       = useState('10');
  const [adding, setAdding]                 = useState(false);
  const [customPrice, setCustomPrice]       = useState('');
  const [addQuantity, setAddQuantity]       = useState(1);
  // Box modal state
  const [showBoxModal, setShowBoxModal]     = useState(false);
  const [selectedBox, setSelectedBox]       = useState<BoosterSet | null>(null);
  const [boxCondition, setBoxCondition]     = useState<'Sealed' | 'Opened'>('Sealed');
  const [boxCustomPrice, setBoxCustomPrice] = useState('');
  const [boxQuantity, setBoxQuantity]       = useState(1);
  const [addedBoxes, setAddedBoxes]         = useState<Set<string>>(new Set());
  const [scanning, setScanning]             = useState(false);
  const [scanPreview, setScanPreview]       = useState<string | null>(null);
  const [showScanModal, setShowScanModal]   = useState(false);
  const [scanResult, setScanResult]         = useState('');

  const searchTimeout = useRef<any>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const didLoad       = useRef(false);

  // Initial hot-cards load. Use useEffect so React's render phase stays pure
  // (setState inside render is forbidden in React 19 / Strict Mode).
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    loadHotCards('');
  }, []);

  // Auto-search when navigated here with a pre-filled query (e.g. JP card tap on home)
  useEffect(() => {
    if (incomingQuery) handleSearch(incomingQuery);
  }, [incomingQuery]);

  // Fetch certified-merchant lowest prices whenever visible cards change
  useEffect(() => {
    const ids = [...enCards, ...jpCards, ...hotEnCards, ...hotJpCards].map(c => c.id);
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length) fetchLowestPrices(unique).then(setLowestPrices);
  }, [enCards, jpCards, hotEnCards, hotJpCards]);

  // Sync addedCards from DB on screen focus (handles portfolio deletions cross-tab)
  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from('user_collection').select('card_id').eq('user_id', uid)
        .then(({ data: rows }) => {
          if (rows) setAddedCards(new Set(rows.map((r: any) => r.card_id).filter(Boolean)));
        });
    });
  }, []));

  // Load live booster box prices when box mode opens
  useEffect(() => {
    if (mode !== 'boxes' || Object.keys(boxPrices).length > 0) return;
    setBoxPricesLoading(true);
    getBoxPricesMap(BOOSTER_SETS)
      .then(map => setBoxPrices(map))
      .catch(err => { if (__DEV__) console.warn('[BoxPrices] load error:', err); })
      .finally(() => setBoxPricesLoading(false));
  }, [mode]);

  // ─── Hot Cards ──────────────────────────────────────────────────────────────
  async function loadHotCards(lang: string) {
    setHotLoading(true);
    try {
      const fetchEn = lang === '' || lang === 'en';
      const fetchJp = lang === '' || lang === 'ja';
      const page    = Math.floor(Math.random() * 3) + 1;

      // EN: pokemontcg.io for reliable images + PPT for real eBay prices (parallel)
      // JP: PPT for prices + artofpkm/TCGdex for hi-res images
      const [enPokeIo, pptEN, pptJP] = await Promise.all([
        fetchEn
          ? fetch(
              `${POKEMON_TCG_BASE_URL}/cards?q=${encodeURIComponent('set.series:"Scarlet & Violet"')}&pageSize=20&orderBy=-set.releaseDate&page=${page}&select=id,name,number,rarity,set,images,cardmarket,tcgplayer`,
              { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY } }
            ).then(r => r.json()).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        fetchEn ? fetchHotEnCards(20) : Promise.resolve([] as PPTCard[]),
        fetchJp ? fetchHotCards(12)   : Promise.resolve([] as PPTCard[]),
      ]);

      // Build PPT price map for EN by card name (lowercase)
      const enPptMap = new Map<string, PPTCard>(
        (pptEN as PPTCard[]).map(c => [c.name.toLowerCase(), c])
      );

      // Merge: pokemontcg.io cards (reliable images) enriched with PPT prices
      // Sort by PPT PSA10 price desc → show most valuable first
      const enList: PokemonCard[] = ((enPokeIo.data ?? []) as PokemonCard[])
        .filter(c => !isJpCard(c))
        .map(c => {
          const ppt = enPptMap.get(c.name.toLowerCase());
          return {
            ...c,
            _lang:      'EN' as const,
            _jtcgPrice: ppt ? pptPriceCompat(ppt) : null,
            _pptCard:   ppt ?? null,
          };
        })
        .sort((a, b) => {
          // Sort by real PSA10 if present, else raw market — no estimation
          const aV = a._jtcgPrice?.psa10 || a._jtcgPrice?.market || getRawUsd(a);
          const bV = b._jtcgPrice?.psa10 || b._jtcgPrice?.market || getRawUsd(b);
          return bV - aV;
        })
        .slice(0, 8);

      // JP hot: enrich with hi-res images from artofpkm/TCGdex
      const rawJpPPT = (pptJP as PPTCard[]).filter(c => c.image).slice(0, 12);
      const hiresMap = await fetchHiresJPImages(rawJpPPT.map(c => ({ name: c.name, setName: c.setName })));
      const enrichedJp = rawJpPPT.map(c => hiresMap[c.name] ? { ...c, imageLarge: hiresMap[c.name] } : c);
      const jpList: PokemonCard[] = enrichedJp
        .filter(c => hasReliableImage(c.imageLarge || c.image || ''))
        .map(pptCardToPokemonCard);

      setHotEnCards(enList);
      setHotJpCards(jpList);
    } catch (e) {
      if (__DEV__) console.error('loadHotCards error:', e);
    }
    setHotLoading(false);
  }

  // ─── Camera Scan ────────────────────────────────────────────────────────────
  const openCameraScanner = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('search.cameraPermission'), t('search.cameraPermissionMsg'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setScanPreview(asset.uri);
    setShowScanModal(true);
    setScanning(true);
    setScanResult('');

    try {
      // ML Kit OCR disabled for Simulator — re-enable for App Store build
      // const mlResult = await TextRecognition.recognize(asset.uri, TextRecognitionScript.JAPANESE);
      // const rawText: string = mlResult.text ?? '';
      // const extracted = extractPokemonName(rawText);
      // setScanResult(extracted);
      setScanResult(''); // Simulator: no OCR, user can type manually
    } catch (err) {
      if (__DEV__) console.error('[Scan] error:', err);
      setScanResult('');
    }
    setScanning(false);
  };

  /** Heuristic: find the most likely Pokemon name from OCR text */
  const extractPokemonName = (text: string): string => {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

    // ── Japanese card: look for katakana name first ──────────────────────────
    // Pokemon names on JP cards are in katakana (ァ-ヶ) + long vowel mark (ー)
    // They appear near the top, typically 2–12 characters
    const katakanaPattern = /^[ァ-ヶー・]{2,14}$/;
    for (const line of lines) {
      if (katakanaPattern.test(line)) return line;
    }
    // Also match katakana mixed with a dot (e.g. カプ・コケコ)
    const katakanaLoose = /^[ァ-ヶー・ヴ]{2,14}$/;
    for (const line of lines) {
      if (katakanaLoose.test(line)) return line;
    }

    // ── English card: look for capitalized name ──────────────────────────────
    // Skip lines that look like HP, numbers, symbols, set codes, or game text
    const junkPattern = /^(HP|hp|\d+|●|◆|[!@#$%^&*()_+=\[\]{}|<>,./\\?;:'"~`-]+|\w{1,2}$)/;
    const longPattern = /^.{40,}$/; // skip very long descriptive lines

    // Prefer lines that look like proper names (capitalized words, 3–20 chars)
    const namePattern = /^[A-ZÁÉÍÓÚ][a-zA-Záéíóúü\- ]{2,19}$/;

    // First pass: strict name pattern
    for (const line of lines) {
      if (namePattern.test(line) && !junkPattern.test(line)) return line;
    }

    // Second pass: first readable word 3-20 chars
    for (const line of lines) {
      if (!junkPattern.test(line) && !longPattern.test(line) && line.length >= 3) return line;
    }

    return lines[0] ?? '';
  };

  const confirmScanSearch = () => {
    if (scanResult.trim().length >= 2) {
      setQuery(scanResult.trim());
      setShowScanModal(false);
      doSearch(scanResult.trim(), activeCategory, activeLang);
    }
  };

  // ─── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    // Show loading skeleton immediately so the user knows we're working
    if (text.trim().length >= 2) setLoading(true);
    else { allJpRef.current = []; allEnRef.current = []; setEnCards([]); setJpCards([]); setLoading(false); }
    searchTimeout.current = setTimeout(() => doSearch(text, activeCategory, activeLang), 600);
  };

  const doSearch = async (
    rawText: string,
    category = activeCategory,
    lang = activeLang,
  ) => {
    // Cancel any in-flight request from a previous call
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    if (rawText.trim().length < 2) { setEnCards([]); setJpCards([]); setLoading(false); return; }
    setLoading(true);
    try {
      const resolved = normalizeQuery(rawText.trim());
      const isNumberQuery = /^\d+$/.test(resolved);
      // Build pokemontcg.io Lucene query.
      //
      // IMPORTANT: wildcards (`*`) do NOT work inside quoted phrases in Lucene.
      // So  name:"charizard ex*"  → 0 hits. Instead we split on whitespace AND
      // hyphens, emit one  name:<term>*  clause per word, then AND them
      // implicitly.
      //
      // Examples:
      //   "Charizard ex" → name:charizard* name:ex*       ✅ matches "Charizard ex"
      //   "Sightseer"    → name:sightseer*                ✅ matches "Sightseer"
      //   "Ho-Oh"        → name:ho* name:oh*              ✅ matches "Ho-Oh"
      //   "Type: Null"   → name:type* name:null*          ✅ matches "Type: Null"
      //
      // We strip Lucene-special chars (NOT including `-`, which we split on
      // instead — leaving it in would make `name:ho-oh*` mean "ho AND NOT oh*").
      const escapeTerm = (s: string) =>
        s.toLowerCase().replace(/[+!(){}\[\]^"~*?:\\/]/g, '').trim();
      let baseQ: string;
      if (isNumberQuery) {
        baseQ = `number:${resolved}`;
      } else {
        // Split on whitespace AND hyphens so multi-word + hyphenated names work
        const terms = resolved.split(/[\s-]+/).map(escapeTerm).filter(t => t.length > 0);
        baseQ = terms.length
          ? terms.map(t => `name:${t}*`).join(' ')
          : `name:${escapeTerm(resolved)}*`;
      }
      if (category !== 'all') baseQ += ` subtypes:${category}`;

      const showEn = lang === '' || lang === 'en';
      const showJp = lang === '' || lang === 'ja';

      // EN: pokemontcg.io for images + PPT for real eBay prices (parallel fetch)
      // JP: PPT API with artofpkm hi-res image enrichment
      const [enRes, enPPT, jpPPT] = await Promise.all([
        showEn
          ? fetch(
              `${POKEMON_TCG_BASE_URL}/cards?q=${encodeURIComponent(baseQ)}&pageSize=20&orderBy=-set.releaseDate&select=id,name,number,rarity,set,images,cardmarket,tcgplayer`,
              { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY }, signal }
            ).then(r => r.json()).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        // PPT EN search only makes sense for name queries, not card numbers
        showEn && !isNumberQuery ? searchENCards(resolved, 20, signal) : Promise.resolve([] as PPTCard[]),
        showJp ? searchJPCards(resolved, 50, signal) : Promise.resolve([] as PPTCard[]),
      ]);

      if (__DEV__) {
        console.log('[Search] pokemontcg EN:', enRes.data?.length ?? 0, '| PPT EN:', (enPPT as PPTCard[]).length, '| PPT JP:', (jpPPT as PPTCard[]).length);
      }

      // Build PPT price map by card name for EN merge
      const enPptMap = new Map<string, PPTCard>(
        (enPPT as PPTCard[]).map(c => [c.name.toLowerCase(), c])
      );

      // Merge: pokemontcg.io gives reliable images, PPT gives real eBay PSA prices
      // Sort: highest PSA10 (or estimate) first
      const enList: PokemonCard[] = showEn
        ? ((enRes.data ?? []) as PokemonCard[])
            .filter(c => !isJpCard(c))
            .map(c => {
              const ppt = enPptMap.get(c.name.toLowerCase());
              return {
                ...c,
                _lang:      'EN' as const,
                _jtcgPrice: ppt ? pptPriceCompat(ppt) : null,
                _pptCard:   ppt ?? null,
              };
            })
            .sort((a, b) => {
              // Sort by real PSA10 if present, else raw market — no estimation
              const aV = a._jtcgPrice?.psa10 || a._jtcgPrice?.market || getRawUsd(a);
              const bV = b._jtcgPrice?.psa10 || b._jtcgPrice?.market || getRawUsd(b);
              return bV - aV;
            })
        : [];

      // JP: enrich with hi-res images from artofpkm/TCGdex
      const rawJpSearch = showJp ? (jpPPT as PPTCard[]) : [];
      if (rawJpSearch.length) {
        const hiresSearchMap = await fetchHiresJPImages(rawJpSearch.map(c => ({ name: c.name, setName: c.setName })));
        rawJpSearch.forEach(c => { if (hiresSearchMap[c.name]) c.imageLarge = hiresSearchMap[c.name]; });
      }
      // In search, show ALL results — user explicitly searched for this card
      const jpList = rawJpSearch.map(pptCardToPokemonCard);

      if (signal.aborted) return;
      allEnRef.current = enList;
      allJpRef.current = jpList;
      setEnCards(enList.slice(0, PAGE_SIZE));
      setJpCards(jpList.slice(0, PAGE_SIZE));
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // stale request cancelled — ignore
      if (__DEV__) console.error('doSearch error:', e);
    } finally {
      // Always clear the spinner — even on abort. If this call was superseded
      // by a newer one, that newer doSearch already set loading=true and will
      // be the source of truth for the final state.
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const handleLangChange = (lang: string) => {
    setActiveLang(lang);
    loadHotCards(lang);
    if (query.trim().length >= 2) doSearch(query, activeCategory, lang);
  };

  // ─── Price helpers ───────────────────────────────────────────────────────────
  // PPT psa10/psa9 先過 sanity check（psa10 ≥ raw × 1.5），擋住 PPT 髒數據
  // （例：Giratina V Lost Abyss PPT psa10 = HK$3,845，真實 eBay 是 HK$15k+）。
  // 通不過就 fallback 到 Raw × multiplier 估算，標 isEstimate = true。
  const getDisplayPrice = (card: PokemonCard): { usd: number; isEstimate: boolean } => {
    const raw    = getRawUsd(card);
    const jtcg   = card._jtcgPrice;
    const market = jtcg?.market && jtcg.market > 0 ? jtcg.market : raw;
    const isJp   = isJpCard(card);
    const base   = raw > 0 ? raw : (isJp && market > 0 ? market : 0);

    const psa10ok = (jtcg?.psa10 ?? 0) > 0 && (base <= 0 || jtcg!.psa10 >= base * 1.5);
    const psa9ok  = (jtcg?.psa9  ?? 0) > 0 && (base <= 0 || jtcg!.psa9  >= base * 1.2);

    if (activePSA === '10') {
      if (psa10ok) return { usd: jtcg!.psa10, isEstimate: false };
      if (base > 0) return { usd: base * (isJp ? 3 : 4), isEstimate: true };
      return { usd: 0, isEstimate: false };
    }
    if (activePSA === '9') {
      if (psa9ok) return { usd: jtcg!.psa9, isEstimate: false };
      if (base > 0) return { usd: base * (isJp ? 1.5 : 1.8), isEstimate: true };
      return { usd: 0, isEstimate: false };
    }
    if (activePSA === 'Raw') {
      if (market > 0) return { usd: market, isEstimate: false };
      return { usd: 0, isEstimate: false };
    }
    // "All" — show PSA 10 by default (matches home + detail). Real PPT psa10
    // first; otherwise Raw × multiplier estimate. Never fall back to raw
    // market here — that would mislabel a Raw price as PSA 10.
    if (psa10ok) return { usd: jtcg!.psa10, isEstimate: false };
    if (base > 0) return { usd: base * (isJp ? 3 : 4), isEstimate: true };
    return { usd: 0, isEstimate: false };
  };

  // ─── PSA Modal ───────────────────────────────────────────────────────────────
  const openPSAModal = (card: PokemonCard) => {
    setSelectedCard(card);
    setSelectedPSA(isJpCard(card) ? '10' : 'Raw');
    setCustomPrice('');
    setAddQuantity(1);
    setShowPSAModal(true);

    // Always re-fetch for JP cards to get real eBay PSA prices from PPT
    const needsFetch = !card._jtcgPrice || isJpCard(card);
    if (needsFetch) {
      const lang = isJpCard(card) ? 'japanese' : 'english';
      getPPTCardPrice(card.tcgplayer?.id ?? '', card.name, card.set.name, lang).then(ppt => {
        if (ppt) {
          setSelectedCard(prev => prev
            ? { ...prev, _jtcgPrice: pptPriceCompat(ppt), _pptCard: ppt }
            : prev
          );
        }
      });
    }
  };

  const confirmAdd = async () => {
    if (!selectedCard) return;
    setAdding(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { Alert.alert(t('home.loginFirst')); return; }

      const parsedCustom = parseFloat(customPrice);
      const { usd: calcUsd } = getDisplayPriceForCard(selectedCard, selectedPSA);
      // User input is in selected currency (e.g. HKD), divide by rate to get USD for storage
      const usd = (!isNaN(parsedCustom) && parsedCustom > 0) ? parsedCustom / rate : calcUsd;
      const qty = Math.max(1, Math.min(999, Math.floor(addQuantity || 1)));

      // Image fallback: if this card came from the PPT path with no reliable
      // image attached, do the full JP-image resolution (artofpkm Supabase
      // → TCGdex JA → TCGdex EN by name) before writing the row. This is the
      // same pipeline portfolio.tsx uses to rescue images for already-saved
      // rows — running it at add-time means the user's portfolio gets the
      // image right away instead of waiting for the next portfolio load.
      let imageUrl = selectedCard.images.small || '';
      if (!imageUrl) {
        try {
          const map = await fetchHiresJPImages([{ name: selectedCard.name, setName: selectedCard.set.name }]);
          if (map[selectedCard.name]) imageUrl = map[selectedCard.name];
        } catch { /* leave empty — portfolio recovery will try again later */ }
      }

      const { error } = await supabase.from('user_collection').insert({
        user_id:        user.id,
        card_id:        selectedCard.id,
        card_name:      selectedCard.name,
        set_name:       selectedCard.set.name,
        purchase_price: usd,
        current_price:  usd,
        quantity:       qty,
        psa_grade:      selectedPSA,
        image_url:      imageUrl,
      });
      if (!error) {
        setAddedCards(prev => new Set([...prev, selectedCard.id]));
        setShowPSAModal(false);
        const qtySuffix = qty > 1 ? ` × ${qty}` : '';
        Alert.alert(t('search.addedToPortfolio'), `${selectedCard.name} (${selectedPSA === 'Raw' ? 'Raw' : `PSA ${selectedPSA}`})${qtySuffix}`);
      } else {
        Alert.alert(t('home.addFailed'), error.message);
      }
    } finally { setAdding(false); }
  };

  // ─── Box Modal ───────────────────────────────────────────────────────────────
  const openBoxModal = (box: BoosterSet) => {
    setSelectedBox(box);
    setBoxCondition('Sealed');
    setBoxCustomPrice('');
    setBoxQuantity(1);
    setShowBoxModal(true);
  };

  const confirmAddBox = async () => {
    if (!selectedBox) return;
    setAdding(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { Alert.alert(t('home.loginFirst')); return; }

      const live = boxPrices[selectedBox.id];
      const marketUsd = live?.box_usd ?? selectedBox.boxMarketUSD;
      const parsedCustom = parseFloat(boxCustomPrice);
      const usd = (!isNaN(parsedCustom) && parsedCustom > 0) ? parsedCustom : marketUsd;

      const qty = Math.max(1, Math.min(999, Math.floor(boxQuantity || 1)));
      const { error } = await supabase.from('user_collection').insert({
        user_id:        user.id,
        card_id:        `box-${selectedBox.id}`,
        card_name:      `${selectedBox.nameJP}${t('search.boxSuffix')}`,
        set_name:       selectedBox.nameEN,
        purchase_price: usd,
        current_price:  usd,
        quantity:       qty,
        psa_grade:      'Sealed',
        image_url:      selectedBox.imageUrl ?? '',
        item_type:      'box',
      });

      if (!error) {
        setAddedBoxes(prev => new Set([...prev, selectedBox.id]));
        setShowBoxModal(false);
        const qtySuffix = qty > 1 ? ` × ${qty}` : '';
        Alert.alert(t('search.addedToPortfolio'), `${selectedBox.nameJP}${qtySuffix}`);
      } else {
        Alert.alert(t('home.addFailed'), error.message);
      }
    } finally { setAdding(false); }
  };

  // Helper: get price for any card + grade combo (used in modal)
  // 同 getDisplayPrice：sanity check 後採用 PPT，否則 Raw × multiplier 估算
  const getDisplayPriceForCard = (card: PokemonCard, grade: string): { usd: number; isEstimate: boolean } => {
    const raw  = getRawUsd(card);
    const jtcg = card._jtcgPrice;
    const isJp = isJpCard(card);
    const base = raw > 0 ? raw : (isJp && jtcg?.market ? jtcg.market : 0);

    const psa10ok = (jtcg?.psa10 ?? 0) > 0 && (base <= 0 || jtcg!.psa10 >= base * 1.5);
    const psa9ok  = (jtcg?.psa9  ?? 0) > 0 && (base <= 0 || jtcg!.psa9  >= base * 1.2);

    if (grade === '10') {
      if (psa10ok) return { usd: jtcg!.psa10, isEstimate: false };
      if (base > 0) return { usd: base * (isJp ? 3 : 4), isEstimate: true };
      return { usd: 0, isEstimate: false };
    }
    if (grade === '9') {
      if (psa9ok) return { usd: jtcg!.psa9, isEstimate: false };
      if (base > 0) return { usd: base * (isJp ? 1.5 : 1.8), isEstimate: true };
      return { usd: 0, isEstimate: false };
    }
    // Raw: PPT market 優先，沒有就 cardmarket/tcgplayer raw
    if (jtcg?.market && jtcg.market > 0) return { usd: jtcg.market, isEstimate: false };
    return { usd: raw, isEstimate: false };
  };

  // ─── Card Renderer ───────────────────────────────────────────────────────────
  const renderCard = (item: PokemonCard, forceLang?: 'EN' | 'JP') => {
    const isAdded = addedCards.has(item.id);
    const isJP    = forceLang === 'JP' || (forceLang !== 'EN' && isJpCard(item));
    const { usd, isEstimate } = getDisplayPrice(item);

    // Unified labels — always "PSA 10" when the price represents a PSA 10
    // value (real or estimated). The visual distinction live-vs-estimate is
    // carried by the LIVE badge on the image + the "≈" prefix on the price.
    const psaLabel =
      activePSA === '10'  ? 'PSA 10' :
      activePSA === '9'   ? 'PSA 9'  :
      activePSA === 'Raw' ? 'Raw'    :
      'PSA 10'; // "all" tab also defaults to PSA 10 display

    const priceStr = usd > 0
      ? `${isEstimate ? '≈ ' : ''}${convert(usd)}`
      : t('search.pricePending');

    // 30-day % change. Two data sources:
    //   1. PPT card (JP)        → real history-based change30d (use whenever
    //      PPT has ANY history data; flat 0% is still informative)
    //   2. EN card (no PPT)     → cardmarket.avg30 vs current
    const rawUsd  = getRawUsd(item);
    let change30: number | null = null;
    if (item._pptCard?.price?.history && item._pptCard.price.history.length > 0) {
      change30 = item._pptCard.price.change30d;
    } else {
      const avg30 = item.cardmarket?.prices?.avg30 ?? 0;
      if (avg30 > 0 && rawUsd > 0) {
        change30 = ((rawUsd - avg30) / avg30) * 100;
      }
    }

    // Use JustTCG image for JP cards if available, else pokemontcg image
    const imageUri = item.images?.small || item.images?.large || '';

    const jpParams = isJP ? {
      jp_name:   item.name,
      jp_image:  item.images?.small || '',
      jp_set:    item.set.name,
      jp_number: item._pptCard?.number ?? '',
      jp_psa10:  String(item._jtcgPrice?.psa10  ?? 0),
      jp_psa9:   String(item._jtcgPrice?.psa9   ?? 0),
      jp_market: String(item._jtcgPrice?.market ?? 0),
    } : {};

    return (
      <View style={styles.card} key={item.id}>
        {/* Image tap → detail */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(tabs)/card/[id]', params: { id: item.id, ...jpParams } } as any)}
          activeOpacity={0.85}
        >
          {imageUri ? (
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.cardImage}
              contentFit="contain"
              transition={150}
              recyclingKey={item.id}
              onError={() => {/* silently fall back to placeholder color */}}
            />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
              <Text style={styles.cardImagePlaceholderText} numberOfLines={3}>{item.name}</Text>
            </View>
          )}
          <View style={[styles.langBadge, isJP ? styles.langBadgeJP : styles.langBadgeEN]}>
            <Text style={styles.langBadgeText}>{isJP ? '🇯🇵 JP' : '🇺🇸 EN'}</Text>
          </View>
          {item._jtcgPrice && !isEstimate && (
            <View style={styles.liveTag}>
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Card body — tapping text area also navigates */}
        <TouchableOpacity
          style={styles.cardBody}
          onPress={() => router.push({ pathname: '/(tabs)/card/[id]', params: { id: item.id, ...jpParams } } as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardSet}  numberOfLines={1}>{item.set.name}</Text>
          {item.rarity && <Text style={styles.cardRarity} numberOfLines={1}>{item.rarity}</Text>}

          <View style={[styles.psaRow,
            psaLabel === 'PSA 10' ? styles.psaRowJP :
            psaLabel === 'PSA 9'  ? styles.psaRowEN :
            styles.psaRowRaw
          ]}>
            <Text style={[styles.psaRowText,
              psaLabel === 'PSA 10' ? styles.psaRowTextJP :
              psaLabel === 'PSA 9'  ? styles.psaRowTextEN :
              styles.psaRowTextRaw
            ]}>
              {psaLabel}
            </Text>
          </View>

          <Text style={[styles.cardPrice, isEstimate && styles.cardPriceEstimate]}>
            {priceStr}
          </Text>

          {/* 30-day change */}
          {change30 !== null && (
            <View style={styles.change30Row}>
              <Text style={[styles.change30Text, change30 >= 0 ? styles.change30Up : styles.change30Down]}>
                {change30 >= 0 ? '▲' : '▼'} {Math.abs(change30).toFixed(1)}%
              </Text>
              <Text style={styles.change30Label}> 30d</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Certified merchant lowest price button */}
        {lowestPrices[item.id] && (
          <TouchableOpacity
            style={styles.merchantBtn}
            onPress={() => router.push(`/listing/${lowestPrices[item.id].listing_id}` as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.merchantBtnText}>
              {t('home.certifiedLowest', { price: lowestPrices[item.id].price.toLocaleString() })}
            </Text>
          </TouchableOpacity>
        )}

        {/* Add button — separate from nav touchables */}
        <TouchableOpacity
          style={[styles.addBtn, isAdded && styles.addBtnAdded]}
          onPress={() => !isAdded && openPSAModal(item)}
        >
          <Text style={styles.addBtnText}>{isAdded ? '✓' : '+'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Load more (progressive reveal from already-fetched data) ────────────────
  const handleLoadMore = useCallback(() => {
    let updated = false;
    if (jpCards.length < allJpRef.current.length) {
      setJpCards(allJpRef.current.slice(0, jpCards.length + PAGE_SIZE));
      updated = true;
    }
    if (enCards.length < allEnRef.current.length) {
      setEnCards(allEnRef.current.slice(0, enCards.length + PAGE_SIZE));
      updated = true;
    }
    return updated;
  }, [jpCards.length, enCards.length]);

  const hasMoreResults =
    jpCards.length < allJpRef.current.length ||
    enCards.length < allEnRef.current.length;

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const hasSearch = enCards.length > 0 || jpCards.length > 0;

  const searchSections: CardSection[] = [];
  if (jpCards.length > 0) searchSections.push({ title: t('search.langJP'), data: toPairs(jpCards), lang: 'JP' });
  if (enCards.length > 0) searchSections.push({ title: t('search.langEN'), data: toPairs(enCards), lang: 'EN' });

  const hotAllRaw: PokemonCard[] =
    activeLang === 'en' ? hotEnCards.map(c => ({ ...c, _lang: 'EN' as const })) :
    activeLang === 'ja' ? hotJpCards.map(c => ({ ...c, _lang: 'JP' as const })) :
    [
      ...hotJpCards.map(c => ({ ...c, _lang: 'JP' as const })),
      ...hotEnCards.map(c => ({ ...c, _lang: 'EN' as const })),
    ];

  // Filter hot cards by active category (client-side)
  const hotAll: PokemonCard[] = activeCategory === 'all'
    ? hotAllRaw
    : hotAllRaw.filter(c => c.subtypes?.some(
        (s: string) => s.toLowerCase() === activeCategory.toLowerCase()
      ));

  const hotTitle =
    activeLang === 'en' ? t('search.hotTitleEN') :
    activeLang === 'ja' ? t('search.hotTitleJP') :
    t('search.hotTitleAll');

  // ─── Booster box helpers ──────────────────────────────────────────────────────
  const BOX_SERIES_FILTERS = [
    { key: 'all',             label: t('search.catAll') },
    { key: 'popular',         label: t('search.boxPopular') },
    { key: 'MEGA 系列',       label: 'MEGA 系列' },
    { key: '朱・紫系列',      label: '朱・紫系列' },
    { key: 'Sword & Shield 系列', label: 'Sword & Shield 系列' },
  ];

  const filteredBoxes: BoosterSet[] = BOOSTER_SETS.filter(s => {
    const matchQuery = boxQuery.trim().length < 1 ||
      s.nameJP.includes(boxQuery) ||
      s.nameEN.toLowerCase().includes(boxQuery.toLowerCase()) ||
      s.setCode.toLowerCase().includes(boxQuery.toLowerCase());
    const matchSeries =
      boxSeriesFilter === 'all'     ? true :
      boxSeriesFilter === 'popular' ? !!s.popular :
      s.series === boxSeriesFilter;
    return matchQuery && matchSeries;
  });


  const renderBoosterBox = (item: BoosterSet) => {
    const live      = boxPrices[item.id];
    const packUsd   = live?.pack_usd ?? item.packMarketUSD;
    const boxUsd    = live?.box_usd  ?? item.boxMarketUSD;
    const isLive    = live?.source === 'pricecharting';
    const packPrice = convert(packUsd);
    const boxPrice  = convert(boxUsd);
    const imgStage  = boxImgErrors[item.id] ?? 0; // 0=primary, 1=fallback, 2=emoji

    const isAdded = addedBoxes.has(item.id);

    return (
      <View key={item.id} style={styles.card}>
        {/* Tappable image area */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openBoxModal(item)}
        >
          <View style={[styles.cardImage, styles.boxImageArea]}>
            {imgStage < 2 ? (
              <ExpoImage
                source={
                  item.localImage && imgStage === 0
                    ? item.localImage
                    : { uri: imgStage === 0 ? (item.imageUrl ?? '') : (item.fallbackImageUrl ?? '') }
                }
                style={imgStage === 0 ? styles.boxPackImage : styles.boxLogoImage}
                contentFit="contain"
                transition={0}
                priority={item.popular ? 'high' : 'normal'}
                cachePolicy="memory-disk"
                recyclingKey={`${item.id}-${imgStage}`}
                onError={() => setBoxImgErrors(prev => ({
                  ...prev,
                  [item.id]: (prev[item.id] ?? 0) + 1,
                }))}
              />
            ) : (
              <Text style={styles.boxBigEmoji}>{item.emoji}</Text>
            )}
            {/* Set code badge */}
            <View style={[styles.langBadge, styles.langBadgeJP]}>
              <Text style={styles.langBadgeText}>{item.setCode}</Text>
            </View>
            {item.popular && (
              <View style={styles.liveTag}>
                <Text style={styles.liveTagText}>{t('search.boxPopularBadge')}</Text>
              </View>
            )}
            {isLive && (
              <View style={[styles.liveTag, { bottom: 6, top: undefined }]}>
                <Text style={styles.liveTagText}>LIVE</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Tappable card body */}
        <TouchableOpacity
          style={styles.cardBody}
          activeOpacity={0.85}
          onPress={() => openBoxModal(item)}
        >
          <Text style={styles.cardName} numberOfLines={1}>{item.nameJP}</Text>
          <Text style={styles.cardSet}  numberOfLines={1}>{item.nameEN}</Text>

          <View style={[styles.psaRow, styles.psaRowJP]}>
            <Text style={[styles.psaRowText, styles.psaRowTextJP]}>🇯🇵 JP · {item.packsPerBox}{t('search.packsPerBox')}</Text>
          </View>

          {/* Pack + Box price side by side */}
          {boxPricesLoading && !live ? (
            <Text style={styles.boxRetailHint}>{t('common.loadingEllipsis')}</Text>
          ) : (
            <View style={styles.boxPriceRow}>
              <View style={styles.boxPriceItem}>
                <Text style={styles.boxPriceLabel}>{t('search.packPrice')}</Text>
                <Text style={styles.boxPriceValue} numberOfLines={1} adjustsFontSizeToFit>{packPrice}</Text>
              </View>
              <View style={styles.boxPriceSep} />
              <View style={styles.boxPriceItem}>
                <Text style={styles.boxPriceLabel}>{t('search.boxPrice')}</Text>
                <Text style={[styles.boxPriceValue, { color: '#FF6900' }]} numberOfLines={1} adjustsFontSizeToFit>{boxPrice}</Text>
              </View>
            </View>
          )}
          <Text style={styles.boxRetailHint}>{t('search.boxRetailHint', { price: item.packRetailJPY, packs: item.packsPerBox })}</Text>
        </TouchableOpacity>

        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBtn, isAdded && styles.addBtnAdded]}
          onPress={() => !isAdded && openBoxModal(item)}
        >
          <Text style={styles.addBtnText}>{isAdded ? '✓' : '+'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <Header />

      {/* Mode toggle: 單卡 vs 卡盒 */}
      <View style={styles.modeToggleWrap}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'cards' && styles.modeBtnActive]}
          onPress={() => setMode('cards')}
        >
          <Text style={[styles.modeBtnText, mode === 'cards' && styles.modeBtnTextActive]}>{t('search.cards')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'boxes' && styles.modeBtnActive]}
          onPress={() => setMode('boxes')}
        >
          <Text style={[styles.modeBtnText, mode === 'boxes' && styles.modeBtnTextActive]}>{t('search.boxes')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar — adapts to mode */}
      <View style={styles.searchWrap}>
        {mode === 'cards' && (
          <TouchableOpacity style={styles.cameraBtn} onPress={openCameraScanner}>
            <Image source={require('../../assets/icons/camera.png')} style={{ width: 20, height: 20, tintColor: '#6B7280' }} />
          </TouchableOpacity>
        )}
        <View style={styles.searchBox}>
          <Image source={require('../../assets/icons/search.png')} style={styles.searchIconImg} />
          {mode === 'cards' ? (
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.searchPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={handleSearch}
              autoCorrect={false}
            />
          ) : (
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.boxSearchPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={boxQuery}
              onChangeText={setBoxQuery}
              autoCorrect={false}
            />
          )}
          {mode === 'cards' && query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setEnCards([]); setJpCards([]); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {mode === 'cards' && (<>
        <View style={styles.filterWrap}>
          <FlatList horizontal showsHorizontalScrollIndicator={false}
            data={LANGUAGES} keyExtractor={i => i.value}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.langBtn, activeLang === item.value && styles.langBtnActive]}
                onPress={() => handleLangChange(item.value)}
              >
                <Text style={[styles.langText, activeLang === item.value && styles.langTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.filterWrap}>
          <FlatList horizontal showsHorizontalScrollIndicator={false}
            data={PSA_GRADES} keyExtractor={i => i.key}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.psaBtn, activePSA === item.key && styles.psaBtnActive]}
                onPress={() => setActivePSA(item.key)}
              >
                <Text style={[styles.psaText, activePSA === item.key && styles.psaTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {loading && (
          <SkeletonGrid count={6} cardWidth={CARD_W} cardHeight={CARD_W * 1.4 + 80} />
        )}

        {!loading && query.length > 0 && !hasSearch && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t('search.noResults')}</Text>
            <Text style={styles.emptySub}>{t('search.noResultsSub')}</Text>
          </View>
        )}

        {!loading && query.length > 0 && hasSearch && (
          <SectionList<CardPair, CardSection>
            sections={searchSections}
            keyExtractor={pair => `${pair[0].id}-${pair[1]?.id ?? 'x'}`}
            contentContainerStyle={styles.grid}
            stickySectionHeadersEnabled={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader,
                section.lang === 'JP' ? styles.sectionHeaderJP : styles.sectionHeaderEN]}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
                <Text style={styles.sectionCount}>
                  {section.lang === 'JP'
                    ? `${jpCards.length}${allJpRef.current.length > jpCards.length ? `/${allJpRef.current.length}` : ''}${t('search.cardsUnit')}`
                    : `${enCards.length}${allEnRef.current.length > enCards.length ? `/${allEnRef.current.length}` : ''}${t('search.cardsUnit')}`}
                </Text>
              </View>
            )}
            renderItem={({ item: pair, section }) => (
              <View style={styles.gridRow}>
                {renderCard(pair[0], section.lang)}
                {pair[1] ? renderCard(pair[1], section.lang) : <View style={{ width: CARD_W }} />}
              </View>
            )}
            ListFooterComponent={() => (
              <View style={{ alignItems: 'center', paddingVertical: 20, paddingBottom: 100 }}>
                {hasMoreResults
                  ? <ActivityIndicator size="small" color="#9CA3AF" />
                  : <Text style={{ fontSize: 13, color: '#9CA3AF' }}>{t('search.allShown')}</Text>}
              </View>
            )}
          />
        )}

        {!loading && query.length === 0 && (
          <FlatList
            data={hotAll}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            ListHeaderComponent={
              <View style={styles.hotHeader}>
                <Text style={styles.hotTitle}>{hotTitle}</Text>
                {hotLoading && <Text style={styles.hotLoadingText}>{t('common.loadingEllipsis')}</Text>}
              </View>
            }
            renderItem={({ item }) => renderCard(item, item._lang)}
            ListEmptyComponent={hotLoading ? null : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptySub}>{t('common.noData')}</Text>
              </View>
            )}
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        )}
      </>)}

      {/* ── 卡盒模式 ── */}
      {mode === 'boxes' && (<>
        {/* Series filter row */}
        <View style={styles.filterWrap}>
          <FlatList horizontal showsHorizontalScrollIndicator={false}
            data={BOX_SERIES_FILTERS}
            keyExtractor={i => i.key}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.catBtn, boxSeriesFilter === item.key && styles.catBtnActive]}
                onPress={() => setBoxSeriesFilter(item.key)}
              >
                <Text style={[styles.catText, boxSeriesFilter === item.key && styles.catTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <FlatList
          data={filteredBoxes}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={
            <View style={styles.boxListHeader}>
              <Text style={styles.boxListTitle}>{t('search.boxListTitle')}</Text>
              <Text style={styles.boxListSub}>
                {boxPricesLoading ? t('common.loadingEllipsis') : t('search.boxListSub')}
              </Text>
            </View>
          }
          renderItem={({ item }) => renderBoosterBox(item)}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySub}>{t('search.noResults')}</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      </>)}

      {/* Camera Scan Modal */}
      <Modal visible={showScanModal} transparent animationType="slide" onRequestClose={() => setShowScanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('search.scanTitle')}</Text>
            {scanPreview && (
              <ExpoImage
                source={{ uri: scanPreview }}
                style={styles.scanPreviewImg}
                contentFit="contain"
              />
            )}
            {scanning ? (
              <View style={styles.scanLoadingWrap}>
                <Text style={styles.scanLoadingText}>{t('search.scanningCard')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.scanLabel}>{t('search.scanResult')}</Text>
                <TextInput
                  style={styles.scanInput}
                  value={scanResult}
                  onChangeText={setScanResult}
                  placeholder={t('search.scanResultPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                />
                {scanResult.trim().length === 0 && (
                  <Text style={styles.scanHint}>
                    {t('search.scanHint')}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.confirmBtn, scanResult.trim().length < 2 && { opacity: 0.4 }]}
                  onPress={confirmScanSearch}
                  disabled={scanResult.trim().length < 2}
                >
                  <Text style={styles.confirmBtnText}>{t('search.searchCard')}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowScanModal(false)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PSA Modal */}
      <Modal visible={showPSAModal} transparent animationType="slide" onRequestClose={() => setShowPSAModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('search.selectPSAGrade')}</Text>
            <Text style={styles.modalSub}>{selectedCard?.name}</Text>
            {selectedCard && isJpCard(selectedCard) && (
              <View style={styles.modalJpHint}>
                <Text style={styles.modalJpHintText}>{t('search.jpCardDefaultPSA')}</Text>
              </View>
            )}

            {/* Price comparison row */}
            {selectedCard && (
              <View style={styles.pricePreviewRow}>
                {(['Raw', '9', '10'] as const).map(g => {
                  const { usd, isEstimate } = getDisplayPriceForCard(selectedCard, g);
                  const active = selectedPSA === g;
                  return (
                    <View key={g} style={[styles.pricePreviewBox, active && styles.pricePreviewBoxActive]}>
                      <Text style={[styles.pricePreviewGrade, active && styles.pricePreviewGradeActive]}>
                        {g === 'Raw' ? 'Raw' : `PSA ${g}`}
                      </Text>
                      <Text style={[styles.pricePreviewAmount, active && styles.pricePreviewAmountActive]}>
                        {usd > 0 ? `${isEstimate ? '≈' : ''}${convert(usd)}` : '-'}
                      </Text>
                      {!isEstimate && usd > 0 && (
                        <Text style={styles.liveSmall}>LIVE</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.psaGrid}>
              {['Raw', '9', '10'].map(grade => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.psaGridBtn, selectedPSA === grade && styles.psaGridBtnActive]}
                  onPress={() => setSelectedPSA(grade)}
                >
                  <Text style={[styles.psaGridText, selectedPSA === grade && styles.psaGridTextActive]}>
                    {grade === 'Raw' ? 'Raw' : `PSA ${grade}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom price input */}
            <View style={styles.customPriceWrap}>
              <Text style={styles.customPriceLabel}>{t('search.customPriceLabel', { currency })}</Text>
              <Text style={styles.customPriceHint}>{t('search.customPriceHint')}</Text>
              <TextInput
                style={styles.customPriceInput}
                placeholder={t('search.customPricePlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={customPrice}
                onChangeText={setCustomPrice}
                // Prevent iOS QuickType bar from suggesting passcodes / contacts /
                // misc autofill on top of the numeric keyboard.
                textContentType="none"
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
              />
              {customPrice.length > 0 && !isNaN(parseFloat(customPrice)) && (
                <Text style={styles.customPricePreview}>
                  {t('home.willAddAt', { currency, price: parseFloat(customPrice).toFixed(2) })}
                </Text>
              )}
            </View>

            {/* Quantity stepper */}
            <View style={styles.qtyWrap}>
              <Text style={styles.qtyLabel}>{t('search.quantity')}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, addQuantity <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => setAddQuantity(q => Math.max(1, q - 1))}
                  disabled={addQuantity <= 1}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyValueInput}
                  value={String(addQuantity)}
                  onChangeText={(txt) => {
                    const n = parseInt(txt.replace(/[^0-9]/g, ''), 10);
                    if (isNaN(n)) setAddQuantity(1);
                    else setAddQuantity(Math.max(1, Math.min(999, n)));
                  }}
                  keyboardType="number-pad"
                  textContentType="none"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={3}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={[styles.qtyBtn, addQuantity >= 999 && styles.qtyBtnDisabled]}
                  onPress={() => setAddQuantity(q => Math.min(999, q + 1))}
                  disabled={addQuantity >= 999}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, adding && { opacity: 0.7 }]}
              onPress={confirmAdd} disabled={adding}
            >
              {adding ? <Text style={styles.confirmBtnText}>{t('search.adding')}</Text> : <Text style={styles.confirmBtnText}>{t('search.confirmAdd')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPSAModal(false)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Box Add-to-Collection Modal ── */}
      <Modal visible={showBoxModal} transparent animationType="slide" onRequestClose={() => setShowBoxModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
            {/* Header with pack image */}
            <View style={styles.boxModalHeader}>
              {(selectedBox?.localImage || selectedBox?.imageUrl) && (
                <Image
                  source={
                    selectedBox.localImage
                      ? selectedBox.localImage
                      : { uri: selectedBox.imageUrl ?? '' }
                  }
                  style={styles.boxModalImage}
                  resizeMode="contain"
                />
              )}
              <View style={styles.boxModalInfo}>
                <Text style={styles.modalTitle}>{selectedBox?.nameJP}</Text>
                <Text style={styles.modalSub}>{selectedBox?.nameEN} · {selectedBox?.setCode}</Text>
                <View style={[styles.psaRow, styles.psaRowJP, { marginTop: 4 }]}>
                  <Text style={[styles.psaRowText, styles.psaRowTextJP]}>
                    🇯🇵 {selectedBox?.packsPerBox}{t('search.packsPerBox')} · ¥{selectedBox?.packRetailJPY}/{t('search.pack')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Price reference */}
            {selectedBox && (
              <View style={styles.pricePreviewRow}>
                <View style={[styles.pricePreviewBox, { flex: 1.2 }]}>
                  <Text style={styles.pricePreviewGrade}>{t('search.packPrice')}</Text>
                  <Text style={styles.pricePreviewAmount}>
                    {convert(boxPrices[selectedBox.id]?.pack_usd ?? selectedBox.packMarketUSD)}
                  </Text>
                </View>
                <View style={[styles.pricePreviewBox, styles.pricePreviewBoxActive, { flex: 1.5 }]}>
                  <Text style={[styles.pricePreviewGrade, styles.pricePreviewGradeActive]}>{t('search.boxPrice')}</Text>
                  <Text style={[styles.pricePreviewAmount, styles.pricePreviewAmountActive]}>
                    {convert(boxPrices[selectedBox.id]?.box_usd ?? selectedBox.boxMarketUSD)}
                  </Text>
                  {boxPrices[selectedBox.id]?.source === 'pricecharting' && (
                    <Text style={styles.liveSmall}>LIVE</Text>
                  )}
                </View>
              </View>
            )}

            {/* eBay sold-listings link */}
            {selectedBox && (
              <TouchableOpacity
                style={styles.ebayLinkBtn}
                onPress={() => Linking.openURL(selectedBox.ebayUrl)}
                activeOpacity={0.75}
              >
                <Text style={styles.ebayLinkText}>{t('search.viewEbaySales')}</Text>
              </TouchableOpacity>
            )}

            {/* Custom price */}
            <View style={styles.customPriceWrap}>
              <Text style={styles.customPriceLabel}>{t('search.customPriceLabel', { currency })}</Text>
              <Text style={styles.customPriceHint}>{t('search.boxCustomPriceHint')}</Text>
              <TextInput
                style={styles.customPriceInput}
                placeholder={t('search.customPricePlaceholder')}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={boxCustomPrice}
                onChangeText={setBoxCustomPrice}
                textContentType="none"
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
              />
              {boxCustomPrice.length > 0 && !isNaN(parseFloat(boxCustomPrice)) && (
                <Text style={styles.customPricePreview}>
                  {t('search.boxWillRecord', { price: convert(parseFloat(boxCustomPrice)) })}
                </Text>
              )}
            </View>

            {/* Quantity stepper */}
            <View style={styles.qtyWrap}>
              <Text style={styles.qtyLabel}>{t('search.quantity')}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, boxQuantity <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => setBoxQuantity(q => Math.max(1, q - 1))}
                  disabled={boxQuantity <= 1}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyValueInput}
                  value={String(boxQuantity)}
                  onChangeText={(txt) => {
                    const n = parseInt(txt.replace(/[^0-9]/g, ''), 10);
                    if (isNaN(n)) setBoxQuantity(1);
                    else setBoxQuantity(Math.max(1, Math.min(999, n)));
                  }}
                  keyboardType="number-pad"
                  textContentType="none"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={3}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={[styles.qtyBtn, boxQuantity >= 999 && styles.qtyBtnDisabled]}
                  onPress={() => setBoxQuantity(q => Math.min(999, q + 1))}
                  disabled={boxQuantity >= 999}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, adding && { opacity: 0.6 }]}
              onPress={confirmAddBox}
              disabled={adding}
            >
              <Text style={styles.confirmBtnText}>
                {adding ? t('search.adding') : t('search.confirmAdd')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBoxModal(false)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:                    { flex: 1, backgroundColor: '#F9FAFB' },
  searchWrap:              { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  cameraBtn:               { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  cameraBtnText:           { fontSize: 20 },
  searchBox:               { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  scanPreviewImg:          { width: '100%', height: 200, borderRadius: 12, marginBottom: 14 },
  scanLoadingWrap:         { alignItems: 'center', paddingVertical: 20, gap: 10 },
  scanLoadingText:         { fontSize: 15, color: '#6B7280' },
  scanLabel:               { fontSize: 13, color: '#9CA3AF', marginBottom: 6 },
  scanInput:               { backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#101828', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  scanHint:                { fontSize: 12, color: '#F59E0B', marginBottom: 16 },
  searchIcon:              { fontSize: 16 },
  searchIconImg:           { width: 16, height: 16, tintColor: '#9CA3AF', resizeMode: 'contain' },
  searchInput:             { flex: 1, fontSize: 15, color: '#101828' },
  clearBtn:                { fontSize: 14, color: '#9CA3AF', paddingHorizontal: 4 },
  filterWrap:              { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  filterRow:               { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  langBtn:                 { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  langBtnActive:           { backgroundColor: '#101828', borderColor: '#101828' },
  langText:                { fontSize: 13, color: '#6B7280' },
  langTextActive:          { color: '#fff', fontWeight: '600' },
  catBtn:                  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  catBtnActive:            { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  catText:                 { fontSize: 13, color: '#6B7280' },
  catTextActive:           { color: '#fff', fontWeight: '600' },
  psaBtn:                  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  psaBtnActive:            { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  psaText:                 { fontSize: 13, color: '#6B7280' },
  psaTextActive:           { color: '#fff', fontWeight: '600' },
  emptyWrap:               { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  loadingText:             { fontSize: 15, color: '#9CA3AF', marginTop: 8 },
  hotLoadingText:          { fontSize: 12, color: '#9CA3AF' },
  // Mode toggle
  modeToggleWrap:          { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  modeBtn:                 { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modeBtnActive:           { backgroundColor: '#FF6900' },
  modeBtnText:             { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modeBtnTextActive:       { color: '#fff' },
  // Booster box list
  boxListHeader:           { marginBottom: 8, paddingHorizontal: 4 },
  boxListTitle:            { fontSize: 17, fontWeight: '800', color: '#101828' },
  boxListSub:              { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  boxImageArea:            { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxPackImage:            { width: '100%', height: '100%' },   // primary — fills full area
  boxLogoImage:            { width: '75%', height: '60%' },     // fallback logo — centred
  boxBigEmoji:             { fontSize: 48 },
  boxPriceRow:             { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4, minHeight: 36 },
  boxPriceItem:            { flex: 1, alignItems: 'center', overflow: 'hidden' },
  boxPriceLabel:           { fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginBottom: 1 },
  boxPriceValue:           { fontSize: 13, fontWeight: '800', color: '#101828', marginBottom: 2 },
  boxPriceSep:             { width: 1, height: 24, backgroundColor: '#E5E7EB' },
  boxRetailHint:           { fontSize: 9, color: '#C4C9D4', marginTop: 4 },
  // Box modal
  boxModalHeader:          { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  boxModalImage:           { width: 90, height: 90, borderRadius: 10, backgroundColor: '#fff' },
  boxModalInfo:            { flex: 1 },
  boxConditionLabel:       { fontSize: 14, fontWeight: '700', color: '#101828', marginBottom: 10 },
  customPriceWrap:         { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  customPriceLabel:        { fontSize: 14, fontWeight: '700', color: '#101828', marginBottom: 3 },
  customPriceHint:         { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },
  customPriceInput:        { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#101828', borderWidth: 1.5, borderColor: '#E5E7EB' },
  customPricePreview:      { fontSize: 12, color: '#FF6900', fontWeight: '600', marginTop: 8 },
  // Quantity stepper
  qtyWrap:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  qtyLabel:                { fontSize: 14, fontWeight: '700', color: '#101828' },
  qtyRow:                  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn:                  { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  qtyBtnDisabled:          { opacity: 0.35 },
  qtyBtnText:              { fontSize: 20, fontWeight: '700', color: '#101828', lineHeight: 22 },
  qtyValueInput:           { width: 56, height: 36, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#101828', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', paddingVertical: 0 },
  emptyEmoji:              { fontSize: 48 },
  emptyTitle:              { fontSize: 18, fontWeight: '700', color: '#101828' },
  emptySub:                { fontSize: 14, color: '#9CA3AF' },
  hotHeader:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  hotTitle:                { fontSize: 16, fontWeight: '800', color: '#101828' },
  grid:                    { padding: 16 },
  gridRow:                 { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sectionHeader:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12, marginTop: 4 },
  sectionHeaderJP:         { backgroundColor: '#EEF2FF' },
  sectionHeaderEN:         { backgroundColor: '#FFF3EB' },
  sectionHeaderText:       { fontSize: 15, fontWeight: '700', color: '#101828' },
  sectionCount:            { fontSize: 12, color: '#9CA3AF' },
  card:                    { width: CARD_W, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB', flexDirection: 'column' },
  cardImage:               { width: '100%', height: CARD_W * 1.4, backgroundColor: '#F9FAFB' },
  cardImagePlaceholder:    { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  cardImagePlaceholderText:{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 8 },
  langBadge:               { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  langBadgeEN:             { backgroundColor: 'rgba(0,0,0,0.55)' },
  langBadgeJP:             { backgroundColor: 'rgba(180,0,0,0.75)' },
  langBadgeText:           { fontSize: 10, color: '#fff', fontWeight: '700' },
  liveTag:                 { position: 'absolute', top: 8, right: 8, backgroundColor: '#00A63E', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  liveTagText:             { fontSize: 9, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  cardBody:                { padding: 10, paddingBottom: 4, flex: 1 },
  cardName:                { fontSize: 13, fontWeight: '700', color: '#101828', marginBottom: 2 },
  cardSet:                 { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  cardRarity:              { fontSize: 11, color: '#3B82F6', fontWeight: '500', marginBottom: 4 },
  psaRow:                  { flexDirection: 'row', alignItems: 'center', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 6, alignSelf: 'flex-start' },
  psaRowJP:                { backgroundColor: '#FFF3E8' },
  psaRowEN:                { backgroundColor: '#F3F4F6' },
  psaRowRaw:               { backgroundColor: '#FFF7ED' },
  psaRowText:              { fontSize: 11, fontWeight: '600' },
  psaRowTextJP:            { color: '#FF6900' },
  psaRowTextEN:            { color: '#6B7280' },
  psaRowTextRaw:           { color: '#FF6900' },
  cardPrice:               { fontSize: 15, fontWeight: '800', color: '#101828', marginBottom: 4 },
  cardPriceEstimate:       { color: '#6B7280', fontSize: 13 },
  change30Row:             { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  change30Text:            { fontSize: 11, fontWeight: '700' },
  change30Up:              { color: '#00A63E' },
  change30Down:            { color: '#E7000B' },
  change30Label:           { fontSize: 10, color: '#9CA3AF' },
  merchantBtn:             { backgroundColor: '#ECFDF5', marginHorizontal: 10, marginBottom: 6, borderRadius: 8, paddingVertical: 7, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  merchantBtnText:         { fontSize: 11, fontWeight: '700', color: '#065F46' },
  addBtn:                  { backgroundColor: '#FF6900', marginHorizontal: 10, marginBottom: 10, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  addBtnAdded:             { backgroundColor: '#00A63E' },
  addBtnText:              { fontSize: 14, fontWeight: '700', color: '#fff' },
  modalOverlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  // Inside the KeyboardAvoidingView the ScrollView needs flexGrow so the card sticks to the bottom
  modalScrollContent:      { flexGrow: 1, justifyContent: 'flex-end' },
  modalCard:               { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:              { fontSize: 20, fontWeight: '800', color: '#101828', marginBottom: 4 },
  modalSub:                { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  modalJpHint:             { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  modalJpHintText:         { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  pricePreviewRow:         { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pricePreviewBox:         { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  pricePreviewBoxActive:   { backgroundColor: '#FFF3E8', borderColor: '#FF6900' },
  pricePreviewGrade:       { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 4 },
  pricePreviewGradeActive: { color: '#FF6900' },
  pricePreviewAmount:      { fontSize: 13, fontWeight: '800', color: '#101828' },
  pricePreviewAmountActive:{ color: '#FF6900' },
  liveSmall:               { fontSize: 9, color: '#00A63E', fontWeight: '800', marginTop: 2 },
  psaGrid:                 { flexDirection: 'row', gap: 12, marginBottom: 24 },
  psaGridBtn:              { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', alignItems: 'center' },
  psaGridBtnActive:        { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  psaGridText:             { fontSize: 15, color: '#6B7280', fontWeight: '500' },
  psaGridTextActive:       { color: '#fff', fontWeight: '700' },
  ebayLinkBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF', borderRadius: 12, paddingVertical: 11, marginBottom: 18, borderWidth: 1, borderColor: '#C7D2FE' },
  ebayLinkText:            { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  confirmBtn:              { backgroundColor: '#FF6900', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  confirmBtnText:          { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn:               { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText:           { fontSize: 15, color: '#9CA3AF' },
});
