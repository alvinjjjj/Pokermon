import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { extractArtofpkmKey } from '../../lib/artofpkm';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
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

const { width: SCREEN_W } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

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
  merchant_id: string | null;
  seller_id: string;
};

type SellerInfo = {
  id: string;
  seller_type: 'individual_seller' | 'certified_merchant';
  display_name: string;
  shop_name_zh: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  district: string | null;
  contact_type: string | null;
  contact_value: string | null;
  whatsapp: string | null;
  instagram: string | null;
  status: string;
};

const CONDITION_COLOR: Record<string, string> = {
  'Raw': '#6B7280',
  'PSA 9': '#3B82F6',
  'PSA 10': '#F59E0B',
};


// ── Component ─────────────────────────────────────────────────────────────────

export default function ListingDetail() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { t }   = useTranslation();

  // Helper — keeps style/colors closure scope
  const DetailRow = ({
    iconSource, label, value, valueColor,
  }: {
    iconSource?: any; label: string; value: string; valueColor?: string;
  }) => (
    <View style={styles.detailRow}>
      {iconSource
        ? <Image source={iconSource} style={styles.detailIcon} />
        : <View style={styles.detailIconPlaceholder} />
      }
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor, fontWeight: '700' } : {}]}>
        {value}
      </Text>
    </View>
  );

  const [listing, setListing]   = useState<Listing | null>(null);
  const [seller, setSeller]     = useState<SellerInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [imgIndex, setImgIndex] = useState(0);
  const [myId, setMyId]         = useState<string | null>(null);
  const [chatting, setChatting] = useState(false); // guard against double-tap

  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) loadListing();
    supabase.auth.getUser().then(({ data: { user } }) => setMyId(user?.id ?? null));
  }, [id]);

  const loadListing = async () => {
    setLoading(true);
    try {
      const { data: ls } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (!ls) { return; }
      setListing(ls);

      // Fetch seller
      const { data: mp } = await supabase
        .from('merchant_profiles')
        .select('id, seller_type, display_name, shop_name_zh, avatar_url, logo_url, district, contact_type, contact_value, whatsapp, instagram, status')
        .eq('user_id', ls.seller_id)
        .maybeSingle();

      setSeller(mp ?? null);

      // Enrich with artofpkm image if needed
      if (ls && !(ls.photo_urls?.length) && !ls.card_image_url) {
        const key = extractArtofpkmKey(ls.card_name);
        if (key) {
          const { data: artofpkm } = await supabase
            .from('artofpkm_card_images')
            .select('image_url')
            .eq('key', key)
            .maybeSingle();
          if (artofpkm?.image_url) {
            setListing({ ...ls, card_image_url: artofpkm.image_url });
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.error('[ListingDetail] loadListing error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const photos: string[] = listing
    ? (listing.photo_urls?.length ? listing.photo_urls : (listing.card_image_url ? [listing.card_image_url] : []))
    : [];

  const condColor = listing ? (CONDITION_COLOR[listing.condition] ?? colors.text.tertiary) : colors.text.tertiary;

  const sellerName  = seller?.seller_type === 'certified_merchant'
    ? (seller.shop_name_zh ?? seller.display_name)
    : seller?.display_name ?? t('listing.unknownSeller');

  const sellerAvatar = seller?.seller_type === 'certified_merchant'
    ? (seller.logo_url ?? seller.avatar_url)
    : seller?.avatar_url;

  const startChat = async () => {
    if (chatting || !myId || !listing) return;
    if (myId === listing.seller_id) return; // can't chat with yourself
    setChatting(true);
    try {
      // Find or create conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', myId)
        .eq('seller_id', listing.seller_id)
        .eq('listing_id', listing.id)
        .maybeSingle();

      if (existing) {
        router.push(`/chat/${existing.id}` as any);
        return;
      }

      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          buyer_id:    myId,
          seller_id:   listing.seller_id,
          listing_id:  listing.id,
          merchant_id: listing.merchant_id,
        })
        .select('id')
        .single();

      if (newConv) router.push(`/chat/${newConv.id}` as any);
    } catch (e) {
      if (__DEV__) console.error('[ListingDetail] startChat error:', e);
    } finally {
      setChatting(false);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setImgIndex(idx);
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <Loader size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{t('listing.title')}</Text>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={{ fontSize: 16, color: colors.text.secondary }}>{t('listing.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('listing.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Photo Carousel ── */}
        {photos.length > 0 ? (
          <View>
            <FlatList
              ref={flatRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              )}
            />
            {/* Dots */}
            {photos.length > 1 && (
              <View style={styles.dots}>
                {photos.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === imgIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
            {/* Condition badge overlay */}
            <View style={[styles.condOverlay, { backgroundColor: condColor }]}>
              <Text style={styles.condOverlayText}>{listing.condition}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.photoPlaceholder} />
        )}

        {/* ── Card Info ── */}
        <View style={styles.infoSection}>
          {/* Card name + set */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{listing.card_name}</Text>
              {listing.set_name && (
                <Text style={styles.cardSet}>{listing.set_name}</Text>
              )}
            </View>
            {listing.status === 'sold' && (
              <View style={styles.soldTag}>
                <Text style={styles.soldTagText}>{t('listing.sold')}</Text>
              </View>
            )}
          </View>

          {/* Price row */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>HK${listing.price.toLocaleString()}</Text>
            {listing.is_negotiable && (
              <View style={styles.negoTag}>
                <Text style={styles.negoTagText}>{t('listing.negotiable')}</Text>
              </View>
            )}
          </View>

          {/* Details */}
          <View style={styles.detailsBox}>
            <DetailRow label={t('listing.condition')} value={listing.condition} valueColor={condColor} />
            {listing.language?.length > 0 && (
              <DetailRow label={t('listing.language')} value={listing.language.join(' · ')} />
            )}
            {listing.quantity > 1 && (
              <DetailRow label={t('listing.stock')} value={t('listing.quantity', { n: listing.quantity })} />
            )}
          </View>

          {/* Notes */}
          {listing.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>{t('listing.sellerNotes')}</Text>
              <Text style={styles.notesText}>{listing.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Seller Info ── */}
        {seller && (
          <View style={styles.sellerSection}>
            <Text style={styles.sectionTitle}>{t('listing.sellerInfo')}</Text>

            <TouchableOpacity
              style={styles.sellerRow}
              onPress={() => {
                const mpId = listing.merchant_id ?? seller.id;
                router.push(`/merchant/${mpId}` as any);
              }}
              activeOpacity={0.8}
            >
              {/* Avatar */}
              {sellerAvatar ? (
                <Image source={{ uri: sellerAvatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Image
                    source={seller.seller_type === 'certified_merchant'
                      ? require('../../assets/icons/shops.png')
                      : require('../../assets/icons/profile.png')}
                    style={styles.sellerAvatarIcon}
                  />
                </View>
              )}

              {/* Info */}
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{sellerName}</Text>
                <View style={styles.sellerMeta}>
                  {seller.seller_type === 'certified_merchant' && (
                    <View style={styles.certBadge}>
                      <Image source={require('../../assets/icons/Certification.png')} style={styles.certBadgeIcon} />
                      <Text style={styles.certBadgeText}>{t('listing.certified')}</Text>
                    </View>
                  )}
                  {seller.district && (
                    <View style={styles.sellerDistrictRow}>
                      <Image source={require('../../assets/icons/location-marker.png')} style={styles.locationIcon} />
                      <Text style={styles.sellerDistrict}>{seller.district}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.sellerArrow}>›</Text>
            </TouchableOpacity>

            {/* View all listings */}
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => {
                const mpId = listing.merchant_id ?? seller.id;
                router.push(`/merchant/${mpId}` as any);
              }}
            >
              <Text style={styles.viewAllBtnText}>{t('listing.viewAllListings')}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── Bottom CTA ── */}
      {listing.status !== 'sold' && seller && myId !== listing.seller_id && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: chatting ? '#FDBA74' : colors.brand.orange }]}
            onPress={startChat}
            disabled={chatting}
            activeOpacity={0.85}
          >
            <Image source={require('../../assets/icons/message.png')} style={styles.contactBtnIcon} />
            <Text style={styles.contactBtnText}>{t('listing.contactSeller')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.card },

    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.border.default,
    },
    navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    navTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Photo carousel
    photo: { width: SCREEN_W, height: SCREEN_W * 1.1, backgroundColor: colors.surface.section },
    photoPlaceholder: {
      width: SCREEN_W, height: SCREEN_W * 1.1,
      backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center',
    },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border.strong },
    dotActive: { backgroundColor: colors.brand.orange, width: 18 },
    condOverlay: {
      position: 'absolute', top: 14, left: 14,
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    },
    // '#fff' kept raw — always-white on filled condition overlay
    condOverlayText: { fontSize: 12, fontWeight: '800', color: '#fff' },

    // Info section
    infoSection: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardName: { fontSize: 20, fontWeight: '800', color: colors.text.primary, lineHeight: 26 },
    cardSet: { fontSize: 13, color: colors.text.tertiary, marginTop: 3 },
    // '#FEE2E2'/'#EF4444' kept raw — destructive red tint for sold
    soldTag: {
      backgroundColor: '#FEE2E2', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
    },
    // '#EF4444' kept raw — destructive red
    soldTagText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },

    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    price: { fontSize: 28, fontWeight: '800', color: colors.brand.orange },
    negoTag: {
      backgroundColor: colors.brand.peach, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    negoTagText: { fontSize: 12, fontWeight: '600', color: colors.brand.orange },

    detailsBox: {
      backgroundColor: colors.surface.section, borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 4,
    },
    detailRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border.default, gap: 10,
    },
    detailIcon: { width: 16, height: 16, resizeMode: 'contain', tintColor: colors.text.secondary },
    detailIconPlaceholder: { width: 16 },
    detailLabel: { fontSize: 14, color: colors.text.secondary, flex: 1 },
    detailValue: { fontSize: 14, color: colors.text.primary, fontWeight: '600' },

    // '#FFFBEB'/'#FDE68A'/'#92400E'/'#78350F' kept raw — semantic merchant-note amber tint
    notesBox: {
      backgroundColor: '#FFFBEB', borderRadius: 14,
      padding: 14, borderWidth: 1, borderColor: '#FDE68A',
    },
    // '#92400E' kept raw — semantic merchant-note amber text
    notesLabel: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 6 },
    // '#78350F' kept raw — semantic merchant-note amber text
    notesText: { fontSize: 14, color: '#78350F', lineHeight: 20 },

    // Seller section
    sellerSection: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    sellerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface.section, borderRadius: 18,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    sellerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.border.default },
    sellerAvatarPlaceholder: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center',
    },
    sellerAvatarIcon: { width: 26, height: 26, resizeMode: 'contain', tintColor: colors.text.tertiary },
    sellerInfo: { flex: 1, gap: 4 },
    sellerName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    sellerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    // '#ECFDF5'/'#065F46' kept raw — semantic mint tint for certified
    certBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: '#ECFDF5', borderRadius: 6,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    // '#065F46' kept raw — semantic emerald text for certified
    certBadgeIcon: { width: 11, height: 11, resizeMode: 'contain', tintColor: '#065F46' },
    // '#065F46' kept raw — semantic emerald text for certified
    certBadgeText: { fontSize: 11, fontWeight: '700', color: '#065F46' },
    sellerDistrictRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    locationIcon: { width: 11, height: 11, resizeMode: 'contain', tintColor: colors.text.secondary },
    sellerDistrict: { fontSize: 12, color: colors.text.secondary },
    sellerArrow: { fontSize: 22, color: colors.text.tertiary, fontWeight: '300' },

    viewAllBtn: {
      backgroundColor: colors.surface.section, borderRadius: 14,
      paddingVertical: 13, alignItems: 'center',
    },
    viewAllBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },

    // Bottom bar
    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
      backgroundColor: colors.surface.card,
      borderTopWidth: 0.5, borderTopColor: colors.border.default,
    },
    contactBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 10, borderRadius: 18, paddingVertical: 17,
    },
    // '#fff' kept raw — always-white on Card Orange
    contactBtnIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: '#fff' },
    // '#fff' kept raw — always-white on Card Orange
    contactBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  });
}
