import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

type Card = {
  id: string;
  card_name: string;
  set_name: string;
  purchase_price: number;
  current_price: number;
  quantity: number;
  added_at: string;
};

export default function PortfolioScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [showValue, setShowValue] = useState(true);
  const [loading, setLoading] = useState(true);

  const totalValue = cards.reduce((sum, c) => sum + (c.current_price * c.quantity), 0);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_collection')
      .select('*')
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching cards:', error);
    } else {
      setCards(data || []);
    }
    setLoading(false);
  };

 const addTestCard = async () => {
  const { data, error } = await supabase
    .from('user_collection')
    .insert({
      card_name: 'Pikachu V',
      set_name: 'Vivid Voltage',
      purchase_price: 400,
      current_price: 450,
      quantity: 1,
    })
    .select();
    
  if (error) {
    alert('Error: ' + error.message);
  } else {
    alert('成功！');
    fetchCards();
  }
};

  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Portfolio Value */}
        <View style={styles.valueSection}>
          <Text style={styles.valueLabel}>作品集：<Text style={styles.valueLabelOrange}>Main</Text></Text>
          <View style={styles.valueRow}>
            <Text style={styles.valueAmount}>
              {showValue ? `HK$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
            </Text>
            <TouchableOpacity onPress={() => setShowValue(!showValue)}>
              <Text style={styles.eyeIcon}>{showValue ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardCount}>{cards.length} 張卡片</Text>
        </View>

        {/* Filter Tag */}
        <View style={styles.filterRow}>
          <View style={styles.filterChip}>
            <Text style={styles.filterText}>價格等級，從高到低</Text>
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && cards.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>還沒有卡片</Text>
            <Text style={styles.emptySub}>開始加入你的第一張卡！</Text>
            <TouchableOpacity style={styles.addTestBtn} onPress={addTestCard}>
              <Text style={styles.addTestBtnText}>+ 加入測試卡片</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cards Grid */}
        {!loading && cards.length > 0 && (
          <View style={styles.grid}>
            {cards.map(card => {
              const change = card.purchase_price > 0
                ? ((card.current_price - card.purchase_price) / card.purchase_price) * 100
                : 0;
              return (
                <TouchableOpacity key={card.id} style={styles.card}>
                  <View style={styles.cardImgBox}>
                    <Text style={styles.cardEmoji}>🃏</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{card.card_name}</Text>
                    <Text style={styles.cardSet}>{card.set_name}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>單價</Text>
                      <Text style={styles.priceValue}>HK${card.current_price.toLocaleString()}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Qty: {card.quantity}</Text>
                      <Text style={[styles.changeText, { color: change >= 0 ? '#00A63E' : '#E7000B' }]}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </Text>
                    </View>
                    <View style={styles.totalBox}>
                      <Text style={styles.totalLabel}>總價值</Text>
                      <Text style={styles.totalValue}>HK${(card.current_price * card.quantity).toFixed(2)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  valueSection: { backgroundColor: '#fff', paddingVertical: 20, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  valueLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  valueLabelOrange: { color: '#FF6900', fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueAmount: { fontSize: 36, fontWeight: '800', color: '#101828' },
  eyeIcon: { fontSize: 20 },
  cardCount: { fontSize: 13, color: '#9CA3AF', marginTop: 6 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  filterChip: { backgroundColor: '#101828', borderRadius: 25, paddingHorizontal: 16, paddingVertical: 9, alignSelf: 'flex-start' },
  filterText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  loadingWrap: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#9CA3AF' },
  emptyWrap: { padding: 40, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
  addTestBtn: { marginTop: 16, backgroundColor: '#FF6900', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  addTestBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  card: { width: CARD_W, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardImgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 56 },
  cardBody: { padding: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 2 },
  cardSet: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  priceLabel: { fontSize: 12, color: '#9CA3AF' },
  priceValue: { fontSize: 14, fontWeight: '700', color: '#101828' },
  changeText: { fontSize: 12, fontWeight: '600' },
  totalBox: { backgroundColor: '#FFF3EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  totalLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#FF6900' },
});