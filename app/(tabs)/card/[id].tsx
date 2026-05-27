import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../../components/Header';
import { useTheme } from '../../../theme/ThemeProvider';
import { type ColorTokens } from '../../../constants/colors';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { POKEMON_TCG_API_KEY, POKEMON_TCG_BASE_URL } from '../../../constants/config';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { getCardPrice as getPPTCardPrice, getPPTCardsBySet, pptPriceCompat, PPTCard } from '../../../lib/pokeprice';
import { fetchHiresJPImages, hasReliableImage } from '../../../lib/jpImages';
import { supabase } from '../../../lib/supabase';
import Loader from '../../../components/Loader';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────
type HKListing = {
  id: string;
  price: number;
  condition: string | null;
  is_negotiable: boolean | null;
  seller_type: string | null;
  seller_id: string | null;
  merchant_id: string | null;
  photo_urls: string[] | null;
  seller_name?: string | null;
};

type CardDetail = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; releaseDate: string };
  cardmarket?: { prices?: { averageSellPrice?: number; avg30?: number; avg7?: number } };
  tcgplayer?: { id?: string; prices?: { holofoil?: { market?: number }; normal?: { market?: number } } };
  subtypes?: string[];
  types?: string[];
  hp?: string;
  artist?: string;
  flavorText?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const periods = ['1D', '7D', '1M', '3M', '6M', 'MAX'];

function getRawUsd(card: CardDetail): number {
  return (
    card.cardmarket?.prices?.averageSellPrice ||
    card.tcgplayer?.prices?.holofoil?.market ||
    card.tcgplayer?.prices?.normal?.market ||
    0
  );
}

function getAvg30(card: CardDetail): number {
  return card.cardmarket?.prices?.avg30 || 0;
}

function getAvg7(card: CardDetail): number {
  return card.cardmarket?.prices?.avg7 || 0;
}

