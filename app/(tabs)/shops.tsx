import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchArtofpkmImages } from '../../lib/artofpkm';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { SkeletonGrid, SkeletonRow } from '../../components/SkeletonCard';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 2;

// ── Types ─────────────────────────────────────────────────────────────────────

type SellerType = 'individual_seller' | 'certified_merchant';

type MerchantProfile = {
  id: string;
  user_id: string;
  seller_type: SellerType;
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
  seller_id: string;
  merchant_id: string | null;
  seller_type: SellerType;
  card_id: string | null;
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
  merchant_profiles?: {
    display_name: string;
    shop_name_zh: string | null;
    avatar_url: string | null;
    logo_url: string | null;
    district: string | null;
    whatsapp: string | null;
    contact_type: string | null;
    contact_value: string | null;
  };
};

type MainTab    = 'marketplace' | 'merchants';
type SortKey    = 'newest' | 'price_asc' | 'price_desc';
type CondFilter = 'all' | 'Raw' | 'PSA 9' | 'PSA 10';

// ── Constants ─────────────────────────────────────────────────────────────────

const HK_DISTRICTS = [
  '全部地區',
  '中西區', '灣仔', '東區', '南區',
  '油尖旺', '深水埗', '九龍城', '黃大仙', '觀塘',
  '荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島',
];

const PAYMENT_ICONS: Record<string, string> = {};

const DISTRICT_REGION: Record<string, string> = {
  '中西區': '港島', '灣仔': '港島', '東區': '港島', '南區': '港島',
  '油尖旺': '九龍', '深水埗': '九龍', '九龍城': '九龍', '黃大仙': '九龍', '觀塘': '九龍',
  '荃灣': '新界', '屯門': '新界', '元朗': '新界', '北區': '新界',
  '大埔': '新界', '沙田': '新界', '西貢': '新界', '離島': '離島',
};

const CONDITION_COLOR: Record<string, string> = {
  'Raw':    '#6B7280',
  'PSA 9':  '#3B82F6',
  'PSA 10': '#F59E0B',
};


