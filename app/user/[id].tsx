import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useTheme } from '../../theme/ThemeProvider';
import { type ColorTokens } from '../../constants/colors';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
              // '#fff' kept raw — always-white on brand orange
              ? <ActivityIndicator size="small" color={isFollowing ? colors.text.secondary : '#fff'} />
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
              <Image source={require('../../assets/icons/message.png')} style={{ width: 18, height: 18, tintColor: colors.brand.orange }} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.brand.orange} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.card },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: colors.surface.section,
    },
    navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    navTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },

    profileSection: {
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20,
      borderBottomWidth: 0.5, borderBottomColor: colors.surface.section,
    },
    profileTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 20 },
    avatar: {
      width: 84, height: 84, borderRadius: 42,
      backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.brand.orange,
    },
    avatarImg: { width: 84, height: 84, borderRadius: 42 },
    avatarPlaceholderIcon: { width: 40, height: 40, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center', gap: 2 },
    statNumber: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    statLabel: { fontSize: 12, color: colors.text.secondary },

    profileName: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
    profileBio: { fontSize: 13, color: colors.text.secondary, lineHeight: 18, marginBottom: 12 },

    followBtn: {
      backgroundColor: colors.brand.orange, borderRadius: 12, paddingVertical: 12,
      alignItems: 'center', marginTop: 8,
    },
    msgBtn: {
      backgroundColor: colors.brand.peach, borderRadius: 12, paddingHorizontal: 16,
      alignItems: 'center', justifyContent: 'center', marginTop: 8,
      borderWidth: 1, borderColor: colors.brand.orange,
    },
    followingBtn: { backgroundColor: colors.surface.section, borderWidth: 1, borderColor: colors.border.default },
    // '#fff' kept raw — always-white on brand orange
    followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    followingBtnText: { color: colors.text.primary },
    editBtn: {
      backgroundColor: colors.surface.section, borderRadius: 12, paddingVertical: 12,
      alignItems: 'center', marginTop: 8,
    },
    editBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },

    emptyPosts: { alignItems: 'center', paddingTop: 40 },
    emptyPostsText: { fontSize: 15, color: colors.text.tertiary },

    // Grid
    row: { gap: 1.5 },
    gridItem: { width: GRID_ITEM_W, height: GRID_ITEM_W, marginBottom: 1.5, position: 'relative' },
    gridImg: { width: '100%', height: '100%' },
    gridPlaceholder: { backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center' },
    videoTag: {
      position: 'absolute', top: 6, right: 6,
      // rgba(0,0,0,0.5) kept raw — on-image scrim
      backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
    },
    // '#fff' kept raw — always-white on dark scrim
    videoTagText: { fontSize: 10, color: '#fff' },
    gridOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      // rgba(0,0,0,0.45) kept raw — on-image scrim
      backgroundColor: 'rgba(0,0,0,0.45)',
      flexDirection: 'row', justifyContent: 'space-evenly', padding: 4,
    },
    gridOverlayItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    // '#fff' kept raw — always-white tint on dark scrim
    gridOverlayIcon: { width: 10, height: 10, tintColor: '#fff', resizeMode: 'contain' },
    // rgba(255,255,255,0.9) kept raw — floating text on dark scrim
    gridOverlayText: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  });
}
