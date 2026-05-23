import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import Loader from '../../components/Loader';

const { width } = Dimensions.get('window');

type Post = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  caption: string | null;
  card_name: string | null;
  set_name: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  moderation_status?: string | null;
  post_category?: string | null;
  profiles: { username: string | null; avatar_url: string | null } | null;
};

type FeedTab = 'recommended' | 'following' | 'unboxing';
const FEED_TAB_KEYS: FeedTab[] = ['recommended', 'following', 'unboxing'];

function timeAgo(d: string, t: (k: string, opts?: any) => string): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60)    return t('social.justNow');
  if (s < 3600)  return t('social.minutesAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return t('social.hoursAgo',   { n: Math.floor(s / 3600) });
  return t('social.daysAgo', { n: Math.floor(s / 86400) });
}

export default function SocialScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const FEED_TAB_LABELS: Record<FeedTab, string> = {
    recommended: t('social.tabRecommended'),
    following:   t('social.tabFollowing'),
    unboxing:    t('social.tabUnboxing'),
  };

  const [activeTab, setActiveTab]       = useState<FeedTab>('recommended');
  const [allPosts, setAllPosts]         = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [videos, setVideos]             = useState<Post[]>([]);
  const [likedIds, setLikedIds]         = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [myUserId, setMyUserId]         = useState<string | null>(null);
  const followInProgress                = useRef<Set<string>>(new Set());
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [loadError, setLoadError]       = useState(false);
  // Pagination — cursor on `created_at`. Each page = PAGE_SIZE raw posts;
  // user scrolls to ~80% of bottom to trigger loadMore.
  const PAGE_SIZE = 50;
  const [hasMore, setHasMore]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const oldestCursorRef                 = useRef<string | null>(null);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  /**
   * Enrich raw posts with profile data and bucket into 3 lists.
   * Pure function — caller decides whether to replace or append.
   */
  const enrichAndBucket = async (
    rawPosts: any[],
    fIds: Set<string>,
    selfId: string,
  ): Promise<{ all: Post[]; following: Post[]; videos: Post[] }> => {
    const uniqueUserIds = [...new Set(rawPosts.map((p: any) => p.user_id as string))];
    let profileMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
    if (uniqueUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', uniqueUserIds);
      for (const p of profilesData ?? []) {
        profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
      }
    }
    const enriched: Post[] = rawPosts.map((p: any) => ({
      ...p,
      profiles: profileMap[p.user_id] ?? null,
    }));
    const notRejected = enriched.filter(p => p.moderation_status !== 'rejected');
    const feedIds = new Set([...fIds, selfId]);
    return {
      all: notRejected,
      following: notRejected.filter(p => feedIds.has(p.user_id)),
      videos: notRejected.filter(
        p => p.post_category === 'unboxing' || (!p.post_category && p.media_type === 'video'),
      ),
    };
  };

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { return; }
      setMyUserId(user.id);

      const { data: followData } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id);
      const fIds = new Set((followData ?? []).map((f: any) => f.following_id as string));
      setFollowingIds(fIds);

      const { data: rawPosts } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      const allRaw = (rawPosts ?? []) as any[];
      const buckets = await enrichAndBucket(allRaw, fIds, user.id);
      setAllPosts(buckets.all);
      setFollowingPosts(buckets.following);
      setVideos(buckets.videos);
      setHasMore(allRaw.length === PAGE_SIZE);
      oldestCursorRef.current = allRaw.length > 0
        ? allRaw[allRaw.length - 1].created_at
        : null;

      const { data: likesData } = await supabase
        .from('post_likes').select('post_id').eq('user_id', user.id);
      setLikedIds(new Set((likesData ?? []).map((l: any) => l.post_id as string)));

    } catch (e) {
      if (__DEV__) console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /** Cursor pagination — append posts older than `oldestCursorRef`. */
  const loadMore = async () => {
    if (loadingMore || !hasMore || !myUserId || !oldestCursorRef.current) return;
    setLoadingMore(true);
    try {
      const { data: rawPosts } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .lt('created_at', oldestCursorRef.current)
        .limit(PAGE_SIZE);

      const allRaw = (rawPosts ?? []) as any[];
      if (allRaw.length === 0) {
        setHasMore(false);
        return;
      }
      const buckets = await enrichAndBucket(allRaw, followingIds, myUserId);
      // Defensive dedupe — DB races could in theory return overlapping rows.
      const merge = (existing: Post[], incoming: Post[]) => {
        const seen = new Set(existing.map(p => p.id));
        return [...existing, ...incoming.filter(p => !seen.has(p.id))];
      };
      setAllPosts(prev => merge(prev, buckets.all));
      setFollowingPosts(prev => merge(prev, buckets.following));
      setVideos(prev => merge(prev, buckets.videos));
      setHasMore(allRaw.length === PAGE_SIZE);
      oldestCursorRef.current = allRaw[allRaw.length - 1].created_at;
    } catch (e) {
      if (__DEV__) console.error('[loadMore]', e);
    } finally {
      setLoadingMore(false);
    }
  };

  /** Trigger loadMore when user nears bottom of any ScrollView feed tab. */
  const handleFeedScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < 600) loadMore();
  };

  // ── 舉報 ──────────────────────────────────────────────────────────────────────

  const reportPost = (post: Post) => {
    const reasons: { label: string; value: string }[] = [
      { label: t('social.reportAdult'),         value: 'adult_content' },
      { label: t('social.reportViolence'),      value: 'violence' },
      { label: t('social.reportSpam'),          value: 'spam' },
      { label: t('social.reportMisinfo'),       value: 'misinformation' },
      { label: t('social.reportOther'),         value: 'other' },
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title:   t('social.reportTitle'),
          message: t('social.reportMsg'),
          options: [...reasons.map(r => r.label), t('common.cancel')],
          cancelButtonIndex: reasons.length,
          destructiveButtonIndex: 0,
        },
        async (idx) => {
          if (idx >= reasons.length) return;
          await submitReport(post.id, reasons[idx].value);
        }
      );
    } else {
      Alert.alert(t('social.reportTitle'), t('social.reportMsg'),
        [
          ...reasons.map(r => ({
            text: r.label,
            onPress: () => submitReport(post.id, r.value),
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
    }
  };

  const submitReport = async (postId: string, reason: string) => {
    if (!myUserId) return;
    const { error } = await supabase.from('post_reports').insert({
      post_id:     postId,
      reporter_id: myUserId,
      reason,
    });
    if (error?.code === '23505') {
      Alert.alert(t('social.alreadyReported'), t('social.alreadyReportedMsg'));
    } else if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(t('social.reportSubmitted'), t('social.reportSubmittedMsg'));
    }
  };

  // ── 讚好 toggle ──────────────────────────────────────────────────────────────

  const toggleLike = async (post: Post) => {
    if (!myUserId) return;
    const isLiked = likedIds.has(post.id);
    const delta = isLiked ? -1 : 1;

    // Optimistic update
    setLikedIds(prev => { const s = new Set(prev); isLiked ? s.delete(post.id) : s.add(post.id); return s; });
    const updateCount = (arr: Post[]) =>
      arr.map(p => p.id === post.id ? { ...p, likes_count: Math.max(0, p.likes_count + delta) } : p);
    setAllPosts(updateCount);
    setFollowingPosts(updateCount);

    let dbError = false;
    if (isLiked) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', myUserId);
      if (error) dbError = true;
    } else {
      const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: myUserId });
      if (error) dbError = true;
    }

    if (dbError) {
      // Revert optimistic update on failure
      setLikedIds(prev => { const s = new Set(prev); isLiked ? s.add(post.id) : s.delete(post.id); return s; });
      const revertCount = (arr: Post[]) =>
        arr.map(p => p.id === post.id ? { ...p, likes_count: Math.max(0, p.likes_count - delta) } : p);
      setAllPosts(revertCount);
      setFollowingPosts(revertCount);
      Alert.alert(t('social.likeFailed'), t('social.likeFailedMsg'));
      return;
    }
  };

  // ── Follow/Unfollow toggle ────────────────────────────────────────────────────

  const toggleFollow = async (targetId: string) => {
    if (!myUserId || targetId === myUserId) return;
    if (followInProgress.current.has(targetId)) return; // debounce double-tap
    followInProgress.current.add(targetId);

    const isFollowing = followingIds.has(targetId);

    // Optimistic update
    setFollowingIds(prev => {
      const s = new Set(prev);
      isFollowing ? s.delete(targetId) : s.add(targetId);
      return s;
    });

    const revert = () => {
      setFollowingIds(prev => {
        const s = new Set(prev);
        isFollowing ? s.add(targetId) : s.delete(targetId);
        return s;
      });
    };

    try {
      const { error } = isFollowing
        ? await supabase.from('follows').delete().eq('follower_id', myUserId).eq('following_id', targetId)
        : await supabase.from('follows').insert({ follower_id: myUserId, following_id: targetId });

      if (error) {
        revert();
        if (__DEV__) console.error('[Social] toggleFollow DB error:', error);
      }
    } catch (e) {
      revert();
      if (__DEV__) console.error('[Social] toggleFollow error:', e);
    } finally {
      followInProgress.current.delete(targetId);
    }
  };

  // ── Post render ───────────────────────────────────────────────────────────────

  const renderPost = (post: Post) => {
    const profile  = post.profiles;
    const isLiked  = likedIds.has(post.id);
    const isOwn    = post.user_id === myUserId;
    const isFollowing = followingIds.has(post.user_id);
    const mediaUrl = post.media_type === 'video' ? post.thumbnail_url : post.media_url;

    return (
      <View key={post.id} style={styles.postWrap}>
        {/* Header row */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: post.user_id } })}
          >
            {profile?.avatar_url
              ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
              : <View style={styles.avatarPlaceholder}><Image source={require('../../assets/icons/profile.png')} style={styles.avatarText} /></View>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postMeta}
            onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: post.user_id } })}
          >
            <Text style={styles.userName}>{profile?.username ?? t('social.user')}</Text>
            <Text style={styles.handle}>
              @{(profile?.username ?? 'user').toLowerCase().replace(/\s/g, '')} · {timeAgo(post.created_at, t)}
            </Text>
          </TouchableOpacity>

          {!isOwn && (
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              onPress={() => toggleFollow(post.user_id)}
            >
              <Text style={[styles.followText, isFollowing && styles.followingText]}>
                {isFollowing ? t('social.following') : t('social.follow')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Media — tap to open post detail */}
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: post.id } })}
        >
          {mediaUrl
            ? <Image source={{ uri: mediaUrl }} style={styles.postMedia} resizeMode="cover" />
            : (
              <View style={styles.postCard}>
                <View style={styles.postCardInner}>
                  <Image source={require('../../assets/icons/portfolio.png')} style={styles.cardPlaceholderIcon} />
                  {post.card_name && <Text style={styles.postCardName}>{post.card_name}</Text>}
                  {post.set_name  && <Text style={styles.postSetName}>{post.set_name}</Text>}
                </View>
              </View>
            )
          }
          {post.media_type === 'video' && (
            <View style={styles.videoPlayOverlay}>
              <Text style={styles.videoPlayIcon}>▶</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.footerBtn} onPress={() => toggleLike(post)}>
            <Image
              source={require('../../assets/icons/love.png')}
              style={[styles.footerIcon, { tintColor: isLiked ? '#E7000B' : '#9CA3AF' }]}
            />
            <Text style={[styles.footerCount, isLiked && { color: '#E7000B' }]}>{post.likes_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: post.id } })}
          >
            <Image
              source={require('../../assets/icons/message.png')}
              style={[styles.footerIcon, { tintColor: '#9CA3AF' }]}
            />
            <Text style={styles.footerCount}>{post.comments_count}</Text>
          </TouchableOpacity>
          {/* 舉報 — 只對非自己帖子顯示 */}
          {!isOwn && (
            <TouchableOpacity
              style={[styles.footerBtn, { marginLeft: 'auto' }]}
              onPress={() => reportPost(post)}
            >
              <Text style={styles.reportIcon}>⚑</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Caption */}
        {post.caption ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: post.id } })}
            activeOpacity={0.8}
          >
            <View style={styles.captionWrap}>
              <Text style={styles.captionText}>
                <Text style={styles.captionHandle}>{profile?.username ?? t('social.user')} </Text>
                {post.caption}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Comments hint */}
        {post.comments_count > 0 && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: post.id } })}
          >
            <Text style={styles.viewComments}>{t('social.viewComments', { n: post.comments_count })}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Video grid ────────────────────────────────────────────────────────────────

  const VIDEO_W = (width - 3) / 2;

  const renderVideoGrid = () => (
    <View style={styles.videoGrid}>
      {videos.map(v => {
        const thumb = v.thumbnail_url ?? v.media_url;
        return (
          <TouchableOpacity
            key={v.id}
            style={[styles.videoItem, { width: VIDEO_W }]}
            onPress={() => router.push({ pathname: '/post-detail' as any, params: { id: v.id } })}
          >
            <View style={styles.videoThumb}>
              {thumb
                ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                : null
              }
              <View style={styles.videoOverlay}>
                <Text style={styles.videoPlayIconSmall}>▶</Text>
                <Text style={styles.videoUser} numberOfLines={1}>{v.profiles?.username ?? t('social.user')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Current feed data ─────────────────────────────────────────────────────────

  const currentPosts = activeTab === 'recommended' ? allPosts : followingPosts;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <Header />

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {FEED_TAB_KEYS.map(key => (
          <TouchableOpacity
            key={key}
            style={styles.tabBtn}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{FEED_TAB_LABELS[key]}</Text>
            {activeTab === key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Unboxing tab */}
      {activeTab === 'unboxing' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#FF6900" />}
          onScroll={handleFeedScroll}
          scrollEventThrottle={400}
        >
          {loading
            ? <View style={styles.loadingWrap}><Loader size="large" /></View>
            : videos.length === 0
              ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{t('social.noVideos')}</Text>
                  <Text style={styles.emptySub}>{t('social.noVideosSub')}</Text>
                </View>
              )
              : renderVideoGrid()
          }
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Recommended / Following Feed */}
      {activeTab !== 'unboxing' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor="#FF6900" />}
          onScroll={handleFeedScroll}
          scrollEventThrottle={400}
        >
          {loading
            ? <View style={styles.loadingWrap}><Loader size="large" /></View>
            : loadError
              ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{t('common.loadFailed')}</Text>
                  <Text style={styles.emptySub}>{t('social.checkNetworkRetry')}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoadError(false); loadAll(); }}>
                    <Text style={styles.retryBtnText}>{t('common.reload')}</Text>
                  </TouchableOpacity>
                </View>
              )
            : currentPosts.length === 0
              ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'following'
                      ? (followingIds.size > 0 ? t('social.followingNoPosts') : t('social.notFollowingAnyone'))
                      : t('social.noPosts')}
                  </Text>
                  <Text style={styles.emptySub}>
                    {activeTab === 'following'
                      ? (followingIds.size > 0 ? t('social.waitForPosts') : t('social.discoverCollectors'))
                      : t('social.noPostsSub')}
                  </Text>
                </View>
              )
              : currentPosts.map(renderPost)
          }
          {loadingMore && !loading && (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color="#FF6900" />
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  // Tabs
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#101828', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2.5, backgroundColor: '#FF6900', borderRadius: 2 },

  // Post
  postWrap: { borderBottomWidth: 8, borderBottomColor: '#F3F4F6', marginBottom: 0 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  avatarWrap: {},
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { width: 20, height: 20, tintColor: '#C4C9D4', resizeMode: 'contain' },
  postMeta: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '700', color: '#101828' },
  handle: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  followBtn: { borderWidth: 1.5, borderColor: '#FF6900', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  followingBtn: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  followText: { fontSize: 12, fontWeight: '700', color: '#FF6900' },
  followingText: { color: '#6B7280' },

  postMedia: { width: '100%', aspectRatio: 1 },
  postCard: { width: '100%', height: 300, backgroundColor: '#0F1923' },
  postCardInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  cardPlaceholderIcon: { width: 52, height: 52, tintColor: 'rgba(255,255,255,0.15)', resizeMode: 'contain' },
  postCardName: { fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center' },
  postSetName: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  videoPlayIcon: { fontSize: 36, color: '#fff' },

  postFooter: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 10 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerIcon: { width: 22, height: 22, resizeMode: 'contain' },
  footerCount: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  captionWrap: { paddingHorizontal: 14, paddingBottom: 4 },
  captionText: { fontSize: 14, color: '#101828', lineHeight: 20 },
  captionHandle: { fontWeight: '700' },
  viewComments: { paddingHorizontal: 14, paddingBottom: 8, fontSize: 13, color: '#9CA3AF' },
  reportIcon: { fontSize: 16, color: '#D1D5DB' },

  // Video grid
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5, paddingTop: 8 },
  videoItem: { aspectRatio: 0.75 },
  videoThumb: { flex: 1, backgroundColor: '#1a1a1a', overflow: 'hidden' },
  videoEmoji: { fontSize: 32, position: 'absolute', top: '40%', left: '40%' },
  videoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)' },
  videoPlayIconSmall: { fontSize: 10, color: '#fff' },
  videoUser: { fontSize: 11, color: '#fff', flex: 1 },

  loadingWrap: { paddingTop: 60, alignItems: 'center' },
  emptyWrap: { paddingTop: 80, alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 8, backgroundColor: '#FF6900', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
