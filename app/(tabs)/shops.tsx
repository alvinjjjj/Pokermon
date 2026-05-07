import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';

const SHOPS = [
  { id: '1', name: 'Card Master HK', location: '旺角', rating: 4.8, reviews: 128, verified: true, emoji: '🃏' },
  { id: '2', name: 'Pokemon 專門店', location: '銅鑼灣', rating: 4.9, reviews: 128, verified: true, emoji: '⚡' },
  { id: '3', name: '收藏卡中心', location: '尖沙咀', rating: 4.7, reviews: 128, verified: true, emoji: '🏆' },
  { id: '4', name: 'TCG Paradise', location: '觀塘', rating: 4.6, reviews: 128, verified: false, emoji: '🎮' },
];

const EBAY_ITEMS = [
  { id: '1', name: 'Charizard VMAX', sub: 'Darkness Ablaze • 020/189', condition: 'Near Mint', price: 'HK$1,280', emoji: '🔥' },
  { id: '2', name: 'Pikachu V', sub: 'Vivid Voltage • 043/185', condition: 'Mint', price: 'HK$450', emoji: '⚡' },
  { id: '3', name: 'Mewtwo GX', sub: 'Shining Legends • 39/73', condition: 'Near Mint', price: 'HK$680', emoji: '💜' },
];

export default function ShopsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={styles.bannerWrap}>
          <View style={styles.banner}>
            <Text style={styles.bannerIcon}>🏪</Text>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>香港商家招募中</Text>
              <Text style={styles.bannerSub}>加入 HKcardcoll 官方認證商家{'\n'}線下認證審核，提升品牌信譽</Text>
            </View>
            <TouchableOpacity style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>申請成為商家</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 認證商家 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>認證商家</Text>
            <TouchableOpacity>
              <Text style={styles.viewMore}>查看更多 ↗</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.shopGrid}>
            {SHOPS.map(shop => (
              <TouchableOpacity key={shop.id} style={styles.shopCard}>
                {/* Verified Badge at top center */}
                {shop.verified && (
                  <View style={styles.verifiedWrap}>
                    <View style={styles.verifiedCircle}>
                      <Text style={styles.verifiedIcon}>✓</Text>
                    </View>
                  </View>
                )}
                {/* 1:1 Image Box */}
                <View style={styles.shopImgBox}>
                  <Text style={styles.shopEmoji}>{shop.emoji}</Text>
                </View>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{shop.name}</Text>
                  <Text style={styles.shopLocation}>📍 {shop.location}</Text>
                  <Text style={styles.shopRating}>⭐ {shop.rating} ({shop.reviews} 評價)</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* eBay 立即購買 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>eBay 立即購買</Text>
            <TouchableOpacity>
              <Text style={styles.viewMore}>查看更多 ↗</Text>
            </TouchableOpacity>
          </View>
          {EBAY_ITEMS.map(item => (
            <View key={item.id} style={styles.ebayCard}>
              <View style={styles.ebayIcon}>
                <Text style={styles.ebayEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.ebayBody}>
                <Text style={styles.ebayName}>{item.name}</Text>
                <Text style={styles.ebaySub}>{item.sub}</Text>
                <Text style={styles.ebayCondition}>{item.condition}</Text>
              </View>
              <View style={styles.ebayRight}>
                <Text style={styles.ebayPrice}>{item.price}</Text>
                <TouchableOpacity style={styles.buyBtn}>
                  <Text style={styles.buyBtnText}> 購買</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* eBay 說明 */}
        <View style={styles.ebayNote}>
          <Text style={styles.ebayNoteIcon}>ℹ️</Text>
          <Text style={styles.ebayNoteText}>
            <Text style={styles.ebayNoteBold}>關於 eBay 購買{'\n'}</Text>
            點擊「購買」將跳轉至 eBay 完成交易。請注意賣家評價和運送條款。
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  // Banner
  bannerWrap: { padding: 16 },
  banner: { backgroundColor: '#FF6900', borderRadius: 20, padding: 20, gap: 12 },
  bannerIcon: { fontSize: 32 },
  bannerTextWrap: { gap: 4 },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  bannerBtn: { backgroundColor: '#fff', borderRadius: 25, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  bannerBtnText: { fontSize: 15, fontWeight: '700', color: '#FF6900' },

  // Section
  section: { backgroundColor: '#fff', marginBottom: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#101828' },
  viewMore: { fontSize: 13, color: '#FF6900', fontWeight: '500' },

  // Shop Grid
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  shopCard: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  verifiedWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'center',
    zIndex: 1,
    marginTop: 1,
  },
  verifiedCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6900',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  shopImgBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopEmoji: { fontSize: 48 },
  shopInfo: { padding: 12 },
  shopName: { fontSize: 14, fontWeight: '700', color: '#101828', marginBottom: 4 },
  shopLocation: { fontSize: 12, color: '#6B7280', marginBottom: 3 },
  shopRating: { fontSize: 12, color: '#6B7280' },

  // eBay
  ebayCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', gap: 12 },
  ebayIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  ebayEmoji: { fontSize: 24 },
  ebayBody: { flex: 1, gap: 2 },
  ebayName: { fontSize: 14, fontWeight: '700', color: '#101828' },
  ebaySub: { fontSize: 12, color: '#9CA3AF' },
  ebayCondition: { fontSize: 12, color: '#00A63E', fontWeight: '500' },
  ebayRight: { alignItems: 'flex-end', gap: 6 },
  ebayPrice: { fontSize: 15, fontWeight: '700', color: '#101828' },
  buyBtn: { backgroundColor: '#FF6900', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  buyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // eBay Note
  ebayNote: { flexDirection: 'row', backgroundColor: '#EFF6FF', marginHorizontal: 16, borderRadius: 14, padding: 14, gap: 10, alignItems: 'flex-start' },
  ebayNoteIcon: { fontSize: 18, marginTop: 1 },
  ebayNoteText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  ebayNoteBold: { fontWeight: '700' },
});