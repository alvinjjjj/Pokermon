/**
 * Followers list page
 *
 * Shows users who follow the target user (default: current user).
 * Each row = avatar + username + bio + follow/unfollow button.
 * Tap row → push to /user/[id].
 *
 * Query param:
 *   ?userId=<uuid>  (optional — defaults to current user)
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Loader from '../components/Loader';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

type Row = {
  id: string;            // profile id
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function FollowersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t }  = useTranslation();
  const params = useLocalSearchParams<{ userId?: string }>();

  const [targetId, setTargetId]       = useState<string | null>(null);
  const [myUserId, setMyUserId]       = useState<string | null>(null);
  const [rows, setRows]               = useState<Row[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const followBusy                    = useRef<Set<string>>(new Set());

  useEffect(() => { load(); }, [params.userId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meId = user?.id ?? null;
      setMyUserId(meId);

      const tId = (params.userId ?? meId) ?? null;
      setTargetId(tId);
      if (!tId) return;

      // 1. who follows target?
      const { data: followRows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', tId);

      const followerIds = (followRows ?? []).map(r => r.follower_id as string);
      if (followerIds.length === 0) {
        setRows([]);
        setFollowingSet(new Set());
        return;
      }

      // 2. their profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .in('id', followerIds);

      setRows((profilesData ?? []) as Row[]);

      // 3. which of these am I (the viewer) already following?
      if (meId) {
        const { data: myFollows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', meId)
          .in('following_id', followerIds);
        setFollowingSet(new Set((myFollows ?? []).map(r => r.following_id as string)));
      }
    } catch (e) {
      if (__DEV__) console.error('[Followers] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [params.userId]);

  const toggleFollow = async (uid: string) => {
    if (!myUserId || uid === myUserId) return;
    if (followBusy.current.has(uid)) return;
    followBusy.current.add(uid);

    const isFollowing = followingSet.has(uid);

    // optimistic
    setFollowingSet(prev => {
      const s = new Set(prev);
      isFollowing ? s.delete(uid) : s.add(uid);
      return s;
    });

    try {
      const { error } = isFollowing
        ? await supabase.from('follows').delete().eq('follower_id', myUserId).eq('following_id', uid)
        : await supabase.from('follows').insert({ follower_id: myUserId, following_id: uid });

      if (error) {
        // revert
        setFollowingSet(prev => {
          const s = new Set(prev);
          isFollowing ? s.add(uid) : s.delete(uid);
          return s;
        });
        if (__DEV__) console.error('[Followers] follow error:', error);
      }
    } finally {
      followBusy.current.delete(uid);
    }
  };

  const renderRow = ({ item }: { item: Row }) => {
    const isMe        = myUserId === item.id;
    const isFollowing = followingSet.has(item.id);
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => router.push({ pathname: '/user/[id]' as any, params: { id: item.id } })}
      >
        {item.avatar_url
          ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          : <View style={styles.avatar}><Image source={require('../assets/icons/profile.png')} style={styles.avatarIcon} /></View>
        }
        <View style={styles.info}>
          <Text style={styles.username} numberOfLines={1}>{item.username ?? t('social.user')}</Text>
          {item.bio ? <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text> : null}
        </View>
        {!isMe && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={() => toggleFollow(item.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.followText, isFollowing && styles.followingText]}>
              {isFollowing ? t('social.following') : t('social.follow')}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.followers')}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Loader size="large" />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('profile.noFollowers')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.card },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.default,
    },
    backBtn: { padding: 4 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { fontSize: 14, color: colors.text.tertiary },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.surface.section,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarIcon: { width: 24, height: 24, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    info: { flex: 1, minWidth: 0 },
    username: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    bio: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },

    followBtn: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 8, backgroundColor: colors.brand.orange,
      minWidth: 80, alignItems: 'center',
    },
    followingBtn: { backgroundColor: colors.surface.section },
    // '#fff' kept raw — always-white on Card Orange
    followText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    followingText: { color: colors.text.primary },
  });
}