/** Generate simulated price history for chart display */
function generateHistory(
  current: number,
  avg30: number,
  avg7: number,
  period: string,
): { label: string; value: number }[] {
  if (current <= 0) return [];

  const seed = current * 1000; // deterministic noise
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 0.5 + 0.5;
    return x * 2 - 1; // -1 to 1
  };

  const base30 = avg30 > 0 ? avg30 : current * 0.92;
  const base7  = avg7  > 0 ? avg7  : current * 0.97;

  if (period === '1D') {
    // 24 hourly points, trending from base7 to current
    return Array.from({ length: 24 }, (_, i) => {
      const t = i / 23;
      const trend = base7 + (current - base7) * t;
      const noise = trend * 0.02 * rng(i);
      return {
        label: i % 3 === 0 ? `${i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`}` : '',
        value: Math.max(trend + noise, 0.01),
      };
    });
  }

  if (period === '7D') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((label, i) => {
      const t = i / 6;
      const trend = base7 + (current - base7) * t;
      return { label, value: Math.max(trend + trend * 0.04 * rng(i), 0.01) };
    });
  }

  if (period === '1M') {
    return Array.from({ length: 30 }, (_, i) => {
      const t = i / 29;
      const trend = base30 + (current - base30) * t;
      return {
        label: i % 7 === 0 ? `${i + 1}` : '',
        value: Math.max(trend + trend * 0.05 * rng(i), 0.01),
      };
    });
  }

  // Month labels — anchored to the CURRENT month so the chart always ends
  // on "now" instead of always showing Jan–Dec / Jan–Jun regardless of when
  // the user opens the app.
  const mLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayMonth = new Date().getMonth(); // 0–11

  if (period === '3M') {
    // 13 weekly points covering ~3 months. Label the start (3M ago), middle
    // months, and the end (now) using actual month names relative to today.
    const POINTS = 13;
    return Array.from({ length: POINTS }, (_, i) => {
      const t = i / (POINTS - 1);
      const start = base30 * 0.85;
      const trend = start + (current - start) * t;
      // Pick 4 evenly-spaced labels: 3M ago, 2M ago, 1M ago, now
      let label = '';
      if (i === 0)                    label = mLabels[(todayMonth - 3 + 12) % 12];
      else if (i === Math.floor(POINTS / 3))     label = mLabels[(todayMonth - 2 + 12) % 12];
      else if (i === Math.floor(2 * POINTS / 3)) label = mLabels[(todayMonth - 1 + 12) % 12];
      else if (i === POINTS - 1)      label = mLabels[todayMonth];
      return { label, value: Math.max(trend + trend * 0.06 * rng(i), 0.01) };
    });
  }

  // 6M / MAX — monthly points, ending at the current month
  const count = period === '6M' ? 6 : 12;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const start = current * (period === '6M' ? 0.7 : 0.45);
    const trend = start + (current - start) * t;
    // i=0 is the oldest, i=count-1 is "now" — so offset back from today.
    const monthIdx = (todayMonth - (count - 1) + i + 12 * 12) % 12;
    return {
      label: mLabels[monthIdx],
      value: Math.max(trend + trend * 0.08 * rng(i), 0.01),
    };
  });
}

/** Build chart data from real Supabase snapshots for the selected period */
function buildChartFromSnapshots(
  snaps: { date: string; price_usd: number; psa10_usd: number | null }[],
  period: string,
  usePsa10: boolean,
): { label: string; value: number }[] | null {
  if (!snaps.length) return null;

  const now = new Date();
  const cutoff = new Date(now);
  const daysNeeded: Record<string, number> = {
    '1D': 0, '7D': 7, '1M': 30, '3M': 90, '6M': 180, 'MAX': 9999,
  };

  // 1D has no real hourly data — fall back to simulated
  if (period === '1D') return null;

  const days = daysNeeded[period] ?? 30;
  cutoff.setDate(cutoff.getDate() - days);

  const filtered = snaps.filter(s => new Date(s.date) >= cutoff);
  if (filtered.length < 3) return null; // not enough data yet

  return filtered.map((s, i) => {
    const d = new Date(s.date);
    const label =
      i === 0 || i === filtered.length - 1
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : '';
    const value = usePsa10 && s.psa10_usd && s.psa10_usd > 0
      ? s.psa10_usd
      : s.price_usd;
    return { label, value };
  });
}

// ─── Chart ─────────────────────────────────────────────────────────────────────
// Y-axis labels and tooltip values used to be hard-coded with a `$` prefix —
// they actually came from raw USD data, so a HK$81,900 PSA 10 card would show
// a chart axis of "$10.4k" (USD), causing users to think the chart was off.
// We now thread `rate` + `symbol` through so the chart displays in whichever
// currency the user has selected at the top of the screen.
function PriceChart({
  data,
  positive,
  rate,
  symbol,
}: {
  data: { label: string; value: number }[];
  positive: boolean;
  rate: number;
  symbol: string;
}) {
  const { colors } = useTheme();
  // Helper: format a USD value in the user's currency. Compact "k" notation
  // above 1,000; full number below.
  const fmt = (usd: number) => {
    const v = usd * rate;
    if (Math.abs(v) >= 1000) return `${symbol}${(v / 1000).toFixed(1)}k`;
    return `${symbol}${v.toFixed(0)}`;
  };
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Hooks MUST run unconditionally on every render — keep ptsRef + panResponder
  // ABOVE the `if (!data.length) return null` early-exit at line ~265.
  // Previously these useRef calls sat after the early return, violating
  // Rules of Hooks: when `data` toggled empty/non-empty between renders the
  // hook order changed and React would crash with "Rendered fewer hooks than
  // expected" (caught by eslint react-hooks/rules-of-hooks).
  //
  // panResponder callbacks reference `findNearest` (declared further down)
  // via lexical scope — fine because the callbacks only fire at gesture time,
  // not at PanResponder.create() time.
  const ptsRef = useRef<{ x: number; y: number }[]>([]);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => findNearest(e.nativeEvent.locationX),
      onPanResponderMove: e => findNearest(e.nativeEvent.locationX),
      onPanResponderRelease: () => setHoverIdx(null),
    }),
  ).current;

  const w = SCREEN_W - 32;
  const h = 180;
  const padL = 30;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  if (!data.length) return null;

  const maxV = Math.max(...data.map(d => d.value));
  const minV = Math.min(...data.map(d => d.value));
  const range = maxV - minV || 1;
  // Vol.03 D3: chart main line uses text.primary (Ink/Paper) — neutral, no up/down signaling.
  // `positive` still drives the area-fill gradient tint (Sage / Brick) so the band still reads.
  const lineColor = colors.text.primary;
  const tintColor = positive ? colors.state.upStrong : colors.state.down;

  const getY = (v: number) => padT + (1 - (v - minV) / range) * (h - padT - padB);
  const getX = (i: number) =>
    data.length === 1
      ? padL + (w - padL - padR) / 2
      : padL + (i / (data.length - 1)) * (w - padL - padR);

  const pts = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    pts.length > 1
      ? `${linePath} L ${pts[pts.length - 1].x} ${h - padB} L ${pts[0].x} ${h - padB} Z`
      : '';

  // Keep ptsRef in sync with the latest computed positions so PanResponder
  // callbacks (captured once above) always see fresh data.
  ptsRef.current = pts;

  const findNearest = (x: number) => {
    let nearest = 0, minDist = Infinity;
    ptsRef.current.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hovered = hoverIdx !== null ? pts[hoverIdx] : null;
  const hoveredData = hoverIdx !== null ? data[hoverIdx] : null;
  const tooltipW = 110;
  const tooltipX = hovered
    ? Math.min(Math.max(hovered.x - tooltipW / 2, padL), w - tooltipW - padR)
    : 0;
  const tooltipY = hovered ? Math.max(hovered.y - 55, 4) : 0;

  // y-axis labels
  const yLabels = [maxV, (maxV + minV) / 2, minV];

  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }} {...panResponder.panHandlers}>
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tintColor} stopOpacity="0.18" />
            <Stop offset="1" stopColor={tintColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yLabels.map((val, i) => (
          <Line key={i} x1={padL} y1={getY(val)} x2={w - padR} y2={getY(val)}
            stroke={colors.border.default} strokeWidth="1" />
        ))}
        {yLabels.map((val, i) => (
          <SvgText key={i} x={padL - 4} y={getY(val) + 4} fontSize="9" fill={colors.text.tertiary}
            textAnchor="end">
            {fmt(val)}
          </SvgText>
        ))}

        {data.map((d, i) =>
          d.label ? (
            <SvgText key={i} x={getX(i)} y={h - 8} fontSize="9" fill={colors.text.tertiary}
              textAnchor="middle">
              {d.label}
            </SvgText>
          ) : null,
        )}

        {areaPath ? <Path d={areaPath} fill="url(#cgrad)" /> : null}
        {/* Vol.03 D3: 1.5px line in Ink/Paper, neutral colour */}
        <Path d={linePath} stroke={lineColor} strokeWidth="1.5" fill="none"
          strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 0}
            fill={colors.surface.card} stroke={lineColor} strokeWidth="2" />
        ))}
        {hovered && (
          <Line x1={hovered.x} y1={padT} x2={hovered.x} y2={h - padB}
            stroke={lineColor} strokeWidth="1" strokeDasharray="4,3" />
        )}
      </Svg>

      {hovered && hoveredData && (
        <View style={{
          position: 'absolute', left: tooltipX, top: tooltipY,
          width: tooltipW, backgroundColor: colors.surface.elevated, borderRadius: 10,
          paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center',
          // shadowColor '#000' kept (shadow convention)
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 }, elevation: 5,
          borderWidth: 0.5, borderColor: colors.border.default,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.primary }}>
            {fmt(hoveredData.value)}
          </Text>
          {hoveredData.label ? (
            <Text style={{ fontSize: 9, color: colors.text.tertiary, marginTop: 1 }}>{hoveredData.label}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function CardDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id, jp_name, jp_image, jp_set, jp_number, jp_psa10, jp_psa9, jp_market } =
    useLocalSearchParams<{
      id: string;
      jp_name?: string; jp_image?: string; jp_set?: string; jp_number?: string;
      jp_psa10?: string; jp_psa9?: string; jp_market?: string;
    }>();
  const router = useRouter();
  const { convert, currency, rate, symbol } = useCurrency();
  const { t } = useTranslation();

  // ppt_ IDs come from home screen PPT cards; jtcg_ from old JustTCG (legacy)
  const isJPCard = typeof id === 'string' && (id.startsWith('jtcg_') || id.startsWith('ppt_'));

  const [card, setCard] = useState<CardDetail | null>(null);
  const [relatedCards, setRelatedCards] = useState<CardDetail[]>([]);
  const [jtcgPrice, setJtcgPrice] = useState<{ market: number; low: number; high: number; psa9: number; psa10: number } | null>(null);
  const [pptCard, setPptCard]     = useState<PPTCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1M');
  const [showPSAModal, setShowPSAModal] = useState(false);
  const [selectedPSA, setSelectedPSA] = useState('10');
  const [adding, setAdding] = useState(false);
  const [addedGrades, setAddedGrades] = useState<Set<string>>(new Set());
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [customPriceText, setCustomPriceText] = useState('');
  const [hkListings, setHkListings] = useState<HKListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<{ date: string; price_usd: number; psa10_usd: number | null }[]>([]);

  // JP / EN 卡圖切換
  const [imgLang, setImgLang] = useState<'original' | 'jp' | 'en'>('original');
  const [jpAltImage, setJpAltImage] = useState<string | null>(null);   // JP 對應版卡圖
  const [enAltImage, setEnAltImage] = useState<string | null>(null);   // EN 對應版卡圖

  const fetchHKListings = async (cardId: string) => {
    if (!cardId || cardId.startsWith('jtcg_') || cardId.startsWith('ppt_')) return;
    setListingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('id, price, condition, is_negotiable, seller_type, seller_id, merchant_id, photo_urls')
        .eq('card_id', cardId)
        .eq('status', 'active')
        .order('price', { ascending: true })
        .limit(20);
      if (!error && data) {
        setHkListings(data as HKListing[]);
      }
    } catch (e) {
      if (__DEV__) console.error('fetchHKListings error:', e);
    }
    setListingsLoading(false);
  };

  useEffect(() => {
    if (!id) return;
    // Reset stale state from the previously viewed card. Without this,
    // navigating from card A to card B (e.g. via the 相關卡牌 row) leaves
    // A's chart / PSA prices / related cards on screen until B's PPT
    // fetch resolves — looks like "data didn't update".
    setPptCard(null);
    setRelatedCards([]);
    setSnapshots([]);
    setJtcgPrice(null);
    setHkListings([]);

    fetchHKListings(typeof id === 'string' ? id : id[0]);
    if (isJPCard) {
      // Build a synthetic CardDetail from URL params (home screen / portfolio)
      const psa10  = parseFloat(jp_psa10  ?? '0') || 0;
      const psa9   = parseFloat(jp_psa9   ?? '0') || 0;
      const market = parseFloat(jp_market ?? '0') || 0;
      const synth: CardDetail = {
        id,
        name:   jp_name  ?? t('cardDetail.jpCard'),
        number: jp_number ?? '',
        images: { small: jp_image ?? '', large: jp_image ?? '' },
        set:    { id: '', name: jp_set ?? '', series: 'Japanese', releaseDate: '' },
      };
      setCard(synth);
      setJtcgPrice({ market, low: 0, high: 0, psa9, psa10 });
      setLoading(false);

      // Background-fetch full PPT data (price history, change30d, PSA9/10 eBay).
      // ALWAYS fetch — even if synth params already have PSA values — because
      // we need price history for the chart + change30d display, which URL
      // params never carry. Also sync card.number / card.set.name from PPT
      // so the 「卡片資料」section shows real values instead of "-".
      if (jp_name) {
        getPPTCardPrice('', jp_name, jp_set ?? '', 'japanese')
          .then(ppt => {
            if (!ppt) return;
            setPptCard(ppt);
            setJtcgPrice(pptPriceCompat(ppt));
            // Merge PPT-supplied fields into the synthetic card so the info
            // table renders properly. Keep existing fields if PPT didn't
            // return a value (don't overwrite with empty).
            setCard(prev => prev ? {
              ...prev,
              number: prev.number || ppt.number || '',
              set: {
                ...prev.set,
                name: prev.set.name || ppt.setName || '',
              },
            } : prev);
            if (ppt.price.history.length > 0) {
              setSnapshots(ppt.price.history.map(h => ({
                date:      h.date,
                price_usd: h.price,
                psa10_usd: null as number | null,
              })));
            }
          })
          .catch(() => {});

        // Fetch related JP cards from same set via PPT.
        // Pass real card number (e.g. "290/XY-P") as hint so the helper can
        // extract set code as a fallback when set name match misses. Fall back
        // to jp_name (which often embeds the number) if no number was passed.
        if (jp_set || jp_name || jp_number) {
          (async () => {
            const jpRelated = await getPPTCardsBySet(
              jp_set ?? '', 'japanese', 12, jp_number || jp_name || ''
            );
            if (!jpRelated || jpRelated.length === 0) return;

            const filtered = jpRelated.filter(c => c.name !== jp_name).slice(0, 8);

            // Enrich images via artofpkm + TCGdex (same path used by home/search
            // for JP cards). PPT often returns no image or a low-res thumbnail
            // for JP cards — fetchHiresJPImages resolves the real hi-res art.
            const hires = await fetchHiresJPImages(
              filtered.map(c => ({ name: c.name, setName: c.setName }))
            ).catch(() => ({} as Record<string, string>));

            const synthRelated: CardDetail[] = filtered
              .map(c => {
                const enrichedImg = hires[c.name] || c.imageLarge || c.image || '';
                return { c, enrichedImg };
              })
              // Drop cards we can't render properly. PPT covers "function cards"
              // (energy / stadium / item / non-character supporter) but artofpkm
              // doesn't scrape those, so they end up with no image — leaving an
              // ugly empty blue frame. Better to omit them entirely.
              .filter(({ enrichedImg }) => enrichedImg && hasReliableImage(enrichedImg))
              .map(({ c, enrichedImg }) => ({
                id:     `ppt_${c.tcgPlayerId || c.name.replace(/\s+/g, '_')}`,
                name:   c.name,
                number: c.number || '',
                images: { small: enrichedImg, large: enrichedImg },
                set:    { id: '', name: c.setName, series: 'Japanese', releaseDate: '' },
                // Pack PPT data into a synthetic cardmarket-like shape so
                // related-cards UI can show price + change%
                cardmarket: {
                  prices: {
                    averageSellPrice: c.price.market,
                    avg30:            c.price.history.length > 0
                      ? c.price.history[0].price
                      : c.price.market,
                  },
                } as any,
              }));
            setRelatedCards(synthRelated);
          })().catch(() => {});
        }
      }
    } else {
      fetchCard(id);
    }
  }, [id]);

  const fetchCard = async (cardId: string) => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout(`${POKEMON_TCG_BASE_URL}/cards/${cardId}`, {
        headers: { 'X-Api-Key': POKEMON_TCG_API_KEY },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      if (!json.data) throw new Error('Card not found');
      const c: CardDetail = json.data;
      setCard(c);

      // Determine if JP card
      const isJP = c.set.series?.includes('Japanese') || /[぀-ヿ一-鿿]/.test(c.name);

      // Related cards query — same set
      const relatedQuery = `set.id:${c.set.id}`;

      // Fetch PPT price data + related cards in parallel
      const [pptResult, relRes] = await Promise.all([
        getPPTCardPrice(
          c.tcgplayer?.id ?? '',
          c.name,
          c.set.name,
          isJP ? 'japanese' : 'english',
        ),
        fetchWithTimeout(
          `${POKEMON_TCG_BASE_URL}/cards?q=${encodeURIComponent(relatedQuery)}&pageSize=12&orderBy=-cardmarket.prices.averageSellPrice`,
          { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY } },
        ).then(r => r.json()).catch(() => ({ data: [] })),
      ]);

      // Apply PPT price data (real PSA 9/10 eBay prices + 30-day history)
      if (pptResult) {
        setPptCard(pptResult);
        setJtcgPrice(pptPriceCompat(pptResult));
        // Map PPT history to snapshot shape for chart
        if (pptResult.price.history.length > 0) {
          const pptSnaps = pptResult.price.history.map(h => ({
            date:       h.date,
            price_usd:  h.price,
            psa10_usd:  null as number | null,
          }));
          setSnapshots(pptSnaps);
        }
      }

      const related = (relRes.data ?? []).filter((rc: CardDetail) => rc.id !== cardId).slice(0, 8);
      setRelatedCards(related);

      // ── 搜尋對應的 JP / EN 版本卡圖（background，不阻塞載入）────────────
      if (!isJP) {
        // 這是 EN 卡 → 搜尋對應的 JP 版本
        const jpQuery = `name:"${c.name}" set.series:"Scarlet & Violet (Japanese)" OR set.series:"Sword & Shield (Japanese)"`;
        fetchWithTimeout(
          `${POKEMON_TCG_BASE_URL}/cards?q=${encodeURIComponent(jpQuery)}&pageSize=3`,
          { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY } }
        ).then(r => r.json()).then(jpRes => {
          const jpCard = jpRes.data?.[0];
          if (jpCard?.images?.large) setJpAltImage(jpCard.images.large);
          else if (jpCard?.images?.small) setJpAltImage(jpCard.images.small);
        }).catch(() => {});
      } else {
        // 這是 JP 卡 → 搜尋對應的 EN 版本
        const enQuery = `name:"${c.name}" -set.series:"Scarlet & Violet (Japanese)" -set.series:"Sword & Shield (Japanese)" -set.series:"Sun & Moon (Japanese)"`;
        fetchWithTimeout(
          `${POKEMON_TCG_BASE_URL}/cards?q=${encodeURIComponent(enQuery)}&pageSize=3&orderBy=-set.releaseDate`,
          { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY } }
        ).then(r => r.json()).then(enRes => {
          const enCard = enRes.data?.[0];
          if (enCard?.images?.large) setEnAltImage(enCard.images.large);
          else if (enCard?.images?.small) setEnAltImage(enCard.images.small);
        }).catch(() => {});
      }
    } catch (e) {
      if (__DEV__) console.error('fetchCard error:', e);
    }
    setLoading(false);
  };

  const confirmAdd = async () => {
    if (!card) return;
    setAdding(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { alert(t('cardDetail.loginRequired')); return; }

      // If user entered a custom price, convert from selected currency back to USD
      const customVal = parseFloat(customPriceText.replace(/[^0-9.]/g, ''));
      const usd = customVal > 0 ? customVal / rate : getPSAPrice(selectedPSA).usd;
      const { error } = await supabase.from('user_collection').insert({
        user_id:        user.id,
        card_id:        card.id,
        card_name:      card.name,
        set_name:       card.set.name,
        purchase_price: usd,
        current_price:  usd,
        quantity:       1,
        psa_grade:      selectedPSA,
        image_url:      card.images.small,
      });
      if (!error) {
        setAddedGrades(prev => new Set([...prev, selectedPSA]));
        setIsWishlisted(true);
        setShowPSAModal(false);
        alert(t('cardDetail.addSuccess', { name: card.name, grade: selectedPSA === 'Raw' ? 'Raw' : `PSA ${selectedPSA}` }));
      } else {
        alert(t('cardDetail.addFailed') + error.message);
      }
    } finally { setAdding(false); }
  };

  /**
   * 返回 PSA 等級的價格（USD）及是否為估算值。
   *
   * 策略：
   *   1. PPT eBay 真實 psa10/psa9 數據優先，但要通過 sanity check
   *      （psa10 必須 ≥ Raw × 1.5，psa9 必須 ≥ Raw × 1.2）
   *   2. PPT 有時會把低成交或 Raw 價誤標為 psa10（例如 Giratina V Lost Abyss
   *      PPT psa10 = HK$3,845，但真實 eBay PSA 10 是 HK$15,000–20,000）
   *      — sanity check 擋住髒數據，改用 Raw × multiplier 估算
   *   3. 估算結果標明 isEstimate: true，UI 顯示「≈」+「參考估價」tag
   */
  const getPSAPrice = (grade: string): { usd: number; isEstimate: boolean } => {
    if (!card) return { usd: 0, isEstimate: false };
    const raw  = getRawUsd(card);
    const jtcg = jtcgPrice; // populated from pptPriceCompat()

    // JP PPT 卡通常沒 cardmarket/tcgplayer raw → 用 PPT market 當 base
    const base = raw > 0 ? raw : (isJPCard && jtcg?.market ? jtcg.market : 0);

    // Sanity check：PPT psa10/psa9 必須明顯高於 raw 才採信
    const psa10ok = (jtcg?.psa10 ?? 0) > 0 && (base <= 0 || jtcg!.psa10 >= base * 1.5);
    const psa9ok  = (jtcg?.psa9  ?? 0) > 0 && (base <= 0 || jtcg!.psa9  >= base * 1.2);

    if (grade === '10') {
      if (psa10ok) return { usd: jtcg!.psa10, isEstimate: false };
      if (base > 0) return { usd: base * (isJPCard ? 3 : 4), isEstimate: true };
      return { usd: 0, isEstimate: false };
    }
    if (grade === '9') {
      if (psa9ok) return { usd: jtcg!.psa9, isEstimate: false };
      if (base > 0) return { usd: base * (isJPCard ? 1.5 : 1.8), isEstimate: true };
      return { usd: 0, isEstimate: false };
    }
    // Raw — PPT market 優先，沒有就 fallback 到 cardmarket/tcgplayer raw
    if (jtcg?.market && jtcg.market > 0) return { usd: jtcg.market, isEstimate: false };
    return { usd: raw, isEstimate: false };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Loader size="large" />
          <Text style={styles.loadingText}>{t('cardDetail.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t('cardDetail.notFound')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnInline}>
            <Text style={styles.backBtnInlineText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const rawPrice  = getRawUsd(card);
  const avg30     = getAvg30(card);
  const avg7      = getAvg7(card);
  const psa10Result = getPSAPrice('10');
  const psa9Result  = getPSAPrice('9');
  const rawResult   = getPSAPrice('Raw');
  const psa10Usd    = psa10Result.usd;
  const psa9Usd     = psa9Result.usd;
  const rawUsd      = rawResult.usd;
  const psa10IsEst  = psa10Result.isEstimate;
  const psa9IsEst   = psa9Result.isEstimate;

  const hasJtcg   = !!jtcgPrice && (jtcgPrice.market > 0 || jtcgPrice.psa10 > 0);
  const isJP      = card.set.series?.includes('Japanese') || /[぀-ヿ一-鿿]/.test(card.name);

  // 30-day change based on PSA 10 price trend
  const change30 = avg30 > 0 ? ((rawPrice - avg30) / avg30) * 100 : 0;
  const changePositive = change30 >= 0;

  // Chart uses PSA 10 price so chart values match the "premium" view.
  // avg30/avg7 are Cardmarket EUR raw prices — don't mix them with PSA 10 USD.
  // Use proportional bands from chartBase instead.
  const chartBase   = psa10Usd > 0 ? psa10Usd : rawPrice;
  const chartAvg30  = chartBase * 0.92; // ≈ 30-day anchor (−8% band)
  const chartAvg7   = chartBase * 0.97; // ≈ 7-day anchor  (−3% band)

  // Use real snapshots if available, otherwise fall back to simulated
  const realChartData = buildChartFromSnapshots(snapshots, period, psa10Usd > 0);
  const chartData     = realChartData ?? generateHistory(chartBase, chartAvg30, chartAvg7, period);
  const chartIsReal   = !!realChartData;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* App Header */}
        <Header />

        {/* Back + wishlist row */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.wishBtn, isWishlisted && styles.wishBtnActive]}
            onPress={() => { setCustomPriceText(''); setShowPSAModal(true); }}
          >
            <Text style={[styles.wishBtnText, isWishlisted && styles.wishBtnTextActive]}>
              {isWishlisted ? t('cardDetail.wishlisted') : t('cardDetail.addToCollection')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PSA badge */}
        <View style={styles.heroSection}>
          <View style={styles.psaBadge}>
            <Text style={styles.psaBadgeText}>PSA 10</Text>
          </View>

          {/* Card name + set */}
          <Text style={styles.heroName}>{card.name}</Text>
          <View style={styles.heroBadgeRow}>
            {card.number ? (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>#{card.number}</Text>
              </View>
            ) : null}
            {card.set.name ? (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText} numberOfLines={1}>{card.set.name.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
          {card.rarity && <Text style={styles.heroRarity}>{card.rarity}</Text>}

          {/* JP / EN 語言切換按鈕 */}
          {(jpAltImage || enAltImage) && (
            <View style={styles.langToggleRow}>
              <TouchableOpacity
                style={[styles.langToggleBtn, imgLang === 'original' && styles.langToggleBtnActive]}
                onPress={() => setImgLang('original')}
              >
                <Text style={[styles.langToggleText, imgLang === 'original' && styles.langToggleTextActive]}>
                  {isJP ? '🇯🇵 JP' : '🇺🇸 EN'}
                </Text>
              </TouchableOpacity>
              {!isJP && jpAltImage && (
                <TouchableOpacity
                  style={[styles.langToggleBtn, imgLang === 'jp' && styles.langToggleBtnActive]}
                  onPress={() => setImgLang('jp')}
                >
                  <Text style={[styles.langToggleText, imgLang === 'jp' && styles.langToggleTextActive]}>{t('cardDetail.jpVersion')}</Text>
                </TouchableOpacity>
              )}
              {isJP && enAltImage && (
                <TouchableOpacity
                  style={[styles.langToggleBtn, imgLang === 'en' && styles.langToggleBtnActive]}
                  onPress={() => setImgLang('en')}
                >
                  <Text style={[styles.langToggleText, imgLang === 'en' && styles.langToggleTextActive]}>{t('cardDetail.enVersion')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Card image */}
          <View style={styles.heroImageWrap}>
            <Image
              source={{
                uri: imgLang === 'jp' && jpAltImage
                  ? jpAltImage
                  : imgLang === 'en' && enAltImage
                  ? enAltImage
                  : (card.images.large || card.images.small)
              }}
              style={styles.heroImage}
              resizeMode="contain"
            />
            {isJP && (
              <View style={styles.jpFlag}>
                <Text style={styles.jpFlagText}>🇯🇵 JP</Text>
              </View>
            )}
            {hasJtcg && (
              <View style={styles.liveFlag}>
                <Text style={styles.liveFlagText}>LIVE</Text>
              </View>
            )}
          </View>

          {/* Price summary under image */}
          <View style={styles.priceSummary}>
            <Text style={styles.priceSummaryMain}>{psa10Usd > 0 ? convert(psa10Usd) : '-'}</Text>
            {change30 !== 0 && (
              <View style={[styles.changePill, changePositive ? styles.changePillUp : styles.changePillDown]}>
                <Text style={[styles.changePillText, changePositive ? { color: colors.state.upStrong } : { color: colors.state.down }]}>
                  {changePositive ? '▲' : '▼'} {Math.abs(change30).toFixed(1)}% vs30d
                </Text>
              </View>
            )}
          </View>

          {/* PSA 3-box row */}
          <View style={styles.priceRow}>
            {([
              { label: 'Raw',    usd: rawUsd,    isEst: false        },
              { label: 'PSA 9',  usd: psa9Usd,   isEst: psa9IsEst    },
              { label: 'PSA 10', usd: psa10Usd,  isEst: psa10IsEst   },
            ] as const).map(({ label, usd, isEst }) => (
              <View key={label} style={[styles.priceBox, label === 'PSA 10' && styles.priceBoxHighlight]}>
                <Text style={[styles.priceBoxLabel, label === 'PSA 10' && styles.priceBoxLabelHL]}>
                  {label}
                </Text>
                <Text style={[styles.priceBoxValue, label === 'PSA 10' && styles.priceBoxValueHL]}>
                  {usd > 0 ? `${isEst ? '≈ ' : ''}${convert(usd)}` : '-'}
                </Text>
                {usd > 0 && (
                  isEst
                    ? <Text style={styles.estimateTag}>{t('cardDetail.estimateTag')}</Text>
                    : <Text style={styles.liveTag}>LIVE</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Period toggles + Chart */}
        {chartBase > 0 && (
          <View style={styles.chartSection}>
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
            <PriceChart data={chartData} positive={changePositive} rate={rate} symbol={symbol} />
            {/* Data source disclaimer */}
            <View style={styles.chartDisclaimer}>
              {chartIsReal ? (
                <Text style={styles.chartDisclaimerReal}>
                  {t('cardDetail.realChart', { n: snapshots.length })}
                </Text>
              ) : (
                <Text style={styles.chartDisclaimerEst}>
                  {t('cardDetail.estChart')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Card Info — only show rows with real values to avoid a sea of "-"
            for JP cards (PPT provides number + set but not rarity/HP/etc). */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>{t('cardDetail.infoTitle')}</Text>
          <View style={styles.infoGrid}>
            {([
              { label: t('cardDetail.series'),       value: card.set.series },
              { label: t('cardDetail.set'),          value: card.set.name },
              { label: t('cardDetail.number'),       value: card.number },
              { label: t('cardDetail.rarity'),       value: card.rarity },
              { label: t('cardDetail.hp'),           value: card.hp },
              { label: t('cardDetail.releaseDate'),  value: card.set.releaseDate },
            ] as { label: string; value: string | undefined }[])
              .filter(row => row.value && row.value !== '-' && row.value !== '')
              .map(({ label, value }) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            {card.types && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('cardDetail.attribute')}</Text>
                <Text style={styles.infoValue}>{card.types.join(', ')}</Text>
              </View>
            )}
            {card.subtypes && card.subtypes.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('cardDetail.subtype')}</Text>
                <Text style={styles.infoValue}>{card.subtypes.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* HK Merchant Listings */}
        {!isJPCard && (
          <View style={styles.hkSection}>
            <View style={styles.hkHeader}>
              <Text style={styles.sectionTitle}>{t('cardDetail.hkListings')}</Text>
              {hkListings.length > 0 && (
                <View style={styles.hkCountBadge}>
                  <Text style={styles.hkCountText}>{t('cardDetail.listingsCount', { n: hkListings.length })}</Text>
                </View>
              )}
            </View>

            {listingsLoading ? (
              <ActivityIndicator color={colors.brand.orange} style={{ marginVertical: 16 }} />
            ) : hkListings.length === 0 ? (
              <View style={styles.hkEmpty}>
                <Text style={styles.hkEmptyText}>{t('cardDetail.noHkListings')}</Text>
                <Text style={styles.hkEmptySubText}>{t('cardDetail.beFirstSeller')}</Text>
              </View>
            ) : (
              hkListings.map((listing, idx) => (
                <TouchableOpacity
                  key={listing.id}
                  style={[styles.hkRow, idx === hkListings.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => router.push({ pathname: '/listing/[id]' as any, params: { id: listing.id } })}
                  activeOpacity={0.6}
                >
                  <View style={styles.hkRowLeft}>
                    <View style={styles.hkBadgeRow}>
                      {listing.condition ? (
                        <View style={[
                          styles.hkCondBadge,
                          listing.condition === 'Mint' || listing.condition === 'Near Mint'
                            ? styles.hkCondMint
                            : listing.condition === 'Excellent'
                            ? styles.hkCondExcellent
                            : styles.hkCondOther,
                        ]}>
                          <Text style={styles.hkCondText}>{listing.condition}</Text>
                        </View>
                      ) : null}
                      {listing.seller_type === 'certified_merchant' && (
                        <View style={styles.hkMerchBadge}>
                          <Text style={styles.hkMerchText}>{t('cardDetail.certifiedBadge')}</Text>
                        </View>
                      )}
                      {listing.is_negotiable && (
                        <View style={styles.hkNegoBadge}>
                          <Text style={styles.hkNegoText}>{t('cardDetail.negotiable')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.hkSellerType}>
                      {listing.seller_type === 'certified_merchant' ? t('cardDetail.certifiedMerchantType') : t('cardDetail.individualSeller')}
                    </Text>
                  </View>
                  <View style={styles.hkRowRight}>
                    <Text style={styles.hkPrice}>HK${listing.price.toLocaleString()}</Text>
                    <Text style={styles.hkChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Related Cards */}
        {relatedCards.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={[styles.sectionTitle, { paddingLeft: 24 }]}>{t('cardDetail.relatedCards')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 24, paddingRight: 24, gap: 12 }}>
              {relatedCards.map(rc => {
                const rPrice = getRawUsd(rc);
                const rChange = rc.cardmarket?.prices?.avg30
                  ? ((rPrice - rc.cardmarket.prices.avg30) / rc.cardmarket.prices.avg30) * 100
                  : null;
                // JP related: pass jp_* params so the next detail page can build
                // a proper synthetic CardDetail AND trigger PPT background fetch.
                // Without these, the next page would show an empty card.
                const isRelatedJP = rc.id.startsWith('ppt_') || rc.id.startsWith('jtcg_');
                const navParams: Record<string, string> = { id: rc.id };
                if (isRelatedJP) {
                  navParams.jp_name   = rc.name;
                  navParams.jp_image  = rc.images.small || '';
                  navParams.jp_set    = rc.set.name;
                  navParams.jp_number = rc.number || '';
                  navParams.jp_market = String(rPrice || 0);
                }
                return (
                  <TouchableOpacity
                    key={rc.id}
                    style={styles.relatedCard}
                    onPress={() => router.push({ pathname: '/(tabs)/card/[id]', params: navParams } as any)}
                  >
                    <Image
                      source={{ uri: rc.images.small }}
                      style={styles.relatedImg}
                      resizeMode="contain"
                    />
                    <Text style={styles.relatedName} numberOfLines={2}>{rc.name}</Text>
                    {rPrice > 0 && (
                      <Text style={styles.relatedPrice}>{convert(rPrice)}</Text>
                    )}
                    <Text style={styles.relatedENTag}>{isJP ? 'JP Raw' : 'EN Raw'}</Text>
                    {rChange !== null && (
                      <Text style={[styles.relatedChange, rChange >= 0 ? { color: colors.state.upStrong } : { color: colors.state.down }]}>
                        {rChange >= 0 ? '▲' : '▼'} {Math.abs(rChange).toFixed(1)}%
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('cardDetail.selectPsaGrade')}</Text>
              <Text style={styles.modalSub}>{card.name}</Text>

              {/* Price preview */}
              <View style={styles.previewRow}>
                {(['Raw', '9', '10'] as const).map(g => {
                  const psaResult = getPSAPrice(g);
                  const active = selectedPSA === g;
                  return (
                    <View key={g} style={[styles.previewBox, active && styles.previewBoxActive]}>
                      <Text style={[styles.previewGrade, active && styles.previewGradeActive]}>
                        {g === 'Raw' ? 'Raw' : `PSA ${g}`}
                      </Text>
                      <Text style={[styles.previewAmount, active && styles.previewAmountActive]}>
                        {psaResult.usd > 0 ? `${psaResult.isEstimate ? '≈ ' : ''}${convert(psaResult.usd)}` : '-'}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.psaGrid}>
                {(['Raw', '9', '10'] as const).map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.psaBtn, selectedPSA === g && styles.psaBtnActive]}
                    onPress={() => setSelectedPSA(g)}
                  >
                    <Text style={[styles.psaText, selectedPSA === g && styles.psaTextActive]}>
                      {g === 'Raw' ? 'Raw' : `PSA ${g}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom price input */}
              <View style={styles.customPriceBox}>
                <Text style={styles.customPriceLabel}>
                  {t('cardDetail.customPriceLabel', { currency })}
                </Text>
                <Text style={styles.customPriceSub}>
                  {t('cardDetail.customPriceSub')}
                </Text>
                <TextInput
                  style={styles.customPriceInput}
                  value={customPriceText}
                  onChangeText={setCustomPriceText}
                  keyboardType="decimal-pad"
                  placeholder={t('cardDetail.customPricePlaceholder', { value: convert(getPSAPrice(selectedPSA).usd).replace(/[^0-9.]/g, '') })}
                  placeholderTextColor={colors.text.tertiary}
                  returnKeyType="done"
                  textContentType="none"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, adding && { opacity: 0.7 }]}
                onPress={confirmAdd}
                disabled={adding}
              >
                {adding ? (
                  // ActivityIndicator '#fff' kept raw — on Card Orange confirm button
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmText}>{t('cardDetail.confirmAdd')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowPSAModal(false); setCustomPriceText(''); }}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe:               { flex: 1, backgroundColor: colors.surface.base },
    loadingWrap:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText:        { fontSize: 15, color: colors.text.tertiary },
    backBtnInline:      { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.brand.orange, borderRadius: 12 },
    // backBtnInlineText '#fff' kept raw — always-white on Card Orange
    backBtnInlineText:  { color: '#fff', fontWeight: '600' },
    navBar:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
    backBtn:            { paddingVertical: 6, paddingRight: 12 },
    backBtnText:        { fontSize: 14, color: colors.text.secondary, fontWeight: '500' },
    wishBtn:            { backgroundColor: colors.surface.section, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.border.default },
    wishBtnActive:      { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    wishBtnText:        { fontSize: 13, color: colors.text.secondary, fontWeight: '600' },
    // wishBtnTextActive '#fff' kept raw — on Card Orange
    wishBtnTextActive:  { color: '#fff' },
    heroSection:        { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.surface.base },
    psaBadge:           { backgroundColor: colors.text.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 7, marginBottom: 14 },
    // psaBadgeText uses inverse — Paper on dark surface, Ink-light on light surface
    psaBadgeText:       { color: colors.text.inverse, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
    heroName:           { fontSize: 22, fontWeight: '800', color: colors.text.primary, textAlign: 'center' },
    heroSet:            { fontSize: 13, color: colors.brand.orange, fontWeight: '600', marginTop: 3, textAlign: 'center' },
    // heroRarity '#3B82F6' kept raw — semantic rarity-indicator blue, same hue both modes
    heroRarity:         { fontSize: 12, color: '#3B82F6', marginTop: 2, textAlign: 'center', fontWeight: '500' },
    heroBadgeRow:       { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap', paddingHorizontal: 16 },
    heroBadge:          { borderWidth: 1.5, borderColor: colors.text.primary, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
    heroBadgeText:      { fontSize: 11, fontWeight: '700', color: colors.text.primary, letterSpacing: 0.5 },
    heroImageWrap:      { marginTop: 14, position: 'relative' },
    heroImage:          { width: SCREEN_W * 0.58, height: SCREEN_W * 0.58 * 1.4, borderRadius: 10 },
    langToggleRow:      { flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'center' },
    langToggleBtn:      { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: colors.surface.section },
    langToggleBtnActive:{ backgroundColor: colors.text.primary, borderColor: colors.text.primary },
    langToggleText:     { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
    langToggleTextActive:{ color: colors.text.inverse },
    // jpFlag: semantic red flag overlaid on card image; same hue both modes
    jpFlag:             { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(180,0,0,0.8)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    jpFlagText:         { color: '#fff', fontSize: 10, fontWeight: '700' },
    // liveFlag semantic LIVE green — indicates real-time data, same hue both modes
    liveFlag:           { position: 'absolute', top: 8, right: 8, backgroundColor: '#00A63E', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    liveFlagText:       { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    priceSummary:       { marginTop: 16, alignItems: 'center', gap: 6 },
    priceSummaryMain:   { fontSize: 28, fontWeight: '800', color: colors.text.primary },
    changePill:         { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    // Vol.03 D2: change pill uses Sage/Brick tokens with low-opacity tint
    changePillUp:       { backgroundColor: colors.state.upStrong + '22' },
    changePillDown:     { backgroundColor: colors.state.down + '22' },
    changePillText:     { fontSize: 12, fontWeight: '700' },
    priceRow:           { flexDirection: 'row', gap: 8, marginTop: 16, width: '100%' },
    priceBox:           { flex: 1, backgroundColor: colors.surface.section, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border.default },
    priceBoxHighlight:  { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
    priceBoxLabel:      { fontSize: 10, color: colors.text.tertiary, fontWeight: '600', marginBottom: 4 },
    priceBoxLabelHL:    { color: colors.text.tertiary, fontSize: 10, fontWeight: '600', marginBottom: 4 },
    priceBoxValue:      { fontSize: 13, fontWeight: '800', color: colors.text.primary },
    priceBoxValueHL:    { color: colors.text.inverse, fontSize: 14, fontWeight: '800' },
    // estimateTag '#F59E0B' / liveTag '#00A63E' kept raw — semantic estimate amber / LIVE green
    estimateTag:        { fontSize: 9, color: '#F59E0B', fontWeight: '700', marginTop: 2 },
    liveTag:            { fontSize: 9, color: '#00A63E', fontWeight: '700', marginTop: 2 },
    chartSection:       { paddingHorizontal: 16, marginTop: 8 },
    chartDisclaimer:    { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, marginBottom: 8 },
    chartDisclaimerEst: { fontSize: 10, color: '#F59E0B', fontWeight: '500' },
    chartDisclaimerReal:{ fontSize: 10, color: '#00A63E', fontWeight: '600' },
    periodRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    // Vol.03 D1: period selector uses 2px Card Orange underline (not orange-fill pill)
    periodBtn:          { flex: 1, alignItems: 'center', paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: 'transparent', marginHorizontal: 2 },
    periodActive:       { borderBottomColor: colors.brand.orange },
    periodText:         { fontSize: 12, color: colors.text.tertiary },
    periodTextActive:   { color: colors.text.primary, fontWeight: '600' },
    infoSection:        { paddingHorizontal: 24, marginTop: 20 },
    sectionTitle:       { fontSize: 18, fontWeight: '800', color: colors.text.primary, marginBottom: 12 },
    infoGrid:           { backgroundColor: colors.surface.section, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border.default },
    infoRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    infoLabel:          { fontSize: 13, color: colors.text.tertiary },
    infoValue:          { fontSize: 13, fontWeight: '600', color: colors.text.primary, maxWidth: '60%', textAlign: 'right' },
    // ── HK Listings ──────────────────────────────────────────────────────────────
    hkSection:          { paddingHorizontal: 24, marginTop: 20 },
    hkHeader:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    hkCountBadge:       { backgroundColor: colors.brand.peach, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.brand.orange },
    hkCountText:        { fontSize: 11, color: colors.brand.orange, fontWeight: '700' },
    hkEmpty:            { backgroundColor: colors.surface.section, borderRadius: 14, paddingVertical: 28, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: colors.border.default },
    hkEmptyIcon:        { fontSize: 28 },
    hkEmptyText:        { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
    hkEmptySubText:     { fontSize: 12, color: colors.text.tertiary },
    hkRow:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    hkRowLeft:          { flex: 1, gap: 4 },
    hkBadgeRow:         { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    hkCondBadge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    // Semantic condition tint backgrounds — same hue both modes
    hkCondMint:         { backgroundColor: '#DCFCE7' },
    hkCondExcellent:    { backgroundColor: '#DBEAFE' },
    hkCondOther:        { backgroundColor: colors.surface.section },
    // hkCondText '#374151' kept raw — reads on the semantic-tint condition backgrounds above
    hkCondText:         { fontSize: 11, fontWeight: '700', color: '#374151' },
    // Semantic merchant amber + negotiable purple — same hue both modes
    hkMerchBadge:       { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    hkMerchText:        { fontSize: 11, fontWeight: '700', color: '#92400E' },
    hkNegoBadge:        { backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    hkNegoText:         { fontSize: 11, fontWeight: '700', color: '#5B21B6' },
    hkSellerType:       { fontSize: 11, color: colors.text.tertiary, marginTop: 2 },
    hkPrice:            { fontSize: 17, fontWeight: '800', color: colors.text.primary },
    hkRowRight:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 12 },
    hkChevron:          { fontSize: 22, color: colors.text.tertiary, marginTop: -2 },
    relatedSection:     { marginTop: 20, paddingHorizontal: 0 },
    relatedCard:        { width: 120, backgroundColor: colors.surface.section, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border.default, padding: 8 },
    relatedImg:         { width: '100%', height: 120 * 1.4, borderRadius: 8 },
    relatedName:        { fontSize: 11, fontWeight: '600', color: colors.text.primary, marginTop: 6, lineHeight: 14 },
    relatedPrice:       { fontSize: 12, fontWeight: '800', color: colors.brand.orange, marginTop: 3 },
    relatedChange:      { fontSize: 10, fontWeight: '600', marginTop: 1 },
    relatedENTag:       { fontSize: 9, color: colors.text.tertiary, fontWeight: '500', marginTop: 1 },
    modalOverlay:       { flex: 1, backgroundColor: colors.overlay.medium, justifyContent: 'flex-end' },
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
    psaGrid:            { flexDirection: 'row', gap: 12, marginBottom: 16 },
    customPriceBox:     { backgroundColor: colors.surface.section, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: colors.border.default },
    customPriceLabel:   { fontSize: 13, fontWeight: '700', color: colors.text.primary, marginBottom: 3 },
    customPriceSub:     { fontSize: 11, color: colors.text.tertiary, marginBottom: 10 },
    customPriceInput:   { backgroundColor: colors.surface.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border.default, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text.primary, fontWeight: '600' },
    psaBtn:             { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: colors.surface.section, alignItems: 'center' },
    psaBtnActive:       { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    psaText:            { fontSize: 15, color: colors.text.secondary, fontWeight: '500' },
    // psaTextActive '#fff' kept raw — on Card Orange
    psaTextActive:      { color: '#fff', fontWeight: '700' },
    confirmBtn:         { backgroundColor: colors.brand.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
    // confirmText '#fff' kept raw — on Card Orange
    confirmText:        { fontSize: 16, fontWeight: '700', color: '#fff' },
    cancelBtn:          { alignItems: 'center', paddingVertical: 12 },
    cancelText:         { fontSize: 15, color: colors.text.tertiary },
  });
}
