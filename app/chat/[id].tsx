import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import Loader from '../../components/Loader';

// ── Types ─────────────────────────────────────────────────────

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type OtherUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type ListingCtx = {
  id: string;
  card_name: string;
  card_image_url: string | null;
  photo_urls: string[];
  price: number;
  condition: string;
} | null;

// ── Component ─────────────────────────────────────────────────

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { t, i18n } = useTranslation();

  const [myId, setMyId]               = useState<string | null>(null);
  const [myAvatar, setMyAvatar]       = useState<string | null>(null);
  const [otherUser, setOtherUser]     = useState<OtherUser | null>(null);
  const [listing, setListing]     = useState<ListingCtx>(null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const myIdRef = useRef<string | null>(null);
  const PAGE_SIZE = 40;

  useEffect(() => {
    if (!id) return;
    loadChat();

    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
          // Mark as read if other person sent it
          if (newMsg.sender_id !== myIdRef.current) {
            supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then(() => {});
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const loadChat = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;
      setMyId(user.id);
      myIdRef.current = user.id;
      supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
        .then(({ data }) => setMyAvatar(data?.avatar_url ?? null));

      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (convErr || !conv) {
        if (__DEV__) console.error('[Chat] conv error:', convErr?.message);
        return;
      }

      const otherId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;

      const [profileRes, listingRes, msgRes] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').eq('id', otherId).single(),
        conv.listing_id
          ? supabase.from('listings').select('id, card_name, card_image_url, photo_urls, price, condition').eq('id', conv.listing_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(PAGE_SIZE),
      ]);

      setOtherUser(profileRes.data ?? { id: otherId, username: t('social.user'), avatar_url: null });
      setListing(listingRes.data ?? null);
      const msgs = msgRes.data ?? [];
      setMessages(msgs);
      setHasMore(msgs.length === PAGE_SIZE);

      // Mark unread messages as read
      supabase.from('messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id)
        .eq('is_read', false)
        .then(() => {});

      // Reset unread counter
      const isBuyer = conv.buyer_id === user.id;
      supabase.from('conversations')
        .update(isBuyer ? { unread_buyer: 0 } : { unread_seller: 0 })
        .eq('id', id)
        .then(() => {});

    } catch (e) {
      if (__DEV__) console.error('[Chat] loadChat error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!id || !hasMore || loadingMore) return;
    const oldest = messages[messages.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      const older = data ?? [];
      if (older.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          return [...prev, ...older.filter(m => !existingIds.has(m.id))];
        });
      }
      setHasMore(older.length === PAGE_SIZE);
    } catch (e) {
      if (__DEV__) console.error('[Chat] loadOlderMessages error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !myId || sending) return;
    setInput('');
    setSending(true);

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: id!,
      sender_id: myId,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages(prev => [optimistic, ...prev]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: myId, content })
      .select()
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(content);
    } else {
      // Dedupe: the Realtime subscription may have already added the real
      // message (with `data.id`) before the insert promise resolved. In that
      // case, just remove the temp placeholder. Otherwise, replace temp → real.
      setMessages(prev => {
        const realAlreadyIn = prev.some(m => m.id === data.id);
        return realAlreadyIn
          ? prev.filter(m => m.id !== tempId)
          : prev.map(m => m.id === tempId ? data : m);
      });
    }
    setSending(false);
  };

  // ── Helpers ───────────────────────────────────────────────

  const formatTime = (iso: string) => {
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'zh-CN' ? 'zh-CN' : 'zh-HK';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  };

  // ── Render Message ────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe   = item.sender_id === myId;
    const isTemp = item.id.startsWith('temp-');

    // Show date separator
    const prevItem = messages[index + 1];
    const showDate = !prevItem ||
      new Date(prevItem.created_at).toDateString() !== new Date(item.created_at).toDateString();

    return (
      <React.Fragment>
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
          {!isMe && (
            <View style={styles.msgAvatar}>
              {otherUser?.avatar_url ? (
                <Image source={{ uri: otherUser.avatar_url }} style={styles.msgAvatarImg} />
              ) : (
                <View style={styles.msgAvatarPlaceholder}>
                  <Text style={styles.msgAvatarLetter}>
                    {(otherUser?.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
              {item.content}
            </Text>
            <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
              {formatTime(item.created_at)}
              {isMe && !isTemp ? (item.is_read ? `  ${t('chat.read')}` : `  ${t('chat.sent')}`) : ''}
            </Text>
          </View>
          {isMe && (
            <View style={styles.msgAvatar}>
              {myAvatar ? (
                <Image source={{ uri: myAvatar }} style={styles.msgAvatarImg} />
              ) : (
                <View style={[styles.msgAvatarPlaceholder, { backgroundColor: '#FF6900' }]}>
                  <Image source={require('../../assets/icons/profile.png')} style={[styles.msgAvatarIcon, { tintColor: '#fff' }]} />
                </View>
              )}
            </View>
          )}
        </View>
        {showDate && (
          <View style={styles.dateSep}>
            <Text style={styles.dateSepText}>
              {new Date(item.created_at).toLocaleDateString(
                i18n.language === 'en' ? 'en-US' : i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'zh-CN' ? 'zh-CN' : 'zh-HK',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </Text>
          </View>
        )}
      </React.Fragment>
    );
  };

  // ── Loading ───────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}><Loader size="large" /></View>
      </SafeAreaView>
    );
  }

  const listingThumb = listing?.photo_urls?.[0] ?? listing?.card_image_url;

  // ── Main Render ───────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.navCenter}>
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.navAvatar} />
          ) : (
            <View style={styles.navAvatarPlaceholder}>
              <Image source={require('../../assets/icons/profile.png')} style={styles.navAvatarIcon} />
            </View>
          )}
          <Text style={styles.navName} numberOfLines={1}>
            {otherUser?.username ?? t('social.user')}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Listing context banner */}
      {listing && (
        <TouchableOpacity
          style={styles.listingBanner}
          onPress={() => router.push(`/listing/${listing.id}` as any)}
          activeOpacity={0.85}
        >
          {listingThumb ? (
            <Image source={{ uri: listingThumb }} style={styles.listingBannerImg} resizeMode="contain" />
          ) : (
            <View style={[styles.listingBannerImg, { backgroundColor: '#F3F4F6' }]} />
          )}
          <View style={styles.listingBannerInfo}>
            <Text style={styles.listingBannerName} numberOfLines={1}>{listing.card_name}</Text>
            <Text style={styles.listingBannerPrice}>
              HK${listing.price.toLocaleString()} · {listing.condition}
            </Text>
          </View>
          <Text style={styles.listingBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.2}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#FF6900" style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>{t('chat.startConversation')}</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('chat.inputPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Image source={require('../../assets/icons/arrow.png')} style={styles.sendIcon} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Nav
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB',
  },
  navBack:             { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navBackText:         { fontSize: 28, color: '#101828', fontWeight: '300' },
  navCenter:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navAvatar:           { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6' },
  navAvatarPlaceholder:{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  navAvatarIcon:       { width: 16, height: 16, resizeMode: 'contain', tintColor: '#9CA3AF' },
  navName:             { fontSize: 16, fontWeight: '700', color: '#101828', maxWidth: 180 },

  // Listing banner
  listingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFF8F3',
    borderBottomWidth: 0.5, borderBottomColor: '#FFD4B2',
  },
  listingBannerImg:   { width: 40, height: 40, borderRadius: 8 },
  listingBannerInfo:  { flex: 1 },
  listingBannerName:  { fontSize: 13, fontWeight: '700', color: '#101828' },
  listingBannerPrice: { fontSize: 12, color: '#FF6900', fontWeight: '600', marginTop: 1 },
  listingBannerArrow: { fontSize: 20, color: '#C7C7CC' },

  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexGrow: 1 },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 8 },
  msgRowMe:   { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },

  msgAvatar:           { width: 28, flexShrink: 0 },
  msgAvatarImg:        { width: 28, height: 28, borderRadius: 14 },
  msgAvatarPlaceholder:{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  msgAvatarIcon:       { width: 14, height: 14, tintColor: '#9CA3AF', resizeMode: 'contain' },
  msgAvatarLetter:     { fontSize: 12, fontWeight: '700', color: '#6B7280' },

  bubble:         { maxWidth: '72%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:       { backgroundColor: '#FF6900', borderBottomRightRadius: 4 },
  bubbleThem:     { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  bubbleText:     { fontSize: 15, lineHeight: 21 },
  bubbleTextMe:   { color: '#fff' },
  bubbleTextThem: { color: '#101828' },
  bubbleTime:     { fontSize: 11, marginTop: 4 },
  bubbleTimeMe:   { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  bubbleTimeThem: { color: '#9CA3AF' },

  dateSep:     { alignItems: 'center', marginVertical: 12 },
  dateSepText: { fontSize: 12, color: '#9CA3AF', backgroundColor: '#fff', paddingHorizontal: 8 },

  emptyChat:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyChatText: { fontSize: 14, color: '#9CA3AF' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24,
    borderTopWidth: 0.5, borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#101828', maxHeight: 120,
  },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF6900', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#E5E7EB' },
  sendIcon:        { width: 18, height: 18, resizeMode: 'contain', tintColor: '#fff' },
});
