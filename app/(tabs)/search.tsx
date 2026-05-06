import { Dimensions, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


const WIDTH = Dimensions.get('window').width;
const CARD_W = (WIDTH - 48) / 2;

const cards = [
  { id: '1', name: 'Charmander', sub: 'Mega Evolution Promos Promo • 038', price: 'HK$432', change: -14.42, qty: 0, emoji: '🔥' },
  { id: '2', name: 'Bulbasaur', sub: 'Mega Evolution Promos Promo • 037', price: 'HK$234', change: -0.98, qty: 0, emoji: '🌿' },
  { id: '3', name: 'Squirtle', sub: 'Mega Evolution Promos Promo • 039', price: 'HK$287', change: 2.15, qty: 0, emoji: '💧' },
  { id: '4', name: 'Greninja', sub: 'Sun & Moon Promo • SM197', price: 'HK$156', change: -5.32, qty: 0, emoji: '🌊' },
];

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        
        {/* Search Row */}
        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.cameraBtn}>
            <Text style={styles.cameraEmoji}>📷</Text>
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <TextInput placeholder="搜索商品" placeholderTextColor="#9CA3AF" style={styles.searchInput} />
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Image source={require('../../assets/icons/Favorite.png')} style={styles.searchIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Image source={require('../../assets/icons/filter.png')} style={styles.searchIcon} />
          </TouchableOpacity>
        </View>

        {/* Banner */}
        <View style={styles.bannerWrap}>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>拆真實卡包 $1起</Text>
            <Text style={styles.bannerSub}>開啟數位卡包，並獲得真實卡片認證</Text>
            <TouchableOpacity style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>立即開始</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {cards.map(c => (
            <View key={c.id} style={styles.cardWrap}>
              <View style={styles.cardImgBox}>
                <Text style={styles.cardEmoji}>{c.emoji}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>{c.sub}</Text>
                <View style={styles.cardPriceRow}>
                  <View>
                    <Text style={styles.cardPrice}>{c.price}</Text>
                    <Text style={[styles.cardChange, { color: c.change > 0 ? '#00A63E' : '#E7000B' }]}>
                      {c.change > 0 ? '+' : ''}{c.change.toFixed(2)}%
                    </Text>
                  </View>
                  <Text style={styles.qty}>Qty: {c.qty}</Text>
                </View>
                <TouchableOpacity style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ 加入收藏</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
 topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
logo: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#101828', letterSpacing: 2 },
  logo: { fontSize: 16, fontWeight: '800', color: '#101828', letterSpacing: 2 },
  hkdBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, gap: 4 },
  hkdText: { fontSize: 13, color: '#101828' },
  arrowIcon: { width: 12, height: 12, tintColor: '#101828' },
  bellIcon: { width: 22, height: 22, tintColor: '#101828' },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', gap: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  cameraBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 0.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  cameraEmoji: { fontSize: 18 },
  searchBar: { flex: 1, height: 36, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  searchInput: { fontSize: 14, color: '#101828' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { width: 20, height: 20, tintColor: '#6B7280' },
  bannerWrap: { padding: 16, backgroundColor: '#fff', marginBottom: 8 },
  banner: { backgroundColor: '#FF6900', borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  bannerBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, alignSelf: 'flex-start' },
  bannerBtnText: { fontSize: 13, fontWeight: '600', color: '#FF6900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  cardWrap: { width: CARD_W, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardImgBox: { width: '100%', height: 140, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 56 },
  cardBody: { padding: 10 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#101828', marginBottom: 3 },
  cardSub: { fontSize: 11, color: '#9CA3AF', marginBottom: 8, lineHeight: 15 },
  cardPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  cardPrice: { fontSize: 15, fontWeight: '700', color: '#101828' },
  cardChange: { fontSize: 11, marginTop: 2 },
  qty: { fontSize: 11, color: '#9CA3AF' },
  addBtn: { backgroundColor: '#FF6900', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});