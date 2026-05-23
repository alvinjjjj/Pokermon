import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from '../../lib/supabase';
import Loader from '../../components/Loader';

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
  likes_count: number;
  comments_count: number;
  created_at: string;
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { t }   = useTranslation();

  const [profile, setProfile]         = useState<Profile | null>(null);
  const [posts, setPosts]             = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing]   = useState(false);
  const [isMutual, setIsMutual]         = useState(false);
  const [myUserId, setMyUserId]         = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => { if (id) loadAll(); }, [id]);

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setMyUserId(user?.id ?? null);

      const [profileRes, postsRes, followerRes, followingRes, followCheckRes, theyFollowMeRes] = await Promise.all([
        supabase.from('profiles').select('id, username, bio, avatar_url').eq('id', id).single(),
        supabase.from('posts').select('id, media_url, media_type, thumbnail_url, caption, card_name, likes_count, comments_count, created_at')
          .eq('user_id', id).neq('moderation_status', 'rejected').order('created_at', { ascending: false }),
        supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', id),
        user
          ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id).maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('follows').select('id').eq('follower_id', id).eq('following_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setPosts((postsRes.data ?? []) as Post[]);
      setFollowerCount(followerRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
      const iFollow = !!followCheckRes.data;
      const theyFollow = !!theyFollowMeRes.data;
      setIsFollowing(iFollow);
      setIsMutual(iFollow && theyFollow);
    } catch (e) {
      if (__DEV__) console.error('[UserProfile] loadAll error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleFollow = async () => {
    if (!myUserId || !id || myUserId === id) return;
    setFollowLoading(true);

    // Optimistic update
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount(prev => wasFollowing ? Math.max(0, prev - 1) : prev + 1);

    const revert = () => {
      setIsFollowing(wasFollowing);
      setFollowerCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1));
    };

    try {
      if (wasFollowing) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', myUserId).eq('following_id', id);
        if (error) { revert(); if (__DEV__) console.error('[UserProfile] toggleFollow error:', error); return; }
      } else {
        const { error } = await supabase.from('follows')
          .insert({ follower_id: myUserId, following_id: id });
        if (error) { revert(); if (__DEV__) console.error('[UserProfile] toggleFollow error:', error); return; }
      }
    } catch (e) {
      // Revert optimistic update on JS exception
      revert();
      if (__DEV__) console.error('[UserProfile] toggleFollow error:', e);
    } finally {
      setFollowLoading(false);
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const thumb = item.media_type === 'video' ? item.thumbnail_url : item.media_url;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: item.id } })}
      >
        {thumb
          ? <Image source={{ uri: thumb }} style={styles.gridImg} resizeMode="cover" />
          : (
            <View style={[styles.gridImg, styles.gridPlaceholder]} />
          )
        }
        {item.media_type === 'video' && (
          <View style={styles.videoTag}><Text style={styles.videoTagText}>▶</Text></View>
        )}
        {/* Like + comment overlay */}
        <View style={styles.gridOverlay}>
          <View style={styles.gridOverlayItem}>
            <Image source={require('../../assets/icons/love.png')} style={styles.gridOverlayIcon} />
            <Text style={styles.gridOverlayText}>{item.likes_count}</Text>
          </View>
          <View style={styles.gridOverlayItem}>
            <Image source={require('../../assets/icons/message.png')} style={styles.gridOverlayIcon} />
            <Text style={styles.gridOverlayText}>{item.comments_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}><Loader size="large" /></View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = myUserId === id;

  const ListHeader = (
    <View style={styles.profileSection}>
      {/* Avatar */}
      <View style={styles.profileTop}>
        <View style={styles.avatar}>
          {profile?.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            : <Image source={require('../../assets/icons/profile.png')} style={styles.avatarPlaceholderIcon} />
          }
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>{t('profile.posts')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>{t('profile.followers')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>{t('profile.following')}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.profileName}>{profile?.username ?? t('social.user')}</Text>
      {profile?.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}

      {/* Follow / Message / Edit button */}
      {!isOwnProfile ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn, { flex: 1 }]}
            onPress={toggleFollow}
            disabled={followLoading}
          >
            {followLoading
              ? <ActivityIndicator size="small" color={isFollowing ? '#6B7280' : '#fff'} />
              : <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                  {isFollowing ? '✓ ' + t('social.following') : t('social.follow')}
                </Text>
            }
          </TouchableOpacity>
          {isMutual && (
            <TouchableOpacity
              style={styles.msgBtn}
              onPress={async () => {
                if (!myUserId || !id) return;
                const { data: existing } = await supabase
                  .from('conversations')
                  .select('id')
                  .or(`and(buyer_id.eq.${myUserId},seller_id.eq.${id}),and(buyer_id.eq.${id},seller_id.eq.${myUserId})`)
                  .is('listing_id', null)
                  .maybeSingle();
                if (existing) {
                  router.push(`/chat/${existing.id}` as any);
                } else {
                  const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({ buyer_id: myUserId, seller_id: id, listing_id: null })
                    .select('id').single();
                  if (newConv) router.push(`/chat/${newConv.id}` as any);
                }
              }}
            >
              <Image source={require('../../assets/icons/message.png')} style={{ width: 18, height: 18, tintColor: '#FF6900' }} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push('/edit-profile' as any)}
        >
          <Text style={styles.editBtnText}>{t('settings.editProfile')}</Text>
        </TouchableOpacity>
      )}

      {posts.length === 0 && (
        <View style={styles.emptyPosts}>
          <Text style={styles.emptyPostsText}>{t('social.noPosts')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{profile?.username ?? t('social.user')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        numColumns={3}
        ListHeaderComponent={ListHeader}
        renderItem={renderPost}
        columnWrapperStyle={posts.length > 0 ? styles.row : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#FF6900" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navBackText: { fontSize: 28, color: '#101828', fontWeight: '300' },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },

  profileSection: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 20 },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FF6900',
  },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholderIcon: { width: 40, height: 40, tintColor: '#C4C9D4', resizeMode: 'contain' },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 18, fontWeight: '700', color: '#101828' },
  statLabel: { fontSize: 12, color: '#6B7280' },

  profileName: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 4 },
  profileBio: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 12 },

  followBtn: {
    backgroundColor: '#FF6900', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  msgBtn: {
    backgroundColor: '#FFF3E8', borderRadius: 12, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    borderWidth: 1, borderColor: '#FF6900',
  },
  followingBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: '#374151' },
  editBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#101828' },

  emptyPosts: { alignItems: 'center', paddingTop: 40 },
  emptyPostsText: { fontSize: 15, color: '#9CA3AF' },

  // Grid
  row: { gap: 1.5 },
  gridItem: { width: GRID_ITEM_W, height: GRID_ITEM_W, marginBottom: 1.5, position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  gridPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  videoTag: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  videoTagText: { fontSize: 10, color: '#fff' },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row', justifyContent: 'space-evenly', padding: 4,
  },
  gridOverlayItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridOverlayIcon: { width: 10, height: 10, tintColor: '#fff', resizeMode: 'contain' },
  gridOverlayText: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
});
