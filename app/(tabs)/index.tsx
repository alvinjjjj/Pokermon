import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Header from '../../components/Header';
import { type ColorTokens } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeProvider';

const WIDTH   = Dimensions.get('window').width;
const CARD_W  = (WIDTH - 48) / 2;   // same as search grid
const PSA10_MIN_USD = 385;           // ≈ HK$3,000 at 7.8
const periods = ['1D', '7D', '1M', '3M', '6M', 'MAX'];
import { useCurrency } from '../../contexts/CurrencyContext';
import { fetchHotCards, fetchHotEnCards, getHotCacheTimestamp, getMarketMovers, pptPriceCompat, PPTCard } from '../../lib/pokeprice';
import { fetchLowestPrices, LowestListing } from '../../lib/lowestPrices';
import { fetchHiresJPImages } from '../../lib/jpImages';

type CertifiedMerchant = {
  id: string;
  shop_name_zh: string | null;
  shop_name_en: string | null;
  display_name: string;
  logo_url: string | null;
  district: string | null;
  has_physical_store: boolean;
};

type MarketCard = {
  id: string;
  name: string;
  set: { id: string; name: string; series?: string };
  rarity?: string;
  images: { small: string; large?: string };
  cardmarket?: { prices?: { averageSellPrice?: number; avg30?: number; avg7?: number } };
  tcgplayer?: { prices?: { holofoil?: { market?: number }; normal?: { market?: number } } };
  _jtcgPrice?: { market: number; low: number; high: number; psa9: number; psa10: number } | null;
  _pptCard?:  PPTCard | null;   // full PPT card (for change7d, history, etc.)
  _lang?: 'EN' | 'JP';
  _hkPrice?: number;   // HK 平台均價（HKD），來自 hk_market_prices
  _hkLowest?: number;  // HK 平台最低價（HKD）
};

// 把小時數字轉成 am/pm label
function hourToLabel(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// 1D 只顯示這些小時的 label（每 3 小時一格：12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm）
const SHOW_HOURS_1D = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

/**
 * Build a portfolio-value-over-time series for the chart on the home screen.
 *
 * For every period we:
 *   1. Generate a fixed timeline of N buckets (so the X-axis always has
 *      the right span, even if the user has no activity inside it).
 *   2. Compute the starting value as the cumulative value of cards added
 *      BEFORE the window opens.
 *   3. For each bucket, add the value of cards added inside that bucket
 *      and emit the running cumulative total.
 *
 * Previously this fn just iterated all cards and built keys by weekday or
 * "M/D" — which meant 1M and 3M produced identical output (same M/D keys)
 * and 7D collapsed multiple weeks onto the same weekday slot.
 */
function groupByPeriod(cards: any[], period: string) {
  if (!cards.length) return [];

  const valueOf = (c: any) => (c.current_price || 0) * (c.quantity || 1);
  const now = new Date();
  type Bucket = { label: string; hour: number; start: Date; end: Date };

  // ── 1D: 24 hourly buckets ending at the current hour ────────────────────
  if (period === '1D') {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const buckets: Bucket[] = Array.from({ length: 24 }, (_, h) => {
      const start = new Date(startOfDay); start.setHours(h, 0, 0, 0);
      const end   = new Date(startOfDay); end.setHours(h + 1, 0, 0, 0);
      return { label: hourToLabel(h), hour: h, start, end };
    });
    return cumulativeOverBuckets(cards, buckets, valueOf, startOfDay);
  }

  // ── 7D: 7 daily buckets ending today ────────────────────────────────────
  if (period === '7D') {
    const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const buckets: Bucket[] = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (6 - i));
      const end   = new Date(start); end.setDate(end.getDate() + 1);
      return { label: dayLabels[start.getDay()], hour: -1, start, end };
    });
    return cumulativeOverBuckets(cards, buckets, valueOf, buckets[0].start);
  }

  // ── 1M: 30 daily buckets ────────────────────────────────────────────────
  if (period === '1M') {
    const buckets: Bucket[] = Array.from({ length: 30 }, (_, i) => {
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (29 - i));
      const end   = new Date(start); end.setDate(end.getDate() + 1);
      // Show date label every 7 buckets so axis is readable
      const label = i % 7 === 0 || i === 29 ? `${start.getMonth() + 1}/${start.getDate()}` : '';
      return { label, hour: -1, start, end };
    });
    return cumulativeOverBuckets(cards, buckets, valueOf, buckets[0].start);
  }

  // ── 3M: 13 weekly buckets ───────────────────────────────────────────────
  if (period === '3M') {
    const buckets: Bucket[] = Array.from({ length: 13 }, (_, i) => {
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (12 - i) * 7);
      const end   = new Date(start); end.setDate(end.getDate() + 7);
      const label = i % 4 === 0 || i === 12 ? `${start.getMonth() + 1}/${start.getDate()}` : '';
      return { label, hour: -1, start, end };
    });
    return cumulativeOverBuckets(cards, buckets, valueOf, buckets[0].start);
  }

  // ── 6M: 6 monthly buckets ending in the current month ───────────────────
  if (period === '6M') {
    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const buckets: Bucket[] = Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      return { label: monthLabels[start.getMonth()], hour: -1, start, end };
    });
    return cumulativeOverBuckets(cards, buckets, valueOf, buckets[0].start);
  }

  // ── MAX: 12 monthly buckets ending in the current month ─────────────────
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const buckets: Bucket[] = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - (11 - i) + 1, 1);
    return { label: monthLabels[start.getMonth()], hour: -1, start, end };
  });
  return cumulativeOverBuckets(cards, buckets, valueOf, buckets[0].start);
}

/** Helper: bucket cards by added_at into the supplied timeline and emit cumulative totals. */
function cumulativeOverBuckets(
  cards: any[],
  buckets: { label: string; hour: number; start: Date; end: Date }[],
  valueOf: (c: any) => number,
  windowStart: Date,
): { label: string; hour: number; value: number }[] {
  // Starting balance = value of cards added BEFORE the window opens.
  let cumulative = 0;
  for (const card of cards) {
    const t = new Date(card.added_at);
    if (t < windowStart) cumulative += valueOf(card);
  }
  return buckets.map(b => {
    for (const card of cards) {
      const t = new Date(card.added_at);
      if (t >= b.start && t < b.end) cumulative += valueOf(card);
    }
    return { label: b.label, hour: b.hour, value: cumulative };
  });
}

