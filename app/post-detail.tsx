import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Loader from '../components/Loader';

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
  profiles: { username: string | null; avatar_url: string | null } | null;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { t }   = useTranslation();

  const timeAgo = (dateStr: string): string => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60)    return t('social.justNow');
    if (diff < 3600)  return t('social.minutesAgo', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('social.hoursAgo',   { n: Math.floor(diff / 3600) });
    return t('social.daysAgo', { n: Math.floor(diff / 86400) });
  };

  const [post, setPost]             = useState<Post | null>(null);
  const [comments, setComments]     = useState<Comment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [liked, setLiked]           = useState(false);
  const [myUserId, setMyUserId]     = useState<string | null>(null);
  const [myProfile, setMyProfile]   = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { if (id) loadAll(); }, [id]);

  const loadAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMyUserId(user.id);
        const { data: p } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single();
        setMyProfile(p ?? null);
      }

      const [postRes, commentsRes, likeRes] = await Promise.all([
        supabase.from('posts').select('*').eq('id', id).single(),
        supabase.from('post_comments')
          .select('*')
          .eq('post_id', id)
          .order('created_at', { ascending: true })
          .limit(50),
        user
          ? supabase.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // 分開取 profiles，避免 FK join 問題
      let postWithProfile: Post | null = null;
      if (postRes.data) {
        const { data: authorProfile } = await supabase
          .from('profiles').select('username, avatar_url').eq('id', postRes.data.user_id).single();
        postWithProfile = { ...postRes.data, profiles: authorProfile ?? null } as Post;
        setPost(postWithProfile);
      }

      // 取留言者 profiles
      const rawComments = (commentsRes.data ?? []) as any[];
      const commentUserIds = [...new Set(rawComments.map((c: any) => c.user_id as string))];
      let commentProfileMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
      if (commentUserIds.length > 0) {
        const { data: cpData } = await supabase
          .from('profiles').select('id, username, avatar_url').in('id', commentUserIds);
        for (const cp of cpData ?? []) commentProfileMap[cp.id] = { username: cp.username, avatar_url: cp.avatar_url };
      }
      setComments(rawComments.map((c: any) => ({ ...c, profiles: commentProfileMap[c.user_id] ?? null })) as Comment[]);

      setLiked(!!likeRes.data);
    } catch (e) {
      if (__DEV__) console.error('[PostDetail] loadAll error:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!myUserId || !post) return;
    const prevLiked = liked;
    const prevCount = post.likes_count;
    const newLiked  = !liked;
    const newCount  = prevCount + (newLiked ? 1 : -1);

    // Optimistic update
    setLiked(newLiked);
    setPost(prev => prev ? { ...prev, likes_count: newCount } : prev);

    try {
      const { error: likeError } = newLiked
        ? await supabase.from('post_likes').insert({ post_id: post.id, user_id: myUserId })
        : await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', myUserId);

      if (likeError) throw likeError;

      const { error: countError } = await supabase
        .from('posts').update({ likes_count: newCount }).eq('id', post.id);
      if (countError) throw countError;
    } catch {
      // Revert on failure
      setLiked(prevLiked);
      setPost(prev => prev ? { ...prev, likes_count: prevCount } : prev);
    }
  };

  const submitComment = async () => {
    if (!myUserId || !post || !commentText.trim() || submitting) return;
    setSubmitting(true);
    const content = commentText.trim();
    setCommentText('');

    const newComment: Comment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: myUserId,
      content,
      created_at: new Date().toISOString(),
      profiles: myProfile,
    };
    setComments(prev => [...prev, newComment]);
    setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, user_id: myUserId, content })
      .select('id, post_id, user_id, content, created_at')
      .single();

    if (!error && data) {
      // Attach myProfile since FK join to profiles doesn't work (user_id → auth.users, not profiles)
      setComments(prev => prev.map(c =>
        c.id === newComment.id
          ? { ...(data as any), profiles: myProfile } as Comment
          : c
      ));
    }
    setSubmitting(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const deleteComment = async (comment: Comment) => {
    const doDelete = async () => {
      // Optimistic update
      setComments(prev => prev.filter(c => c.id !== comment.id));
      setPost(prev => prev ? { ...prev, comments_count: Math.max(0, prev.comments_count - 1) } : prev);

      const { error } = await supabase.from('post_comments').delete().eq('id', comment.id);
      if (error) {
        // Revert on failure
        setComments(prev => [...prev, comment].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ));
        setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
        Alert.alert(t('common.error'), t('common.tryAgainLater'));
      }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(t('postDetail.deleteCommentMsg'))) await doDelete();
    } else {
      Alert.alert(t('postDetail.deleteCommentTitle'), t('postDetail.deleteCommentMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('postDetail.delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleReport = () => {
    const reasons = [
      { label: t('social.reportAdult'),    value: 'adult_content'  },
      { label: t('social.reportViolence'), value: 'violence'       },
      { label: t('social.reportSpam'),     value: 'spam'           },
      { label: t('social.reportMisinfo'),  value: 'misinformation' },
      { label: t('social.reportOther'),    value: 'other'          },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t('social.reportTitle'), options: [...reasons.map(r => r.label), t('common.cancel')], cancelButtonIndex: reasons.length, destructiveButtonIndex: 0 },
        async (idx) => {
          if (idx >= reasons.length || !myUserId || !post) return;
          const { error } = await supabase.from('post_reports').insert({ post_id: post.id, reporter_id: myUserId, reason: reasons[idx].value });
          if (error?.code === '23505') Alert.alert(t('social.alreadyReported'), t('social.alreadyReportedMsg'));
          else if (!error) Alert.alert(t('social.reportSubmitted'), t('social.reportSubmittedMsg'));
        }
      );
    } else {
      Alert.alert(t('social.reportTitle'), t('social.reportMsg'), [
        ...reasons.map(r => ({ text: r.label, onPress: async () => {
          if (!myUserId || !post) return;
          const { error } = await supabase.from('post_reports').insert({ post_id: post.id, reporter_id: myUserId, reason: r.value });
          if (error?.code === '23505') Alert.alert(t('social.alreadyReported'), t('social.alreadyReportedMsg'));
          else if (!error) Alert.alert(t('social.reportSubmitted'), t('social.reportSubmittedMsg'));
        }})),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const handleDeletePost = () => {
    setShowDeleteModal(true);
  };

  const confirmDeletePost = async () => {
    if (!post) return;
    setShowDeleteModal(false);
    try {
      const filesToRemove: string[] = [];
      if (post.media_url) {
        const path = post.media_url.split('/storage/v1/object/public/posts/')[1];
        if (path) filesToRemove.push(path);
      }
      if (post.thumbnail_url) {
        const path = post.thumbnail_url.split('/storage/v1/object/public/posts/')[1];
        if (path) filesToRemove.push(path);
      }
      if (filesToRemove.length > 0) {
        await supabase.storage.from('posts').remove(filesToRemove).catch(() => {});
      }
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('common.tryAgainLater'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Loader size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ fontSize: 16, color: '#6B7280' }}>{t('postDetail.notFound')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: '#FF6900', marginTop: 12, fontSize: 15, fontWeight: '600' }}>{t('postDetail.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const profile  = post.profiles;
  const mediaUrl = post.media_type === 'video' ? post.thumbnail_url : post.media_url;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('postDetail.title')}</Text>
        {post.user_id === myUserId
          ? <TouchableOpacity onPress={handleDeletePost} style={styles.moreBtn}>
              <Text style={styles.deleteText}>{t('postDetail.delete')}</Text>
            </TouchableOpacity>
          : <TouchableOpacity onPress={handleReport} style={styles.moreBtn}>
              <Text style={styles.reportText}>{t('postDetail.report')}</Text>
            </TouchableOpacity>
        }
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Author */}
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: post.user_id } })}
          >
            {profile?.avatar_url
              ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}><Image source={require('../assets/icons/profile.png')} style={styles.avatarEmoji} /></View>
            }
            <View style={styles.userMeta}>
              <Text style={styles.username}>{profile?.username ?? t('social.user')}</Text>
              <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
            </View>
          </TouchableOpacity>

          {/* Media */}
          {mediaUrl
            ? <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />
            : (
              <View style={styles.mediaPlaceholder} />
            )
          }

          {/* Card tag */}
          {(post.card_name || post.set_name) && (
            <View style={styles.cardInfoRow}>
              <Image source={require('../assets/icons/favorite.png')} style={styles.cardInfoIcon} />
              <View>
                {post.card_name && <Text style={styles.cardName}>{post.card_name}</Text>}
                {post.set_name && <Text style={styles.setName}>{post.set_name}</Text>}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
              <Image
                source={require('../assets/icons/love.png')}
                style={[styles.actionIcon, { tintColor: liked ? '#E7000B' : '#9CA3AF' }]}
              />
              <Text style={[styles.actionCount, liked && { color: '#E7000B' }]}>{post.likes_count}</Text>
            </TouchableOpacity>
            <View style={styles.actionBtn}>
              <Image
                source={require('../assets/icons/message.png')}
                style={[styles.actionIcon, { tintColor: '#9CA3AF' }]}
              />
              <Text style={styles.actionCount}>{post.comments_count}</Text>
            </View>
          </View>

          {/* Caption */}
          {post.caption ? (
            <View style={styles.captionWrap}>
              <Text style={styles.captionUser}>{profile?.username ?? t('social.user')} </Text>
              <Text style={styles.captionText}>{post.caption}</Text>
            </View>
          ) : null}

          {/* ── Comments ──────────────────────────────────────────── */}
          <View style={styles.commentsDivider} />

          {comments.length === 0 ? (
            <Text style={styles.noComments}>{t('postDetail.noComments')}</Text>
          ) : (
            comments.map(c => {
              const isOwnComment = c.user_id === myUserId;
              return (
                <View key={c.id} style={styles.commentRow}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: c.user_id } })}
                  >
                    {c.profiles?.avatar_url
                      ? <Image source={{ uri: c.profiles.avatar_url }} style={styles.commentAvatar} />
                      : <View style={styles.commentAvatarPlaceholder}><Image source={require('../assets/icons/profile.png')} style={{ width: 16, height: 16, tintColor: '#C4C9D4', resizeMode: 'contain' }} /></View>
                    }
                  </TouchableOpacity>
                  <View style={styles.commentBody}>
                    <View style={styles.commentBubble}>
                      <Text style={styles.commentUsername}>{c.profiles?.username ?? t('social.user')} </Text>
                      <Text style={styles.commentContent}>{c.content}</Text>
                    </View>
                    <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                  </View>
                  {isOwnComment && (
                    <TouchableOpacity onPress={() => deleteComment(c)} style={styles.commentDeleteBtn}>
                      <Text style={styles.commentDeleteIcon}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ── Comment input ─────────────────────────────────────── */}
        <View style={styles.inputBar}>
          {myProfile?.avatar_url
            ? <Image source={{ uri: myProfile.avatar_url }} style={styles.inputAvatar} />
            : <View style={styles.inputAvatarPlaceholder}><Image source={require('../assets/icons/profile.png')} style={{ width: 18, height: 18, tintColor: '#C4C9D4', resizeMode: 'contain' }} /></View>
          }
          <TextInput
            style={styles.input}
            placeholder={t('postDetail.commentPlaceholder', { username: myProfile?.username ?? t('social.user') })}
            placeholderTextColor="#9CA3AF"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            onPress={submitComment}
            disabled={!commentText.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>{t('postDetail.send')}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* Delete confirm modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDeleteModal(false)}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>{t('postDetail.deletePostTitle')}</Text>
            <Text style={styles.deleteModalSub}>{t('postDetail.deletePostMsg')}</Text>
            <View style={styles.deleteModalBtns}>
              <TouchableOpacity style={styles.deleteModalCancel} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.deleteModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteModalConfirm} onPress={confirmDeletePost}>
                <Text style={styles.deleteModalConfirmText}>{t('postDetail.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 50 },
  backIcon: { fontSize: 28, color: '#101828', lineHeight: 32 },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  moreBtn: { width: 50, alignItems: 'flex-end' },
  deleteText: { fontSize: 14, color: '#E7000B', fontWeight: '600' },
  reportText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { width: 22, height: 22, tintColor: '#C4C9D4', resizeMode: 'contain' },
  userMeta: { flex: 1 },
  username: { fontSize: 15, fontWeight: '700', color: '#101828' },
  postTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  media: { width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6' },
  mediaPlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: '#0F1923', alignItems: 'center', justifyContent: 'center' },

  cardInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF3EB' },
  cardInfoIcon: { width: 20, height: 20, tintColor: '#FF6900', resizeMode: 'contain' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#101828' },
  setName: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 18, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { width: 22, height: 22, resizeMode: 'contain' },
  actionCount: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  captionWrap: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap' },
  captionUser: { fontSize: 14, fontWeight: '700', color: '#101828' },
  captionText: { fontSize: 14, color: '#101828', lineHeight: 20 },

  // Comments
  commentsDivider: { height: 8, backgroundColor: '#F9FAFB', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#F3F4F6' },
  noComments: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 28 },

  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentAvatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1, gap: 3 },
  commentBubble: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', flexWrap: 'wrap' },
  commentUsername: { fontSize: 13, fontWeight: '700', color: '#101828' },
  commentContent: { fontSize: 13, color: '#374151', lineHeight: 18 },
  commentTime: { fontSize: 11, color: '#9CA3AF', paddingLeft: 4 },
  commentDeleteBtn: { padding: 6, alignSelf: 'center' },
  commentDeleteIcon: { fontSize: 13, color: '#9CA3AF' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  inputAvatar: { width: 34, height: 34, borderRadius: 17, marginBottom: 2 },
  inputAvatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  input: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#101828', maxHeight: 100,
  },
  sendBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#FF6900' },

  // Delete modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  deleteModal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', gap: 12 },
  deleteModalTitle: { fontSize: 18, fontWeight: '800', color: '#101828', textAlign: 'center' },
  deleteModalSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  deleteModalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  deleteModalCancel: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  deleteModalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  deleteModalConfirm: { flex: 1, backgroundColor: '#E7000B', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  deleteModalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
