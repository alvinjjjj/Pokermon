import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Dimensions, Image, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

const WIDTH = Dimensions.get('window').width;
const periods = ['1D', '7D', '1M', '3M', '6M', 'MAX'];
const API_KEY = 'b58e91e7-d37e-48af-a472-09f364116acd';

const creators = [
  { id: '1', name: 'TCG Gaming', followers: '2.94K', emoji: '🎮' },
  { id: '2', name: 'Steve Aoki', followers: '1.7K', emoji: '🎵' },
  { id: '3', name: 'Dubby', followers: '476', emoji: '🎯' },
];

type MarketCard = {
  id: string;
  name: string;
  set: { name: string };
  rarity?: string;
  images: { small: string };
  cardmarket?: { prices?: { averageSellPrice?: number; avg30?: number } };
  tcgplayer?: { prices?: { holofoil?: { market?: number }; normal?: { market?: number } } };
};

// 把小時數字轉成 am/pm label
function hourToLabel(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// 1D 只顯示這些小時的 label
const SHOW_HOURS_1D = new Set([0, 3, 6, 9, 12, 15, 19, 21]);

function groupByPeriod(cards: any[], period: string) {
  if (!cards.length) return [];

  if (period === '1D') {
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;
    cards.forEach(card => {
      const hour = new Date(card.added_at).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + (card.current_price || 0) * (card.quantity || 1);
    });
    let cumulative = 0;
    return Array.from({ length: 24 }, (_, h) => {
      cumulative += hourMap[h];
      return { label: hourToLabel(h), hour: h, value: cumulative };
    });
  }

  const grouped: Record<string, number> = {};
  const keyOrder: string[] = [];
  cards.forEach(card => {
    const date = new Date(card.added_at);
    let key = '';
    if (period === '7D') key = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
    else if (period === '1M' || period === '3M') key = `${date.getMonth()+1}/${date.getDate()}`;
    else if (period === '6M') key = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()];
    else key = date.getFullYear().toString();
    if (!grouped[key]) keyOrder.push(key);
    grouped[key] = (grouped[key] || 0) + (card.current_price || 0) * (card.quantity || 1);
  });
  let cumulative = 0;
  return keyOrder.map(key => {
    cumulative += grouped[key];
    return { label: key, hour: -1, value: cumulative };
  });
}

function getCardPrice(card: MarketCard): number {
  return card.cardmarket?.prices?.averageSellPrice ||
    card.tcgplayer?.prices?.holofoil?.market ||
    card.tcgplayer?.prices?.normal?.market ||
    0;
}

