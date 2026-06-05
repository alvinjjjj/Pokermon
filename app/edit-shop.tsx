import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { PSAGradeBadge, normalizeGrade } from '../components/PSAGradeBadge';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

// Buy-order option lists. Kept local since these are merchant-facing controls
// that map 1:1 to the merchant_buy_orders.conditions / .languages text[] columns.
const CONDITION_OPTIONS = ['Raw', 'PSA 9', 'PSA 10', 'BGS 9.5', 'BGS 10'] as const;
const LANGUAGE_OPTIONS  = ['EN', 'JP', 'KR', 'CN'] as const;

type BuyOrder = {
  id:             string;
  merchant_id:    string;
  card_id:        string;
  card_name:      string;
  set_name:       string | null;
  buy_price:      number;
  conditions:     string[];
  languages:      string[];
  daily_limit:    number;
  daily_filled:   number;
  last_filled_at: string | null;
  expires_at:     string;
  reset_at:       string;
  status:         'active' | 'paused' | 'expired' | 'cancelled';
  notes:          string | null;
  created_at:     string;
  updated_at:     string;
};

const HK_DISTRICTS = [
  '中西區', '灣仔', '東區', '南區',
  '油尖旺', '深水埗', '九龍城', '黃大仙', '觀塘',
  '荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島',
];

// ── Upload helper (same arrayBuffer pattern as merchant-registration.tsx) ─────
async function uploadAsset(uri: string, path: string): Promise<string | null> {
  try {
    const resp = await fetch(uri);
    const arrayBuffer = await resp.arrayBuffer();
    const uriExt   = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const ext      = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uriExt) ? uriExt : 'jpg';
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const fullPath = `${path}.${ext}?v=${Date.now()}`;  // cache-bust on update
    const cleanPath = `${path}.${ext}`;
    const { error } = await supabase.storage
      .from('merchant-assets')
      .upload(cleanPath, arrayBuffer, { upsert: true, contentType: mimeType });
    if (error) {
      if (__DEV__) console.error('uploadAsset error:', error.message);
      return null;
    }
    // Add cache-buster to URL so existing <Image> components reload
    const { data } = supabase.storage.from('merchant-assets').getPublicUrl(cleanPath);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (e) {
    if (__DEV__) console.error('uploadAsset exception:', e);
    return null;
  }
}

type MerchantData = {
  id:                 string;
  seller_type:        'individual_seller' | 'certified_merchant';
  display_name:       string | null;
  shop_name_zh:       string | null;
  shop_name_en:       string | null;
  district:           string | null;
  shop_description:   string | null;
  logo_url:           string | null;
  banner_url:         string | null;
  has_physical_store: boolean;
  address:            string | null;
  business_hours:     string | null;
  whatsapp:           string | null;
  website:            string | null;
  instagram:          string | null;
  payment_methods:    string[] | null;
};