function getCardPrice(card: MarketCard): number {
  return card.cardmarket?.prices?.averageSellPrice ||
    card.tcgplayer?.prices?.holofoil?.market ||
    card.tcgplayer?.prices?.normal?.market ||
    0;
}

// JP image enrichment moved to lib/jpImages.ts (shared with search.tsx + portfolio.tsx)

/** Convert a PPTCard into the MarketCard shape used on the home screen */
function pptCardToMarket(c: PPTCard): MarketCard {
  return {
    id:     `ppt_${c.tcgPlayerId || c.name.replace(/\s+/g, '_')}`,
    name:   c.name,
    set:    { id: '', name: c.setName, series: c.language === 'japanese' ? 'Japanese' : undefined },
    images: { small: c.imageLarge || c.image || '', large: c.image || '' },
    _jtcgPrice: pptPriceCompat(c),
    _pptCard:   c,
    _lang: c.language === 'japanese' ? 'JP' : 'EN',
  };
}

function MiniChart({
  chartData, is1D, convert, symbol,
}: {
  chartData: { label: string; hour: number; value: number }[];
  is1D: boolean;
  convert: (usd: number) => string;
  symbol: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const w = WIDTH - 24;
  const h = 200;
  const padL = 24;
  const padR = 24;
  const padT = 24;
  const padB = 24;

  const maxVal = Math.max(...chartData.map(d => d.value));
  const chartMax = Math.ceil(maxVal / 1000) * 1000 || 1000;
  const yLabels = [chartMax, chartMax * 0.5, 0];

  const getY = (val: number) => padT + (1 - val / chartMax) * (h - padT - padB);
  const getX = (i: number) => chartData.length === 1
    ? padL + (w - padL - padR) / 2
    : padL + (i / (chartData.length - 1)) * (w - padL - padR);

  const pts = chartData.map((d, i) => ({ x: getX(i), y: getY(d.value) }));

  // Keep a ref to the latest pts so the PanResponder closure never goes stale
  const ptsRef = useRef(pts);
  ptsRef.current = pts;

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = pts.length > 1
    ? `${linePath} L ${pts[pts.length-1].x} ${h - padB} L ${pts[0].x} ${h - padB} Z`
    : '';

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => findNearest(e.nativeEvent.locationX),
    onPanResponderMove: (e) => findNearest(e.nativeEvent.locationX),
    onPanResponderRelease: () => setHoverIdx(null),
  })).current;

  const findNearest = (x: number) => {
    let nearest = 0, minDist = Infinity;
    // Use ptsRef.current so we always read the latest pts, never stale
    ptsRef.current.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hovered     = hoverIdx !== null ? pts[hoverIdx]      : null;
  const hoveredData = hoverIdx !== null ? chartData[hoverIdx] : null;
  const tooltipW    = 120;
  const tooltipX    = hovered ? Math.min(Math.max(hovered.x - tooltipW / 2, padL), w - tooltipW - padR) : 0;
  const tooltipY    = hovered ? Math.max(hovered.y - 55, 4) : 0;

  const shouldShowLabel = (d: { label: string; hour: number }, idx: number, total: number): boolean => {
    if (is1D) return SHOW_HOURS_1D.has(d.hour);
    if (total <= 7) return true;
    if (total <= 12) return idx % 2 === 0;
    return idx % Math.ceil(total / 6) === 0 || idx === total - 1;
  };

  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }} {...panResponder.panHandlers}>
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand.orange} stopOpacity="0.2" />
            <Stop offset="1" stopColor={colors.brand.orange} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yLabels.map((val, i) => (
          <Line key={i} x1={padL} y1={getY(val)} x2={w - padR} y2={getY(val)} stroke={colors.border.default} strokeWidth="1" />
        ))}
        {yLabels.map((val, i) => (
          <SvgText key={i} x={padL - 6} y={getY(val) + 4} fontSize="9" fill={colors.text.tertiary} textAnchor="end">
            {val >= 1000 ? `${symbol}${(val/1000).toFixed(0)}k` : `${symbol}${val}`}
          </SvgText>
        ))}

        {chartData.map((d, i) => (
          shouldShowLabel(d, i, chartData.length) ? (
            <SvgText key={i} x={getX(i)} y={h - 6} fontSize="9" fill={colors.text.tertiary} textAnchor="middle">
              {d.label}
            </SvgText>
          ) : null
        ))}

        {areaPath ? <Path d={areaPath} fill="url(#grad)" /> : null}
        <Path d={linePath} stroke={colors.text.primary} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 0} fill={colors.surface.base} stroke={colors.brand.orange} strokeWidth="2" />
        ))}
        {hovered && (
          <Line x1={hovered.x} y1={padT} x2={hovered.x} y2={h - padB} stroke={colors.brand.orange} strokeWidth="1" strokeDasharray="4,3" />
        )}
      </Svg>

      {hovered && hoveredData && (
        <View style={{
          position: 'absolute', left: tooltipX, top: tooltipY,
          width: tooltipW, backgroundColor: colors.surface.elevated, borderRadius: 10,
          paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 }, elevation: 5,
          borderWidth: 0.5, borderColor: colors.border.default,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.primary }}>
            {convert(hoveredData.value)}
          </Text>
          <Text style={{ fontSize: 9, color: colors.text.tertiary, marginTop: 1 }}>
            {hoveredData.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { convert, currency, rate, symbol } = useCurrency();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [period, setPeriod] = useState('1D');
  const [cards, setCards] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ label: string; hour: number; value: number }[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [valueChange, setValueChange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [portfolioName, setPortfolioName] = useState<string>('Main');
  const [topCards, setTopCards] = useState<MarketCard[]>([]);
  const [hotCards, setHotCards] = useState<MarketCard[]>([]);
  const [hotEnCards, setHotEnCards] = useState<MarketCard[]>([]);
  // Freshness chip below 「今日熱門（日版）」title. `fetched_at` is read from
  // Supabase card_price_cache row keyed by current HOT_CACHE_KEY (v9). Re-read
  // on every Home tab focus so the relative-time string stays honest across
  // app sessions even when the JS bundle is still warm.
  const [hotFreshness, setHotFreshness] = useState<Date | null>(null);
  const [showPSAModal, setShowPSAModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MarketCard | null>(null);
  const [selectedPSA, setSelectedPSA] = useState('10');
  const [adding, setAdding] = useState(false);
  const [customPrice, setCustomPrice] = useState('');
  const [addedCards, setAddedCards]             = useState<Set<string>>(new Set());
  // Maps card_id → collection row id (for deletion)
  const [collectionRowIds, setCollectionRowIds] = useState<Record<string, string>>({});
  const [lowestPrices, setLowestPrices]         = useState<Record<string, LowestListing>>({});
  const [certifiedMerchants, setCertifiedMerchants] = useState<CertifiedMerchant[]>([]);
  const [merchantsLoaded, setMerchantsLoaded]   = useState(false);
  const [marketLoaded, setMarketLoaded]         = useState(false);
  const [marketError, setMarketError]           = useState(false);
  const [portfolioError, setPortfolioError]     = useState(false);
  const didLoadMarket                           = useRef(false);
  const router = useRouter();

  useFocusEffect(useCallback(() => { fetchPortfolio(); fetchCertifiedMerchants(); }, []));
  useFocusEffect(useCallback(() => {
    if (!didLoadMarket.current) { didLoadMarket.current = true; fetchMarketCards(); }
  }, []));
  useFocusEffect(useCallback(() => {
    if (cards.length) setChartData(groupByPeriod(cards, period));
  }, [period, cards]));

  // Read the JP HOT cache's fetched_at on mount for the freshness chip.
  // Cheap one-shot Supabase read; the row is created by fetchHotCards. If
  // the row doesn't exist yet (first ever launch), the chip simply hides.
  useEffect(() => {
    getHotCacheTimestamp('jp').then(setHotFreshness);
  }, []);

  // Format a Date as a relative-time string in Chinese, e.g. "3 小時前".
  // Sub-minute → 「啱啱」, sub-hour → minutes, sub-day → hours, else days.
  const formatRelative = (date: Date): string => {
    const ms = Date.now() - date.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return '啱啱';
    if (mins < 60) return `${mins} 分鐘前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} 小時前`;
    return `${Math.floor(hrs / 24)} 日前`;
  };

  const fetchPortfolio = async () => {
    setLoading(true);
    setPortfolioError(false);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { setLoading(false); return; }

      const [collectionRes, profileRes] = await Promise.all([
        supabase.from('user_collection').select('*').eq('user_id', user.id).order('added_at', { ascending: true }),
        supabase.from('profiles').select('portfolio_name').eq('id', user.id).single(),
      ]);

      if (profileRes.data?.portfolio_name) {
        setPortfolioName(profileRes.data.portfolio_name);
      }

      const { data, error } = collectionRes;
      if (error) { setPortfolioError(true); }
      else if (data) {
        setCards(data);
        const total = data.reduce((sum, c) => sum + ((c.current_price ?? 0) * (c.quantity ?? 1)), 0);
        const costBasis = data.reduce((sum, c) => sum + ((c.purchase_price ?? 0) * (c.quantity ?? 1)), 0);
        setTotalValue(total);
        setValueChange(total - costBasis);
        setChartData(groupByPeriod(data, period));
        // Sync addedCards from actual DB state (handles cross-tab deletions)
        setAddedCards(new Set(data.map((c: any) => c.card_id).filter(Boolean)));
        // Map card_id → collection row id for deletion
        const rowMap: Record<string, string> = {};
        data.forEach((c: any) => { if (c.card_id && c.id) rowMap[c.card_id] = c.id; });
        setCollectionRowIds(rowMap);
      }
    } catch {
      setPortfolioError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchCertifiedMerchants = async () => {
    try {
      const { data } = await supabase
        .from('merchant_profiles')
        .select('id, shop_name_zh, shop_name_en, display_name, logo_url, district, has_physical_store')
        .eq('seller_type', 'certified_merchant')
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (data) setCertifiedMerchants(data as CertifiedMerchant[]);
    } finally {
      setMerchantsLoaded(true);
    }
  };

  const fetchMarketCards = async () => {
    try {
      // ── Step 1: PPT — 30 JP 熱門卡 ───────────────────────────────────────
      const pptCards = await fetchHotCards(30).catch(() => [] as PPTCard[]);

      // ── Step 2: TCGdex hi-res images (600×825px) ──────────────────────────
      // Uses card number in PPT name for precise lookup, e.g. "Pikachu - 175/XY-P"
      // Falls back to 400x400 TCGPlayer CDN (already set in imageLarge by pokeprice.ts)
      const hiresMap = await fetchHiresJPImages(pptCards.map(c => ({ name: c.name, setName: c.setName })));
      const pptEnriched = pptCards.map(c =>
        hiresMap[c.name] ? { ...c, imageLarge: hiresMap[c.name] } : c
      );
      // Reliable image sources: artofpkm, TCGdex, TCGPlayer CDN 400x400, pokemontcg.io hires.
      // Anything else (raw PPT JP thumbnail URLs) may fail to load → treat as no-image.
      // tcgplayer-cdn.tcgplayer.com is excluded — returns 403 when hotlinked from React Native
      const hasReliableImage = (url: string) =>
        url.includes('artofpkm.com') ||
        url.includes('tcgdex.net') ||
        url.includes('images.pokemontcg.io');

      // Only show cards with a confirmed loadable image
      const allPPT: MarketCard[] = pptEnriched
        .filter(c => hasReliableImage(c.imageLarge || c.image || ''))
        .map(pptCardToMarket);

      // ── Step 3: 最有價值 = 按 PSA 10 / market 現價排序 ──────────────────
      // allPPT already has reliable-image-only cards, so topCards inherits the filter.
      // Result: promo cards + popular Pokémon (artofpkm/TCGdex) + any EN card with
      // TCGPlayer/pokemontcg.io image. Trainer cards and obscure JP cards are excluded.
      const topCards: MarketCard[] = [...allPPT]
        .sort((a, b) => (b._jtcgPrice?.psa10 ?? b._jtcgPrice?.market ?? 0)
                      - (a._jtcgPrice?.psa10 ?? a._jtcgPrice?.market ?? 0))
        .slice(0, 10);

      // ── Step 4: 今日熱門 = eBay 週成交量最高 ─────────────────────────────
      const movers = getMarketMovers(
        pptEnriched.filter(c => hasReliableImage(c.imageLarge || c.image || '')),
        10
      );
      const hotCards: MarketCard[] = movers.map(pptCardToMarket);

      // ── Step 5: 今日熱門 EN ─────────────────────────────────────────────────
      // pokemontcg.io = reliable images (images.pokemontcg.io CDN, never 403)
      // PPT = real eBay PSA10 prices for ordering and display
      // Merged by card name → pokemontcg.io image + PPT price
      let hotEnCards: MarketCard[] = [];
      try {
        const [pokeIoRes, pptEn] = await Promise.all([
          fetch(
            'https://api.pokemontcg.io/v2/cards?q=set.series%3A%22Scarlet%20%26%20Violet%22&orderBy=-cardmarket.prices.averageSellPrice&select=id,name,number,rarity,set,images,cardmarket,tcgplayer&pageSize=30'
          ).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
          fetchHotEnCards(30),
        ]);

        // PPT price map: name (lowercase) → PPTCard
        const pptEnMap = new Map<string, PPTCard>(pptEn.map(c => [c.name.toLowerCase(), c]));

        hotEnCards = ((pokeIoRes.data ?? []) as any[])
          .map((c: any): MarketCard => {
            const ppt = pptEnMap.get(c.name.toLowerCase());
            return {
              id:         c.id,
              name:       c.name,
              set:        { id: c.set?.id || '', name: c.set?.name || '', series: c.set?.series },
              rarity:     c.rarity,
              images:     { small: c.images?.small || '', large: c.images?.large || '' },
              cardmarket: c.cardmarket,
              tcgplayer:  c.tcgplayer,
              _lang:      'EN',
              _jtcgPrice: ppt ? pptPriceCompat(ppt) : null,
              _pptCard:   ppt ?? null,
            };
          })
          .filter((c: MarketCard) => {
            // Only show if PSA10 estimate ≥ HK$3,000 (~$385 USD)
            const psa10 = c._jtcgPrice?.psa10 ?? 0;
            const mkt   = c._jtcgPrice?.market ?? getCardPrice(c);
            const est   = psa10 > 0 ? psa10 : mkt * 3;
            return est >= PSA10_MIN_USD;
          })
          .sort((a: MarketCard, b: MarketCard) => {
            const aV = (a._jtcgPrice?.psa10 ?? 0) > 0 ? a._jtcgPrice!.psa10 : (a._jtcgPrice?.market ?? getCardPrice(a)) * 3;
            const bV = (b._jtcgPrice?.psa10 ?? 0) > 0 ? b._jtcgPrice!.psa10 : (b._jtcgPrice?.market ?? getCardPrice(b)) * 3;
            return bV - aV;
          })
          .slice(0, 10);
      } catch (e) {
        if (__DEV__) console.warn('[Home] EN hot fetch failed:', e);
      }

      // ── Step 6: HK 平台最低價（Supabase listings）──────────────────────
      const allIds = [...topCards, ...hotCards, ...hotEnCards].map(c => c.id).filter(Boolean);
      if (allIds.length) fetchLowestPrices(allIds).then(setLowestPrices);

      setTopCards(topCards);
      setHotCards(hotCards);
      setHotEnCards(hotEnCards);
      if (__DEV__) console.log(`[Home] PPT: ${pptCards.length} cards, movers: ${movers.length}, hotEN: ${hotEnCards.length}`);

    } catch (e) {
      if (__DEV__) console.error('fetchMarketCards:', e);
      setMarketError(true);
    } finally {
      setMarketLoaded(true);
    }
  };

  /**
   * 主頁熱門卡的 PSA 取價。
   * PPT psa10/psa9 數據先經過 sanity check（psa10 ≥ raw × 1.5），
   * 通不過就 fallback 到 Raw × multiplier 估算 — PPT API 有時會把低成交或
   * Raw 價誤標為 psa10（例如 Giratina V Lost Abyss）。
   */
  const getPSAPrice = (card: MarketCard, grade: string): number => {
    // HK 平台真實數據優先（已是 HKD，除以匯率轉 USD 作統一比較）
    if (card._hkPrice && card._hkPrice > 0) {
      const hkUsd = card._hkPrice / 7.8;
      if (grade === 'Raw') return hkUsd;
      if (grade === '10')  return hkUsd; // 商家通常標明 PSA 等級，直接用均價
      if (grade === '9')   return hkUsd * 0.7;
      return hkUsd;
    }
    const isJp = card._lang === 'JP';
    const jtcg = card._jtcgPrice;
    const raw  = getCardPrice(card);
    const base = raw > 0 ? raw : (isJp && jtcg?.market ? jtcg.market : 0);

    // Sanity check：擋住 PPT 髒數據
    const psa10ok = (jtcg?.psa10 ?? 0) > 0 && (base <= 0 || jtcg!.psa10 >= base * 1.5);
    const psa9ok  = (jtcg?.psa9  ?? 0) > 0 && (base <= 0 || jtcg!.psa9  >= base * 1.2);

    if (grade === '10') {
      if (psa10ok) return jtcg!.psa10;
      return base > 0 ? base * (isJp ? 3 : 4) : 0;
    }
    if (grade === '9') {
      if (psa9ok) return jtcg!.psa9;
      return base > 0 ? base * (isJp ? 1.5 : 1.8) : 0;
    }
    // Raw
    if (jtcg?.market && jtcg.market > 0) return jtcg.market;
    return raw;
  };

  const openAddModal = (card: MarketCard) => {
    setSelectedCard(card);
    setSelectedPSA(card._lang === 'JP' ? '10' : 'Raw');
    setCustomPrice('');
    setShowPSAModal(true);
    // PPT data already loaded via fetchHotCards (includes PSA 9/10 + history).
    // No extra API call needed — _jtcgPrice is already populated from pptPriceCompat.
  };

  const removeCard = (card: MarketCard) => {
    Alert.alert(
      t('home.removeTitle'),
      t('home.removeMsg', { name: card.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('home.removeConfirm'),
          style: 'destructive',
          onPress: async () => {
            const rowId = collectionRowIds[card.id];
            if (!rowId) return;
            const { error } = await supabase.from('user_collection').delete().eq('id', rowId);
            if (!error) {
              setAddedCards(prev => { const s = new Set(prev); s.delete(card.id); return s; });
              setCollectionRowIds(prev => { const m = { ...prev }; delete m[card.id]; return m; });
            }
          },
        },
      ]
    );
  };

  const confirmAdd = async () => {
    if (!selectedCard) return;
    setAdding(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { Alert.alert(t('home.loginFirst')); return; }
      const parsedCustom = parseFloat(customPrice);
      // User enters price in selected currency (e.g. HKD), convert back to USD for storage
      const usd = (!isNaN(parsedCustom) && parsedCustom > 0)
        ? parsedCustom / rate
        : getPSAPrice(selectedCard, selectedPSA);
      const { error } = await supabase.from('user_collection').insert({
        user_id:        user.id,
        card_id:        selectedCard.id,
        card_name:      selectedCard.name,
        set_name:       selectedCard.set.name,
        purchase_price: usd,
        current_price:  usd,
        quantity:       1,
        psa_grade:      selectedPSA,
        image_url:      selectedCard.images.small,
      });
      if (!error) {
        setAddedCards(prev => new Set([...prev, selectedCard.id]));
        setShowPSAModal(false);
        setCustomPrice('');
        Alert.alert(t('home.addedTitle'), t('home.addedMsg', { name: selectedCard.name, grade: selectedPSA === 'Raw' ? 'Raw' : `PSA ${selectedPSA}` }));
      } else {
        Alert.alert(t('home.addFailed'), error.message);
      }
    } finally { setAdding(false); }
  };

  // ── Card renderer ────────────────────────────────────────────────────────────
  const renderHomeCard = (card: MarketCard & { _changeP?: number }) => {
    const isJP      = card._lang === 'JP';
    const hasLive   = isJP && !!card._jtcgPrice && (card._jtcgPrice.psa10 > 0);
    const isAdded   = addedCards.has(card.id);

    // PSA 10 價格：永遠顯示 PSA 10（真實價優先；否則 Raw × multiplier 估算）
    // 跟 card/[id].tsx + search.tsx 同一套邏輯 — 三個地方數字才會一致。
    const ppt       = card._pptCard;
    const jtcg      = card._jtcgPrice;
    const marketUsd = (jtcg?.market ?? 0) > 0 ? jtcg!.market : getCardPrice(card);
    const psa10Raw  = jtcg?.psa10 ?? 0;
    // Sanity check: PPT 有時把 market 誤標為 psa10。真 PSA 10 至少 ≥ Raw × 1.5。
    const psa10Credible = psa10Raw > 0 && (marketUsd <= 0 || psa10Raw >= marketUsd * 1.5);
    const psa10Real = psa10Credible ? psa10Raw : 0;
    // 沒真 PSA10 → 估算：JP × 3 / EN × 4 (對齊 detail / search 兩邊)
    const psa10Usd  = psa10Real > 0 ? psa10Real : marketUsd * (isJP ? 3 : 4);
    const isLive    = psa10Real > 0;  // green LIVE badge 只在真 PPT psa10 時亮
    const isEstimate = !isLive && psa10Usd > 0;
    const priceStr  = psa10Usd > 0
      ? `${isEstimate ? '≈ ' : ''}${convert(psa10Usd)}`
      : '-';

    // 30-day % change. Two data sources:
    //   1. PPT card → real history-based change30d (use whenever PPT has ANY
    //      history data, even if calc returns 0% — a flat market is still
    //      informative; we hide only when truly no data points exist)
    //   2. EN card (no PPT) → cardmarket.avg30 vs current
    let changeP: number | null = null;
    if (ppt && ppt.price.history.length > 0) {
      changeP = ppt.price.change30d;
    } else if (card.cardmarket?.prices?.avg30 && card.cardmarket.prices.avg30 > 0 && psa10Usd > 0) {
      const ref = psa10Real > 0 ? psa10Real : marketUsd;
      const avg30 = card.cardmarket.prices.avg30;
      if (ref > 0 && avg30 > 0) {
        changeP = ((ref - avg30) / avg30) * 100;
      }
    }

    const goDetail = () => {
      if (isJP) {
        router.push({
          pathname: '/(tabs)/card/[id]',
          params: {
            id: card.id,
            jp_name:   card.name,
            jp_image:  card.images.small,
            jp_set:    card.set.name,
            jp_number: card._pptCard?.number ?? '',
            jp_psa10:  String(card._jtcgPrice?.psa10  ?? 0),
            jp_psa9:   String(card._jtcgPrice?.psa9   ?? 0),
            jp_market: String(card._jtcgPrice?.market ?? 0),
          },
        } as any);
      } else {
        router.push({ pathname: '/(tabs)/card/[id]', params: { id: card.id } } as any);
      }
    };

    return (
      <View key={card.id} style={styles.card}>
        {/* Image section */}
        <TouchableOpacity onPress={goDetail} activeOpacity={0.85}>
          <ExpoImage
            source={{ uri: card.images.small || card.images.large }}
            style={styles.cardImage}
            contentFit="contain"
            transition={150}
            recyclingKey={card.id}
            onError={e => __DEV__ && console.warn('[IMG ERR]', card.name, (card.images.small||'').slice(0,80), e.error)}
            onLoad={__DEV__ ? () => console.log('[IMG OK]', card.name) : undefined}
          />
          <View style={[styles.langBadge, isJP ? styles.langBadgeJP : styles.langBadgeEN]}>
            <Text style={styles.langBadgeText}>{isJP ? '🇯🇵 JP' : '🇺🇸 US'}</Text>
          </View>
          {hasLive && (
            <View style={styles.liveTag}>
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Content section — flex:1 pushes button to bottom */}
        <View style={styles.cardContent}>
          <TouchableOpacity style={styles.cardBody} onPress={goDetail} activeOpacity={0.85}>
            <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
            <Text style={styles.cardSet}  numberOfLines={1}>{card.set.name}</Text>
            {card.rarity && <Text style={styles.cardRarity} numberOfLines={1}>{card.rarity}</Text>}
            {/* Unified PSA 10 tag — no "PPT" / "LIVE" / "≈" suffix in the label
                itself. Real vs estimated is conveyed by the green LIVE badge
                on the image + the "≈" prefix on the price. */}
            <View style={[styles.psaRow, isLive ? styles.psaRowJP : styles.psaRowRaw]}>
              <Text style={[styles.psaRowText, isLive ? styles.psaRowTextJP : styles.psaRowTextRaw]}>
                PSA 10
              </Text>
            </View>
            <Text style={styles.cardPrice}>{priceStr}</Text>
            {changeP !== null && Math.abs(changeP) > 0.5 && (
              <View style={styles.change30Row}>
                <Text style={[styles.change30Text, changeP >= 0 ? styles.change30Up : styles.change30Down]}>
                  {changeP >= 0 ? '▲' : '▼'} {Math.abs(changeP).toFixed(1)}%
                </Text>
                <Text style={styles.change30Label}> 30d</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Certified merchant lowest price */}
          {lowestPrices[card.id] && (
          <TouchableOpacity
            style={styles.merchantBtn}
            onPress={() => router.push(`/listing/${lowestPrices[card.id].listing_id}` as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.merchantBtnText}>
              {t('home.certifiedLowest', { price: lowestPrices[card.id].price.toLocaleString() })}
            </Text>
          </TouchableOpacity>
          )}

          {/* Add button — always at the bottom of cardContent */}
          <TouchableOpacity
            style={[styles.addBtn, isAdded && styles.addBtnAdded]}
            onPress={() => isAdded ? removeCard(card) : openAddModal(card)}
          >
            <Text style={styles.addBtnText}>{isAdded ? '✓' : '+'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.portfolioSection}>
          <Text style={styles.portfolioLabel}>{t('home.portfolioLabel', { name: portfolioName })}</Text>
          <Text style={styles.portfolioValue}>
            {(({ USD: 'US$', HKD: 'HK$', JPY: '¥', CNY: 'CN¥' } as Record<string,string>)[currency] ?? 'HK$')}{(totalValue * rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <Text style={[styles.portfolioChange, { color: valueChange >= 0 ? colors.state.upStrong : colors.state.down }]}>
            {valueChange >= 0 ? '+' : '-'}{(({ USD: 'US$', HKD: 'HK$', JPY: '¥', CNY: 'CN¥' } as Record<string,string>)[currency] ?? 'HK$')}{(Math.abs(valueChange) * rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {t('home.vsWhenBought')}
          </Text>
        </View>

        <View style={styles.periodRow}>
          {periods.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chartWrap}>
          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={{ color: colors.text.tertiary }}>{t('home.loadingPortfolio')}</Text>
            </View>
          ) : portfolioError ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.emptyTitle}>{t('home.loadFailed')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => fetchPortfolio()}>
                <Text style={styles.emptyBtnText}>{t('home.reload')}</Text>
              </TouchableOpacity>
            </View>
          ) : chartData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('home.noCards')}</Text>
              <Text style={styles.emptySub}>{t('home.addFirstCard')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/search')}>
                <Text style={styles.emptyBtnText}>{t('home.addCard')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MiniChart chartData={chartData} is1D={period === '1D'} convert={convert} symbol={symbol} />
          )}
        </View>

        {/* Today's Hot — JP */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.todayHotJP')}</Text>
            <Text style={styles.sectionSub}>{t('home.hotSub')}</Text>
          </View>
          {/* Freshness chip — reassures the user the rail is alive (rotation
              can look slow on thin JP-grail markets even with a healthy 6h
              cache refresh; see Fix A / Fix A-2 commits). */}
          {hotFreshness && (
            <Text style={styles.hotFreshness}>
              資料更新於 {formatRelative(hotFreshness)}
            </Text>
          )}
          {!marketLoaded ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator color={colors.brand.orange} size="small" />
              <Text style={styles.sectionLoadingText}>{t('home.loadingMarket')}</Text>
            </View>
          ) : marketError ? (
            <View style={styles.sectionError}>
              <Text style={styles.sectionErrorText}>{t('home.marketLoadFailed')}</Text>
              <TouchableOpacity style={styles.sectionRetryBtn} onPress={() => { setMarketError(false); setMarketLoaded(false); didLoadMarket.current = true; fetchMarketCards(); }}>
                <Text style={styles.sectionRetryText}>{t('home.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : hotCards.length === 0 ? (
            <View style={styles.sectionLoading}>
              <Text style={styles.sectionLoadingText}>{t('common.noData')}</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={hotCards}
              keyExtractor={c => c.id}
              renderItem={({ item }) => renderHomeCard(item)}
              contentContainerStyle={styles.cardRow}
              scrollEnabled={hotCards.length > 2}
            />
          )}
          <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)}>
            <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Hot — EN */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.todayHotEN')}</Text>
            <Text style={styles.sectionSub}>{t('home.hotSubEN')}</Text>
          </View>
          {!marketLoaded ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator color={colors.brand.orange} size="small" />
              <Text style={styles.sectionLoadingText}>{t('home.loadingMarket')}</Text>
            </View>
          ) : hotEnCards.length === 0 ? (
            <View style={styles.sectionLoading}>
              <Text style={styles.sectionLoadingText}>{t('common.noData')}</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={hotEnCards}
              keyExtractor={c => c.id}
              renderItem={({ item }) => renderHomeCard(item)}
              contentContainerStyle={styles.cardRow}
              scrollEnabled={hotEnCards.length > 2}
            />
          )}
          <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)}>
            <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {/* 收藏品 (formerly 最有價值) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.collectibles')}</Text>
            <Text style={styles.sectionSub}>{t('home.psaMinPrice')}</Text>
          </View>
          {!marketLoaded ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator color={colors.brand.orange} size="small" />
              <Text style={styles.sectionLoadingText}>{t('home.loadingMarket')}</Text>
            </View>
          ) : marketError ? (
            <View style={styles.sectionError}>
              <Text style={styles.sectionErrorText}>{t('home.marketLoadFailed')}</Text>
              <TouchableOpacity style={styles.sectionRetryBtn} onPress={() => { setMarketError(false); setMarketLoaded(false); didLoadMarket.current = true; fetchMarketCards(); }}>
                <Text style={styles.sectionRetryText}>{t('home.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : topCards.length === 0 ? (
            <View style={styles.sectionLoading}>
              <Text style={styles.sectionLoadingText}>{t('common.noData')}</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={topCards}
              keyExtractor={c => c.id}
              renderItem={({ item }) => renderHomeCard(item)}
              contentContainerStyle={styles.cardRow}
              scrollEnabled={topCards.length > 2}
            />
          )}
          <TouchableOpacity onPress={() => router.push('/(tabs)/search' as any)}>
            <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {/* Certified Stores */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>{t('home.certifiedStores')}</Text>
              <Image source={require('../../assets/icons/Certification.png')} style={{ width: 16, height: 16, resizeMode: 'contain', tintColor: colors.brand.orange }} />
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shops' as any)}>
              <Text style={styles.sectionSeeAll}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          {!merchantsLoaded ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator color={colors.brand.orange} size="small" />
              <Text style={styles.sectionLoadingText}>{t('home.loadingMarket')}</Text>
            </View>
          ) : certifiedMerchants.length === 0 ? (
            <View style={styles.sectionLoading}>
              <Text style={styles.sectionLoadingText}>{t('home.noCertifiedStores')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.merchantRow}>
              {certifiedMerchants.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.merchantCard}
                  onPress={() => router.push({ pathname: '/merchant/[id]', params: { id: m.id } } as any)}
                  activeOpacity={0.85}
                >
                  {/* Logo */}
                  {m.logo_url ? (
                    <Image source={{ uri: m.logo_url }} style={styles.merchantLogo} resizeMode="cover" />
                  ) : (
                    <View style={styles.merchantLogoPlaceholder}>
                      <Image source={require('../../assets/icons/shops.png')} style={{ width: 32, height: 32, tintColor: '#fff', resizeMode: 'contain' }} />
                    </View>
                  )}
                  {/* Verified badge */}
                  <View style={styles.verifiedBadge}>
                    <Image source={require('../../assets/icons/Certification.png')} style={{ width: 14, height: 14, resizeMode: 'contain', tintColor: colors.brand.orange }} />
                  </View>
                  <Text style={styles.merchantName} numberOfLines={1}>
                    {m.shop_name_zh ?? m.display_name}
                  </Text>
                  {m.district ? (
                    <Text style={styles.merchantDistrict} numberOfLines={1}>{m.district}</Text>
                  ) : m.has_physical_store ? (
                    <Text style={styles.merchantDistrict}>{t('home.physicalStore')}</Text>
                  ) : (
                    <Text style={styles.merchantDistrict}>{t('home.onlineStore')}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* PSA Add Modal */}
      <Modal
        visible={showPSAModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPSAModal(false)}
      >
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
              <Text style={styles.modalTitle}>{t('home.selectPSAGrade')}</Text>
            <Text style={styles.modalSub}>{selectedCard?.name}</Text>

            <View style={styles.previewRow}>
              {(['Raw', '9', '10'] as const).map(g => {
                const usd = selectedCard ? getPSAPrice(selectedCard, g) : 0;
                const active = selectedPSA === g;
                return (
                  <View key={g} style={[styles.previewBox, active && styles.previewBoxActive]}>
                    <Text style={[styles.previewGrade, active && styles.previewGradeActive]}>
                      {g === 'Raw' ? 'Raw' : `PSA ${g}`}
                    </Text>
                    <Text style={[styles.previewAmount, active && styles.previewAmountActive]}>
                      {usd > 0 ? convert(usd) : '-'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.psaGrid}>
              {(['Raw', '9', '10'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.psaGridBtn, selectedPSA === g && styles.psaGridBtnActive]}
                  onPress={() => setSelectedPSA(g)}
                >
                  <Text style={[styles.psaGridText, selectedPSA === g && styles.psaGridTextActive]}>
                    {g === 'Raw' ? 'Raw' : `PSA ${g}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom price input */}
            <View style={styles.customPriceWrap}>
              <Text style={styles.customPriceLabel}>{t('home.customPriceLabel', { currency })}</Text>
              <Text style={styles.customPriceHint}>{t('home.customPriceHint')}</Text>
              <TextInput
                style={styles.customPriceInput}
                placeholder={t('home.customPricePlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
                value={customPrice}
                onChangeText={setCustomPrice}
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

            <TouchableOpacity
              style={[styles.confirmBtn, adding && { opacity: 0.7 }]}
              onPress={confirmAdd}
              disabled={adding}
            >
              {adding ? <Text style={styles.confirmText}>{t('home.adding')}</Text> : <Text style={styles.confirmText}>{t('home.confirmAdd')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPSAModal(false); setCustomPrice(''); }}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.section },
    scroll: { flex: 1 },
    portfolioSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2, backgroundColor: colors.surface.card },
    portfolioLabel: { fontSize: 13, color: colors.text.secondary, marginBottom: 2 },
    portfolioValue: { fontSize: 34, fontWeight: '700', color: colors.text.primary },
    portfolioChange: { fontSize: 12, color: colors.text.primary, marginTop: 2, marginBottom: 8 },
    // Vol.03 §2 D1 period selector: 2px Card Orange underline on active, Ink text both states.
    periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface.card, justifyContent: 'space-between' },
    periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 5, marginHorizontal: 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    periodActive: { borderBottomColor: colors.brand.orange },
    periodText: { fontSize: 12, color: colors.text.primary },
    periodTextActive: { fontWeight: '600' },
    chartWrap: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 6, backgroundColor: colors.surface.card, alignItems: 'center' },
    emptyWrap: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyEmoji: { fontSize: 44 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    emptySub: { fontSize: 13, color: colors.text.tertiary },
    emptyBtn: { backgroundColor: colors.brand.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11, marginTop: 4 },
    emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.inverse },
    section:             { paddingTop: 14, paddingBottom: 4, backgroundColor: colors.surface.card, marginTop: 6 },
    sectionHeader:       { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
    sectionTitle:        { fontSize: 17, fontWeight: '800', color: colors.text.primary },
    sectionSub:          { fontSize: 11, color: colors.text.tertiary },
    hotFreshness:        { fontSize: 11, color: colors.text.tertiary, paddingHorizontal: 16, marginBottom: 8, marginTop: -4, letterSpacing: 0.3 },
    sectionLoading:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 20 },
    sectionLoadingText:  { fontSize: 13, color: colors.text.tertiary },
    cardRow:             { paddingHorizontal: 16, gap: 12, paddingBottom: 4, alignItems: 'stretch' },
    // Search-style card
    card:                { width: CARD_W, backgroundColor: colors.surface.card, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border.default, flexDirection: 'column' },
    cardContent:         { flex: 1, flexDirection: 'column', justifyContent: 'space-between' },
    cardImage:           { width: '100%', height: CARD_W * 1.4, backgroundColor: colors.surface.section },
    langBadge:           { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    langBadgeEN:         { backgroundColor: 'rgba(0,0,0,0.55)' },
    langBadgeJP:         { backgroundColor: 'rgba(180,0,0,0.75)' },
    langBadgeText:       { fontSize: 10, color: '#fff', fontWeight: '700' },
    // liveTag stays raw (#00A63E success-bright) — semantic LIVE indicator, intentionally bright across modes
    liveTag:             { position: 'absolute', top: 8, right: 8, backgroundColor: '#00A63E', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    liveTagText:         { fontSize: 9, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
    cardBody:            { flex: 1, padding: 10, paddingBottom: 4 },
    cardName:            { fontSize: 13, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
    cardSet:             { fontSize: 11, color: colors.text.secondary, marginBottom: 2 },
    cardRarity:          { fontSize: 11, color: colors.state.info, fontWeight: '500', marginBottom: 4 },
    psaRow:              { flexDirection: 'row', alignItems: 'center', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 6, alignSelf: 'flex-start' },
    psaRowJP:            { backgroundColor: colors.brand.peach },
    psaRowRaw:           { backgroundColor: colors.surface.section },
    psaRowText:          { fontSize: 11, fontWeight: '600' },
    psaRowTextJP:        { color: colors.brand.orange },
    psaRowTextRaw:       { color: colors.text.secondary },
    cardPrice:           { fontSize: 15, fontWeight: '800', color: colors.text.primary, marginBottom: 4 },
    change30Row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    change30Text:        { fontSize: 11, fontWeight: '700' },
    // Vol.03 D2 body +/- %: Sage Strong / Brick (replace iOS green / pure red)
    change30Up:          { color: colors.state.upStrong },
    change30Down:        { color: colors.state.down },
    change30Label:       { fontSize: 10, color: colors.text.tertiary },
    // merchantBtn green-tint (certified lowest) — kept raw hex for now;
    // dedicated semantic 'success tint bg' token not defined yet (Phase 4+ polish)
    merchantBtn:         { backgroundColor: '#ECFDF5', marginHorizontal: 10, marginBottom: 6, borderRadius: 8, paddingVertical: 7, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
    merchantBtnText:     { fontSize: 11, fontWeight: '700', color: '#065F46' },
    addBtn:              { backgroundColor: colors.brand.orange, marginHorizontal: 10, marginBottom: 10, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    addBtnAdded:         { backgroundColor: colors.state.upStrong },
    addBtnText:          { fontSize: 14, fontWeight: '700', color: colors.text.inverse },
    viewAll:             { color: colors.brand.orange, fontSize: 13, fontWeight: '500', textAlign: 'center', paddingVertical: 12, marginHorizontal: 16 },
    modalOverlay:       { flex: 1, backgroundColor: colors.overlay.medium, justifyContent: 'flex-end' },
    modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
    modalCard:          { backgroundColor: colors.surface.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle:         { fontSize: 20, fontWeight: '800', color: colors.text.primary, marginBottom: 4 },
    modalSub:           { fontSize: 14, color: colors.text.secondary, marginBottom: 16 },
    previewRow:         { flexDirection: 'row', gap: 8, marginBottom: 20 },
    previewBox:         { flex: 1, backgroundColor: colors.surface.section, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border.default },
    previewBoxActive:   { backgroundColor: colors.brand.peach, borderColor: colors.brand.orange },
    previewGrade:       { fontSize: 11, color: colors.text.tertiary, fontWeight: '600', marginBottom: 4 },
    previewGradeActive: { color: colors.brand.orange },
    previewAmount:      { fontSize: 13, fontWeight: '800', color: colors.text.primary },
    previewAmountActive:{ color: colors.brand.orange },
    psaGrid:            { flexDirection: 'row', gap: 12, marginBottom: 24 },
    psaGridBtn:         { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: colors.surface.section, alignItems: 'center' },
    psaGridBtnActive:   { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    psaGridText:        { fontSize: 15, color: colors.text.secondary, fontWeight: '500' },
    psaGridTextActive:  { color: colors.text.inverse, fontWeight: '700' },
    confirmBtn:         { backgroundColor: colors.brand.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
    confirmText:        { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
    cancelBtn:          { alignItems: 'center', paddingVertical: 12 },
    cancelText:         { fontSize: 15, color: colors.text.tertiary },
    customPriceWrap:    { backgroundColor: colors.surface.section, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border.default },
    customPriceLabel:   { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 3 },
    customPriceHint:    { fontSize: 11, color: colors.text.tertiary, marginBottom: 10 },
    customPriceInput:   { backgroundColor: colors.surface.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.text.primary, borderWidth: 1.5, borderColor: colors.border.default },
    customPricePreview: { fontSize: 12, color: colors.brand.orange, fontWeight: '600', marginTop: 8 },
    sectionError:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 20 },
    sectionErrorText:    { fontSize: 13, color: colors.state.down, fontWeight: '600' },
    sectionRetryBtn:     { backgroundColor: colors.brand.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
    sectionRetryText:    { fontSize: 13, fontWeight: '700', color: colors.text.inverse },
    sectionSeeAll:       { fontSize: 13, color: colors.brand.orange, fontWeight: '600' },
    merchantRow:         { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
    merchantCard:        { width: 100, alignItems: 'center', position: 'relative' },
    merchantLogo:        { width: 72, height: 72, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border.default, marginBottom: 7 },
    merchantLogoPlaceholder: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.brand.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
    verifiedBadge:       { position: 'absolute', top: 0, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface.card, alignItems: 'center', justifyContent: 'center' },
    verifiedBadgeText:   { fontSize: 12 },
    merchantName:        { fontSize: 12, fontWeight: '700', color: colors.text.primary, textAlign: 'center', width: 96 },
    merchantDistrict:    { fontSize: 10, color: colors.text.tertiary, textAlign: 'center', marginTop: 2, width: 96 },
  });
}