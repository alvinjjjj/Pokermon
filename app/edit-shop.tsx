import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

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

  // ── Load existing data ────────────────────────────────────────────────
  useEffect(() => { load(); }, []);

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
  });
}