export default function EditShop() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t }  = useTranslation();

  const PAYMENT_OPTIONS = ['FPS', 'PayMe', 'Alipay HK', 'WeChat Pay', t('merchantReg.cash'), t('merchantReg.bankTransfer')];

  const [merchantId, setMerchantId]   = useState<string | null>(null);
  const [sellerType, setSellerType]   = useState<'individual_seller' | 'certified_merchant'>('individual_seller');
  const [shopNameZh, setShopNameZh]   = useState('');
  const [shopNameEn, setShopNameEn]   = useState('');
  const [district, setDistrict]       = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri]         = useState<string | null>(null);
  const [bannerUri, setBannerUri]     = useState<string | null>(null);
  const [hasPhysicalStore, setHasPhysicalStore] = useState(false);
  const [address, setAddress]         = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [whatsapp, setWhatsapp]       = useState('');
  const [website, setWebsite]         = useState('');
  const [instagram, setInstagram]     = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // ── Tab state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<'shop' | 'buy'>('shop');

  // ── Buy-orders state ─────────────────────────────────────────────────
  const [buyOrders, setBuyOrders]     = useState<BuyOrder[]>([]);
  const [buyLoading, setBuyLoading]   = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  // Form fields for the add/edit modal
  const [formCardId,      setFormCardId]      = useState('');
  const [formCardName,    setFormCardName]    = useState('');
  const [formSetName,     setFormSetName]     = useState('');
  const [formPrice,       setFormPrice]       = useState('');
  const [formConditions,  setFormConditions]  = useState<string[]>(['PSA 10']);
  const [formLanguages,   setFormLanguages]   = useState<string[]>(['EN']);
  const [formDailyLimit,  setFormDailyLimit]  = useState('1');
  const [formNotes,       setFormNotes]       = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // ── Load existing data ────────────────────────────────────────────────
  useEffect(() => { load(); }, []);

  // Lazy-load buy orders when user first opens the Buy Orders tab. Keeps
  // initial render light for merchants who never touch this flow.
  useEffect(() => {
    if (activeTab === 'buy' && buyOrders.length === 0 && !buyLoading) {
      loadBuyOrders();
    }
    // We intentionally do NOT re-trigger on buyOrders.length change after
    // first load — refresh is handled explicitly after CRUD operations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadBuyOrders = async () => {
    setBuyLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setBuyLoading(false); return; }
      // Include all non-cancelled statuses so paused/expired surface in the
      // list — RLS public-read filter is for OTHER users, not the owner.
      const { data, error } = await supabase
        .from('merchant_buy_orders')
        .select('*')
        .eq('merchant_id', user.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) {
        if (__DEV__) console.error('loadBuyOrders error:', error.message);
        setBuyOrders([]);
      } else {
        setBuyOrders((data ?? []) as BuyOrder[]);
      }
    } finally {
      setBuyLoading(false);
    }
  };

  const activeOrderCount = useMemo(
    () => buyOrders.filter(o => o.status === 'active').length,
    [buyOrders]
  );

  const resetForm = () => {
    setEditingOrderId(null);
    setFormCardId('');
    setFormCardName('');
    setFormSetName('');
    setFormPrice('');
    setFormConditions(['PSA 10']);
    setFormLanguages(['EN']);
    setFormDailyLimit('1');
    setFormNotes('');
  };

  const openAddModal = () => {
    if (activeOrderCount >= 10) {
      Alert.alert(t('editShop.buyOrders.maxReached'));
      return;
    }
    resetForm();
    setShowBuyModal(true);
  };

  const openEditModal = (order: BuyOrder) => {
    setEditingOrderId(order.id);
    setFormCardId(order.card_id);
    setFormCardName(order.card_name);
    setFormSetName(order.set_name ?? '');
    setFormPrice(String(order.buy_price));
    setFormConditions(order.conditions);
    setFormLanguages(order.languages);
    setFormDailyLimit(String(order.daily_limit));
    setFormNotes(order.notes ?? '');
    setShowBuyModal(true);
  };

  const toggleFormCondition = (c: string) =>
    setFormConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleFormLanguage = (l: string) =>
    setFormLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  const handleSubmitOrder = async () => {
    if (submittingOrder) return;
    const price = parseFloat(formPrice);
    const dailyLimit = parseInt(formDailyLimit, 10);
    if (!formCardName.trim() || !(price > 0) || !(dailyLimit >= 1) || formConditions.length === 0 || formLanguages.length === 0) {
      Alert.alert(t('editShop.buyOrders.formIncomplete'));
      return;
    }
    setSubmittingOrder(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not logged in');
      const payload = {
        merchant_id: user.id,
        card_id:     formCardId.trim() || formCardName.trim(),
        card_name:   formCardName.trim(),
        set_name:    formSetName.trim() || null,
        buy_price:   price,
        conditions:  formConditions,
        languages:   formLanguages,
        daily_limit: dailyLimit,
        notes:       formNotes.trim() || null,
      };
      const { error } = editingOrderId
        ? await supabase.from('merchant_buy_orders').update(payload).eq('id', editingOrderId)
        : await supabase.from('merchant_buy_orders').insert(payload);
      if (error) {
        // Map the DB trigger message to a user-friendly toast.
        if (error.message.includes('10 active buy orders')) {
          Alert.alert(t('editShop.buyOrders.maxReached'));
        } else {
          Alert.alert(t('editShop.saveFailed'), error.message);
        }
        return;
      }
      setShowBuyModal(false);
      resetForm();
      await loadBuyOrders();
      Alert.alert(t('editShop.buyOrders.savedToast'));
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handlePauseOrder = async (order: BuyOrder) => {
    const nextStatus = order.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('merchant_buy_orders')
      .update({ status: nextStatus })
      .eq('id', order.id);
    if (error) {
      Alert.alert(t('editShop.saveFailed'), error.message);
      return;
    }
    await loadBuyOrders();
    Alert.alert(nextStatus === 'paused' ? t('editShop.buyOrders.pausedToast') : t('editShop.buyOrders.resumedToast'));
  };

  const handleDeleteOrder = (order: BuyOrder) => {
    Alert.alert(
      t('editShop.buyOrders.deleteConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editShop.buyOrders.deleteBtn'),
          style: 'destructive',
          onPress: async () => {
            // Soft-delete via status = 'cancelled' preserves audit trail and
            // is invisible to public-read RLS (filters status = 'active').
            const { error } = await supabase
              .from('merchant_buy_orders')
              .update({ status: 'cancelled' })
              .eq('id', order.id);
            if (error) { Alert.alert(t('editShop.saveFailed'), error.message); return; }
            await loadBuyOrders();
            Alert.alert(t('editShop.buyOrders.deletedToast'));
          },
        },
      ],
    );
  };

  // ── Expiry helper ────────────────────────────────────────────────────
  // Returns hours remaining (rounded, min 0). Used by the per-order chip
  // showing "X 小時到期". Sub-hour values clamp to 0 so we don't show
  // negative remainders for orders that already expired.
  const hoursUntil = (iso: string): number => {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.round(ms / (60 * 60 * 1000)));
  };

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); router.back(); return; }

    const { data, error } = await supabase
      .from('merchant_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      setLoading(false);
      Alert.alert(t('editShop.notMerchant'), t('editShop.notMerchantMsg'));
      router.back();
      return;
    }

    const m = data as MerchantData;
    setMerchantId(m.id);
    setSellerType(m.seller_type);
    setShopNameZh(m.shop_name_zh ?? '');
    setShopNameEn(m.shop_name_en ?? '');
    setDistrict(m.district ?? '');
    setDescription(m.shop_description ?? '');
    setLogoUri(m.logo_url);          // existing remote URL, will be replaced if user picks new
    setBannerUri(m.banner_url);
    setHasPhysicalStore(m.has_physical_store);
    setAddress(m.address ?? '');
    setBusinessHours(m.business_hours ?? '');
    setWhatsapp(m.whatsapp ?? '');
    setWebsite(m.website ?? '');
    setInstagram(m.instagram ?? '');
    setPaymentMethods(m.payment_methods ?? []);

    setLoading(false);
  };

  // ── Image pickers ─────────────────────────────────────────────────────
  const pickImage = async (setter: (uri: string) => void, aspect: [number, number]) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const togglePayment = (m: string) =>
    setPaymentMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    if (!shopNameZh.trim() && !shopNameEn.trim()) {
      Alert.alert(t('merchantReg.alertFillName'));
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not logged in');

      // Upload new images only if user picked a local file (file:// URI).
      // Existing remote URLs (https://) are kept as-is.
      const needUploadLogo   = logoUri   && !logoUri.startsWith('http');
      const needUploadBanner = bannerUri && !bannerUri.startsWith('http');

      const [newLogoUrl, newBannerUrl] = await Promise.all([
        needUploadLogo   ? uploadAsset(logoUri!,   `logos/${user.id}`)   : Promise.resolve(null),
        needUploadBanner ? uploadAsset(bannerUri!, `banners/${user.id}`) : Promise.resolve(null),
      ]);

      const updates: Record<string, any> = {
        display_name:       shopNameZh.trim() || shopNameEn.trim(),
        shop_name_zh:       shopNameZh.trim() || null,
        shop_name_en:       shopNameEn.trim() || null,
        district:           district || null,
        shop_description:   description.trim() || null,
        has_physical_store: hasPhysicalStore,
        address:            address.trim() || null,
        business_hours:     businessHours.trim() || null,
        whatsapp:           whatsapp.trim() || null,
        website:            website.trim() || null,
        instagram:          instagram.trim() || null,
        payment_methods:    paymentMethods,
      };
      // Only overwrite logo / banner if a new one was uploaded.
      // Sending `null` for an unchanged remote URL would wipe the existing image.
      if (newLogoUrl)   updates.logo_url   = newLogoUrl;
      if (newBannerUrl) updates.banner_url = newBannerUrl;

      const { error } = await supabase
        .from('merchant_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      Alert.alert(t('editShop.savedTitle'), t('editShop.savedMsg'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t('editShop.saveFailed'), err.message ?? t('common.tryAgainLater'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Self-downgrade certified merchant → individual seller. Two-step confirm
   * so the user can't tap it by accident — losing certified status means
   * losing the green badge + customer trust.
   */
  const handleDowngrade = () => {
    Alert.alert(
      t('editShop.downgradeTitle'),
      t('editShop.downgradeMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editShop.downgradeConfirm'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase.rpc('self_downgrade_merchant');
              if (error) throw error;
              Alert.alert(t('editShop.downgradeDoneTitle'), t('editShop.downgradeDoneMsg'), [
                { text: t('common.ok'), onPress: () => router.replace('/(tabs)/settings') },
              ]);
            } catch (e: any) {
              Alert.alert(t('editShop.saveFailed'), e?.message ?? t('common.tryAgainLater'));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Loader size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{t('editShop.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab bar — only certified merchants see the Buy Orders tab.
            Individual sellers fall through to the original single-page form. */}
        {sellerType === 'certified_merchant' && (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'shop' && styles.tabBtnActive]}
              onPress={() => setActiveTab('shop')}
            >
              <Text style={[styles.tabText, activeTab === 'shop' && styles.tabTextActive]}>
                {t('editShop.tabShop')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'buy' && styles.tabBtnActive]}
              onPress={() => setActiveTab('buy')}
            >
              <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActive]}>
                {t('editShop.buyOrders.tabTitle')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'shop' && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Banner */}
          <Text style={styles.label}>{t('merchantReg.bannerTitle')}</Text>
          <TouchableOpacity style={styles.bannerWrap} onPress={() => pickImage(setBannerUri, [16, 9])}>
            {bannerUri
              ? <Image source={{ uri: bannerUri }} style={styles.bannerImg} resizeMode="cover" />
              : <View style={styles.bannerPlaceholder}>
                  <Text style={styles.bannerPlaceholderText}>{t('merchantReg.bannerPlaceholder')}</Text>
                </View>}
          </TouchableOpacity>

          {/* Logo */}
          <Text style={styles.label}>{t('merchantReg.logoTitle')}</Text>
          <TouchableOpacity style={styles.logoWrap} onPress={() => pickImage(setLogoUri, [1, 1])}>
            {logoUri
              ? <Image source={{ uri: logoUri }} style={styles.logoImg} resizeMode="cover" />
              : <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>+</Text>
                </View>}
          </TouchableOpacity>

          {/* Shop name */}
          <Text style={styles.label}>{t('merchantReg.shopNameZhLabel')}</Text>
          <TextInput
            style={styles.input}
            value={shopNameZh}
            onChangeText={setShopNameZh}
            placeholder={t('merchantReg.shopNameZhPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
          />

          <Text style={styles.label}>{t('merchantReg.shopNameEnLabel')}</Text>
          <TextInput
            style={styles.input}
            value={shopNameEn}
            onChangeText={setShopNameEn}
            placeholder={t('merchantReg.shopNameEnPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
          />

          {/* District */}
          <Text style={styles.label}>{t('merchantReg.districtLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {HK_DISTRICTS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, district === d && styles.chipActive]}
                onPress={() => setDistrict(prev => prev === d ? '' : d)}
              >
                <Text style={[styles.chipText, district === d && styles.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Description */}
          <Text style={styles.label}>{t('merchantReg.descLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('merchantReg.descPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={4}
          />

          {/* Physical store toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.label}>{t('merchantReg.physicalStoreLabel')}</Text>
            <TouchableOpacity
              style={[styles.toggle, hasPhysicalStore && styles.toggleActive]}
              onPress={() => setHasPhysicalStore(prev => !prev)}
            >
              <View style={[styles.toggleKnob, hasPhysicalStore && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>

          {hasPhysicalStore && (
            <>
              <Text style={styles.label}>{t('merchantReg.addressLabel')}</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder={t('merchantReg.addressPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
              />

              <Text style={styles.label}>{t('merchantReg.businessHoursLabel')}</Text>
              <TextInput
                style={styles.input}
                value={businessHours}
                onChangeText={setBusinessHours}
                placeholder={t('merchantReg.businessHoursPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
              />
            </>
          )}

          {/* Contact */}
          <Text style={styles.label}>{t('merchantReg.whatsappLabel')}</Text>
          <TextInput
            style={styles.input}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder={t('merchantReg.whatsappPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>{t('merchantReg.websiteLabel')}</Text>
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder={t('merchantReg.websitePlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('merchantReg.instagramLabel')}</Text>
          <TextInput
            style={styles.input}
            value={instagram}
            onChangeText={setInstagram}
            placeholder={t('merchantReg.instagramPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
          />

          {/* Payment methods */}
          <Text style={styles.label}>{t('merchantReg.paymentLabel')}</Text>
          <View style={styles.paymentGrid}>
            {PAYMENT_OPTIONS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.paymentChip, paymentMethods.includes(m) && styles.paymentChipActive]}
                onPress={() => togglePayment(m)}
              >
                <Text style={[styles.paymentText, paymentMethods.includes(m) && styles.paymentTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              // '#fff' kept raw — always-white on brand orange
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{t('editShop.saveBtn')}</Text>}
          </TouchableOpacity>

          {/* Downgrade — visually subordinate (text-only button in red).
              Destructive action with double-confirm in handleDowngrade. */}
          <TouchableOpacity
            style={styles.downgradeBtn}
            onPress={handleDowngrade}
            disabled={saving}
          >
            <Text style={styles.downgradeText}>{t('editShop.downgradeBtn')}</Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />

        </ScrollView>
        )}

        {activeTab === 'buy' && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Active count header + Add button */}
          <View style={styles.buyHeaderRow}>
            <Text style={styles.buyHeaderCount}>
              {t('editShop.buyOrders.activeCount', { count: activeOrderCount })}
            </Text>
            <TouchableOpacity
              style={[styles.buyAddBtn, activeOrderCount >= 10 && styles.buyAddBtnDisabled]}
              onPress={openAddModal}
              disabled={activeOrderCount >= 10}
            >
              <Text style={styles.buyAddBtnText}>{t('editShop.buyOrders.addButton')}</Text>
            </TouchableOpacity>
          </View>

          {buyLoading ? (
            <View style={[styles.center, { paddingVertical: 40 }]}><Loader size="large" /></View>
          ) : buyOrders.length === 0 ? (
            <Text style={styles.buyEmpty}>{t('editShop.buyOrders.emptyState')}</Text>
          ) : (
            buyOrders.map(order => {
              const conditionLooksGraded = order.conditions.some(c =>
                /^(raw|psa\s*9|psa\s*10)$/i.test(c.trim())
              );
              return (
                <View key={order.id} style={styles.buyCard}>
                  {/* Status pill (paused = subtle highlight) */}
                  {order.status !== 'active' && (
                    <View style={styles.buyStatusPill}>
                      <Text style={styles.buyStatusText}>{order.status.toUpperCase()}</Text>
                    </View>
                  )}

                  {/* Card identity */}
                  <Text style={styles.buyCardName} numberOfLines={1}>{order.card_name}</Text>
                  {order.set_name ? (
                    <Text style={styles.buyCardSet} numberOfLines={1}>{order.set_name}</Text>
                  ) : null}

                  {/* Price */}
                  <Text style={styles.buyPrice}>
                    {t('editShop.buyOrders.priceFormat', { price: order.buy_price.toLocaleString() })}
                  </Text>

                  {/* Conditions + Languages chips */}
                  <View style={styles.buyChipRow}>
                    {order.conditions.map(c => {
                      const norm = normalizeGrade(c);
                      // Only graded conditions render via PSAGradeBadge (§A.3).
                      // Anything else (e.g. 'BGS 9.5') falls back to plain chip.
                      if (conditionLooksGraded && (norm === '10' || norm === '9' || norm === 'raw')) {
                        return (
                          <View key={c} style={styles.buyChipWrap}>
                            <PSAGradeBadge grade={norm} size="sm" />
                          </View>
                        );
                      }
                      return (
                        <View key={c} style={styles.buyChip}>
                          <Text style={styles.buyChipText}>{c}</Text>
                        </View>
                      );
                    })}
                    {order.languages.map(l => (
                      <View key={l} style={styles.buyChipLang}>
                        <Text style={styles.buyChipLangText}>{l}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Daily counter + expiry */}
                  <View style={styles.buyMetaRow}>
                    <Text style={styles.buyMetaText}>
                      {t('editShop.buyOrders.dailyProgress', {
                        filled: order.daily_filled,
                        limit:  order.daily_limit,
                      })}
                    </Text>
                    <Text style={styles.buyMetaText}>
                      {t('editShop.buyOrders.remainingHours', { hours: hoursUntil(order.expires_at) })}
                    </Text>
                  </View>
                  {/* Daily-fill progress bar */}
                  <View style={styles.buyProgressTrack}>
                    <View
                      style={[
                        styles.buyProgressFill,
                        { width: `${Math.min(100, (order.daily_filled / order.daily_limit) * 100)}%` },
                      ]}
                    />
                  </View>

                  {/* Notes (optional) */}
                  {order.notes ? (
                    <Text style={styles.buyNotes} numberOfLines={2}>{order.notes}</Text>
                  ) : null}

                  {/* Actions */}
                  <View style={styles.buyActionRow}>
                    <TouchableOpacity style={styles.buyActionBtn} onPress={() => openEditModal(order)}>
                      <Text style={styles.buyActionText}>{t('editShop.buyOrders.editBtn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.buyActionBtn} onPress={() => handlePauseOrder(order)}>
                      <Text style={styles.buyActionText}>
                        {order.status === 'active'
                          ? t('editShop.buyOrders.pauseBtn')
                          : t('editShop.buyOrders.resumeBtn')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.buyActionBtn} onPress={() => handleDeleteOrder(order)}>
                      <Text style={[styles.buyActionText, styles.buyActionDelete]}>
                        {t('editShop.buyOrders.deleteBtn')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
        )}

        {/* Add / Edit modal */}
        <Modal
          visible={showBuyModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBuyModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingOrderId
                  ? t('editShop.buyOrders.formTitleEdit')
                  : t('editShop.buyOrders.formTitleNew')}
              </Text>

              <ScrollView
                style={styles.modalScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.label}>{t('editShop.buyOrders.cardNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={formCardName}
                  onChangeText={setFormCardName}
                  placeholderTextColor={colors.text.tertiary}
                />

                <Text style={styles.label}>{t('editShop.buyOrders.cardSetLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={formSetName}
                  onChangeText={setFormSetName}
                  placeholderTextColor={colors.text.tertiary}
                />

                <Text style={styles.label}>{t('editShop.buyOrders.cardIdLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={formCardId}
                  onChangeText={setFormCardId}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>{t('editShop.buyOrders.priceLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={formPrice}
                  onChangeText={setFormPrice}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>{t('editShop.buyOrders.conditionsLabel')}</Text>
                <View style={styles.paymentGrid}>
                  {CONDITION_OPTIONS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.paymentChip, formConditions.includes(c) && styles.paymentChipActive]}
                      onPress={() => toggleFormCondition(c)}
                    >
                      <Text style={[styles.paymentText, formConditions.includes(c) && styles.paymentTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>{t('editShop.buyOrders.languagesLabel')}</Text>
                <View style={styles.paymentGrid}>
                  {LANGUAGE_OPTIONS.map(l => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.paymentChip, formLanguages.includes(l) && styles.paymentChipActive]}
                      onPress={() => toggleFormLanguage(l)}
                    >
                      <Text style={[styles.paymentText, formLanguages.includes(l) && styles.paymentTextActive]}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>{t('editShop.buyOrders.dailyLimitLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={formDailyLimit}
                  onChangeText={setFormDailyLimit}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>{t('editShop.buyOrders.notesLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  numberOfLines={3}
                />
              </ScrollView>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => { setShowBuyModal(false); resetForm(); }}
                  disabled={submittingOrder}
                >
                  <Text style={styles.modalBtnCancelText}>{t('editShop.buyOrders.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnConfirm, submittingOrder && styles.saveBtnDisabled]}
                  onPress={handleSubmitOrder}
                  disabled={submittingOrder}
                >
                  {submittingOrder
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.modalBtnConfirmText}>{t('editShop.buyOrders.confirm')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.surface.card },
    center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: colors.surface.section,
    },
    navBack:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.brand.orange, lineHeight: 32 },
    navTitle:    { fontSize: 16, fontWeight: '700', color: colors.text.primary },

    content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },

    label: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 8, marginTop: 16 },

    bannerWrap: {
      width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden',
      backgroundColor: colors.surface.section,
      borderWidth: 1, borderColor: colors.border.default,
    },
    bannerImg:           { width: '100%', height: '100%' },
    bannerPlaceholder:   { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    bannerPlaceholderText: { fontSize: 13, color: colors.text.tertiary },

    logoWrap: {
      width: 96, height: 96, borderRadius: 16, overflow: 'hidden',
      backgroundColor: colors.surface.section,
      borderWidth: 1, borderColor: colors.border.default,
    },
    logoImg:             { width: '100%', height: '100%' },
    logoPlaceholder:     { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    logoPlaceholderText: { fontSize: 36, color: colors.text.tertiary, fontWeight: '300' },

    input: {
      backgroundColor: colors.surface.section,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border.default,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.text.primary,
    },
    textarea: { minHeight: 88, textAlignVertical: 'top' },

    chipRow:    { gap: 8, paddingRight: 24 },
    chip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface.section },
    chipActive: { backgroundColor: colors.brand.orange },
    chipText:       { fontSize: 13, color: colors.text.primary, fontWeight: '500' },
    // '#fff' kept raw — always-white on brand orange
    chipTextActive: { color: '#fff', fontWeight: '700' },

    toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
    toggle:       { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border.default, padding: 3 },
    toggleActive: { backgroundColor: colors.brand.orange },
    // '#fff' kept raw — always-white knob
    toggleKnob:        { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
    toggleKnobActive:  { transform: [{ translateX: 20 }] },

    paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    paymentChip:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface.section },
    paymentChipActive: { backgroundColor: colors.brand.orange },
    paymentText:       { fontSize: 13, color: colors.text.primary, fontWeight: '500' },
    // '#fff' kept raw — always-white on brand orange
    paymentTextActive: { color: '#fff', fontWeight: '700' },

    saveBtn: {
      marginTop: 32,
      backgroundColor: colors.brand.orange, borderRadius: 50,
      paddingVertical: 16, alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    // '#fff' kept raw — always-white on brand orange
    saveBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff' },
    // Visually subordinate, destructive — text-only red link.
    downgradeBtn:    { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    // '#E7000B' kept raw — destructive red
    downgradeText:   { fontSize: 14, color: '#E7000B', fontWeight: '600' },

    // ── Tab bar (Phase B.2) ────────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.section,
    },
    tabBtn: {
      flex: 1, paddingVertical: 12, alignItems: 'center',
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabBtnActive: { borderBottomColor: colors.brand.orange },
    tabText:       { fontSize: 14, color: colors.text.secondary, fontWeight: '600' },
    tabTextActive: { color: colors.brand.orange, fontWeight: '700' },

    // ── Buy orders list ────────────────────────────────────────────────
    buyHeaderRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16,
    },
    buyHeaderCount: { fontSize: 13, color: colors.text.secondary, fontWeight: '600' },
    buyAddBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
      backgroundColor: colors.brand.orange,
    },
    buyAddBtnDisabled: { opacity: 0.4 },
    // '#fff' kept raw — always-white on brand orange
    buyAddBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    buyEmpty: {
      fontSize: 14, color: colors.text.tertiary, textAlign: 'center',
      paddingVertical: 32,
    },

    buyCard: {
      backgroundColor: colors.surface.section,
      borderRadius: 12, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border.default,
    },
    buyStatusPill: {
      alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 4, marginBottom: 6,
      borderWidth: 1, borderColor: colors.text.mute,
    },
    buyStatusText: {
      fontSize: 10, fontWeight: '700', color: colors.text.tertiary, letterSpacing: 0.5,
    },
    buyCardName: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    buyCardSet:  { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
    buyPrice:    { fontSize: 18, fontWeight: '800', color: colors.brand.orange, marginTop: 8 },

    buyChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    buyChipWrap: {},   // wrapper for PSAGradeBadge — keeps gap layout consistent
    buyChip: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
      borderWidth: 1, borderColor: colors.text.primary,
    },
    buyChipText: { fontSize: 10, fontWeight: '600', color: colors.text.primary, textTransform: 'uppercase' },
    buyChipLang: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
      borderWidth: 1, borderColor: colors.text.mute,
    },
    buyChipLangText: { fontSize: 10, fontWeight: '600', color: colors.text.secondary, textTransform: 'uppercase' },

    buyMetaRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      marginTop: 10,
    },
    buyMetaText: { fontSize: 11, color: colors.text.tertiary, fontWeight: '500' },
    buyProgressTrack: {
      height: 4, borderRadius: 2, backgroundColor: colors.border.default,
      marginTop: 6, overflow: 'hidden',
    },
    buyProgressFill: { height: '100%', backgroundColor: colors.brand.orange },

    buyNotes: { fontSize: 12, color: colors.text.secondary, marginTop: 8, fontStyle: 'italic' },

    buyActionRow: { flexDirection: 'row', marginTop: 12, gap: 16 },
    buyActionBtn: { paddingVertical: 4 },
    buyActionText: { fontSize: 13, color: colors.text.secondary, fontWeight: '600' },
    // '#E7000B' kept raw — destructive red, same hue as downgradeText
    buyActionDelete: { color: '#E7000B' },

    // ── Add/Edit modal ────────────────────────────────────────────────
    // 'rgba(0,0,0,0.5)' kept raw — universal modal scrim, theme-independent
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
      maxHeight: '85%',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 8 },
    modalScroll: { maxHeight: '80%' },
    modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    modalBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 50, alignItems: 'center',
    },
    modalBtnCancel:     { backgroundColor: colors.surface.section },
    modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    modalBtnConfirm:    { backgroundColor: colors.brand.orange },
    // '#fff' kept raw — always-white on brand orange
    modalBtnConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
