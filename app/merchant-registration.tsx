import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

// ── Constants ────────────────────────────────────────────────────────────────

// PAYMENT_OPTIONS moved inside component (uses translation hook)

const HK_DISTRICTS = [
  '中西區', '灣仔', '東區', '南區',
  '油尖旺', '深水埗', '九龍城', '黃大仙', '觀塘',
  '荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島',
];

type Step = 1 | 2 | 3;

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadAsset(uri: string, path: string): Promise<string | null> {
  try {
    // IMPORTANT: in React Native, `fetch(uri).then(r => r.blob())` often produces
    // a 0-byte Blob even when no error is thrown (because RN's Blob impl on iOS/Android
    // doesn't fully implement the spec for file:// URIs). Using arrayBuffer() works
    // reliably — Supabase storage upload accepts ArrayBuffer directly.
    const resp = await fetch(uri);
    const arrayBuffer = await resp.arrayBuffer();

    // Detect content type from URI extension (more reliable than blob.type on RN)
    const uriExt   = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const ext      = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uriExt) ? uriExt : 'jpg';
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const fullPath = `${path}.${ext}`;

    const { error } = await supabase.storage
      .from('merchant-assets')
      .upload(fullPath, arrayBuffer, { upsert: true, contentType: mimeType });
    if (error) {
      console.error('uploadAsset error:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('merchant-assets').getPublicUrl(fullPath);
    return data.publicUrl;
  } catch (e) {
    console.error('uploadAsset exception:', e);
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MerchantRegistration() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);

  const PAYMENT_OPTIONS = ['FPS', 'PayMe', 'Alipay HK', 'WeChat Pay', t('merchantReg.cash'), t('merchantReg.bankTransfer')];

  // Step 1 — 商店資料
  const [shopNameZh, setShopNameZh]   = useState('');
  const [shopNameEn, setShopNameEn]   = useState('');
  const [district, setDistrict]       = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri]         = useState<string | null>(null);
  const [bannerUri, setBannerUri]     = useState<string | null>(null);

  // Step 2 — 聯絡 & 營業
  const [hasPhysicalStore, setHasPhysicalStore] = useState(false);
  const [address, setAddress]         = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [whatsapp, setWhatsapp]       = useState('');
  const [website, setWebsite]         = useState('');
  const [instagram, setInstagram]     = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  // Step 3 — BR 文件
  const [brNumber, setBrNumber]       = useState('');
  const [brDocUri, setBrDocUri]       = useState<string | null>(null);

  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  const togglePayment = (p: string) =>
    setPaymentMethods(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );

  const pickImage = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const pickDocument = async (setter: (uri: string) => void) => {
    // Use image picker for BR document (PDF ideally, but image works too)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!shopNameZh.trim() && !shopNameEn.trim()) {
      Alert.alert(t('merchantReg.alertFillName'));
      return;
    }
    if (!brNumber.trim()) {
      Alert.alert(t('merchantReg.alertFillBrNumber'));
      return;
    }
    if (!brDocUri) {
      Alert.alert(t('merchantReg.alertUploadBrDoc'));
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('merchantReg.notLoggedIn'));

      // ── Check existing merchant_profile state ──────────────────────────────
      // Four possible states:
      //   1. No row              → INSERT a fresh certified_merchant pending row
      //   2. individual_seller   → UPDATE in place (upgrade flow)
      //   3. certified_merchant, status='active'   → BLOCK (already approved)
      //   4. certified_merchant, status='pending'  → BLOCK (review in progress)
      //   5. certified_merchant, status='rejected' → UPDATE in place (re-apply)
      const { data: existing } = await supabase
        .from('merchant_profiles')
        .select('id, seller_type, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.seller_type === 'certified_merchant' && existing.status === 'active') {
          Alert.alert(t('merchantReg.alreadyCertified'), t('merchantReg.alreadyCertifiedMsg'));
          setLoading(false);
          return;
        }
        if (existing.seller_type === 'certified_merchant' && existing.status === 'pending') {
          Alert.alert(t('merchantReg.reviewInProgress'), t('merchantReg.reviewInProgressMsg'));
          setLoading(false);
          return;
        }
        // Otherwise (individual_seller OR rejected) → fall through to UPDATE
      }

      // Upload assets
      const [logoUrl, bannerUrl, brDocUrl] = await Promise.all([
        logoUri   ? uploadAsset(logoUri,   `logos/${user.id}`)   : Promise.resolve(null),
        bannerUri ? uploadAsset(bannerUri, `banners/${user.id}`) : Promise.resolve(null),
        brDocUri  ? uploadAsset(brDocUri,  `br/${user.id}`)      : Promise.resolve(null),
      ]);

      // BR document is mandatory — surface upload failure instead of submitting without it
      if (!brDocUrl) {
        Alert.alert(t('merchantReg.submitFailed'), t('merchantReg.brUploadFailed'));
        setLoading(false);
        return;
      }

      const payload = {
        user_id:            user.id,
        seller_type:        'certified_merchant' as const,
        display_name:       shopNameZh.trim() || shopNameEn.trim(),
        shop_name_zh:       shopNameZh.trim() || null,
        shop_name_en:       shopNameEn.trim() || null,
        district:           district || null,
        shop_description:   description.trim() || null,
        logo_url:           logoUrl,
        banner_url:         bannerUrl,
        has_physical_store: hasPhysicalStore,
        address:            address.trim() || null,
        business_hours:     businessHours.trim() || null,
        whatsapp:           whatsapp.trim() || null,
        website:            website.trim() || null,
        instagram:          instagram.trim() || null,
        payment_methods:    paymentMethods,
        br_number:          brNumber.trim(),
        br_document_url:    brDocUrl,
        status:             'pending' as const,
      };

      // INSERT new row OR UPDATE existing (upgrade / re-apply)
      const { error } = existing
        ? await supabase
            .from('merchant_profiles')
            .update(payload)
            .eq('id', existing.id)
        : await supabase
            .from('merchant_profiles')
            .insert(payload);

      if (error) throw error;

      setSuccess(true);
    } catch (err: any) {
      Alert.alert(t('merchantReg.submitFailed'), err.message ?? t('common.tryAgainLater'));
    }
    setLoading(false);
  };

  // ── Step indicators ────────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {([1, 2, 3] as Step[]).map(s => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepDot, step === s && styles.stepDotActive, step > s && styles.stepDotDone]}>
            <Text style={[styles.stepDotText, (step === s || step > s) && styles.stepDotTextActive]}>
              {step > s ? '✓' : s}
            </Text>
          </View>
          <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
            {s === 1 ? t('merchantReg.step1Label') : s === 2 ? t('merchantReg.step2Label') : t('merchantReg.step3Label')}
          </Text>
          {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineDone]} />}
        </View>
      ))}
    </View>
  );

  // ── Step 1 content ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      {/* Banner picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.bannerTitle')}</Text>
        <TouchableOpacity style={styles.bannerPicker} onPress={() => pickImage(setBannerUri)}>
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.bannerPreview} resizeMode="cover" />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Text style={styles.bannerPlaceholderIcon}>🖼</Text>
              <Text style={styles.bannerPlaceholderText}>{t('merchantReg.bannerPlaceholder')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Logo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.logoTitle')}</Text>
        <TouchableOpacity style={styles.logoPicker} onPress={() => pickImage(setLogoUri)}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>{t('merchantReg.logoPlaceholder')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Names */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.shopNameZhLabel')}<Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder={t('merchantReg.shopNameZhPlaceholder')}
          placeholderTextColor={colors.text.tertiary}
          value={shopNameZh}
          onChangeText={setShopNameZh}
          maxLength={30}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.shopNameEnLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Card House HK"
          placeholderTextColor={colors.text.tertiary}
          value={shopNameEn}
          onChangeText={setShopNameEn}
          autoCapitalize="words"
          maxLength={50}
        />
      </View>

      {/* District */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.districtLabel')} <Text style={styles.required}>*</Text></Text>
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
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.descLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('merchantReg.descPlaceholder')}
          placeholderTextColor={colors.text.tertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/200</Text>
      </View>

      <TouchableOpacity
        style={[styles.nextBtn, (!shopNameZh.trim() && !shopNameEn.trim()) && styles.nextBtnDisabled]}
        onPress={() => {
          if (!shopNameZh.trim() && !shopNameEn.trim()) {
            Alert.alert(t('merchantReg.alertFillName'));
            return;
          }
          if (!district) {
            Alert.alert(t('merchantReg.alertSelectDistrict'));
            return;
          }
          setStep(2);
        }}
        disabled={!shopNameZh.trim() && !shopNameEn.trim()}
      >
        <Text style={styles.nextBtnText}>{t('merchantReg.nextStep')}</Text>
      </TouchableOpacity>
    </>
  );

  // ── Step 2 content ─────────────────────────────────────────────────────────

  const renderStep2 = () => (
    <>
      {/* Physical store toggle */}
      <View style={[styles.section, styles.switchRow]}>
        <View style={styles.switchInfo}>
          <Text style={styles.sectionTitle}>{t('merchantReg.physicalStoreLabel')}</Text>
          <Text style={styles.hint}>{t('merchantReg.physicalStoreHint')}</Text>
        </View>
        <Switch
          value={hasPhysicalStore}
          onValueChange={setHasPhysicalStore}
          trackColor={{ true: colors.brand.orange, false: colors.border.default }}
          // '#fff' kept raw — always-white thumb
          thumbColor="#fff"
        />
      </View>

      {hasPhysicalStore && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('merchantReg.addressLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('merchantReg.addressPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={address}
              onChangeText={setAddress}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('merchantReg.businessHoursLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('merchantReg.businessHoursPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={businessHours}
              onChangeText={setBusinessHours}
            />
          </View>
        </>
      )}

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.whatsappLabel')} <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 91234567"
          placeholderTextColor={colors.text.tertiary}
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.instagramLabel')}</Text>
        <View style={styles.prefixInput}>
          <Text style={styles.prefixText}>@</Text>
          <TextInput
            style={styles.prefixTextInput}
            placeholder="instagram_handle"
            placeholderTextColor={colors.text.tertiary}
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.websiteLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="https://your-shop.com"
          placeholderTextColor={colors.text.tertiary}
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {/* Payment */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.paymentLabel')}</Text>
        <View style={styles.payGrid}>
          {PAYMENT_OPTIONS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.payBtn, paymentMethods.includes(p) && styles.payBtnActive]}
              onPress={() => togglePayment(p)}
            >
              <Text style={[styles.payBtnText, paymentMethods.includes(p) && styles.payBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.stepBtnRow}>
        <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep(1)}>
          <Text style={styles.backStepBtnText}>{t('merchantReg.prevStep')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, styles.nextBtnFlex, !whatsapp.trim() && styles.nextBtnDisabled]}
          onPress={() => {
            if (!whatsapp.trim()) { Alert.alert(t('merchantReg.alertFillWhatsapp')); return; }
            setStep(3);
          }}
          disabled={!whatsapp.trim()}
        >
          <Text style={styles.nextBtnText}>{t('merchantReg.nextStep')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Step 3 content ─────────────────────────────────────────────────────────

  const renderStep3 = () => (
    <>
      <View style={styles.infoBox}>
        <Text style={styles.infoBoxIcon}>i</Text>
        <Text style={styles.infoBoxText}>
          {t('merchantReg.brInfo')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.brNumberLabel')} <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 12345678-000-01-23-4"
          placeholderTextColor={colors.text.tertiary}
          value={brNumber}
          onChangeText={setBrNumber}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('merchantReg.brUploadLabel')} <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.docPicker} onPress={() => pickDocument(setBrDocUri)}>
          {brDocUri ? (
            <View style={styles.docPickerSelected}>
              <Image source={require('../assets/icons/Certification.png')} style={styles.docPickerSelectedIcon} />
              <Text style={styles.docPickerSelectedText}>{t('merchantReg.docSelected')}</Text>
              <TouchableOpacity onPress={() => pickDocument(setBrDocUri)}>
                <Text style={styles.docPickerChangeText}>{t('merchantReg.docChange')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.docPickerEmpty}>
              <Image source={require('../assets/icons/pen.png')} style={styles.docPickerIcon} />
              <Text style={styles.docPickerText}>{t('merchantReg.docUploadText')}</Text>
              <Text style={styles.docPickerHint}>{t('merchantReg.docSupportedFormats')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.reviewBox}>
        <Text style={styles.reviewBoxTitle}>{t('merchantReg.reviewFlowTitle')}</Text>
        <View style={styles.reviewStep}>
          <View style={styles.reviewDot}><Text style={styles.reviewDotText}>1</Text></View>
          <Text style={styles.reviewStepText}>{t('merchantReg.reviewStep1')}</Text>
        </View>
        <View style={styles.reviewStep}>
          <View style={styles.reviewDot}><Text style={styles.reviewDotText}>2</Text></View>
          <Text style={styles.reviewStepText}>{t('merchantReg.reviewStep2')}</Text>
        </View>
        <View style={styles.reviewStep}>
          <View style={styles.reviewDot}><Text style={styles.reviewDotText}>3</Text></View>
          <Text style={styles.reviewStepText}>{t('merchantReg.reviewStep3')}</Text>
        </View>
      </View>

      <View style={styles.stepBtnRow}>
        <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep(2)}>
          <Text style={styles.backStepBtnText}>{t('merchantReg.prevStep')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, styles.nextBtnFlex, (!brNumber.trim() || !brDocUri || loading) && styles.nextBtnDisabled]}
          onPress={handleSubmit}
          disabled={!brNumber.trim() || !brDocUri || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>{t('merchantReg.submitBtn')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Success screen ─────────────────────────────────────────────────────────

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <Image source={require('../assets/icons/Certification.png')} style={styles.successIcon} />
          <Text style={styles.successTitle}>{t('merchantReg.successTitle')}</Text>
          <Text style={styles.successSub}>{t('merchantReg.successSub')}</Text>
          <View style={styles.successSteps}>
            <View style={styles.successStep}>
              <Text style={styles.successStepNum}>1</Text>
              <Text style={styles.successStepText}>{t('merchantReg.successStep1')}</Text>
            </View>
            <View style={styles.successStep}>
              <Text style={styles.successStepNum}>2</Text>
              <Text style={styles.successStepText}>{t('merchantReg.successStep2')}</Text>
            </View>
            <View style={styles.successStep}>
              <Text style={styles.successStepNum}>3</Text>
              <Text style={styles.successStepText}>{t('merchantReg.successStep3')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => router.replace('/(tabs)/shops' as any)}
          >
            <Text style={styles.successBtnText}>{t('merchantReg.successBtn')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{t('merchantReg.navTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {renderStepIndicator()}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    scrollContent: { paddingBottom: 40 },

    // Step indicator
    stepIndicator: { flexDirection: 'row', backgroundColor: colors.surface.card, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border.default },
    stepDotActive: { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    // '#22C55E' kept raw — semantic success/done green
    stepDotDone: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
    stepDotText: { fontSize: 12, fontWeight: '700', color: colors.text.tertiary },
    // '#fff' kept raw — always-white on filled dot
    stepDotTextActive: { color: '#fff' },
    stepLabel: { fontSize: 11, color: colors.text.tertiary, marginLeft: 6 },
    stepLabelActive: { color: colors.brand.orange, fontWeight: '700' },
    stepLine: { flex: 1, height: 1.5, backgroundColor: colors.border.default, marginHorizontal: 4 },
    // '#22C55E' kept raw — semantic success/done green
    stepLineDone: { backgroundColor: '#22C55E' },

    section: { backgroundColor: colors.surface.card, padding: 20, marginBottom: 8, gap: 8 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switchInfo: { flex: 1, gap: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
    // '#EF4444' kept raw — destructive red
    required: { color: '#EF4444' },
    hint: { fontSize: 12, color: colors.text.tertiary },
    charCount: { fontSize: 11, color: colors.text.tertiary, textAlign: 'right' },

    input: { backgroundColor: colors.surface.section, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.default },
    textArea: { height: 90, paddingTop: 12 },

    prefixInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface.section, borderRadius: 14, borderWidth: 1, borderColor: colors.border.default, paddingHorizontal: 16 },
    prefixText: { fontSize: 16, color: colors.text.tertiary, marginRight: 2 },
    prefixTextInput: { flex: 1, fontSize: 15, color: colors.text.primary, paddingVertical: 14 },

    // Image pickers
    bannerPicker: { width: '100%', height: 140, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border.default, borderStyle: 'dashed' },
    bannerPreview: { width: '100%', height: '100%' },
    bannerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface.section },
    bannerPlaceholderIcon: { fontSize: 28 },
    bannerPlaceholderText: { fontSize: 13, color: colors.text.tertiary },

    logoPicker: { alignSelf: 'flex-start' },
    logoPreview: { width: 80, height: 80, borderRadius: 16 },
    logoPlaceholder: { width: 80, height: 80, borderRadius: 16, backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.border.default, borderStyle: 'dashed' },
    logoPlaceholderIcon: { fontSize: 24 },
    logoPlaceholderText: { fontSize: 10, color: colors.text.tertiary },

    chipRow: { gap: 8, paddingVertical: 4 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface.section, borderWidth: 1, borderColor: colors.border.default },
    chipActive: { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    chipText: { fontSize: 13, fontWeight: '500', color: colors.text.secondary },
    // '#fff' kept raw — always-white on Card Orange
    chipTextActive: { color: '#fff', fontWeight: '700' },

    payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    payBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface.section, borderWidth: 1, borderColor: colors.border.default },
    // '#EFF6FF'/'#3B82F6' kept raw — semantic rarity/payment-selected blue
    payBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
    payBtnText: { fontSize: 13, fontWeight: '500', color: colors.text.secondary },
    // '#3B82F6' kept raw — semantic blue
    payBtnTextActive: { color: '#3B82F6', fontWeight: '700' },

    // Document picker
    docPicker: { borderWidth: 1.5, borderColor: colors.border.default, borderStyle: 'dashed', borderRadius: 16 },
    docPickerEmpty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
    docPickerIcon: { width: 32, height: 32, tintColor: colors.text.tertiary, resizeMode: 'contain' },
    docPickerText: { fontSize: 14, color: colors.text.primary, fontWeight: '600' },
    docPickerHint: { fontSize: 12, color: colors.text.tertiary },
    docPickerSelected: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
    // '#22C55E' kept raw — semantic success green
    docPickerSelectedIcon: { width: 22, height: 22, tintColor: '#22C55E', resizeMode: 'contain' },
    // '#22C55E' kept raw — semantic success green
    docPickerSelectedText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#22C55E' },
    docPickerChangeText: { fontSize: 13, color: colors.brand.orange, fontWeight: '600' },

    // Info box
    // '#EFF6FF'/'#3B82F6' kept raw — semantic info-blue tint
    infoBox: { flexDirection: 'row', backgroundColor: '#EFF6FF', margin: 16, borderRadius: 16, padding: 16, gap: 10 },
    // '#3B82F6' kept raw — semantic info blue
    infoBoxIcon: { fontSize: 14, fontWeight: '800', color: '#3B82F6', width: 20, textAlign: 'center' },
    infoBoxText: { flex: 1, fontSize: 13, color: colors.text.primary, lineHeight: 20 },

    // Review flow box
    reviewBox: { backgroundColor: colors.surface.card, marginHorizontal: 16, marginTop: 8, borderRadius: 20, padding: 20, gap: 12 },
    reviewBoxTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
    reviewStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    reviewDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand.orange, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    // '#fff' kept raw — always-white on Card Orange
    reviewDotText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    reviewStepText: { flex: 1, fontSize: 13, color: colors.text.primary, lineHeight: 20 },

    // Buttons
    nextBtn: { marginHorizontal: 16, marginTop: 8, backgroundColor: colors.brand.orange, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
    nextBtnFlex: { flex: 1, marginHorizontal: 0 },
    // '#FED7B0' kept raw — disabled orange tint
    nextBtnDisabled: { backgroundColor: '#FED7B0', opacity: 0.7 },
    // '#fff' kept raw — always-white on Card Orange
    nextBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

    stepBtnRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 8 },
    backStepBtn: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 18, backgroundColor: colors.surface.section, alignItems: 'center', borderWidth: 1, borderColor: colors.border.default },
    backStepBtnText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },

    // Success screen
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
    successIcon: { width: 64, height: 64, tintColor: colors.brand.orange, resizeMode: 'contain' },
    successTitle: { fontSize: 26, fontWeight: '800', color: colors.text.primary },
    successSub: { fontSize: 15, color: colors.text.secondary, textAlign: 'center', lineHeight: 24 },
    successSteps: { backgroundColor: colors.surface.section, borderRadius: 20, padding: 20, width: '100%', gap: 14, borderWidth: 1, borderColor: colors.border.default },
    successStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    // '#fff' kept raw — always-white on Card Orange
    successStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand.orange, textAlign: 'center', lineHeight: 28, fontSize: 13, fontWeight: '800', color: '#fff', overflow: 'hidden' },
    successStepText: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 20 },
    successBtn: { backgroundColor: colors.surface.section, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 32, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: colors.border.default },
    successBtnText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  });
}
