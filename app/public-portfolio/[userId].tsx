import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { supabase } from '../../lib/supabase';
import Loader from '../../components/Loader';
import { useTheme } from '../../theme/ThemeProvider';
import { type ColorTokens } from '../../constants/colors';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

type Card = {
  id: string;
  card_id: string | null;
  card_name: string;
  set_name: string | null;
  current_price: number;
  quantity: number;
  psa_grade: string | null;
  image_url: string | null;
  item_type: 'card' | 'box' | null;
  box_condition: 'Sealed' | 'Opened' | null;
};

type Profile = {
  username: string | null;
  avatar_url: string | null;
  portfolio_name: string | null;
};

const GRADE_COLORS: Record<string, string> = {
  'Raw': '#6B7280', 'PSA 9': '#3B82F6', 'PSA 10': '#F59E0B',
  '9': '#3B82F6', '10': '#F59E0B',
};

function gradeLabel(g: string): string {
  if (g === '9' || g === 'PSA 9') return 'PSA 9';
  if (g === '10' || g === 'PSA 10') return 'PSA 10';
  return g;
}

export default function PublicPortfolioScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const [profile, setProfile]     = useState<Profile | null>(null);
  const [cards, setCards]         = useState<Card[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (userId) load(); }, [userId]);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const [profileRes, cardsRes] = await Promise.all([
      supabase.from('profiles').select('username, avatar_url, portfolio_name').eq('id', userId).single(),
      supabase.from('user_collection')
        .select('id, card_id, card_name, set_name, current_price, quantity, psa_grade, image_url, item_type, box_condition')
        .eq('user_id', userId)
        .order('added_at', { ascending: false }),
    ]);

    setProfile(profileRes.data ?? null);
    setCards((cardsRes.data ?? []) as Card[]);
    setLoading(false);
    setRefreshing(false);
  };

  const totalValue = cards.reduce((s, c) => s + ((c.current_price ?? 0) * (c.quantity ?? 1)), 0);
  const cardCount  = cards.filter(c => c.item_type !== 'box').length;
  const boxCount   = cards.filter(c => c.item_type === 'box').length;

  const renderCard = ({ item }: { item: Card }) => {
    const isBox = item.item_type === 'box';
    const gradeColor = item.psa_grade ? (GRADE_COLORS[item.psa_grade] ?? '#9CA3AF') : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => item.card_id && !isBox && router.push({ pathname: '/card/[id]' as any, params: { id: item.card_id } })}
        activeOpacity={item.card_id && !isBox ? 0.8 : 1}
      >
        <View style={[styles.cardImgBox, isBox && { aspectRatio: 1 }]}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={styles.cardImg} resizeMode="contain" />
            : null
          }
          {/* Grade badge */}
          {!isBox && item.psa_grade && gradeColor && (
            <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
              <Text style={styles.gradeBadgeText}>{gradeLabel(item.psa_grade)}</Text>
            </View>
          )}
          {/* Box badge */}
          {isBox && item.box_condition && (
            <View style={[styles.gradeBadge, { backgroundColor: item.box_condition === 'Sealed' ? '#6366F1' : '#9CA3AF' }]}>
              <Text style={styles.gradeBadgeText}>{item.box_condition === 'Sealed' ? 'S' : 'O'}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.card_name}</Text>
          {item.set_name && <Text style={styles.cardSet} numberOfLines={1}>{item.set_name}</Text>}
          <Text style={styles.cardPrice}>HK${item.current_price.toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {profile?.avatar_url
          ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          : <View style={styles.avatar} />
        }
        <View style={styles.headerInfo}>
          <Text style={styles.portfolioName}>{profile?.portfolio_name ?? t('portfolio.defaultName')}</Text>
          <Text style={styles.ownerName}>{t('portfolio.ownerCollection', { name: profile?.username ?? t('social.user') })}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{cardCount}</Text>
          <Text style={styles.statLabel}>{t('portfolio.statCards')}</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{boxCount}</Text>
          <Text style={styles.statLabel}>{t('portfolio.statBoxes')}</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>HK${totalValue.toLocaleString()}</Text>
          <Text style={styles.statLabel}>{t('portfolio.statValue')}</Text>
        </View>
      </View>

      {cards.length === 0 && !loading && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('portfolio.publicEmpty')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('portfolio.publicTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><Loader size="large" /></View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          numColumns={2}
          ListHeaderComponent={ListHeader}
          renderItem={renderCard}
          columnWrapperStyle={styles.row}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand.orange} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        />
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
      backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.border.default,
    },
    navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    navTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },

    header: { paddingVertical: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
    avatar: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.brand.orange,
    },
    headerInfo: { flex: 1 },
    portfolioName: { fontSize: 18, fontWeight: '800', color: colors.text.primary },
    ownerName: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },

    statsRow: { flexDirection: 'row', backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, marginBottom: 16 },
    statItem: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 16, fontWeight: '800', color: colors.text.primary },
    statLabel: { fontSize: 11, color: colors.text.tertiary, marginTop: 2 },
    statDiv: { width: 0.5, backgroundColor: colors.border.default, marginVertical: 4 },

    empty: { alignItems: 'center', paddingTop: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.text.tertiary },

    row: { gap: 16, marginBottom: 16 },
    card: { width: CARD_W, backgroundColor: colors.surface.card, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border.default },
    cardImgBox: { width: '100%', aspectRatio: 0.72, backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    cardImg: { width: '100%', height: '100%' },
    gradeBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    // '#fff' kept raw — always-white on grade fill
    gradeBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    cardInfo: { padding: 10 },
    cardName: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    cardSet: { fontSize: 11, color: colors.text.tertiary, marginTop: 2 },
    cardPrice: { fontSize: 14, fontWeight: '700', color: colors.brand.orange, marginTop: 4 },
  });
}
