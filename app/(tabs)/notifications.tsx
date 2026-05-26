import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import Loader from '../../components/Loader';
import { useTheme } from '../../theme/ThemeProvider';
import { type ColorTokens } from '../../constants/colors';

type NotifType = 'like' | 'comment' | 'follow' | 'moderation_approved' | 'moderation_rejected';

type Notification = {
  id: string;
  type: NotifType;
  read: boolean;
  created_at: string;
  post_id: string | null;
  actor_id: string | null;
  actor: { username: string | null; avatar_url: string | null } | null;
  post: { media_url: string | null; thumbnail_url: string | null; media_type: string } | null;
};

// Group type now uses key-based approach (defined below with NotifGroupKey)

type NotifGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier' | 'monthAgo';

// ── Grouping helpers ──────────────────────────────────────────────────────────

function getGroupKey(dateStr: string): NotifGroupKey {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7)  return 'thisWeek';
  if (diffDays < 30) return 'earlier';
  return 'monthAgo';
}

function groupNotificationsByKey(items: Notification[]): { key: NotifGroupKey; items: Notification[] }[] {
  const map = new Map<NotifGroupKey, Notification[]>();
  const order: NotifGroupKey[] = ['today', 'yesterday', 'thisWeek', 'earlier', 'monthAgo'];
  for (const item of items) {
    const key = getGroupKey(item.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return order.filter(k => map.has(k)).map(k => ({ key: k, items: map.get(k)! }));
}

function notifTimeAgo(d: string, t: (k: string, opts?: any) => string): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60)    return t('social.justNow');
  if (s < 3600)  return t('social.minutesAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return t('social.hoursAgo',   { n: Math.floor(s / 3600) });
  if (s < 604800)return t('social.daysAgo',    { n: Math.floor(s / 86400) });
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  const TYPE_CONFIG: Record<NotifType, { icon: any; tint: string; text: string; systemImg?: any; systemTint?: string }> = {
    like:                { icon: require('../../assets/icons/love.png'),          tint: '#EF4444', text: t('social.notifLike') },
    comment:             { icon: require('../../assets/icons/message.png'),       tint: '#3B82F6', text: t('social.notifComment') },
    follow:              { icon: require('../../assets/icons/profile.png'),       tint: '#8B5CF6', text: t('social.notifFollow') },
    moderation_approved: { icon: require('../../assets/icons/Certification.png'), tint: '#10B981', text: t('social.notifApproved'), systemImg: require('../../assets/icons/Certification.png'), systemTint: '#10B981' },
    moderation_rejected: { icon: require('../../assets/icons/delete.png'),        tint: '#EF4444', text: t('social.notifRejected'), systemImg: require('../../assets/icons/delete.png'),        systemTint: '#EF4444' },
  };

  const GROUP_LABELS: Record<NotifGroupKey, string> = {
    today:     t('social.groupToday'),
    yesterday: t('social.groupYesterday'),
    thisWeek:  t('social.groupThisWeek'),
    earlier:   t('social.groupEarlier'),
    monthAgo:  t('social.groupMonthAgo'),
  };

  const [groups, setGroups]   = useState<{ key: NotifGroupKey; items: Notification[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnread, setHasUnread]   = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 10000);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        clearTimeout(timeout);
        setGroups([]);
        return;
      }

      const { data: rawNotifs, error: notifErr } = await supabase
        .from('notifications')
        .select('id, type, read, created_at, post_id, actor_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80);

      if (notifErr) {
        if (__DEV__) console.error('[Notifications] fetch error:', notifErr.message);
        setGroups([]);
        return;
      }

      const rawList = (rawNotifs ?? []) as any[];

      const actorIds = [...new Set(rawList.map(n => n.actor_id).filter(Boolean))] as string[];
      let actorMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from('profiles').select('id, username, avatar_url').in('id', actorIds);
        for (const a of actors ?? []) actorMap[a.id] = { username: a.username, avatar_url: a.avatar_url };
      }

      const postIds = [...new Set(rawList.map(n => n.post_id).filter(Boolean))] as string[];
      let postMap: Record<string, { media_url: string | null; thumbnail_url: string | null; media_type: string }> = {};
      if (postIds.length > 0) {
        const { data: posts } = await supabase
          .from('posts').select('id, media_url, thumbnail_url, media_type').in('id', postIds);
        for (const p of posts ?? []) postMap[p.id] = { media_url: p.media_url, thumbnail_url: p.thumbnail_url, media_type: p.media_type };
      }

      const notifs: Notification[] = rawList.map(n => ({
        ...n,
        actor: n.actor_id ? (actorMap[n.actor_id] ?? null) : null,
        post:  n.post_id  ? (postMap[n.post_id]  ?? null) : null,
      }));
      setGroups(groupNotificationsByKey(notifs));
      setHasUnread(notifs.some(n => !n.read));

      const unreadIds = notifs.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      }
    } catch (e) {
      if (__DEV__) console.error('[Notifications] load error:', e);
      setGroups([]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAllRead = async () => {
    setGroups((prev: { key: NotifGroupKey; items: Notification[] }[]) => prev.map(g => ({
      ...g,
      items: g.items.map((n: Notification) => ({ ...n, read: true })),
    })));
    setHasUnread(false);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (user) {
      await supabase.from('notifications').update({ read: true })
        .eq('user_id', user.id).eq('read', false);
    }
  };

  const handlePress = async (n: Notification) => {
    if (n.type === 'follow' && n.actor_id) {
      router.push({ pathname: '/user/[id]' as any, params: { id: n.actor_id } });
    } else if (n.post_id && n.type !== 'moderation_rejected') {
      const { data: post } = await supabase.from('posts').select('id').eq('id', n.post_id).maybeSingle();
      if (!post) {
        Alert.alert(t('social.postDeleted'), t('social.postDeletedMsg'));
        return;
      }
      router.push({ pathname: '/post-detail' as any, params: { id: n.post_id } });
    }
  };

  const isSystemNotif = (type: NotifType) =>
    type === 'moderation_approved' || type === 'moderation_rejected';

  const renderNotif = (n: Notification) => {
    const config   = TYPE_CONFIG[n.type];
    const isSystem = isSystemNotif(n.type);
    const thumbUri = n.post?.media_type === 'video' ? n.post.thumbnail_url : n.post?.media_url;
    const isRejected = n.type === 'moderation_rejected';

    return (
      <TouchableOpacity
        key={n.id}
        style={[styles.row, !n.read && styles.rowUnread, isRejected && styles.rowRejected]}
        onPress={() => handlePress(n)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {isSystem ? (
            <View style={[styles.systemIcon, isRejected ? styles.systemIconRed : styles.systemIconGreen]}>
              <Image source={config.systemImg} style={[styles.systemIconImg, { tintColor: config.systemTint }]} />
            </View>
          ) : (
            <>
              {n.actor?.avatar_url
                ? <Image source={{ uri: n.actor.avatar_url }} style={styles.avatar} />
                : <View style={styles.avatarPlaceholder}><Image source={require('../../assets/icons/profile.png')} style={styles.avatarPlaceholderIcon} /></View>
              }
              <View style={styles.typeIconBadge}>
                <Image source={config.icon} style={[styles.typeIconImg, { tintColor: config.tint }]} />
              </View>
            </>
          )}
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.notifText} numberOfLines={3}>
            {!isSystem && <Text style={styles.actorName}>{n.actor?.username ?? t('social.user')} </Text>}
            <Text style={isRejected ? styles.rejectedText : undefined}>{config.text}</Text>
          </Text>
          <Text style={styles.timeText}>{notifTimeAgo(n.created_at, t)}</Text>
        </View>

        {thumbUri && !isSystem && (
          <Image source={{ uri: thumbUri }} style={styles.postThumb} resizeMode="cover" />
        )}
        {!thumbUri && !isSystem && n.post_id && (
          <View style={styles.postThumbPlaceholder} />
        )}

        {!n.read && <View style={[styles.unreadDot, isRejected && styles.unreadDotRed]} />}
      </TouchableOpacity>
    );
  };

  const totalCount = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    // edges={['top']} — tab bar 已處理底部 safe area，不需再加
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Nav */}
      <View style={styles.nav}>
        {/* 在 tab 內用 navigate 回主頁，而非 back() */}
        <TouchableOpacity style={styles.navBack} onPress={() => router.navigate('/(tabs)' as any)}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('notifications.title')}</Text>
        {hasUnread
          ? <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
            </TouchableOpacity>
          : <View style={{ width: 60 }} />
        }
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><Loader size="large" /></View>
      ) : totalCount === 0 ? (
        <View style={styles.emptyWrap}>
          <Image source={require('../../assets/icons/notification.png')} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{t('notifications.noNotifications')}</Text>
          <Text style={styles.emptySub}>{t('notifications.noNotificationsSub')}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand.orange} />}
        >
          {groups.map(group => (
            <View key={group.key}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{GROUP_LABELS[group.key]}</Text>
              </View>
              {group.items.map(renderNotif)}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.section },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: colors.border.default,
    },
    navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    navTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    markAllBtn: { paddingHorizontal: 4 },
    markAllText: { fontSize: 13, color: colors.brand.orange, fontWeight: '600' },

    groupHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
    groupLabel: { fontSize: 12, fontWeight: '700', color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8 },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 0.5, borderBottomColor: colors.border.default,
      backgroundColor: colors.surface.card,
    },
    rowUnread: { backgroundColor: colors.brand.peach },
    rowRejected: { backgroundColor: '#FFF5F5' }, // semantic destructive tint kept raw

    avatarWrap: { position: 'relative', flexShrink: 0 },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarPlaceholder: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center',
    },
    typeIconBadge: {
      position: 'absolute', bottom: -2, right: -4,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.surface.card, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border.default,
    },
    typeIconImg: { width: 12, height: 12, resizeMode: 'contain' },
    avatarPlaceholderIcon: { width: 24, height: 24, tintColor: colors.text.tertiary, resizeMode: 'contain' },

    systemIcon: {
      width: 46, height: 46, borderRadius: 23,
      alignItems: 'center', justifyContent: 'center',
    },
    systemIconGreen: { backgroundColor: '#ECFDF5' }, // semantic success tint kept raw
    systemIconRed:   { backgroundColor: '#FEF2F2' }, // semantic destructive tint kept raw
    systemIconImg:   { width: 24, height: 24, resizeMode: 'contain' },

    textWrap: { flex: 1 },
    notifText: { fontSize: 14, color: colors.text.primary, lineHeight: 20 },
    actorName: { fontWeight: '700' },
    rejectedText: { color: '#EF4444' }, // destructive red kept raw
    timeText: { fontSize: 12, color: colors.text.tertiary, marginTop: 3 },

    postThumb: { width: 48, height: 48, borderRadius: 8, flexShrink: 0 },
    postThumbPlaceholder: {
      width: 48, height: 48, borderRadius: 8,
      backgroundColor: colors.surface.section, flexShrink: 0,
    },

    unreadDot: {
      position: 'absolute', right: 14, top: '50%', marginTop: -4,
      width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand.orange,
    },
    unreadDotRed: { backgroundColor: '#EF4444' }, // destructive red kept raw

    emptyWrap: { flex: 1, paddingTop: 80, alignItems: 'center', gap: 10, paddingHorizontal: 40 },
    emptyIcon: { width: 52, height: 52, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    emptySub: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', lineHeight: 19 },
  });
}
