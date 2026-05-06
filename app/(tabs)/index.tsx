import { useRef, useState } from 'react';
import { Dimensions, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Header from '../../components/Header';

const WIDTH = Dimensions.get('window').width;

const periodData: Record<string, { label: string; value: number }[]> = {
  '1D': [
    { label: '9am', value: 16200 },
    { label: '12pm', value: 16400 },
    { label: '3pm', value: 16600 },
    { label: '6pm', value: 16757 },
  ],
  '7D': [
    { label: 'Mon', value: 15800 },
    { label: 'Tue', value: 16000 },
    { label: 'Wed', value: 15600 },
    { label: 'Thu', value: 16200 },
    { label: 'Fri', value: 16500 },
    { label: 'Sat', value: 16300 },
    { label: 'Sun', value: 16757 },
  ],
  '1M': [
    { label: 'Aug', value: 13000 },
    { label: 'Sept', value: 14200 },
    { label: 'Oct', value: 15800 },
    { label: 'Nov', value: 16757 },
  ],
  '3M': [
    { label: 'Sep', value: 11000 },
    { label: 'Oct', value: 13500 },
    { label: 'Nov', value: 16757 },
  ],
  '6M': [
    { label: 'Jun', value: 9000 },
    { label: 'Jul', value: 10500 },
    { label: 'Aug', value: 12000 },
    { label: 'Sep', value: 13500 },
    { label: 'Oct', value: 15000 },
    { label: 'Nov', value: 16757 },
  ],
  'MAX': [
    { label: '2022', value: 5000 },
    { label: '2023', value: 9000 },
    { label: '2024', value: 13000 },
    { label: '2025', value: 16757 },
  ],
};

const topCards = [
  { id: '1', name: 'Circana V (JP)', sub: '初代 151 • MT1 • Hololoil', price: '$2.23K', change: -4.40, emoji: '⚡' },
  { id: '2', name: 'Pikachu V (JP)', sub: '初代 151 • MT1', price: '$1.85K', change: 13.05, emoji: '⚡' },
  { id: '3', name: 'Blue Sky Stream Booster Box (JP)', sub: 'S7R', price: '$1.66K', change: -1.88, emoji: '📦' },
];

const hotCards = [
  { id: '1', name: 'Charmander', sub: 'Pokemon • Mega Evolution Promos', price: 'HK$432', change: -3.07, changeAmt: 'HK$13.7', emoji: '🔥' },
  { id: '2', name: 'Squirtle', sub: 'Pokemon • Mega Evolution Promos', price: 'HK$287', change: -0.13, changeAmt: 'HK$0.37', emoji: '💧' },
  { id: '3', name: 'Bulbasaur', sub: 'Pokemon • Mega Evolution Promos', price: 'HK$242', change: 0.06, changeAmt: 'HK$0.14', emoji: '🌿' },
];

const creators = [
  { id: '1', name: 'TCG Gaming', followers: '2.94K', emoji: '🎮' },
  { id: '2', name: 'Steve Aoki', followers: '1.7K', emoji: '🎵' },
  { id: '3', name: 'Dubby', followers: '476', emoji: '🎯' },
];

const periods = ['1D', '7D', '1M', '3M', '6M', 'MAX'];

function MiniChart({ period }: { period: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartData = periodData[period] || periodData['1M'];
  const w = WIDTH - 32;
  const h = 260;
  const padL = 72;
  const padR = 16;
  const padT = 20;
  const padB = 32;
  const chartMin = 0;
  const chartMax = 22000;
  const yLabels = [18000, 14000, 9000, 5000, 0];

  const getY = (val: number) => padT + (1 - val / chartMax) * (h - padT - padB);
  const getX = (i: number) => padL + (i / (chartData.length - 1)) * (w - padL - padR);

  const pts = chartData.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length-1].x} ${h - padB} L ${pts[0].x} ${h - padB} Z`;

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
  const tooltipW = 120;
  const tooltipX = hovered ? Math.min(Math.max(hovered.x - tooltipW / 2, padL), w - tooltipW - padR) : 0;
  const tooltipY = hovered ? Math.max(hovered.y - 72, 4) : 0;

  return (
    <View style={{ width: w, height: h }} {...panResponder.panHandlers}>
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FB923C" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#FB923C" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yLabels.map((val, i) => (
          <Line key={i} x1={padL} y1={getY(val)} x2={w - padR} y2={getY(val)}
            stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4,4" />
        ))}

        {yLabels.map((val, i) => (
          <SvgText key={i} x={padL - 10} y={getY(val) + 4}
            fontSize="11" fill="#9CA3AF" textAnchor="end">
            ${val === 0 ? '0k' : `${val / 1000}k`}
          </SvgText>
        ))}

        {chartData.map((d, i) => (
          <SvgText key={i} x={getX(i)} y={h - 8}
            fontSize="11" fill="#9CA3AF" textAnchor="middle">
            {d.label}
          </SvgText>
        ))}

        <Path d={areaPath} fill="url(#grad)" />
        <Path d={linePath} stroke="#FF6900" strokeWidth="2.5" fill="none" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y}
            r={hoverIdx === i ? 7 : 5}
            fill="#fff" stroke="#FF6900" strokeWidth="2.5" />
        ))}

        {hovered && (
          <Line x1={hovered.x} y1={padT} x2={hovered.x} y2={h - padB}
            stroke="#FF6900" strokeWidth="1.5" />
        )}
      </Svg>

      {hovered && hoveredData && (
        <View style={{
          position: 'absolute', left: tooltipX, top: tooltipY,
          width: tooltipW, backgroundColor: '#fff', borderRadius: 12,
          paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 }, elevation: 6,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#101828' }}>
            ${hoveredData.value.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            {hoveredData.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const [period, setPeriod] = useState('1M');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
  <Header />
  <View style={styles.portfolioSection}>
          <Text style={styles.portfolioLabel}>作品集 Main</Text>
          <Text style={styles.portfolioValue}>$16,757.02</Text>
          <Text style={styles.portfolioChange}>↑ +$0.00 近 30 天</Text>
        </View>

        <View style={styles.periodRow}>
          {periods.map(p => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chartWrap}>
          <MiniChart period={period} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最有價值</Text>
          {topCards.map(c => (
            <TouchableOpacity key={c.id} style={styles.listCard}>
              <View style={styles.listCardIcon}><Text style={styles.listCardEmoji}>{c.emoji}</Text></View>
              <View style={styles.listCardBody}>
                <Text style={styles.listCardName}>{c.name}</Text>
                <Text style={styles.listCardSub}>{c.sub}</Text>
              </View>
              <View style={styles.listCardRight}>
                <Text style={styles.listCardPrice}>{c.price}</Text>
                <Text style={[styles.listCardChange, { color: c.change > 0 ? '#00A63E' : '#E7000B' }]}>
                  {c.change > 0 ? '↑' : '↓'} {Math.abs(c.change).toFixed(2)}%
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity><Text style={styles.viewAll}>查看全部</Text></TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日熱門</Text>
          {hotCards.map(c => (
            <TouchableOpacity key={c.id} style={styles.listCard}>
              <View style={styles.listCardIcon}><Text style={styles.listCardEmoji}>{c.emoji}</Text></View>
              <View style={styles.listCardBody}>
                <Text style={styles.listCardName}>{c.name}</Text>
                <Text style={styles.listCardSub}>{c.sub}</Text>
              </View>
              <View style={styles.listCardRight}>
                <Text style={styles.listCardPrice}>{c.price}</Text>
                <Text style={[styles.listCardChange, { color: c.change > 0 ? '#00A63E' : '#E7000B' }]}>
                  {c.changeAmt} ({c.change > 0 ? '+' : ''}{c.change.toFixed(2)}%)
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity><Text style={styles.viewAll}>查看全部</Text></TouchableOpacity>
        </View>

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
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  logo: { fontSize: 18, fontWeight: '800', color: '#101828', letterSpacing: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hkdBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, gap: 4 },
  hkdText: { fontSize: 13, color: '#101828' },
  arrowIcon: { width: 12, height: 12, tintColor: '#101828' },
  bellIcon: { width: 22, height: 22, tintColor: '#101828' },
  portfolioSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, backgroundColor: '#fff' },
  portfolioLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  portfolioValue: { fontSize: 36, fontWeight: '700', color: '#101828' },
  portfolioChange: { fontSize: 13, color: '#00A63E', marginTop: 4, marginBottom: 12 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', justifyContent: 'space-between' },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 20, marginHorizontal: 2 },
  periodActive: { backgroundColor: '#FF6900' },
  periodText: { fontSize: 13, color: '#9CA3AF' },
  periodTextActive: { color: '#fff', fontWeight: '600' },
  chartWrap: { paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#fff' },
  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, backgroundColor: '#fff', marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#101828', marginBottom: 4 },
  listCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  listCardIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  listCardEmoji: { fontSize: 22 },
  listCardBody: { flex: 1 },
  listCardName: { fontSize: 13, fontWeight: '500', color: '#101828' },
  listCardSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  listCardRight: { alignItems: 'flex-end' },
  listCardPrice: { fontSize: 14, fontWeight: '600', color: '#101828' },
  listCardChange: { fontSize: 11, marginTop: 2 },
  viewAll: { color: '#FF6900', fontSize: 14, fontWeight: '500', textAlign: 'center', paddingVertical: 14 },
  creatorCard: { width: 90, marginRight: 16, alignItems: 'center' },
  creatorIcon: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  creatorName: { fontSize: 12, fontWeight: '500', color: '#101828', textAlign: 'center' },
  creatorFollowers: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
});