function MiniChart({ chartData, is1D }: { chartData: { label: string; hour: number; value: number }[], is1D: boolean }) {
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
    pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < minDist) { minDist = d; nearest = i; } });
    setHoverIdx(nearest);
  };

  const hovered = hoverIdx !== null ? pts[hoverIdx] : null;
  const hoveredData = hoverIdx !== null ? chartData[hoverIdx] : null;
  const tooltipW = 110;
  const tooltipX = hovered ? Math.min(Math.max(hovered.x - tooltipW / 2, padL), w - tooltipW - padR) : 0;
  const tooltipY = hovered ? Math.max(hovered.y - 55, 4) : 0;

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
            <Stop offset="0" stopColor="#FF6900" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#FF6900" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yLabels.map((val, i) => (
          <Line key={i} x1={padL} y1={getY(val)} x2={w - padR} y2={getY(val)} stroke="#F3F4F6" strokeWidth="1" />
        ))}
        {yLabels.map((val, i) => (
          <SvgText key={i} x={padL - 6} y={getY(val) + 4} fontSize="9" fill="#C4C9D4" fontFamily="Inter" textAnchor="end">
            {val >= 1000 ? `$${(val/1000).toFixed(0)}k` : `$${val}`}
          </SvgText>
        ))}

        {chartData.map((d, i) => (
          shouldShowLabel(d, i, chartData.length) ? (
            <SvgText key={i} x={getX(i)} y={h - 6} fontSize="9" fill="#C4C9D4" fontFamily="Inter" textAnchor="middle">
              {d.label}
            </SvgText>
          ) : null
        ))}

        {areaPath ? <Path d={areaPath} fill="url(#grad)" /> : null}
        <Path d={linePath} stroke="#FF6900" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 0} fill="#fff" stroke="#FF6900" strokeWidth="2" />
        ))}
        {hovered && (
          <Line x1={hovered.x} y1={padT} x2={hovered.x} y2={h - padB} stroke="#FF6900" strokeWidth="1" strokeDasharray="4,3" />
        )}
      </Svg>

      {hovered && hoveredData && (
        <View style={{
          position: 'absolute', left: tooltipX, top: tooltipY,
          width: tooltipW, backgroundColor: '#fff', borderRadius: 10,
          paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 }, elevation: 5,
          borderWidth: 0.5, borderColor: '#F3F4F6',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#101828', fontFamily: 'Inter' }}>
            HK${hoveredData.value.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1, fontFamily: 'Inter' }}>
            {hoveredData.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const [period, setPeriod] = useState('1D');
  const [cards, setCards] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ label: string; hour: number; value: number }[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topCards, setTopCards] = useState<MarketCard[]>([]);
  const [hotCards, setHotCards] = useState<MarketCard[]>([]);
  const router = useRouter();

  useFocusEffect(useCallback(() => { fetchPortfolio(); }, []));
  useFocusEffect(useCallback(() => { if (topCards.length === 0) fetchMarketCards(); }, []));
  useFocusEffect(useCallback(() => {
    if (cards.length) setChartData(groupByPeriod(cards, period));
  }, [period, cards]));

  const fetchPortfolio = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('user_collection')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: true });

    if (!error && data) {
      setCards(data);
      const total = data.reduce((sum, c) => sum + (c.current_price * c.quantity), 0);
      setTotalValue(total);
      setChartData(groupByPeriod(data, period));
    }
    setLoading(false);
  };

  const fetchMarketCards = async () => {
    try {
      const topRes = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:Charizard&pageSize=3&orderBy=-cardmarket.prices.averageSellPrice`,
        { headers: { 'X-Api-Key': API_KEY } }
      );
      const topData = await topRes.json();
      setTopCards(topData.data || []);

      const hotRes = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:Pikachu&pageSize=3&orderBy=-set.releaseDate`,
        { headers: { 'X-Api-Key': API_KEY } }
      );
      const hotData = await hotRes.json();
      setHotCards(hotData.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.portfolioSection}>
          <Text style={styles.portfolioLabel}>作品集 Main</Text>
          <Text style={styles.portfolioValue}>
            HK${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.portfolioChange}>↑ +$0.00 近 30 天</Text>
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
              <Text style={{ color: '#9CA3AF' }}>載入中...</Text>
            </View>
          ) : chartData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>還沒有卡片</Text>
              <Text style={styles.emptySub}>點擊加入你的第一張卡！</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/search')}>
                <Text style={styles.emptyBtnText}>+ 加入卡片</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MiniChart chartData={chartData} is1D={period === '1D'} />
          )}
        </View>

        {/* 最有價值 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最有價值</Text>
          {topCards.map(c => {
            const price = getCardPrice(c);
            return (
              <TouchableOpacity key={c.id} style={styles.listCard}>
                <Image source={{ uri: c.images.small }} style={styles.listCardImg} resizeMode="contain" />
                <View style={styles.listCardBody}>
                  <Text style={styles.listCardName}>{c.name}</Text>
                  <Text style={styles.listCardSub}>{c.set.name}</Text>
                  {c.rarity && <Text style={styles.listCardRarity}>{c.rarity}</Text>}
                </View>
                <View style={styles.listCardRight}>
                  <Text style={styles.listCardPrice}>
                    {price > 0 ? `HK$${(price * 7.8).toFixed(0)}` : '-'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity><Text style={styles.viewAll}>查看全部</Text></TouchableOpacity>
        </View>

        {/* 今日熱門 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日熱門</Text>
          {hotCards.map(c => {
            const price = getCardPrice(c);
            return (
              <TouchableOpacity key={c.id} style={styles.listCard}>
                <Image source={{ uri: c.images.small }} style={styles.listCardImg} resizeMode="contain" />
                <View style={styles.listCardBody}>
                  <Text style={styles.listCardName}>{c.name}</Text>
                  <Text style={styles.listCardSub}>{c.set.name}</Text>
                  {c.rarity && <Text style={styles.listCardRarity}>{c.rarity}</Text>}
                </View>
                <View style={styles.listCardRight}>
                  <Text style={styles.listCardPrice}>
                    {price > 0 ? `HK$${(price * 7.8).toFixed(0)}` : '-'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity><Text style={styles.viewAll}>查看全部</Text></TouchableOpacity>
        </View>

        {/* 內容創作者 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>內容創作者專區</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {creators.map(c => (
              <TouchableOpacity key={c.id} style={styles.creatorCard}>
                <View style={styles.creatorIcon}><Text style={{ fontSize: 28 }}>{c.emoji}</Text></View>
                <Text style={styles.creatorName}>{c.name}</Text>
                <Text style={styles.creatorFollowers}>{c.followers} followers</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  portfolioSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2, backgroundColor: '#fff' },
  portfolioLabel: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  portfolioValue: { fontSize: 34, fontWeight: '700', color: '#101828' },
  portfolioChange: { fontSize: 12, color: '#00A63E', marginTop: 2, marginBottom: 8 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', justifyContent: 'space-between' },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 20, marginHorizontal: 2 },
  periodActive: { backgroundColor: '#FF6900' },
  periodText: { fontSize: 12, color: '#9CA3AF' },
  periodTextActive: { color: '#fff', fontWeight: '600' },
  chartWrap: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 6, backgroundColor: '#fff', alignItems: 'center' },
  emptyWrap: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
  emptyBtn: { backgroundColor: '#FF6900', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  section: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: '#fff', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#101828', marginBottom: 6 },
  listCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', gap: 12 },
  listCardImg: { width: 40, height: 56, borderRadius: 6 },
  listCardBody: { flex: 1 },
  listCardName: { fontSize: 13, fontWeight: '600', color: '#101828' },
  listCardSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  listCardRarity: { fontSize: 10, color: '#3B82F6', marginTop: 1 },
  listCardRight: { alignItems: 'flex-end' },
  listCardPrice: { fontSize: 14, fontWeight: '700', color: '#101828' },
  viewAll: { color: '#FF6900', fontSize: 13, fontWeight: '500', textAlign: 'center', paddingVertical: 12 },
  creatorCard: { width: 88, marginRight: 14, alignItems: 'center' },
  creatorIcon: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  creatorName: { fontSize: 11, fontWeight: '500', color: '#101828', textAlign: 'center' },
  creatorFollowers: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 1 },
});