const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShopsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<MainTab>('marketplace');

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'newest',     label: t('shops.sortNewest') },
    { key: 'price_asc',  label: t('shops.sortPriceAsc') },
    { key: 'price_desc', label: t('shops.sortPriceDesc') },
  ];

  const CONDITIONS: { key: CondFilter; label: string }[] = [
    { key: 'all',    label: t('shops.condAll') },
    { key: 'Raw',    label: 'Raw'              },
    { key: 'PSA 9',  label: 'PSA 9'            },
    { key: 'PSA 10', label: 'PSA 10'           },
  ];

  // ── Merchants state ──────────────────────────────────────────────────────
  const [merchants, setMerchants]           = useState<MerchantProfile[]>([]);
  const [merchantsLoading, setMerchantsLoading] = useState(true);
  const [merchantsRefreshing, setMerchantsRefreshing] = useState(false);
  const [merchantsError, setMerchantsError] = useState(false);
  const [mFilterType, setMFilterType]       = useState<'all' | SellerType>('all');
  const [mFilterDistrict, setMFilterDistrict] = useState('all');
  const [mSearch, setMSearch]               = useState('');
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [hasProfile, setHasProfile]         = useState(false);
  const [myProfile, setMyProfile]           = useState<{ id: string; seller_type: SellerType } | null>(null);

  // ── Marketplace state ────────────────────────────────────────────────────
  const [listings, setListings]             = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsRefreshing, setListingsRefreshing] = useState(false);
  const [listingsError, setListingsError]     = useState(false);
  const [artofpkmMap, setArtofpkmMap]         = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore]       = useState(false);
  const [hasMore, setHasMore]               = useState(true);
  const pageRef                             = useRef(0);
  const [lSearch, setLSearch]               = useState('');
  const [sortKey, setSortKey]               = useState<SortKey>('newest');
  const [filterCond, setFilterCond]         = useState<CondFilter>('all');
  const [lFilterType, setLFilterType]       = useState<'all' | SellerType>('all');
  const [showSortModal, setShowSortModal]   = useState(false);
  const searchTimer                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────

  // Re-run on focus AND when any filter changes (so navigating back picks up
  // the current filter state rather than stale closure values).
  // The line-188 useEffect already handles filter-change reloads while on-screen;
  // useFocusEffect handles re-entry from another tab.
  useFocusEffect(useCallback(() => {
    loadMerchants();
    resetAndLoadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, filterCond, lFilterType, lSearch]));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('merchant_profiles').select('id, seller_type').eq('user_id', currentUserId).eq('status', 'active').maybeSingle()
      .then(({ data }) => {
        setHasProfile(!!data);
        setMyProfile(data ? { id: data.id, seller_type: data.seller_type as SellerType } : null);
      });
  }, [currentUserId]);

  // Re-load listings when filters change
  useEffect(() => { resetAndLoadListings(); }, [sortKey, filterCond, lFilterType]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => resetAndLoadListings(), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [lSearch]);

  // ── Merchants logic ───────────────────────────────────────────────────────

  const loadMerchants = async (isRefresh = false) => {
    if (isRefresh) setMerchantsRefreshing(true); else setMerchantsLoading(true);
    setMerchantsError(false);
    try {
      const { data, error } = await supabase
        .from('merchant_profiles')
        .select('*')
        .eq('status', 'active')
        .order('seller_type', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) setMerchantsError(true);
      else setMerchants(data ?? []);
    } catch {
      setMerchantsError(true);
    } finally {
      setMerchantsLoading(false);
      setMerchantsRefreshing(false);
    }
  };

  const filteredMerchants = merchants.filter(m => {
    if (mFilterType !== 'all' && m.seller_type !== mFilterType) return false;
    if (mFilterDistrict !== 'all' && m.district !== mFilterDistrict) return false;
    if (mSearch.trim()) {
      const q = mSearch.toLowerCase();
      const name = (m.shop_name_zh ?? m.shop_name_en ?? m.display_name).toLowerCase();
      if (!name.includes(q) && !(m.shop_description ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const certified   = filteredMerchants.filter(m => m.seller_type === 'certified_merchant');
  const individuals = filteredMerchants.filter(m => m.seller_type === 'individual_seller');

  // ── Listings logic ────────────────────────────────────────────────────────

  const enrichWithArtofpkm = async (data: Listing[]) => {
    const resolved = await fetchArtofpkmImages(data);
    if (Object.keys(resolved).length) {
      setArtofpkmMap(prev => ({ ...prev, ...resolved }));
    }
  };

  const buildListingsQuery = (from: number, to: number) => {
    let q = supabase
      .from('listings')
      .select(`*, merchant_profiles(display_name, shop_name_zh, avatar_url, logo_url, district, whatsapp, contact_type, contact_value)`)
      .eq('status', 'active')
      .range(from, to);
    if (filterCond !== 'all')    q = q.eq('condition', filterCond);
    if (lFilterType !== 'all')   q = q.eq('seller_type', lFilterType);
    if (lSearch.trim())          q = q.ilike('card_name', `%${lSearch.trim()}%`);
    if (sortKey === 'newest')    q = q.order('created_at', { ascending: false });
    if (sortKey === 'price_asc') q = q.order('price', { ascending: true });
    if (sortKey === 'price_desc')q = q.order('price', { ascending: false });
    return q;
  };

  const resetAndLoadListings = async (isRefresh = false) => {
    if (isRefresh) setListingsRefreshing(true); else setListingsLoading(true);
    setListingsError(false);
    pageRef.current = 0;
    try {
      const { data, error } = await buildListingsQuery(0, PAGE_SIZE - 1);
      if (error) setListingsError(true);
      else {
        setListings(data ?? []);
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
        enrichWithArtofpkm(data ?? []);
      }
    } catch {
      setListingsError(true);
    } finally {
      setListingsLoading(false);
      setListingsRefreshing(false);
    }
  };

  const loadMoreListings = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    const from = next * PAGE_SIZE;
    const { data } = await buildListingsQuery(from, from + PAGE_SIZE - 1);
    if (data && data.length > 0) {
      setListings(prev => [...prev, ...data]);
      pageRef.current = next;
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  // ── Contact helper ────────────────────────────────────────────────────────

  const openContact = (mp: Listing['merchant_profiles'] | MerchantProfile | undefined) => {
    if (!mp) return;
    const wa = (mp as any).whatsapp;
    const ct = (mp as any).contact_type;
    const cv = (mp as any).contact_value;
    if (wa) Linking.openURL(`https://wa.me/${wa.replace(/\D/g, '')}`);
    else if (ct === 'WhatsApp' && cv) Linking.openURL(`https://wa.me/${cv.replace(/\D/g, '')}`);
    else if (ct === 'Telegram' && cv) Linking.openURL(`https://t.me/${cv}`);
    else if (ct === 'Instagram' && cv) Linking.openURL(`https://instagram.com/${cv}`);
  };

  const getMerchantDisplayName = (m: MerchantProfile) =>
    m.seller_type === 'certified_merchant'
      ? (m.shop_name_zh ?? m.shop_name_en ?? m.display_name)
      : m.display_name;

  // ═══════════════════════════════════════════════════════════════════════════
  // MERCHANTS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  const renderCertifiedCard = (m: MerchantProfile) => (
    <TouchableOpacity key={m.id} style={styles.certCard} onPress={() => router.push(`/merchant/${m.id}` as any)} activeOpacity={0.85}>
      <View style={styles.certBanner}>
        {m.banner_url
          ? <Image source={{ uri: m.banner_url }} style={styles.certBannerImg} resizeMode="cover" />
          : <View style={[styles.certBannerImg, styles.certBannerPlaceholder]} />
        }
        <View style={styles.certLogoWrap}>
          {m.logo_url
            ? <Image source={{ uri: m.logo_url }} style={styles.certLogoImg} resizeMode="cover" />
            : <View style={[styles.certLogoImg, styles.certLogoPlaceholder]}><Text style={styles.certLogoPlaceholderText}>{getMerchantDisplayName(m).charAt(0)}</Text></View>
          }
        </View>
        <View style={styles.certBadge}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Image source={require('../../assets/icons/Certification.png')} style={{ width: 12, height: 12, tintColor: '#FF6900' }} />
            <Text style={styles.certBadgeText}>{t('shops.certifiedMerchant')}</Text>
          </View>
        </View>
      </View>
      <View style={styles.certInfo}>
        <Text style={styles.certName}>{getMerchantDisplayName(m)}</Text>
        {m.shop_name_en && m.shop_name_zh && <Text style={styles.certNameEn}>{m.shop_name_en}</Text>}
        <View style={styles.certMeta}>
          {m.district && <View style={styles.certMetaChip}><Text style={styles.certMetaText}>{m.district}</Text></View>}
          {m.has_physical_store && <View style={[styles.certMetaChip, styles.storeChip]}><Text style={[styles.certMetaText, styles.storeChipText]}>{t('shops.physicalStore')}</Text></View>}
        </View>
        {m.shop_description && <Text style={styles.certDesc} numberOfLines={2}>{m.shop_description}</Text>}
        {m.payment_methods?.length > 0 && (
          <View style={styles.payRow}>
            {m.payment_methods.slice(0, 4).map(p => (
              <View key={p} style={styles.payChip}><Text style={styles.payChipText}>{p}</Text></View>
            ))}
          </View>
        )}
        <View style={styles.certActions}>
          <TouchableOpacity style={styles.certContactBtn} onPress={() => openContact(m)} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Image source={require('../../assets/icons/message.png')} style={{ width: 15, height: 15, tintColor: '#374151', resizeMode: 'contain' }} />
              <Text style={styles.certContactBtnText}>{t('shops.contact')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.certViewBtn} onPress={() => router.push(`/merchant/${m.id}` as any)} activeOpacity={0.8}>
            <Text style={styles.certViewBtnText}>{t('shops.viewListings')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderIndividualRow = (m: MerchantProfile) => (
    <TouchableOpacity key={m.id} style={styles.indRow} onPress={() => router.push(`/merchant/${m.id}` as any)} activeOpacity={0.85}>
      <View style={styles.indAvatar}>
        {m.avatar_url
          ? <Image source={{ uri: m.avatar_url }} style={styles.indAvatarImg} />
          : <View style={[styles.indAvatarImg, styles.indAvatarPlaceholder]}><Text style={styles.indAvatarLetter}>{m.display_name.charAt(0).toUpperCase()}</Text></View>
        }
        <View style={styles.indBadgeDot} />
      </View>
      <View style={styles.indBody}>
        <View style={styles.indTopRow}>
          <Text style={styles.indName}>{m.display_name}</Text>
          <View style={styles.indSellerBadge}><Text style={styles.indSellerBadgeText}>{t('shops.individualSeller')}</Text></View>
        </View>
        <View style={styles.indMeta}>
          {m.district && <Text style={styles.indMetaText}>{m.district}</Text>}
          {m.contact_type && <Text style={styles.indMetaText}>• {m.contact_type}</Text>}
        </View>
        {m.payment_methods?.length > 0 && (
          <Text style={styles.indPayText}>
            {m.payment_methods.slice(0, 3).join(' · ')}
          </Text>
        )}
      </View>
      <Text style={styles.indArrow}>›</Text>
    </TouchableOpacity>
  );

  const renderMerchantsTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={merchantsRefreshing} onRefresh={() => loadMerchants(true)} tintColor="#FF6900" />}
    >
      {/* Search + filter */}
      <View style={styles.mSearchWrap}>
        <View style={styles.searchBar}>
          <Image source={require('../../assets/icons/search.png')} style={styles.searchIcon} />
          <TextInput style={styles.searchInput} placeholder={t('shops.searchMerchants')} placeholderTextColor="#9CA3AF" value={mSearch} onChangeText={setMSearch} />
          {mSearch.length > 0 && <TouchableOpacity onPress={() => setMSearch('')}><Text style={styles.searchClear}>✕</Text></TouchableOpacity>}
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'certified_merchant', 'individual_seller'] as const).map(f => (
            <TouchableOpacity key={f} style={[styles.chip, mFilterType === f && styles.chipActive]} onPress={() => setMFilterType(f)}>
              <Text style={[styles.chipText, mFilterType === f && styles.chipTextActive]}>
                {f === 'all' ? t('shops.condAll') : f === 'certified_merchant' ? t('shops.certifiedMerchant') : t('shops.individualSeller')}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.chip, mFilterDistrict !== 'all' && styles.chipActive]} onPress={() => setShowDistrictModal(true)}>
            <Text style={[styles.chipText, mFilterDistrict !== 'all' && styles.chipTextActive]}>
              {mFilterDistrict === 'all' ? t('shops.district') : mFilterDistrict}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {merchantsLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          {[1,2,3,4,5].map(i => <SkeletonRow key={i} width="100%" height={80} />)}
        </View>
      ) : merchantsError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{t('shops.loadFailed')}</Text>
          <Text style={styles.errorSub}>{t('shops.checkNetworkRetry')}</Text>
          <TouchableOpacity style={styles.errorRetryBtn} onPress={() => loadMerchants()}>
            <Text style={styles.errorRetryText}>{t('shops.reload')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Seller CTA — already has profile */}
          {hasProfile && myProfile && (
            <View style={styles.sellerCTAWrap}>
              <View style={styles.sellerCTA}>
                <View style={styles.sellerCTALeft}>
                  <Text style={styles.sellerCTATitle}>
                    {myProfile.seller_type === 'certified_merchant' ? t('shops.certifiedMerchant') : t('shops.individualSeller')}
                  </Text>
                  <Text style={styles.sellerCTASub}>{t('shops.listNow')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.sellerCTABtn}
                  onPress={() => router.push('/listing-upload' as any)}
                >
                  <Text style={styles.sellerCTABtnText}>{t('shops.addListing')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Become a seller Banner — for non-sellers */}
          {!hasProfile && (
            <View style={styles.bannerWrap}>
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>{t('shops.sellOnPlatform')}</Text>
                <Text style={styles.bannerSub}>{t('shops.chooseSellerType')}</Text>
                <View style={styles.bannerBtnRow}>
                  <TouchableOpacity style={styles.bannerBtnIndividual} onPress={() => router.push('/seller-registration' as any)}>
                    <Text style={styles.bannerBtnIndividualText}>{t('shops.individualSeller')}</Text>
                    <Text style={styles.bannerBtnSubTextDark}>{t('shops.freeInstant')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bannerBtnMerchant} onPress={() => router.push('/merchant-registration' as any)}>
                    <Text style={styles.bannerBtnMerchantText}>{t('shops.certifiedMerchant')}</Text>
                    <Text style={styles.bannerBtnSubText}>{t('shops.needsReview')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Upgrade Banner — for individual sellers */}
          {hasProfile && myProfile?.seller_type === 'individual_seller' && (
            <View style={styles.bannerWrap}>
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>{t('shops.upgradeToCertified')}</Text>
                <Text style={styles.bannerSub}>{t('shops.upgradeSubtitle')}</Text>
                <View style={styles.bannerBtnRow}>
                  <TouchableOpacity style={[styles.bannerBtnMerchant, { flex: 0, paddingHorizontal: 28 }]} onPress={() => router.push('/merchant-registration' as any)}>
                    <Text style={styles.bannerBtnMerchantText}>{t('shops.certifiedMerchant')}</Text>
                    <Text style={styles.bannerBtnSubText}>{t('shops.needsReview')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}><Text style={styles.statNum}>{merchants.filter(m => m.seller_type === 'certified_merchant').length}</Text><Text style={styles.statLabel}>{t('shops.certMerchantCount')}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statNum}>{merchants.filter(m => m.seller_type === 'individual_seller').length}</Text><Text style={styles.statLabel}>{t('shops.individualSellerCount')}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statNum}>{merchants.length}</Text><Text style={styles.statLabel}>{t('shops.totalSellers')}</Text></View>
          </View>

          {/* Certified */}
          {certified.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('shops.certMerchantSection')}</Text>
                <Text style={styles.sectionCount}>{t('shops.certCount', { n: certified.length })}</Text>
              </View>
              {certified.map(renderCertifiedCard)}
            </View>
          )}

          {/* Individual */}
          {individuals.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('shops.individualSellerSection')}</Text>
                <Text style={styles.sectionCount}>{t('shops.individualCount', { n: individuals.length })}</Text>
              </View>
              <View style={styles.indList}>{individuals.map(renderIndividualRow)}</View>
            </View>
          )}

          {filteredMerchants.length === 0 && (
            <View style={styles.emptyWrap}>
              <Image source={require('../../assets/icons/search.png')} style={styles.emptyIconImg} />
              <Text style={styles.emptyTitle}>{t('shops.noMerchantsFound')}</Text>
              <TouchableOpacity onPress={() => { setMFilterType('all'); setMFilterDistrict('all'); setMSearch(''); }}>
                <Text style={styles.emptyReset}>{t('shops.clearAllFilters')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom CTA — only show when there ARE merchants */}
          {!hasProfile && filteredMerchants.length > 0 && (
            <View style={styles.ctaWrap}>
              <View style={styles.ctaCard}>
                <Text style={styles.ctaTitle}>{t('shops.wantToSell')}</Text>
                <Text style={styles.ctaSub}>{t('shops.freeSellerDesc')}</Text>
                <View style={styles.ctaBtnRow}>
                  <TouchableOpacity style={styles.ctaBtnPrimary} onPress={() => router.push('/seller-registration' as any)}>
                    <Text style={styles.ctaBtnPrimaryText}>{t('shops.registerIndividual')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ctaBtnSecondary} onPress={() => router.push('/merchant-registration' as any)}>
                    <Text style={styles.ctaBtnSecondaryText}>{t('shops.applyCertified')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETPLACE TAB
  // ═══════════════════════════════════════════════════════════════════════════

  // useCallback so FlatList sees a stable renderItem identity unless the
  // artofpkm image map actually changes — otherwise every parent re-render
  // (search keystroke, sort modal toggle, etc.) re-mounts every visible card.
  const renderListingCard = useCallback(
    ({ item }: { item: Listing }) => <ListingCard item={item} artofpkmMap={artofpkmMap} />,
    [artofpkmMap]
  );

  const renderMarketplaceTab = () => (
    <>
      {/* Search + sort */}
      <View style={styles.lSearchWrap}>
        <View style={styles.searchBar}>
          <Image source={require('../../assets/icons/search.png')} style={styles.searchIcon} />
          <TextInput style={styles.searchInput} placeholder={t('shops.searchCards')} placeholderTextColor="#9CA3AF" value={lSearch} onChangeText={setLSearch} />
          {lSearch.length > 0 && <TouchableOpacity onPress={() => setLSearch('')}><Text style={styles.searchClear}>✕</Text></TouchableOpacity>}
        </View>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortModal(true)}>
          <Text style={styles.sortBtnText}>⇅ {SORT_OPTIONS.find(s => s.key === sortKey)?.label}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Seller-type filter — keys prefixed `seller-` so they don't collide
              with the condition filter's `all` key in the same ScrollView. */}
          {([{ key: 'all', label: t('shops.allSellers') }, { key: 'certified_merchant', label: t('shops.certOnly') }, { key: 'individual_seller', label: t('shops.individualOnly') }] as const).map(f => (
            <TouchableOpacity key={`seller-${f.key}`} style={[styles.chip, lFilterType === f.key && styles.chipActive]} onPress={() => setLFilterType(f.key)}>
              <Text style={[styles.chipText, lFilterType === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.chipDivider} />
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={`cond-${c.key}`}
              style={[styles.chip, filterCond === c.key && styles.chipActive, c.key !== 'all' && filterCond === c.key && { backgroundColor: CONDITION_COLOR[c.key], borderColor: CONDITION_COLOR[c.key] }]}
              onPress={() => setFilterCond(c.key)}
            >
              <Text style={[styles.chipText, filterCond === c.key && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats */}
      {!listingsLoading && (
        <View style={styles.lStatsBar}>
          <Text style={styles.lStatsText}>{t('shops.totalItems', { n: listings.length, plus: hasMore ? '+' : '' })}</Text>
          {(filterCond !== 'all' || lFilterType !== 'all' || lSearch) && (
            <TouchableOpacity onPress={() => { setFilterCond('all'); setLFilterType('all'); setLSearch(''); }}>
              <Text style={styles.clearFilters}>{t('shops.clearFilter')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {listingsLoading ? (
        <SkeletonGrid count={6} cardWidth={CARD_W} cardHeight={240} />
      ) : listingsError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{t('shops.loadFailed')}</Text>
          <Text style={styles.errorSub}>{t('shops.checkNetworkRetry')}</Text>
          <TouchableOpacity style={styles.errorRetryBtn} onPress={() => resetAndLoadListings()}>
            <Text style={styles.errorRetryText}>{t('shops.reload')}</Text>
          </TouchableOpacity>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Image source={require('../../assets/icons/search.png')} style={styles.emptyIconImg} />
          <Text style={styles.emptyTitle}>{t('shops.noListingsFound')}</Text>
          <Text style={styles.emptySub}>{t('shops.adjustSearch')}</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={renderListingCard}
          extraData={artofpkmMap}
          numColumns={2}
          columnWrapperStyle={styles.lRow}
          contentContainerStyle={styles.lListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={listingsRefreshing} onRefresh={() => resetAndLoadListings(true)} tintColor="#FF6900" />}
          onEndReached={loadMoreListings}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <View style={styles.loadMoreWrap}><ActivityIndicator color="#FF6900" /></View>
              : !hasMore && listings.length > 0
                ? <Text style={styles.noMoreText}>{t('shops.allShown')}</Text>
                : null
          }
        />
      )}
    </>
  );

  // ── District Modal ─────────────────────────────────────────────────────────

  const renderDistrictModal = () => (
    <Modal visible={showDistrictModal} transparent animationType="slide" onRequestClose={() => setShowDistrictModal(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDistrictModal(false)}>
        <View style={styles.districtSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('shops.selectDistrict')}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* All districts option */}
            <TouchableOpacity key="all" style={[styles.districtRow, mFilterDistrict === 'all' && styles.districtRowActive]} onPress={() => { setMFilterDistrict('all'); setShowDistrictModal(false); }}>
              <Text style={[styles.districtRowText, mFilterDistrict === 'all' && styles.districtRowTextActive]}>
                {t('shops.allDistricts')}
              </Text>
              {mFilterDistrict === 'all' && <Text style={styles.districtCheck}>✓</Text>}
            </TouchableOpacity>
            {HK_DISTRICTS.slice(1).map(d => (
              <TouchableOpacity key={d} style={[styles.districtRow, mFilterDistrict === d && styles.districtRowActive]} onPress={() => { setMFilterDistrict(d); setShowDistrictModal(false); }}>
                <Text style={[styles.districtRowText, mFilterDistrict === d && styles.districtRowTextActive]}>
                  {DISTRICT_REGION[d] ? `${DISTRICT_REGION[d]} — ` : ''}{d}
                </Text>
                {mFilterDistrict === d && <Text style={styles.districtCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Sort Modal ─────────────────────────────────────────────────────────────

  const renderSortModal = () => (
    <Modal visible={showSortModal} transparent animationType="slide" onRequestClose={() => setShowSortModal(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
        <View style={styles.sortSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('shops.sortBy')}</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.key} style={[styles.sortRow, sortKey === opt.key && styles.sortRowActive]} onPress={() => { setSortKey(opt.key); setShowSortModal(false); }}>
              <Text style={[styles.sortRowText, sortKey === opt.key && styles.sortRowTextActive]}>{opt.label}</Text>
              {sortKey === opt.key && <Text style={styles.sortCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <Header />

      {/* Sub-tab bar */}
      <View style={styles.subTabBar}>
        <TouchableOpacity style={[styles.subTab, mainTab === 'marketplace' && styles.subTabActive]} onPress={() => setMainTab('marketplace')}>
          <View style={styles.subTabContent}>
            <Image source={require('../../assets/icons/service list.png')} style={[styles.subTabIcon, { tintColor: mainTab === 'marketplace' ? '#FF6900' : '#9CA3AF' }]} />
            <Text style={[styles.subTabText, mainTab === 'marketplace' && styles.subTabTextActive]}>{t('shops.marketplace')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, mainTab === 'merchants' && styles.subTabActive]} onPress={() => setMainTab('merchants')}>
          <View style={styles.subTabContent}>
            <Image source={require('../../assets/icons/shops.png')} style={[styles.subTabIcon, { tintColor: mainTab === 'merchants' ? '#FF6900' : '#9CA3AF' }]} />
            <Text style={[styles.subTabText, mainTab === 'merchants' && styles.subTabTextActive]}>{t('shops.merchants')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {mainTab === 'marketplace' ? renderMarketplaceTab() : renderMerchantsTab()}

      {renderDistrictModal()}
      {renderSortModal()}
    </SafeAreaView>
  );
}

// ── ListingCard component (extracted so useState hook works correctly) ─────────

function ListingCard({ item, artofpkmMap }: { item: Listing; artofpkmMap: Record<string, string> }) {
  const router = useRouter();
  const { t }  = useTranslation();
  const [imgFailed, setImgFailed] = useState(false);

  // Try photo_urls → card_image_url → artofpkm
  const urls = [
    ...(item.photo_urls ?? []),
    item.card_image_url,
    artofpkmMap[item.card_name],
  ].filter(Boolean) as string[];

  const imgUri = imgFailed ? (urls[1] ?? urls[2] ?? null) : (urls[0] ?? null);

  const sellerName = item.merchant_profiles?.shop_name_zh ?? item.merchant_profiles?.display_name ?? t('shops.unknownSeller');
  const condColor  = CONDITION_COLOR[item.condition] ?? '#9CA3AF';

  return (
    <TouchableOpacity
      style={styles.lCard}
      onPress={() => item.card_id
        ? router.push({ pathname: '/card/[id]' as any, params: { id: item.card_id } })
        : router.push(`/listing/${item.id}` as any)
      }
      activeOpacity={0.92}
    >
      <View style={styles.lCardImgBox}>
        {imgUri
          ? <Image source={{ uri: imgUri }} style={styles.lCardImg} resizeMode="contain"
              onError={() => setImgFailed(true)} />
          : <View style={styles.lCardImgPlaceholder}><Image source={require('../../assets/icons/portfolio.png')} style={{ width: 36, height: 36, tintColor: '#D1D5DB', resizeMode: 'contain' }} /></View>
        }
        <View style={[styles.lCondBadge, { backgroundColor: condColor }]}>
          <Text style={styles.lCondBadgeText}>{item.condition}</Text>
        </View>
        {item.seller_type === 'certified_merchant' && (
          <View style={styles.lCertBadge}>
            <Image source={require('../../assets/icons/Certification.png')} style={{ width: 14, height: 14, tintColor: '#fff' }} />
          </View>
        )}
      </View>
      <View style={styles.lCardInfo}>
        <Text style={styles.lCardName} numberOfLines={1}>{item.card_name}</Text>
        {item.set_name && <Text style={styles.lCardSet} numberOfLines={1}>{item.set_name}</Text>}
        {item.language?.length > 0 && <Text style={styles.lCardLang}>{item.language.join(' · ')}</Text>}
        <View style={styles.lPriceRow}>
          <Text style={styles.lPrice}>HK${item.price.toLocaleString()}</Text>
          {item.is_negotiable && <View style={styles.lNegoBadge}><Text style={styles.lNegoBadgeText}>{t('shops.negotiable')}</Text></View>}
        </View>
        <View style={styles.lSellerRow}>
          {item.merchant_profiles?.logo_url ?? item.merchant_profiles?.avatar_url
            ? <Image source={{ uri: (item.merchant_profiles.logo_url ?? item.merchant_profiles.avatar_url)! }} style={styles.lSellerAvatar} />
            : <View style={styles.lSellerAvatarPlaceholder}><Text style={styles.lSellerAvatarLetter}>{sellerName.charAt(0)}</Text></View>
          }
          <Text style={styles.lSellerName} numberOfLines={1}>{sellerName}</Text>
          {item.merchant_profiles?.district && <Text style={styles.lSellerDistrict}> · {item.merchant_profiles.district}</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.lContactBtn, { backgroundColor: condColor + '18' }]}
        onPress={() => router.push(`/listing/${item.id}` as any)}
        activeOpacity={0.8}
      >
        <Text style={[styles.lContactBtnText, { color: condColor === '#6B7280' ? '#374151' : condColor }]}>
          {t('shops.viewListings')}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },

  // Sub-tab bar
  subTabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  subTab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabActive: { borderBottomColor: '#FF6900' },
  subTabContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subTabIcon: { width: 16, height: 16, resizeMode: 'contain' },
  subTabText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  subTabTextActive: { color: '#FF6900', fontWeight: '800' },

  // Shared
  loadingWrap: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyIconImg: { width: 40, height: 40, tintColor: '#D1D5DB', resizeMode: 'contain' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
  emptyReset: { fontSize: 14, color: '#FF6900', fontWeight: '600', marginTop: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchIcon: { width: 16, height: 16, resizeMode: 'contain', tintColor: '#9CA3AF' },
  searchInput: { flex: 1, fontSize: 15, color: '#101828' },
  searchClear: { fontSize: 13, color: '#9CA3AF' },
  filterRow: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#fff' },
  chipDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  clearFilters: { fontSize: 13, color: '#FF6900', fontWeight: '600' },

  // Merchants tab
  mSearchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', gap: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },

  sellerCTAWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  sellerCTA: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, gap: 12, borderWidth: 1, borderColor: '#FFD4B2' },
  sellerCTALeft: { flex: 1, gap: 2 },
  sellerCTATitle: { fontSize: 14, fontWeight: '700', color: '#101828' },
  sellerCTASub: { fontSize: 12, color: '#6B7280' },
  sellerCTABtn: { backgroundColor: '#FF6900', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  sellerCTABtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  bannerWrap: { padding: 16 },
  banner: { backgroundColor: '#FF6900', borderRadius: 20, padding: 20, gap: 12 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  bannerBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bannerBtnIndividual: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', gap: 2 },
  bannerBtnIndividualText: { fontSize: 14, fontWeight: '700', color: '#FF6900' },
  bannerBtnMerchant: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  bannerBtnMerchantText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  bannerBtnSubText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  bannerBtnSubTextDark: { fontSize: 10, color: 'rgba(255,105,0,0.75)', fontWeight: '500' },

  statsRow: { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 8, paddingVertical: 16, paddingHorizontal: 24 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#101828' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },

  section: { backgroundColor: '#fff', marginBottom: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#101828' },
  sectionCount: { fontSize: 13, color: '#9CA3AF' },

  certCard: { backgroundColor: '#FAFAFA', borderRadius: 20, marginBottom: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB' },
  certBanner: { width: '100%', height: 120, position: 'relative' },
  certBannerImg: { width: '100%', height: '100%' },
  certBannerPlaceholder: { backgroundColor: '#FFF3E8', alignItems: 'center', justifyContent: 'center' },
  certBannerPlaceholderText: { fontSize: 40 },
  certLogoWrap: { position: 'absolute', bottom: -24, left: 16, borderRadius: 16, borderWidth: 3, borderColor: '#fff', overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  certLogoImg: { width: 56, height: 56 },
  certLogoPlaceholder: { backgroundColor: '#FF6900', alignItems: 'center', justifyContent: 'center' },
  certLogoPlaceholderText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  certBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  certBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  certInfo: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 16, gap: 6 },
  certName: { fontSize: 18, fontWeight: '800', color: '#101828' },
  certNameEn: { fontSize: 13, color: '#6B7280', marginTop: -4 },
  certMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  certMetaChip: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  storeChip: { backgroundColor: '#FFF3E8' },
  certMetaText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  storeChipText: { color: '#FF6900' },
  certDesc: { fontSize: 13, color: '#374151', lineHeight: 20 },
  payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  payChip: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  payChipText: { fontSize: 11, color: '#3B82F6', fontWeight: '500' },
  certActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  certContactBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  certContactBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  certViewBtn: { flex: 2, backgroundColor: '#FF6900', borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  certViewBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  indList: {},
  indRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', gap: 12 },
  indAvatar: { position: 'relative', width: 48, height: 48 },
  indAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  indAvatarPlaceholder: { backgroundColor: '#E5E7EB', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  indAvatarLetter: { fontSize: 20, fontWeight: '700', color: '#6B7280' },
  indBadgeDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
  indBody: { flex: 1, gap: 3 },
  indTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indName: { fontSize: 15, fontWeight: '700', color: '#101828' },
  indSellerBadge: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  indSellerBadgeText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  indMeta: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  indMetaText: { fontSize: 12, color: '#9CA3AF' },
  indPayText: { fontSize: 12, color: '#6B7280' },
  indArrow: { fontSize: 22, color: '#D1D5DB', fontWeight: '300' },

  ctaWrap: { padding: 16 },
  ctaCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 10, borderWidth: 0.5, borderColor: '#E5E7EB' },
  ctaTitle: { fontSize: 17, fontWeight: '800', color: '#101828' },
  ctaSub: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  ctaBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ctaBtnPrimary: { flex: 1, backgroundColor: '#FF6900', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  ctaBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  ctaBtnSecondary: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  ctaBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // Marketplace tab
  lSearchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', gap: 10, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  sortBtn: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  sortBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  lStatsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  lStatsText: { fontSize: 13, color: '#6B7280' },
  lStatsNum: { fontWeight: '700', color: '#101828' },
  lRow: { gap: 12, marginBottom: 12 },
  lListContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 100 },
  lCard: { width: CARD_W, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB', flexDirection: 'column', justifyContent: 'space-between' },
  lCardImgBox: { width: '100%', aspectRatio: 0.72, backgroundColor: '#F9FAFB', position: 'relative' },
  lCardImg: { width: '100%', height: '100%' },
  lCardImgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lCardImgEmoji: { fontSize: 40 },
  lCondBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  lCondBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  lCertBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#FF6900', borderRadius: 10, padding: 4 },
  lCertBadgeText: { fontSize: 12 },
  lCardInfo: { padding: 10, gap: 3, flex: 1 },
  lCardName: { fontSize: 13, fontWeight: '700', color: '#101828', lineHeight: 18 },
  lCardSet: { fontSize: 11, color: '#9CA3AF' },
  lCardLang: { fontSize: 11, color: '#6B7280' },
  lPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  lPrice: { fontSize: 15, fontWeight: '800', color: '#FF6900' },
  lNegoBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  lNegoBadgeText: { fontSize: 10, color: '#6B7280' },
  lSellerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  lSellerAvatar: { width: 18, height: 18, borderRadius: 9 },
  lSellerAvatarPlaceholder: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  lSellerAvatarLetter: { fontSize: 8, fontWeight: '700', color: '#6B7280' },
  lSellerName: { fontSize: 11, color: '#6B7280', flex: 1 },
  lSellerDistrict: { fontSize: 10, color: '#9CA3AF' },
  lContactBtn: { marginHorizontal: 10, marginBottom: 10, backgroundColor: '#FFF3E8', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  lContactBtnText: { fontSize: 12, fontWeight: '700', color: '#FF6900' },
  loadMoreWrap: { paddingVertical: 20, alignItems: 'center' },
  noMoreText: { textAlign: 'center', fontSize: 13, color: '#9CA3AF', paddingVertical: 20 },

  // Error state
  errorWrap: { paddingVertical: 60, alignItems: 'center', gap: 8, paddingHorizontal: 40 },
  errorEmoji: { fontSize: 44 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  errorSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  errorRetryBtn: { marginTop: 8, backgroundColor: '#FF6900', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  errorRetryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  districtSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 40, maxHeight: '75%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#101828', paddingVertical: 14, textAlign: 'center' },
  districtRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  districtRowActive: { backgroundColor: '#FFF3E8', marginHorizontal: -16, paddingHorizontal: 16 },
  districtRowText: { fontSize: 15, color: '#374151' },
  districtRowTextActive: { color: '#FF6900', fontWeight: '700' },
  districtCheck: { fontSize: 16, color: '#FF6900', fontWeight: '700' },
  sortSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 40 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  sortRowActive: { backgroundColor: '#FFF3E8', marginHorizontal: -16, paddingHorizontal: 16 },
  sortRowText: { fontSize: 16, color: '#374151' },
  sortRowTextActive: { color: '#FF6900', fontWeight: '700' },
  sortCheck: { fontSize: 18, color: '#FF6900', fontWeight: '700' },
});
