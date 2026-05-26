import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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

// ── Types ─────────────────────────────────────────────────────

type ConversationItem = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_buyer: number;
  unread_seller: number;
  updated_at: string;
  other_user: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
  listing: {
    card_name: string;
    card_image_url: string | null;
    photo_urls: string[];
  } | null;
};

// ── Component ─────────────────────────────────────────────────

export default function InboxScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router    = useRouter();
  const { t, i18n } = useTranslation();

  const [myId, setMyId]                   = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  useFocusEffect(useCallback(() => { loadConversations(); }, []));

  const loadConversations = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;
      setMyId(user.id);

      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (convErr) {
        if (__DEV__) console.error('[Inbox] convs error:', convErr.message);
        setConversations([]);
        return;
      }

      if (!convs || convs.length === 0) {
        setConversations([]);
        return;
      }

      const otherIds   = [...new Set(convs.map(c => c.buyer_id === user.id ? c.seller_id : c.buyer_id))];
      const listingIds = [...new Set(convs.filter(c => c.listing_id).map(c => c.listing_id!))];

      const [profilesRes, listingsRes] = await Promise.all([
        otherIds.length > 0
          ? supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        listingIds.length > 0
          ? supabase.from('listings').select('id, card_name, card_image_url, photo_urls').in('id', listingIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const profileMap: Record<string, any> = {};
      (profilesRes.data ?? []).forEach(p => { profileMap[p.id] = p; });

      const listingMap: Record<string, any> = {};
      (listingsRes.data ?? []).forEach(l => { listingMap[l.id] = l; });

      const enriched: ConversationItem[] = convs.map(c => {
        const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
        return {
          ...c,
          other_user: profileMap[otherId] ?? { id: otherId, username: null, avatar_url: null },
          listing: c.listing_id ? (listingMap[c.listing_id] ?? null) : null,
        };
      });

      setConversations(enriched);
    } catch (e) {
      if (__DEV__) console.error('[Inbox] loadConversations error:', e);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getUnread = (c: ConversationItem) => {
    if (!myId) return 0;
    return c.buyer_id === myId ? c.unread_buyer : c.unread_seller;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'zh-CN' ? 'zh-CN' : 'zh-HK';
    const d   = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 7) {
      return d.toLocaleDateString(locale, { weekday: 'short' });
    }
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  };

  // ── Render Item ───────────────────────────────────────────

  const renderItem = ({ item }: { item: ConversationItem }) => {
    const unread = getUnread(item);
    const thumb  = item.listing?.photo_urls?.[0] ?? item.listing?.card_image_url;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/chat/${item.id}` as any)}
        activeOpacity={0.8}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.other_user.avatar_url ? (
            <Image source={{ uri: item.other_user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Image source={require('../../assets/icons/profile.png')} style={styles.avatarIcon} />
            </View>
          )}
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>
              {item.other_user.username ?? t('social.user')}
            </Text>
            <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
          </View>
          {item.listing && (
            <Text style={styles.listingLabel} numberOfLines={1}>
              {item.listing.card_name}
            </Text>
          )}
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {item.last_message ?? t('inbox.startChat')}
          </Text>
        </View>

        {/* Listing thumb */}
        {thumb && (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="contain" />
        )}
      </TouchableOpacity>
    );
  };

  // ── Main Render ───────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('inbox.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}><Loader size="large" /></View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations(true)}
              tintColor={colors.brand.orange}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Image source={require('../../assets/icons/message.png')} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>{t('inbox.noMessages')}</Text>
              <Text style={styles.emptySub}>{t('inbox.noMessagesSub')}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.surface.card },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 8, paddingVertical: 10,
      borderBottomWidth: 0.5, borderBottomColor: colors.border.default,
    },
    backBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    title:    { fontSize: 18, fontWeight: '800', color: colors.text.primary },

    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },

    avatarWrap:          { position: 'relative', flexShrink: 0 },
    avatar:              { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface.section },
    avatarPlaceholder:   { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center' },
    avatarIcon:          { width: 24, height: 24, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    unreadBadge:         {
      position: 'absolute', top: -2, right: -2,
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: colors.brand.orange,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 4,
      // '#fff' kept raw — always-white ring around badge
      borderWidth: 2, borderColor: '#fff',
    },
    // '#fff' kept raw — always-white on brand orange
    unreadBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

    content:       { flex: 1, minWidth: 0 },
    topRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    name:          { fontSize: 15, fontWeight: '600', color: colors.text.primary, flex: 1, marginRight: 8 },
    nameUnread:    { color: colors.text.primary, fontWeight: '700' },
    time:          { fontSize: 12, color: colors.text.tertiary, flexShrink: 0 },
    listingLabel:  { fontSize: 12, color: colors.brand.orange, fontWeight: '500', marginBottom: 2 },
    preview:       { fontSize: 13, color: colors.text.tertiary },
    previewUnread: { color: colors.text.primary, fontWeight: '500' },

    thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface.section, flexShrink: 0 },

    separator: { height: 0.5, backgroundColor: colors.surface.section, marginLeft: 80 },

    empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyIcon:  { width: 48, height: 48, tintColor: colors.border.strong, resizeMode: 'contain' },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    emptySub:   { fontSize: 14, color: colors.text.tertiary },
  });
}
