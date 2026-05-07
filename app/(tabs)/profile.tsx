import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';

const { width } = Dimensions.get('window');
const GRID_ITEM_W = (width - 4) / 3;

const MY_POSTS = [
  { id: '1', emoji: '🔥', hasVideo: false },
  { id: '2', emoji: '⚡', hasVideo: true },
  { id: '3', emoji: '🃏', hasVideo: false },
  { id: '4', emoji: '💎', hasVideo: true },
  { id: '5', emoji: '⭐', hasVideo: false },
  { id: '6', emoji: '🏆', hasVideo: false },
  { id: '7', emoji: '🎯', hasVideo: true },
  { id: '8', emoji: '🔮', hasVideo: false },
  { id: '9', emoji: '✨', hasVideo: false },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileTop}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>👤</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>156</Text>
                <Text style={styles.statLabel}>帖子</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>2.4K</Text>
                <Text style={styles.statLabel}>粉絲</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>342</Text>
                <Text style={styles.statLabel}>關注中</Text>
              </View>
            </View>
          </View>

          <Text style={styles.profileName}>收藏家玩家</Text>
          <Text style={styles.profileBio}>🃏 香港卡片收藏愛好者 | Pokemon TCG | 交流換卡</Text>

          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>編輯個人資料</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts Grid */}
        <View style={styles.myPostsGrid}>
          {MY_POSTS.map(p => (
            <TouchableOpacity key={p.id} style={styles.myPostItem}>
              <View style={styles.myPostThumb}>
                {p.hasVideo && (
                  <View style={styles.videoIndicator}>
                    <Text style={styles.videoIndicatorText}>▶</Text>
                  </View>
                )}
                <Text style={styles.myPostEmoji}>{p.emoji}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  // Profile
  profileSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  profileTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 24 },
  avatarLarge: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { fontSize: 42 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: '#101828' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 4 },
  profileBio: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 14 },
  profileActions: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#101828' },
  addBtn: { width: 44, height: 44, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 20, color: '#101828' },

  // Grid
  myPostsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  myPostItem: { width: GRID_ITEM_W },
  myPostThumb: { width: GRID_ITEM_W, height: GRID_ITEM_W, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  videoIndicator: { position: 'absolute', top: 8, right: 8 },
  videoIndicatorText: { fontSize: 12, color: '#6B7280' },
  myPostEmoji: { fontSize: 40 },
});