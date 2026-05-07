import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

const WIDTH = Dimensions.get('window').width;
const periods = ['1D', '7D', '1M', '3M', '6M', 'MAX'];

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

function groupByPeriod(cards: any[], period: string) {
  if (!cards.length) return [];
  const grouped: Record<string, number> = {};
  cards.forEach(card => {
    const date = new Date(card.added_at);
    let key = '';
    if (period === '1D') key = `${date.getHours()}:00`;
    else if (period === '7D') key = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
    else if (period === '1M' || period === '3M') key = `${date.getMonth()+1}/${date.getDate()}`;
    else if (period === '6M') key = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()];
    else key = date.getFullYear().toString();
    grouped[key] = (grouped[key] || 0) + (card.current_price || 0) * (card.quantity || 1);
  });
  return Object.entries(grouped).map(([label, value]) => ({ value, label }));
}

export default function HomeScreen() {
  const [period, setPeriod] = useState('1M');
  const [cards, setCards] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ value: number; label: string }[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { fetchPortfolio(); }, []);
  useEffect(() => {
    if (cards.length) setChartData(groupByPeriod(cards, period));
  }, [period, cards]);

  const fetchPortfolio = async () => {
    const { data, error } = await supabase
      .from('user_collection')
      .select('*')
      .order('added_at', { ascending: true });
    if (!error && data) {
      setCards(data);
      const total = data.reduce((sum, c) => sum + (c.current_price * c.quantity), 0);
      setTotalValue(total);
      setChartData(groupByPeriod(data, period));
    }
    setLoading(false);
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
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
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
            <LineChart
              data={chartData}
              width={WIDTH - 64}
              height={200}
              color="#FF6900"
              thickness={2.5}
              startFillColor="#FF6900"
              endFillColor="white"
              startOpacity={0.2}
              endOpacity={0}
              areaChart
              curved
              hideDataPoints={false}
              dataPointsColor="#FF6900"
              dataPointsRadius={4}
              yAxisColor="transparent"
              xAxisColor="#F3F4F6"
              yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              noOfSections={4}
              yAxisLabelPrefix="$"
              hideRules={false}
              rulesColor="#F3F4F6"
              rulesType="solid"
              showVerticalLines={false}
              pointerConfig={{
                pointerStripHeight: 160,
                pointerStripColor: '#FF6900',
                pointerStripWidth: 1,
                pointerColor: '#FF6900',
                radius: 6,
                pointerLabelWidth: 120,
                pointerLabelHeight: 50,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: any) => (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipValue}>HK${items[0].value.toLocaleString()}</Text>
                    <Text style={styles.tooltipLabel}>{items[0].label}</Text>
                  </View>
                ),
              }}
            />
          )}
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
  portfolioSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, backgroundColor: '#fff' },
  portfolioLabel: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  portfolioValue: { fontSize: 36, fontWeight: '700', color: '#101828' },
  portfolioChange: { fontSize: 13, color: '#00A63E', marginTop: 4, marginBottom: 12 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', justifyContent: 'space-between' },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 20, marginHorizontal: 2 },
  periodActive: { backgroundColor: '#FF6900' },
  periodText: { fontSize: 13, color: '#9CA3AF' },
  periodTextActive: { color: '#fff', fontWeight: '600' },
  chartWrap: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 16, backgroundColor: '#fff' },
  emptyWrap: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
  emptyBtn: { backgroundColor: '#FF6900', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  tooltip: { backgroundColor: '#fff', borderRadius: 10, padding: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4, borderWidth: 0.5, borderColor: '#F3F4F6' },
  tooltipValue: { fontSize: 13, fontWeight: '700', color: '#101828' },
  tooltipLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
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