import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const GRID_ITEM_W = (width - 3) / 3;

type Profile = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  media_url: string | null;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  caption: string | null;
  card_name: string | null;
  created_at: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', user.id),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (postsRes.data) setPosts(postsRes.data);
    setFollowerCount(followersRes.count ?? 0);
    setFollowingCount(followingRes.count ?? 0);

    setLoading(false);
    setRefreshing(false);
  }

  const renderPost = ({ item }: { item: Post }) => {
    const thumb = item.media_type === 'video' ? item.thumbnail_url : item.media_url;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: item.id } })}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.gridImage, styles.gridPlaceholder]}>
            <Text style={styles.gridPlaceholderEmoji}>🃏</Text>
          </View>
        )}
        {item.media_type === 'video' && (
          <View style={styles.videoTag}>
            <Text style={styles.videoTagText}>▶</Text>
          </View>
        )}
        {item.card_name && (
          <View style={styles.cardTag}>
            <Text style={styles.cardTagText} numberOfLines={1}>{item.card_name}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6900" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        numColumns={3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#FF6900" />
        }
        ListHeaderComponent={
          <View>
            {/* Profile Info */}
            <View style={styles.profileSection}>
              <View style={styles.profileTop}>
                {/* Avatar */}
                <TouchableOpacity onPress={() => router.push('/edit-profile' as any)}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarEmoji}>👤</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{posts.length}</Text>
                    <Text style={styles.statLabel}>帖子</Text>
                  </View>
                  <TouchableOpacity style={styles.statItem}>
                    <Text style={styles.statNumber}>{followerCount}</Text>
                    <Text style={styles.statLabel}>粉絲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statItem}>
                    <Text style={styles.statNumber}>{followingCount}</Text>
                    <Text style={styles.statLabel}>關注中</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name & Bio */}
              <Text style={styles.profileName}>
                {profile?.username ?? '未設定名稱'}
              </Text>
              {profile?.bio ? (
                <Text style={styles.profileBio}>{profile.bio}</Text>
              ) : null}

              {/* Actions */}
              <View style={styles.profileActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push('/edit-profile' as any)}
                >
                  <Text style={styles.editBtnText}>編輯個人資料</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.newPostBtn}
                  onPress={() => router.push('/new-post' as any)}
                >
                  <Text style={styles.newPostBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Grid header */}
            {posts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🃏</Text>
                <Text style={styles.emptyTitle}>還沒有帖子</Text>
                <Text style={styles.emptySub}>分享你今天抽到的卡！</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/new-post' as any)}
                >
                  <Text style={styles.emptyBtnText}>+ 發第一篇帖子</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        renderItem={renderPost}
        columnWrapperStyle={posts.length > 0 ? styles.row : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 20,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6900',
  },
  avatarEmoji: { fontSize: 40 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: '#101828' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 4 },
  profileBio: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  profileActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#101828' },
  newPostBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FF6900',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPostBtnText: { fontSize: 22, color: '#fff', fontWeight: '400' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#101828', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  emptyBtn: {
    backgroundColor: '#FF6900',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Grid
  row: { gap: 1.5 },
  gridItem: { width: GRID_ITEM_W, height: GRID_ITEM_W, marginBottom: 1.5 },
  gridImage: { width: '100%', height: '100%' },
  gridPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  gridPlaceholderEmoji: { fontSize: 32 },
  videoTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  videoTagText: { fontSize: 10, color: '#fff' },
  cardTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cardTagText: { fontSize: 10, color: '#fff', fontWeight: '500' },
});