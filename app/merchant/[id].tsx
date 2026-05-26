import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchArtofpkmImages } from '../../lib/artofpkm';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Note: Linking still used in info tab (website / whatsapp / instagram links)
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import Loader from '../../components/Loader';
import { useTheme } from '../../theme/ThemeProvider';
import { type ColorTokens } from '../../constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_H = 220;
const LOGO_SIZE = 72;

// ── Types ────────────────────────────────────────────────────────────────────

type MerchantProfile = {
  id: string;
  user_id: string;
  seller_type: 'individual_seller' | 'certified_merchant';
  display_name: string;
  avatar_url: string | null;
  district: string | null;
  contact_type: string | null;
  contact_value: string | null;
  payment_methods: string[];
  shop_name_zh: string | null;
  shop_name_en: string | null;
  logo_url: string | null;
  banner_url: string | null;
  has_physical_store: boolean;
  address: string | null;
  business_hours: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  shop_description: string | null;
  status: string;
  created_at: string;
};

type Listing = {
  id: string;
  card_id: string | null;
  card_name: string;
  set_name: string | null;
  rarity: string | null;
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

type TabKey = 'listings' | 'info';

const CONDITION_COLOR: Record<string, string> = {
  'Raw':    '#6B7280',
  'PSA 9':  '#3B82F6',
  'PSA 10': '#F59E0B',
};
const CONDITION_LABEL: Record<string, string> = {
  'Raw': 'Raw', 'PSA 9': 'PSA 9', 'PSA 10': 'PSA 10',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MerchantPage() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { t, i18n } = useTranslation();

  const [profile, setProfile]       = useState<MerchantProfile | null>(null);
  const [listings, setListings]     = useState<Listing[]>([]);
  const [artofpkmMap, setArtofpkmMap] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabKey>('listings');
  const [myId, setMyId]         = useState<string | null>(null);
  const scrollY                 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (id) loadAll();
    supabase.auth.getUser().then(({ data: { user } }) => setMyId(user?.id ?? null));
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [profileRes, listingsRes] = await Promise.all([
        supabase.from('merchant_profiles').select('*').eq('id', id).single(),
        supabase
          .from('listings')
          .select('*')
          .eq('merchant_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ]);
      setProfile(profileRes.data ?? null);
      const listingsData = listingsRes.data ?? [];
      setListings(listingsData);
      fetchArtofpkmImages(listingsData).then(map => {
        if (Object.keys(map).length) setArtofpkmMap(map);
      });
    } catch (e) {
      if (__DEV__) console.error('[MerchantPage] loadAll error:', e);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (listingId?: string) => {
    if (!myId || !profile) return;
    if (myId === profile.user_id) return; // can't chat with yourself

    let existingQuery = supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', myId)
      .eq('seller_id', profile.user_id);

    existingQuery = listingId
      ? existingQuery.eq('listing_id', listingId)
      : existingQuery.is('listing_id', null);

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      router.push(`/chat/${existing.id}` as any);
      return;
    }

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        buyer_id:    myId,
        seller_id:   profile.user_id,
        listing_id:  listingId ?? null,
        merchant_id: profile.id,
      })
      .select('id')
      .single();

    if (newConv) router.push(`/chat/${newConv.id}` as any);
  };

  const displayName = profile
    ? profile.seller_type === 'certified_merchant'
      ? (profile.shop_name_zh ?? profile.shop_name_en ?? profile.display_name)
      : profile.display_name
    : '';

  const contactMethodName = profile?.whatsapp
    ? 'WhatsApp'
    : profile?.contact_type ?? null;

  // Animated header opacity
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [BANNER_H - 80, BANNER_H - 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Loader size="large" />
          <Text style={styles.loadingText}>{t('common.loadingEllipsis')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Text style={styles.notFoundText}>{t('merchant.notFound')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Listings grid ──────────────────────────────────────────────────────────

  const renderListing = ({ item }: { item: Listing }) => {
    const imgUri = item.photo_urls?.[0] || item.card_image_url || artofpkmMap[item.card_name] || null;
    return (
      <View style={styles.listingCard}>
        {/* Image */}
        <View style={styles.listingImgBox}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.listingImg} resizeMode="contain" />
          ) : (
            <View style={styles.listingImgPlaceholder}>
            </View>
          )}
          {/* Condition badge */}
          <View style={[styles.condBadge, { backgroundColor: CONDITION_COLOR[item.condition] ?? colors.text.tertiary }]}>
            <Text style={styles.condBadgeText}>{CONDITION_LABEL[item.condition] ?? item.condition}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.listingInfo}>
          <Text style={styles.listingName} numberOfLines={2}>{item.card_name}</Text>
          {item.set_name && (
            <Text style={styles.listingSet} numberOfLines={1}>{item.set_name}</Text>
          )}
          {item.language && item.language.length > 0 && (
            <Text style={styles.listingLang}>{item.language.join(' · ')}</Text>
          )}
          <View style={styles.listingPriceRow}>
            <Text style={styles.listingPrice}>HK${item.price.toLocaleString()}</Text>
            {item.is_negotiable && <Text style={styles.listingNego}>{t('shops.negotiable')}</Text>}
          </View>
          {item.quantity > 1 && (
            <Text style={styles.listingQty}>{t('merchant.stock', { n: item.quantity })}</Text>
          )}
        </View>

        {/* Contact CTA */}
        <TouchableOpacity style={styles.listingContactBtn} onPress={() => startChat(item.id)}>
          <Text style={styles.listingContactBtnText}>{t('merchant.inquire')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Info tab ───────────────────────────────────────────────────────────────

  const renderInfoTab = () => (
    <View style={styles.infoWrap}>
      {/* About */}
      {profile.shop_description && (
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>{t('merchant.about')}</Text>
          <Text style={styles.infoText}>{profile.shop_description}</Text>
        </View>
      )}

      {/* Location */}
      {(profile.district || profile.address) && (
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>{t('merchant.location')}</Text>
          {profile.district && (
            <View style={styles.infoRow}>
              <Image source={require('../../assets/icons/location-marker.png')} style={styles.infoRowIconImg} />
              <Text style={styles.infoRowText}>{profile.district}</Text>
            </View>
          )}
          {profile.address && (
            <View style={styles.infoRow}>
              <Image source={require('../../assets/icons/home.png')} style={styles.infoRowIconImg} />
              <Text style={styles.infoRowText}>{profile.address}</Text>
            </View>
          )}
          {profile.has_physical_store && (
            <View style={[styles.infoRow, styles.storeRow]}>
              <Image source={require('../../assets/icons/shops.png')} style={[styles.infoRowIconImg, { tintColor: colors.brand.orange }]} />
              <Text style={[styles.infoRowText, styles.storeRowText]}>{t('merchant.hasPhysicalStore')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Hours */}
      {profile.business_hours && (
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>{t('merchant.businessHours')}</Text>
          <View style={styles.infoRow}>
            <Image source={require('../../assets/icons/version.png')} style={styles.infoRowIconImg} />
            <Text style={styles.infoRowText}>{profile.business_hours}</Text>
          </View>
        </View>
      )}

      {/* Contact */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>{t('merchant.contactMethod')}</Text>
        {profile.whatsapp && (
          <TouchableOpacity
            style={styles.infoContactRow}
            onPress={() => Linking.openURL(`https://wa.me/${profile.whatsapp!.replace(/\D/g, '')}`)}
          >
            <Image source={require('../../assets/icons/message.png')} style={[styles.infoContactIconImg, { tintColor: '#3B82F6' }]} />
            <Text style={styles.infoContactText}>WhatsApp：{profile.whatsapp}</Text>
            <Text style={styles.infoContactArrow}>↗</Text>
          </TouchableOpacity>
        )}
        {profile.instagram && (
          <TouchableOpacity
            style={styles.infoContactRow}
            onPress={() => Linking.openURL(`https://instagram.com/${profile.instagram}`)}
          >
            <Image source={require('../../assets/icons/camera.png')} style={[styles.infoContactIconImg, { tintColor: '#3B82F6' }]} />
            <Text style={styles.infoContactText}>Instagram：@{profile.instagram}</Text>
            <Text style={styles.infoContactArrow}>↗</Text>
          </TouchableOpacity>
        )}
        {profile.website && (
          <TouchableOpacity
            style={styles.infoContactRow}
            onPress={() => Linking.openURL(profile.website!.startsWith('http') ? profile.website! : `https://${profile.website}`)}
          >
            <Image source={require('../../assets/icons/search.png')} style={[styles.infoContactIconImg, { tintColor: '#3B82F6' }]} />
            <Text style={styles.infoContactText}>{profile.website}</Text>
            <Text style={styles.infoContactArrow}>↗</Text>
          </TouchableOpacity>
        )}
        {profile.contact_type && profile.contact_value && !profile.whatsapp && (
          <View style={styles.infoRow}>
            <Image source={require('../../assets/icons/message.png')} style={styles.infoRowIconImg} />
            <Text style={styles.infoRowText}>{profile.contact_type}：{profile.contact_value}</Text>
          </View>
        )}
      </View>

      {/* Payment */}
      {profile.payment_methods && profile.payment_methods.length > 0 && (
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>{t('merchant.paymentMethods')}</Text>
          <View style={styles.payGrid}>
            {profile.payment_methods.map(p => (
              <View key={p} style={styles.payItem}>
                <Text style={styles.payItemText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Member since */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>{t('merchant.accountInfo')}</Text>
        <View style={styles.infoRow}>
          <Image source={require('../../assets/icons/version.png')} style={styles.infoRowIconImg} />
          <Text style={styles.infoRowText}>
            {t('merchant.joinedDate', {
              date: new Date(profile.created_at).toLocaleDateString(
                i18n.language === 'en' ? 'en-US' : i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'zh-CN' ? 'zh-CN' : 'zh-HK',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )
            })}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Image
            source={profile.seller_type === 'certified_merchant'
              ? require('../../assets/icons/Certification.png')
              : require('../../assets/icons/profile.png')}
            style={styles.infoRowIconImg}
          />
          <Text style={styles.infoRowText}>
            {profile.seller_type === 'certified_merchant' ? t('merchant.certifiedMerchant') : t('settings.individualSeller')}
          </Text>
        </View>
      </View>
    </View>
  );

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.safe}>
      {/* Floating animated header */}
      <Animated.View style={[styles.floatingHeader, { opacity: headerBgOpacity }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.floatingHeaderInner}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.floatingTitle} numberOfLines={1}>{displayName}</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Transparent back button (always visible) */}
      <SafeAreaView edges={['top']} style={styles.absoluteBack} pointerEvents="box-none">
        <Animated.View style={[styles.floatingHeaderInner, { opacity: Animated.subtract(1, headerBgOpacity) }]}>
          <TouchableOpacity style={[styles.backBtn, styles.backBtnDark]} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, styles.backBtnTextDark]}>‹</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Banner */}
        <View style={styles.bannerWrap}>
          {profile.banner_url ? (
            <Image source={{ uri: profile.banner_url }} style={styles.bannerImg} resizeMode="cover" />
          ) : (
            <View style={[styles.bannerImg, styles.bannerPlaceholder]} />
          )}
        </View>

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.logoRow}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              {profile.logo_url ?? profile.avatar_url ? (
                <Image
                  source={{ uri: (profile.logo_url ?? profile.avatar_url)! }}
                  style={styles.logoImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.logoImg, styles.logoPlaceholder]}>
                  <Text style={styles.logoPlaceholderText}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>

            {/* Badge */}
            <View style={[
              styles.typeBadge,
              profile.seller_type === 'certified_merchant' ? styles.certTypeBadge : styles.indTypeBadge,
            ]}>
              <Image
                source={profile.seller_type === 'certified_merchant'
                  ? require('../../assets/icons/Certification.png')
                  : require('../../assets/icons/profile.png')}
                style={[styles.typeBadgeIcon, {
                  tintColor: profile.seller_type === 'certified_merchant' ? '#065F46' : '#374151',
                }]}
              />
              <Text style={[styles.typeBadgeText, {
                color: profile.seller_type === 'certified_merchant' ? '#065F46' : '#374151',
              }]}>
                {profile.seller_type === 'certified_merchant' ? t('settings.certifiedMerchant') : t('settings.individualSeller')}
              </Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.profileName}>{displayName}</Text>
          {profile.seller_type === 'certified_merchant' && profile.shop_name_en && profile.shop_name_zh && (
            <Text style={styles.profileNameEn}>{profile.shop_name_en}</Text>
          )}

          {/* Meta chips */}
          <View style={styles.metaRow}>
            {profile.district && (
              <View style={styles.metaChip}>
                <Image source={require('../../assets/icons/location-marker.png')} style={styles.metaChipIcon} />
                <Text style={styles.metaChipText}>{profile.district}</Text>
              </View>
            )}
            {profile.has_physical_store && (
              <View style={[styles.metaChip, styles.storeMetaChip]}>
                <Image source={require('../../assets/icons/shops.png')} style={[styles.metaChipIcon, { tintColor: colors.brand.orange }]} />
                <Text style={[styles.metaChipText, styles.storeMetaText]}>{t('merchant.physicalStore')}</Text>
              </View>
            )}
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{t('merchant.tabListings', { n: listings.length })}</Text>
            </View>
          </View>

          {/* Description */}
          {profile.shop_description && (
            <Text style={styles.profileDesc}>{profile.shop_description}</Text>
          )}

          {/* CTA buttons */}
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaContact} onPress={() => startChat()} activeOpacity={0.8}>
              <Image source={require('../../assets/icons/message.png')} style={styles.ctaIcon} />
              <Text style={styles.ctaContactText}>
                {contactMethodName ? t('merchant.inquireVia', { method: contactMethodName }) : t('merchant.inquire')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['listings', 'info'] as TabKey[]).map(tabKey => (
            <TouchableOpacity
              key={tabKey}
              style={[styles.tabBtn, tab === tabKey && styles.tabBtnActive]}
              onPress={() => setTab(tabKey)}
            >
              <Text style={[styles.tabBtnText, tab === tabKey && styles.tabBtnTextActive]}>
                {tabKey === 'listings'
                  ? t('merchant.tabListings', { n: listings.length })
                  : t('merchant.tabInfo')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {tab === 'listings' ? (
          listings.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('merchant.noListings')}</Text>
              <Text style={styles.emptySub}>{t('merchant.noListingsSub')}</Text>
            </View>
          ) : (
            <View style={styles.listingGrid}>
              {listings.map(item => renderListing({ item }))}
            </View>
          )
        ) : (
          renderInfoTab()
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.section },

    // Floating header
    floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    floatingHeaderInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    floatingTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text.primary, textAlign: 'center' },
    absoluteBack: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 101 },
    // rgba(255,255,255,0.9) kept raw — floating overlay on banner image
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    backBtnText: { fontSize: 26, color: colors.text.primary, lineHeight: 30, fontWeight: '300' },
    // rgba(0,0,0,0.3) kept raw — scrim overlay on banner image
    backBtnDark: { backgroundColor: 'rgba(0,0,0,0.3)' },
    // '#fff' kept raw — always-white on scrim
    backBtnTextDark: { color: '#fff' },

    // Loading / error
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: colors.text.tertiary },
    notFoundText: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    backLink: { fontSize: 15, color: colors.brand.orange, fontWeight: '600', marginTop: 8 },

    // Banner
    bannerWrap: { width: '100%', height: BANNER_H },
    bannerImg: { width: '100%', height: '100%' },
    bannerPlaceholder: { backgroundColor: colors.brand.peach },

    // Profile header
    profileHeader: { backgroundColor: colors.surface.card, paddingHorizontal: 20, paddingBottom: 20, marginBottom: 8 },
    logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -LOGO_SIZE / 2 - 8, marginBottom: 12 },
    // shadowColor '#000' kept raw (shadow convention); border '#fff' kept raw — always-white frame
    logoWrap: { borderRadius: LOGO_SIZE / 2 + 4, borderWidth: 4, borderColor: '#fff', overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    logoImg: { width: LOGO_SIZE, height: LOGO_SIZE },
    logoPlaceholder: { backgroundColor: colors.brand.orange, alignItems: 'center', justifyContent: 'center' },
    // '#fff' kept raw — always-white on Card Orange
    logoPlaceholderText: { fontSize: 28, fontWeight: '800', color: '#fff' },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    // '#ECFDF5' kept raw — semantic mint tint for certified-merchant
    certTypeBadge: { backgroundColor: '#ECFDF5' },
    indTypeBadge: { backgroundColor: colors.surface.section },
    typeBadgeIcon: { width: 13, height: 13, resizeMode: 'contain' },
    typeBadgeText: { fontSize: 12, fontWeight: '700' },

    profileName: { fontSize: 24, fontWeight: '800', color: colors.text.primary, marginBottom: 2 },
    profileNameEn: { fontSize: 14, color: colors.text.secondary, marginBottom: 10 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface.section, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
    storeMetaChip: { backgroundColor: colors.brand.peach },
    metaChipIcon: { width: 12, height: 12, resizeMode: 'contain', tintColor: colors.text.secondary },
    metaChipText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
    storeMetaText: { color: colors.brand.orange },
    profileDesc: { fontSize: 14, color: colors.text.primary, lineHeight: 22, marginBottom: 16 },

    ctaRow: { flexDirection: 'row', gap: 10 },
    ctaContact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brand.orange, borderRadius: 16, paddingVertical: 13 },
    // '#fff' kept raw — always-white on Card Orange
    ctaIcon: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#fff' },
    // '#fff' kept raw — always-white on Card Orange
    ctaContactText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Tab bar
    tabBar: { flexDirection: 'row', backgroundColor: colors.surface.card, borderBottomWidth: 1, borderBottomColor: colors.border.default, marginBottom: 8 },
    tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: colors.brand.orange },
    tabBtnText: { fontSize: 15, fontWeight: '600', color: colors.text.tertiary },
    tabBtnTextActive: { color: colors.brand.orange },

    // Listings grid
    listingGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12, paddingTop: 4 },
    listingCard: { width: (SCREEN_W - 36) / 2, backgroundColor: colors.surface.card, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border.default },
    listingImgBox: { width: '100%', aspectRatio: 0.72, backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    listingImg: { width: '100%', height: '100%' },
    listingImgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    listingImgEmoji: { fontSize: 40 },
    condBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    // '#fff' kept raw — always-white on filled condition badge
    condBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    listingInfo: { padding: 10, gap: 2 },
    listingName: { fontSize: 13, fontWeight: '700', color: colors.text.primary, lineHeight: 18 },
    listingSet: { fontSize: 11, color: colors.text.tertiary },
    listingLang: { fontSize: 11, color: colors.text.secondary },
    listingPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    listingPrice: { fontSize: 15, fontWeight: '800', color: colors.brand.orange },
    listingNego: { fontSize: 11, color: colors.text.secondary, backgroundColor: colors.surface.section, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    listingQty: { fontSize: 11, color: colors.text.tertiary },
    listingContactBtn: { marginHorizontal: 10, marginBottom: 10, backgroundColor: colors.brand.peach, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    listingContactBtnText: { fontSize: 13, fontWeight: '600', color: colors.brand.orange },

    // Empty
    emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    emptySub: { fontSize: 14, color: colors.text.tertiary },

    // Info tab
    infoWrap: { paddingBottom: 16 },
    infoSection: { backgroundColor: colors.surface.card, marginBottom: 8, paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
    infoSectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    infoText: { fontSize: 15, color: colors.text.primary, lineHeight: 24 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    infoRowIconImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: colors.text.secondary, marginTop: 2 },
    infoRowText: { flex: 1, fontSize: 15, color: colors.text.primary, lineHeight: 22 },
    storeRow: { backgroundColor: colors.brand.peach, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    storeRowText: { color: colors.brand.orange, fontWeight: '600' },
    infoContactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    infoContactIconImg: { width: 20, height: 20, resizeMode: 'contain' },
    // '#3B82F6' kept raw — semantic info-blue link
    infoContactText: { flex: 1, fontSize: 15, color: '#3B82F6' },
    // '#3B82F6' kept raw — semantic info-blue link
    infoContactArrow: { fontSize: 16, color: '#3B82F6' },
    payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    payItem: { backgroundColor: colors.surface.section, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    payItemText: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  });
}
