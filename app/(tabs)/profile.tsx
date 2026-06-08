import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import Loader from '../../components/Loader';
import { supabase } from '../../lib/supabase';
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
  user_id: string;
  media_url: string | null;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  caption: string | null;
  card_name: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  profiles?: { username: string | null; avatar_url: string | null } | null;
};

type SubTab = 'posts' | 'following' | 'feed';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [feed, setFeed] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SubTab>('posts');

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  async function loadAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Step 1: parallel fetch — profile / my posts / counts / community feed /
      // who I follow (need follow list to build the 「關注中」feed)
      const [profileRes, postsRes, followersRes, followingRes, feedRes, followIdsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('posts').select('id, user_id, media_url, media_type, thumbnail_url, caption, card_name, created_at, likes_count, comments_count')
          .eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
        supabase.from('posts').select('id, user_id, media_url, media_type, thumbnail_url, caption, card_name, created_at, likes_count, comments_count')
          .neq('moderation_status', 'rejected').order('created_at', { ascending: false }).limit(20),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (postsRes.data) setPosts(postsRes.data as Post[]);
      setFollowerCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);

      // Step 2: fetch following-feed posts (from users I follow)
      const followedIds = (followIdsRes.data ?? []).map(r => r.following_id as string);
      let followingPostsData: Post[] = [];
      if (followedIds.length > 0) {
        const { data: fp } = await supabase
          .from('posts')
          .select('id, user_id, media_url, media_type, thumbnail_url, caption, card_name, created_at, likes_count, comments_count')
          .in('user_id', followedIds)
          .neq('moderation_status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(20);
        followingPostsData = (fp ?? []) as Post[];
      }

      // Step 3: enrich both feed + followingPosts with profile info (mini join)
      const allPostsToEnrich = [...(feedRes.data ?? []), ...followingPostsData];
      const uniqueUserIds = [...new Set(allPostsToEnrich.map(p => p.user_id as string))];
      let profilesMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles').select('id, username, avatar_url').in('id', uniqueUserIds);
        for (const p of profilesData ?? []) profilesMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
      }
      const enrich = (arr: any[]): Post[] => arr.map(p => ({ ...p, profiles: profilesMap[p.user_id] ?? null }));
      setFeed(enrich(feedRes.data ?? []));
      setFollowingPosts(enrich(followingPostsData));
    } catch (e) {
      if (__DEV__) console.error('[Profile] loadAll error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function goToEditProfile() {
    router.push('/edit-profile' as any);
  }

  function goToNewPost() {
    router.push('/new-post' as any);
  }

  // ─── Renderers per sub-tab ─────────────────────────────────────────

  const renderPost = ({ item }: { item: Post }) => {
    const thumb = item.media_type === 'video' ? item.thumbnail_url : item.media_url;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: item.id } })}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.gridImage, styles.gridPlaceholder]} />
        )}
        {item.media_type === 'video' && (
          <View style={styles.videoTag}>
            <Text style={styles.videoTagText}>▶</Text>
          </View>
        )}
        <View style={styles.statsOverlay}>
          <View style={styles.statsOverlayItem}>
            <Image source={require('../../assets/icons/love.png')} style={styles.statsOverlayIcon} />
            <Text style={styles.statsOverlayText}>{item.likes_count ?? 0}</Text>
          </View>
          <View style={styles.statsOverlayItem}>
            <Image source={require('../../assets/icons/message.png')} style={styles.statsOverlayIcon} />
            <Text style={styles.statsOverlayText}>{item.comments_count ?? 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFeedItem = ({ item }: { item: Post }) => {
    const thumb = item.media_type === 'video' ? item.thumbnail_url : item.media_url;
    return (
      <TouchableOpacity
        style={styles.feedRow}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: item.id } })}
      >
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: item.user_id } })}
        >
          {item.profiles?.avatar_url
            ? <Image source={{ uri: item.profiles.avatar_url }} style={styles.feedAvatar} />
            : <View style={styles.feedAvatar}><Image source={require('../../assets/icons/profile.png')} style={styles.feedAvatarIcon} /></View>
          }
        </TouchableOpacity>
        <View style={styles.feedBody}>
          <Text style={styles.feedUser} numberOfLines={1}>
            {item.profiles?.username ?? t('social.user')}
          </Text>
          {item.caption ? (
            <Text style={styles.feedCaption} numberOfLines={2}>{item.caption}</Text>
          ) : item.card_name ? (
            <Text style={styles.feedCaption} numberOfLines={1}>{item.card_name}</Text>
          ) : null}
          <View style={styles.feedMetaRow}>
            <Image source={require('../../assets/icons/love.png')} style={styles.feedMetaIcon} />
            <Text style={styles.feedMetaText}>{item.likes_count}</Text>
            <Image source={require('../../assets/icons/message.png')} style={[styles.feedMetaIcon, { marginLeft: 10 }]} />
            <Text style={styles.feedMetaText}>{item.comments_count}</Text>
          </View>
        </View>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.feedThumb} resizeMode="cover" />
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface.section }]}>
        <Header />
        <View style={styles.center}>
          <Loader size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Header (shared across all sub-tabs) ─────────────────────────
  const ListHeader = (
    <View>
      <View style={styles.profileSection}>
        <View style={styles.profileTop}>
          <TouchableOpacity onPress={goToEditProfile}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Image source={require('../../assets/icons/profile.png')} style={styles.avatarEmoji} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>{t('profile.posts')}</Text>
            </View>
            <TouchableOpacity
              style={styles.statItem}
              activeOpacity={0.6}
              onPress={() => router.push('/followers' as any)}
            >
              <Text style={styles.statNumber}>{followerCount}</Text>
              <Text style={styles.statLabel}>{t('profile.followers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              activeOpacity={0.6}
              onPress={() => router.push('/following' as any)}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>{t('profile.following')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.profileName}>
          {profile?.username ?? t('settings.nameNotSet')}
        </Text>
        {profile?.bio ? (
          <Text style={styles.profileBio}>{profile.bio}</Text>
        ) : null}

        <View style={styles.profileActions}>
          <TouchableOpacity style={styles.editBtn} onPress={goToEditProfile}>
            <Text style={styles.editBtnText}>{t('settings.editProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newPostBtn} onPress={goToNewPost}>
            <Text style={styles.newPostBtnText}>＋</Text>
          </TouchableOpacity>
        </View>

        {/* 賣家入口 + 訊息收件箱 (同一行) */}
        <View style={styles.entryRow}>
          <TouchableOpacity
            style={[styles.entryBtnHalf, styles.entryBtnSeller]}
            onPress={() => router.push('/my-listings' as any)}
          >
            <Image source={require('../../assets/icons/shops.png')} style={[styles.entryBtnIcon, { tintColor: '#FF6900' }]} />
            <Text style={[styles.entryBtnText, { color: '#FF6900' }]} numberOfLines={1}>{t('profile.myListings')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.entryBtnHalf, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]}
            onPress={() => router.push('/(tabs)/inbox' as any)}
          >
            <Image source={require('../../assets/icons/message.png')} style={[styles.entryBtnIcon, { tintColor: '#6B7280' }]} />
            <Text style={[styles.entryBtnText, { color: '#6B7280' }]} numberOfLines={1}>{t('profile.messages')}</Text>
          </TouchableOpacity>
        </View>

        {/* Phase B.5 lite · Reservations entry (full-width row below My
            Listings / Messages). Single-line minimal styling matches the
            entryRow visual weight without crowding the 2-button row above. */}
        <TouchableOpacity
          style={styles.reservationsEntry}
          onPress={() => router.push('/my-reservations' as any)}
        >
          <Text style={styles.reservationsEntryText} numberOfLines={1}>
            {t('myReservations.menuItem')}
          </Text>
          <Text style={styles.reservationsEntryArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tab control (Instagram style) */}
      <View style={styles.tabBar}>
        {(['posts', 'following', 'feed'] as SubTab[]).map((k) => {
          const active = activeTab === k;
          const label =
            k === 'posts'     ? t('profile.tabPosts') :
            k === 'following' ? t('profile.tabFollowing') :
                                t('profile.tabFeed');
          const icon =
            k === 'posts'     ? require('../../assets/icons/portfolio.png') :
            k === 'following' ? require('../../assets/icons/profile.png') :
                                require('../../assets/icons/social.png');
          return (
            <TouchableOpacity
              key={k}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(k)}
              activeOpacity={0.7}
            >
              <Image source={icon} style={[styles.tabIcon, { tintColor: active ? '#FF6900' : '#9CA3AF' }]} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Empty-state for posts tab */}
      {activeTab === 'posts' && posts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('social.noPosts')}</Text>
          <Text style={styles.emptySub}>{t('profile.shareCard')}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={goToNewPost}>
            <Text style={styles.emptyBtnText}>{t('profile.firstPost')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty-state for following tab */}
      {activeTab === 'following' && followingPosts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('profile.noFollowingPosts')}</Text>
          <Text style={styles.emptySub}>{t('profile.followToSeeFeed')}</Text>
        </View>
      )}

      {/* Empty-state for feed tab */}
      {activeTab === 'feed' && feed.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('profile.noFeed')}</Text>
          <Text style={styles.emptySub}>{t('profile.followToSeeFeed')}</Text>
        </View>
      )}

      {/* "View full feed" link — on feed/following tabs (full /social has
          推薦/關注/開盒 三個分頁，包含 unboxing) */}
      {(activeTab === 'feed' || activeTab === 'following') &&
        (activeTab === 'feed' ? feed.length > 0 : followingPosts.length > 0) && (
        <TouchableOpacity
          style={styles.viewAllBar}
          onPress={() => router.push('/(tabs)/social' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>{t('profile.viewFullFeed')}</Text>
          <Text style={styles.viewAllArrow}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── Pick data per sub-tab ───────────────────────────────────────
  const data =
    activeTab === 'posts'     ? posts :
    activeTab === 'following' ? followingPosts :
                                 feed;

  // Posts grid (3-col) for own posts; single-column feed for following/social
  const renderItem =
    activeTab === 'posts' ? renderPost : renderFeedItem;

  const numCols = activeTab === 'posts' ? 3 : 1;
  // FlatList requires re-mount when numColumns changes — key on activeTab.
  const listKey = `tab-${activeTab}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface.section }]}>
      <Header />
      <FlatList
        key={listKey}
        data={data as any[]}
        keyExtractor={(item: any) => item.id}
        numColumns={numCols}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#FF6900" />
        }
        ListHeaderComponent={ListHeader}
        renderItem={renderItem as any}
        columnWrapperStyle={numCols > 1 && data.length > 0 ? styles.row : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.card },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    profileSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.default,
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
      backgroundColor: colors.surface.section,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.brand.orange,
    },
    avatarEmoji: { width: 40, height: 40, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4 },
    statNumber: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    statLabel: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    profileName: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
    profileBio: { fontSize: 13, color: colors.text.secondary, lineHeight: 18, marginBottom: 12 },
    profileActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    editBtn: {
      flex: 1,
      backgroundColor: colors.surface.section,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    editBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    newPostBtn: {
      width: 44,
      height: 44,
      backgroundColor: colors.brand.orange,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // newPostBtnText '#fff' kept raw — always-white on Card Orange
    newPostBtnText: { fontSize: 22, color: '#fff', fontWeight: '400' },
    entryBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 13, borderWidth: 1, marginTop: 10 },
    entryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    entryBtnHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 13, borderWidth: 1 },
    entryBtnSeller: { backgroundColor: colors.brand.peach, borderColor: colors.brand.peach },
    // Phase B.5 lite · Reservations row below My Listings / Messages
    reservationsEntry: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface.section, borderColor: colors.border.default,
      borderWidth: 1, borderRadius: 14,
      paddingVertical: 13, paddingHorizontal: 16,
      marginTop: 10,
    },
    reservationsEntryText:  { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    reservationsEntryArrow: { fontSize: 18, color: colors.text.tertiary },
    entryBtnIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: colors.text.secondary },
    entryBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },

    // Sub-tab bar
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.default,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: { borderBottomColor: colors.brand.orange },
    tabIcon: { width: 16, height: 16, resizeMode: 'contain' },
    tabLabel: { fontSize: 13, fontWeight: '600', color: colors.text.tertiary },
    tabLabelActive: { color: colors.brand.orange },

    // View-all bar (only on feed tab)
    viewAllBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.brand.peach,
      marginHorizontal: 12,
      marginTop: 10,
      borderRadius: 10,
    },
    viewAllText: { fontSize: 13, fontWeight: '600', color: colors.brand.orange },
    viewAllArrow: { fontSize: 20, color: colors.brand.orange, marginTop: -2 },

    emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: 6, textAlign: 'center' },
    emptySub: { fontSize: 13, color: colors.text.tertiary, marginBottom: 20, textAlign: 'center' },
    emptyBtn: {
      backgroundColor: colors.brand.orange,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    // emptyBtnText '#fff' kept raw — on Card Orange
    emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

    row: { gap: 1.5 },
    gridItem: { width: GRID_ITEM_W, height: GRID_ITEM_W, marginBottom: 1.5 },
    gridImage: { width: '100%', height: '100%' },
    gridPlaceholder: { backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center' },
    placeholderIcon: { width: 28, height: 28, tintColor: colors.border.strong, resizeMode: 'contain' },

    // videoTag overlays on top of image — keep rgba scrim + '#fff' text
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

    qtyTag: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    qtyTagText: { fontSize: 10, color: '#fff', fontWeight: '700' },

    psaTag: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: colors.brand.orange,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    // psaTagText '#fff' kept raw — on Card Orange
    psaTagText: { fontSize: 9, color: '#fff', fontWeight: '700' },

    statsOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    statsOverlayItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statsOverlayIcon: { width: 10, height: 10, tintColor: '#fff', resizeMode: 'contain' },
    statsOverlayText: { fontSize: 10, color: '#fff', fontWeight: '700' },

    // Feed (single-column list)
    feedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.default,
    },
    feedAvatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surface.section,
      alignItems: 'center', justifyContent: 'center',
    },
    feedAvatarIcon: { width: 20, height: 20, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    feedBody: { flex: 1, minWidth: 0 },
    feedUser: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    feedCaption: { fontSize: 13, color: colors.text.primary, marginTop: 2 },
    feedMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    feedMetaIcon: { width: 12, height: 12, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    feedMetaText: { fontSize: 11, color: colors.text.tertiary, marginLeft: 3 },
    feedThumb: { width: 56, height: 56, borderRadius: 8 },
  });
}
