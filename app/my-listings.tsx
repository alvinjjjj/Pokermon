import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { fetchArtofpkmImages } from '../lib/artofpkm';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Loader from '../components/Loader';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 2;

// ── Types ─────────────────────────────────────────────────────────────────────

type SellerProfile = {
  id: string;
  seller_type: 'individual_seller' | 'certified_merchant';
  display_name: string;
  shop_name_zh: string | null;
  status: string;
};

type Listing = {
  id: string;
  card_name: string;
  set_name: string | null;
  card_image_url: string | null;
  photo_urls: string[];
  condition: string;
  price: number;
  is_negotiable: boolean;
  quantity: number;
  language: string[];
  notes: string | null;
  status: string;
  created_at: string;
};

const CONDITION_COLOR: Record<string, string> = {
  'Raw': '#6B7280', 'PSA 9': '#3B82F6', 'PSA 10': '#F59E0B',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyListings() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router    = useRouter();
  const { t }     = useTranslation();

  const STATUS_TABS = [
    { key: 'active', label: t('myListings.statusActive') },
    { key: 'hidden', label: t('myListings.statusHidden') },
    { key: 'sold',   label: t('myListings.statusSold')   },
  ];

  const [profile, setProfile]       = useState<SellerProfile | null>(null);
  const [listings, setListings]       = useState<Listing[]>([]);
  const [artofpkmMap, setArtofpkmMap] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab]   = useState<'active' | 'hidden' | 'sold'>('active');
  const [uploadLimit, setUploadLimit] = useState(10);

  const [actionTarget, setActionTarget] = useState<Listing | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { return; }

      const { data: mp } = await supabase
        .from('merchant_profiles')
        .select('id, seller_type, display_name, shop_name_zh, status')
        .eq('user_id', user.id)
        .maybeSingle();

      setProfile(mp ?? null);
      setUploadLimit(mp?.seller_type === 'certified_merchant' ? 100 : 10);

      if (mp) {
        const { data: ls } = await supabase
          .from('listings')
          .select('*')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });
        const listingsData = ls ?? [];
        setListings(listingsData);
        fetchArtofpkmImages(listingsData).then(map => {
          if (Object.keys(map).length) setArtofpkmMap(map);
        });
      }
    } catch (e) {
      if (__DEV__) console.error('[MyListings] loadAll error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const activeCount = listings.filter(l => l.status === 'active').length;
  const filtered    = listings.filter(l => l.status === statusTab);

  // ── Actions ────────────────────────────────────────────────────────────────

  const openActionModal = (item: Listing) => {
    setActionTarget(item);
    setShowActionModal(true);
  };

  const handleStatusChange = async (newStatus: 'active' | 'hidden' | 'sold') => {
    if (!actionTarget) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', actionTarget.id);
    setActionLoading(false);
    setShowActionModal(false);
    setActionTarget(null);
    if (!error) {
      // Optimistic update + silent background reload (isRefresh=true avoids full-screen spinner)
      setListings(prev => prev.map(l => l.id === actionTarget.id ? { ...l, status: newStatus } : l));
      loadAll(true);
    }
  };

  const handleDelete = async () => {
    if (!actionTarget) return;
    Alert.alert(t('myListings.deleteConfirmTitle'), t('myListings.deleteConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myListings.deleteListing'), style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          const { error } = await supabase.from('listings').delete().eq('id', actionTarget.id);
          setActionLoading(false);
          setShowActionModal(false);
          setActionTarget(null);
          if (!error) {
            setListings(prev => prev.filter(l => l.id !== actionTarget.id));
            loadAll(true);
          }
        },
      },
    ]);
  };

  // ── Card render ────────────────────────────────────────────────────────────

  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const renderCard = (item: Listing) => {
    const primaryUri = item.photo_urls?.[0] || item.card_image_url || null;
    const fallbackUri = artofpkmMap[item.card_name] || null;
    const imgUri = (imgErrors[item.id] ? fallbackUri : primaryUri) ?? fallbackUri ?? null;
    const condColor = CONDITION_COLOR[item.condition] ?? colors.text.tertiary;
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        onPress={() => router.push(`/listing/${item.id}` as any)}
        activeOpacity={0.9}
      >
        <View style={styles.cardImgBox}>
          {imgUri
            ? <Image
                source={{ uri: imgUri }}
                style={styles.cardImg}
                resizeMode="contain"
                onError={() => setImgErrors(prev => ({ ...prev, [item.id]: true }))}
              />
            : <View style={styles.cardImgPlaceholder} />
          }
          <View style={[styles.condBadge, { backgroundColor: condColor }]}>
            <Text style={styles.condBadgeText}>{item.condition}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={2}>{item.card_name}</Text>
          {item.set_name && <Text style={styles.cardSet} numberOfLines={1}>{item.set_name}</Text>}
          <View style={styles.priceRow}>
            <Text style={styles.price}>HK${item.price.toLocaleString()}</Text>
            {item.is_negotiable && <Text style={styles.nego}>{t('shops.negotiable')}</Text>}
          </View>
          {item.quantity > 1 && <Text style={styles.qty}>{t('myListings.stock', { n: item.quantity })}</Text>}
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => openActionModal(item)}
        >
          <Text style={styles.actionBtnText}>{t('myListings.manage')}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ── Action Modal ───────────────────────────────────────────────────────────

  const renderActionModal = () => (
    <Modal visible={showActionModal} transparent animationType="slide" onRequestClose={() => setShowActionModal(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionModal(false)}>
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />

          {actionTarget && (
            <View style={styles.sheetCardPreview}>
              {(actionTarget.photo_urls?.[0] ?? actionTarget.card_image_url) && (
                <Image
                  source={{ uri: (actionTarget.photo_urls?.[0] ?? actionTarget.card_image_url)! }}
                  style={styles.sheetCardImg}
                  resizeMode="contain"
                />
              )}
              <View style={styles.sheetCardInfo}>
                <Text style={styles.sheetCardName}>{actionTarget.card_name}</Text>
                <Text style={styles.sheetCardPrice}>HK${actionTarget.price.toLocaleString()}</Text>
                <View style={[styles.sheetCondBadge, { backgroundColor: CONDITION_COLOR[actionTarget.condition] ?? colors.text.tertiary }]}>
                  <Text style={styles.sheetCondText}>{actionTarget.condition}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.sheetActions}>
            {actionTarget?.status !== 'active' && (
              <TouchableOpacity style={styles.sheetRow} onPress={() => handleStatusChange('active')} disabled={actionLoading}>
                <Image source={require('../assets/icons/arrow.png')} style={styles.sheetRowIcon} />
                <Text style={styles.sheetRowText}>{t('myListings.relist')}</Text>
              </TouchableOpacity>
            )}
            {actionTarget?.status === 'active' && (
              <TouchableOpacity style={styles.sheetRow} onPress={() => handleStatusChange('hidden')} disabled={actionLoading}>
                <Image source={require('../assets/icons/eye-off.png')} style={styles.sheetRowIcon} />
                <Text style={styles.sheetRowText}>{t('myListings.delist')}</Text>
              </TouchableOpacity>
            )}
            {actionTarget?.status !== 'sold' && (
              <TouchableOpacity style={styles.sheetRow} onPress={() => handleStatusChange('sold')} disabled={actionLoading}>
                <Image source={require('../assets/icons/Certification.png')} style={styles.sheetRowIcon} />
                <Text style={styles.sheetRowText}>{t('myListings.markSold')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.sheetRow, styles.sheetRowDanger]} onPress={handleDelete} disabled={actionLoading}>
              <Image source={require('../assets/icons/delete.png')} style={[styles.sheetRowIcon, { tintColor: '#E7000B' }]} />
              <Text style={[styles.sheetRowText, styles.sheetRowTextDanger]}>{t('myListings.deleteListing')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowActionModal(false)}>
            <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('myListings.title')}</Text>
        {profile && (
          <TouchableOpacity style={styles.navUpload} onPress={() => router.push('/listing-upload' as any)}>
            <Text style={styles.navUploadText}>{t('myListings.upload')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <Loader size="large" />
        </View>
      ) : !profile ? (
        /* No seller account */
        <View style={styles.noProfileWrap}>
          <Image source={require('../assets/icons/shops.png')} style={styles.noProfileIcon} />
          <Text style={styles.noProfileTitle}>{t('myListings.noSellerTitle')}</Text>
          <TouchableOpacity style={styles.noProfileBtn} onPress={() => router.push('/seller-registration' as any)}>
            <Text style={styles.noProfileBtnText}>{t('myListings.registerNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Seller header */}
          <View style={styles.sellerHeader}>
            <View style={styles.sellerHeaderLeft}>
              <Text style={styles.sellerName}>
                {profile.shop_name_zh ?? profile.display_name}
              </Text>
              <View style={styles.sellerTypeRow}>
                <Image
                  source={profile.seller_type === 'certified_merchant'
                    ? require('../assets/icons/Certification.png')
                    : require('../assets/icons/profile.png')}
                  style={styles.sellerTypeIcon}
                />
                <Text style={styles.sellerType}>
                  {profile.seller_type === 'certified_merchant' ? t('settings.certifiedMerchant') : t('settings.individualSeller')}
                  {profile.status === 'pending' ? ` ${t('myListings.statusPending')}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.uploadLimit}>
              <Text style={styles.uploadLimitNum}>
                {activeCount}<Text style={styles.uploadLimitTotal}>/{uploadLimit}</Text>
              </Text>
              <Text style={styles.uploadLimitLabel}>{t('myListings.uploadingLabel')}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: `${Math.min(100, (activeCount / uploadLimit) * 100)}%` as any },
                activeCount >= uploadLimit * 0.9 && styles.progressFillWarn,
              ]} />
            </View>
          </View>

          {/* Status tabs */}
          <View style={styles.tabBar}>
            {STATUS_TABS.map(tab => {
              const count = listings.filter(l => l.status === tab.key).length;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, statusTab === tab.key && styles.tabBtnActive]}
                  onPress={() => setStatusTab(tab.key as any)}
                >
                  <Text style={[styles.tabBtnText, statusTab === tab.key && styles.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabCount, statusTab === tab.key && styles.tabCountActive]}>
                      <Text style={[styles.tabCountText, statusTab === tab.key && styles.tabCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Listings */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.brand.orange} />}
            contentContainerStyle={styles.scrollContent}
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>
                  {statusTab === 'active' ? t('myListings.emptyActive') : statusTab === 'sold' ? t('myListings.emptySold') : t('myListings.emptyHidden')}
                </Text>
                {statusTab === 'active' && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/listing-upload' as any)}>
                    <Text style={styles.emptyBtnText}>{t('myListings.addListingBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.grid}>
                {filtered.map(renderCard)}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      {renderActionModal()}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.section },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    navTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    navUpload: { backgroundColor: colors.brand.orange, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
    // '#fff' kept raw — always-white on Card Orange
    navUploadText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    noProfileWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    noProfileIcon: { width: 56, height: 56, tintColor: colors.border.strong, resizeMode: 'contain' },
    noProfileTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    noProfileBtn: { backgroundColor: colors.brand.orange, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32 },
    // '#fff' kept raw — always-white on Card Orange
    noProfileBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Seller header
    sellerHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface.card, paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
    sellerHeaderLeft: { flex: 1, gap: 3 },
    sellerName: { fontSize: 17, fontWeight: '800', color: colors.text.primary },
    sellerTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    sellerTypeIcon: { width: 13, height: 13, resizeMode: 'contain', tintColor: colors.text.secondary },
    sellerType: { fontSize: 13, color: colors.text.secondary },
    uploadLimit: { alignItems: 'center', gap: 2 },
    uploadLimitNum: { fontSize: 22, fontWeight: '800', color: colors.brand.orange },
    uploadLimitTotal: { fontSize: 14, color: colors.text.tertiary, fontWeight: '400' },
    uploadLimitLabel: { fontSize: 11, color: colors.text.tertiary },

    progressWrap: { backgroundColor: colors.surface.card, paddingHorizontal: 20, paddingBottom: 14 },
    progressTrack: { height: 4, backgroundColor: colors.surface.section, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.brand.orange, borderRadius: 2 },
    // '#EF4444' kept raw — destructive red over-quota warn
    progressFillWarn: { backgroundColor: '#EF4444' },

    // Tab bar
    tabBar: { flexDirection: 'row', backgroundColor: colors.surface.card, borderBottomWidth: 1, borderBottomColor: colors.border.default, marginBottom: 8 },
    tabBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 6, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: colors.brand.orange },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.tertiary },
    tabBtnTextActive: { color: colors.brand.orange, fontWeight: '700' },
    tabCount: { backgroundColor: colors.border.default, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
    tabCountActive: { backgroundColor: colors.brand.peach },
    tabCountText: { fontSize: 11, fontWeight: '700', color: colors.text.secondary },
    tabCountTextActive: { color: colors.brand.orange },

    scrollContent: { paddingHorizontal: 12, paddingTop: 8 },

    // Grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: { width: CARD_W, backgroundColor: colors.surface.card, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border.default },
    cardImgBox: { width: '100%', aspectRatio: 0.72, backgroundColor: colors.surface.section, position: 'relative' },
    cardImg: { width: '100%', height: '100%' },
    cardImgPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.section },
    condBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    // '#fff' kept raw — always-white on filled condition badge
    condBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    cardInfo: { padding: 10, gap: 3 },
    cardName: { fontSize: 13, fontWeight: '700', color: colors.text.primary, lineHeight: 18 },
    cardSet: { fontSize: 11, color: colors.text.tertiary },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    price: { fontSize: 15, fontWeight: '800', color: colors.brand.orange },
    nego: { fontSize: 10, color: colors.text.secondary, backgroundColor: colors.surface.section, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
    qty: { fontSize: 11, color: colors.text.tertiary },
    actionBtn: { marginHorizontal: 10, marginBottom: 10, backgroundColor: colors.surface.section, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.text.primary },

    // Empty
    emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    emptyBtn: { backgroundColor: colors.brand.orange, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 28, marginTop: 4 },
    // '#fff' kept raw — always-white on Card Orange
    emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Action modal
    modalOverlay: { flex: 1, backgroundColor: colors.overlay.light, justifyContent: 'flex-end' },
    actionSheet: { backgroundColor: colors.surface.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 40 },
    sheetHandle: { width: 40, height: 4, backgroundColor: colors.border.default, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
    sheetCardPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface.section, borderRadius: 16, padding: 14, marginBottom: 16 },
    sheetCardImg: { width: 48, height: 67, borderRadius: 6 },
    sheetCardInfo: { flex: 1, gap: 4 },
    sheetCardName: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    sheetCardPrice: { fontSize: 14, fontWeight: '700', color: colors.brand.orange },
    sheetCondBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    // '#fff' kept raw — always-white on filled condition badge
    sheetCondText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    sheetActions: { gap: 2 },
    sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    sheetRowDanger: { borderBottomWidth: 0 },
    sheetRowIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: colors.text.primary },
    sheetRowText: { fontSize: 16, color: colors.text.primary },
    // '#EF4444' kept raw — destructive red
    sheetRowTextDanger: { color: '#EF4444' },
    sheetCancel: { marginTop: 12, backgroundColor: colors.surface.section, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    sheetCancelText: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  });
}
