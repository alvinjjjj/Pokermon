import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';

const { width } = Dimensions.get('window');
const VIDEO_ITEM_W = (width - 3) / 2;

const TABS = ['關注中', '卡片開箱'];

const POSTS = [
  { id: '1', user: 'Jamvv', handle: '@jamvv1991', time: '3小時前', pro: true, emoji: '🃏', price: '$51,240', priceLabel: 'Via eBay POP 6', likes: 14, comments: 1, caption: 'Wait that escalated quickly 🔥' },
  { id: '2', user: 'CardCollector', handle: '@collector_hk', time: '5小時前', pro: false, emoji: '⚡', price: '$8,450', priceLabel: 'PSA 10', likes: 28, comments: 5, caption: '終於收到夢想卡片！' },
  { id: '3', user: 'PokeMaster', handle: '@pokemaster', time: '8小時前', pro: true, emoji: '🔥', price: '$12,800', priceLabel: 'BGS 9.5', likes: 42, comments: 8, caption: '今日最大收穫 💪' },
];

const VIDEOS = [
  { id: '1', emoji: '🔥', views: '4.9K' },
  { id: '2', emoji: '⚡', views: '3M' },
  { id: '3', emoji: '🃏', views: '12.7K' },
  { id: '4', emoji: '💎', views: '18.3K' },
  { id: '5', emoji: '⭐', views: '6.2K' },
  { id: '6', emoji: '🏆', views: '45K' },
  { id: '7', emoji: '🎯', views: '8.1K' },
  { id: '8', emoji: '🔮', views: '22.5K' },
  { id: '9', emoji: '✨', views: '15.7K' },
];

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState('關注中');

  return (
    <SafeAreaView style={styles.safe}>
      <Header />

      {/* Search Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>搜索用戶和貼文標題</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}><Text style={styles.iconText}>💬</Text></TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}><Text style={styles.iconText}>📷</Text></TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* 卡片開箱 Grid */}
      {activeTab === '卡片開箱' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.videoGrid}>
            {VIDEOS.map(v => (
              <TouchableOpacity key={v.id} style={styles.videoItem}>
                <View style={styles.videoThumb}>
                  <Text style={styles.videoEmoji}>{v.emoji}</Text>
                  <View style={styles.viewsRow}>
                    <Text style={styles.playIcon}>▶</Text>
                    <Text style={styles.viewsText}>{v.views}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* 關注中 */}
      {activeTab === '關注中' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {POSTS.map(post => (
            <View key={post.id} style={styles.postWrap}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>👤</Text>
                </View>
                <View style={styles.postMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{post.user}</Text>
                    {post.pro && (
                      <View style={styles.proBadge}>
                        <Text style={styles.proText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.handle}>{post.handle} • {post.time}</Text>
                </View>
                <View style={styles.postActions}>
                  {!post.pro && (
                    <TouchableOpacity style={styles.followBtn}>
                      <Text style={styles.followText}>關注</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.moreBtn}>
                    <Text style={styles.moreText}>⋮</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.postCard}>
                <Text style={styles.cardEmojiText}>{post.emoji}</Text>
                <Text style={styles.postPrice}>{post.price}</Text>
                <Text style={styles.postPriceLabel}>{post.priceLabel}</Text>
              </View>
              <View style={styles.postFooter}>
                <TouchableOpacity style={styles.footerBtn}>
                  <Text style={styles.footerIcon}>🤍</Text>
                  <Text style={styles.footerCount}>{post.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerBtn}>
                  <Text style={styles.footerIcon}>💬</Text>
                  <Text style={styles.footerCount}>{post.comments}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.captionWrap}>
                <Text style={styles.captionText}>
                  <Text style={styles.captionHandle}>{post.handle} </Text>
                  {post.caption}
                </Text>
              </View>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },

  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', paddingHorizontal: 16 },
  tabBtn: { marginRight: 24, paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#FF6900', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6900', borderRadius: 2 },

  // Video Grid
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  videoItem: { width: VIDEO_ITEM_W },
  videoThumb: { width: VIDEO_ITEM_W, height: VIDEO_ITEM_W * 1.3, backgroundColor: '#0F1923', alignItems: 'center', justifyContent: 'center' },
  videoEmoji: { fontSize: 56 },
  viewsRow: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  playIcon: { fontSize: 10, color: '#fff' },
  viewsText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Posts
  postWrap: { borderBottomWidth: 8, borderBottomColor: '#F9FAFB' },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20 },
  postMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: '#101828' },
  proBadge: { backgroundColor: '#FF6900', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  proText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  handle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  followBtn: { backgroundColor: '#FF6900', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  followText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  moreBtn: { padding: 4 },
  moreText: { fontSize: 20, color: '#9CA3AF' },
  postCard: { backgroundColor: '#0F1923', paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  cardEmojiText: { fontSize: 72, marginBottom: 24 },
  postPrice: { fontSize: 36, fontWeight: '800', color: '#fff' },
  postPriceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  postFooter: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerIcon: { fontSize: 18 },
  footerCount: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  captionWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  captionText: { fontSize: 14, color: '#101828', lineHeight: 20 },
  captionHandle: { fontWeight: '700' },
});