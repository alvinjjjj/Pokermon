import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';
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
import { SELLER_UPLOAD_LIMITS, LISTING_PRICE_MIN, LISTING_PRICE_MAX } from '../constants/config';
import { supabase } from '../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────
// CONDITIONS and LANGUAGES are defined inside the component to use i18n

// ── Types ─────────────────────────────────────────────────────────────────────

type PokemonCard = {
  id: string;
  name: string;
  set: { name: string };
  rarity?: string;
  images: { small: string; large: string };
  number: string;
};

type MerchantInfo = {
  id: string;
  seller_type: 'individual_seller' | 'certified_merchant';
  upload_limit: number;
  current_count: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ListingUpload() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  const CONDITIONS = [
    { key: 'Raw',    label: 'Raw',    desc: t('listingUpload.condRaw'),  color: '#6B7280' },
    { key: 'PSA 9',  label: 'PSA 9',  desc: t('listingUpload.condPsa9'), color: '#3B82F6' },
    { key: 'PSA 10', label: 'PSA 10', desc: t('listingUpload.condPsa10'),color: '#F59E0B' },
  ];

  const LANGUAGES = [
    t('listingUpload.langJapanese'),
    t('listingUpload.langEnglish'),
    t('listingUpload.langTradChinese'),
    t('listingUpload.langSimpChinese'),
    t('listingUpload.langKorean'),
  ];

  const params = useLocalSearchParams<{
    prefill_card_id?:   string;
    prefill_card_name?: string;
    prefill_set_name?:  string;
    prefill_image_url?: string;
    prefill_price?:     string;
  }>();

  // Merchant info
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(true);

  // Whether this listing was launched from portfolio (card pre-selected)
  const fromPortfolio = !!params.prefill_card_name;

  // Card info
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);
  // Free-text card name used when listing directly (not from portfolio)
  const [cardName, setCardName] = useState('');

  // Form fields
  const [condition, setCondition]     = useState('Raw');
  const [success, setSuccess]         = useState(false);
  const [price, setPrice]             = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [quantity, setQuantity]       = useState('1');
  const [languages, setLanguages]     = useState<string[]>([]);
  const [notes, setNotes]             = useState('');
  const [photoUris, setPhotoUris]     = useState<string[]>([]);

  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    loadMerchantInfo();
    // Pre-fill from portfolio if params exist
    if (params.prefill_card_name) {
      setSelectedCard({
        id:     params.prefill_card_id ?? '',
        name:   params.prefill_card_name,
        set:    { name: params.prefill_set_name ?? '' },
        rarity: undefined,
        images: { small: params.prefill_image_url ?? '', large: params.prefill_image_url ?? '' },
        number: '',
      });
      if (params.prefill_price) setPrice(params.prefill_price);
    }
  }, []);

  const loadMerchantInfo = async () => {
    setLoadingMerchant(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('merchant_profiles')
        .select('id, seller_type')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!profile) return;

      const { count } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .neq('status', 'sold');

      setMerchantInfo({
        id: profile.id,
        seller_type: profile.seller_type,
        upload_limit: SELLER_UPLOAD_LIMITS[profile.seller_type] ?? 10,
        current_count: count ?? 0,
      });
    } catch (e) {
      if (__DEV__) console.error('loadMerchantInfo error:', e);
    } finally {
      setLoadingMerchant(false);
    }
  };

  // ── Photos ─────────────────────────────────────────────────────────────────

  const pickPhoto = async () => {
    if (photoUris.length >= 4) {
      Alert.alert(t('listingUpload.maxPhotos'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
        Alert.alert(t('newPost.fileTooLarge'));
        return;
      }
      setPhotoUris(prev => [...prev, asset.uri]);
    }
  };

  const removePhoto = (index: number) =>
    setPhotoUris(prev => prev.filter((_, i) => i !== index));

  const toggleLanguage = (lang: string) =>
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );

  // ── Upload photos ──────────────────────────────────────────────────────────

  const uploadPhotos = async (userId: string): Promise<{ urls: string[]; failedCount: number }> => {
    const urls: string[] = [];
    let failedCount = 0;
    for (let i = 0; i < photoUris.length; i++) {
      try {
        const uri  = photoUris[i];
        const uriExt = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
        const ext  = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uriExt) ? uriExt : 'jpg';
        const path = `listings/${userId}/${Date.now()}_${i}.${ext}`;
        // Use arrayBuffer (not blob) — React Native's blob impl returns 0 bytes
        // for file:// URIs even though no error is thrown.
        const resp = await fetch(uri);
        const arrayBuffer = await resp.arrayBuffer();
        const { error } = await supabase.storage
          .from('listing-photos')
          .upload(path, arrayBuffer, {
            upsert: false,
            contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          });
        if (!error) {
          const { data } = supabase.storage.from('listing-photos').getPublicUrl(path);
          urls.push(data.publicUrl);
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }
    return { urls, failedCount };
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (submitting) return;          // guard against double-tap
    const effectiveName = fromPortfolio ? selectedCard?.name : cardName.trim();
    if (!effectiveName) {
      Alert.alert(t('listingUpload.selectCard'));
      return;
    }
    if (photoUris.length === 0) {
      Alert.alert(t('listingUpload.addPhoto'));
      return;
    }
    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum < LISTING_PRICE_MIN) {
      Alert.alert(t('listingUpload.invalidPrice'), t('listingUpload.minPrice', { min: LISTING_PRICE_MIN }));
      return;
    }
    if (priceNum > LISTING_PRICE_MAX) {
      Alert.alert(t('listingUpload.priceTooHigh'), t('listingUpload.maxPrice', { max: LISTING_PRICE_MAX.toLocaleString() }));
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (!quantity || isNaN(qtyNum) || qtyNum < 1) {
      Alert.alert(t('listingUpload.invalidQty'), t('listingUpload.minQty'));
      return;
    }
    if (!merchantInfo) {
      Alert.alert(t('listingUpload.notSeller'), t('listingUpload.notSellerMsg'));
      return;
    }
    if (merchantInfo.current_count >= merchantInfo.upload_limit) {
      Alert.alert(
        t('listingUpload.limitReached'),
        t('listingUpload.limitReachedMsg', {
          sellerType: merchantInfo.seller_type === 'certified_merchant' ? t('listingUpload.certifiedMerchant') : t('listingUpload.individualSeller'),
          limit: merchantInfo.upload_limit,
        })
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('listingUpload.notLoggedIn'));

      const { urls: photoUrls, failedCount } = await uploadPhotos(user.id);
      if (failedCount > 0) {
        Alert.alert(
          t('listingUpload.partialUpload'),
          t('listingUpload.partialUploadMsg', {
            success: photoUris.length - failedCount,
            total: photoUris.length,
            failed: failedCount,
          })
        );
      }

      // If no card image, try artofpkm lookup by card name pattern (e.g. "293/XY-P")
      let cardImageUrl = selectedCard?.images.small || null;
      if (!cardImageUrl && effectiveName) {
        const ref = effectiveName.match(/[-–]\s*0*(\d+)\s*\/\s*([A-Za-z0-9-]+)\s*$/);
        if (ref) {
          const key = `${ref[1].padStart(3, '0')}/${ref[2].toUpperCase()}`;
          const { data: artofpkm } = await supabase
            .from('artofpkm_card_images')
            .select('image_url')
            .eq('key', key)
            .maybeSingle();
          if (artofpkm?.image_url) cardImageUrl = artofpkm.image_url;
        }
      }

      const { error } = await supabase.from('listings').insert({
        seller_id:      user.id,
        merchant_id:    merchantInfo.id,
        seller_type:    merchantInfo.seller_type,
        card_id:        selectedCard?.id ?? null,
        card_name:      effectiveName,
        set_name:       selectedCard?.set.name ?? null,
        rarity:         selectedCard?.rarity ?? null,
        card_image_url: cardImageUrl,
        photo_urls:     photoUrls,
        condition,
        price:          priceNum,
        is_negotiable:  isNegotiable,
        quantity:       qtyNum,
        language:       languages,
        notes:          notes.trim() || null,
        status:         'active',
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err: any) {
      Alert.alert(t('listingUpload.listFailed'), err.message ?? t('common.tryAgainLater'));
    }
    setSubmitting(false);
  };

  // ── Success screen ─────────────────────────────────────────────────────────

  if (success) {
    const successName = selectedCard?.name ?? cardName.trim();
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <Image source={require('../assets/icons/Certification.png')} style={styles.successIcon} />
          <Text style={styles.successTitle}>{t('listingUpload.successTitle')}</Text>
          <View style={styles.successCardWrap}>
            {selectedCard?.images.small ? (
              <Image source={{ uri: selectedCard.images.small }} style={styles.successCardImg} resizeMode="contain" />
            ) : null}
            <View style={styles.successCardInfo}>
              <Text style={styles.successCardName}>{successName}</Text>
              {selectedCard?.set.name ? (
                <Text style={styles.successCardSet}>{selectedCard.set.name}</Text>
              ) : null}
              <View style={[styles.successCondBadge, { backgroundColor: CONDITIONS.find(c => c.key === condition)?.color ?? '#9CA3AF' }]}>
                <Text style={styles.successCondText}>{condition}</Text>
              </View>
              <Text style={styles.successPrice}>HK${parseFloat(price).toLocaleString()}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.successBtnPrimary} onPress={() => {
            setSuccess(false);
            setSelectedCard(null);
            setCardName('');
            setPrice('');
            setPhotoUris([]);
            setCondition('Raw');
            setNotes('');
            setLanguages([]);
            setQuantity('1');
          }}>
            <Text style={styles.successBtnPrimaryText}>{t('listingUpload.continueList')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.successBtnSecondary} onPress={() => router.replace('/(tabs)/shops' as any)}>
            <Text style={styles.successBtnSecondaryText}>{t('listingUpload.viewMarket')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.successBtnSecondary} onPress={() => router.replace('/(tabs)/' as any)}>
            <Text style={[styles.successBtnSecondaryText, { color: colors.text.tertiary }]}>{t('listingUpload.backHome')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── No merchant profile ────────────────────────────────────────────────────

  if (!loadingMerchant && !merchantInfo) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
            <Text style={styles.navBackText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{t('listingUpload.navTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.noProfileWrap}>
          <Image source={require('../assets/icons/shops.png')} style={styles.noProfileIcon} />
          <Text style={styles.noProfileTitle}>{t('listingUpload.noSellerTitle')}</Text>
          <Text style={styles.noProfileSub}>{t('listingUpload.noSellerSub')}</Text>
          <View style={styles.noProfileBtnRow}>
            <TouchableOpacity
              style={styles.noProfileBtnIndividual}
              onPress={() => router.push('/seller-registration' as any)}
            >
              <Text style={styles.noProfileBtnIndividualText}>{t('shops.individualSeller')}</Text>
              <Text style={styles.noProfileBtnSubDark}>{t('shops.freeInstant')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.noProfileBtnMerchant}
              onPress={() => router.push('/merchant-registration' as any)}
            >
              <Text style={styles.noProfileBtnMerchantText}>{t('shops.certifiedMerchant')}</Text>
              <Text style={styles.noProfileBtnSubWhite}>{t('shops.needsReview')}</Text>
            </TouchableOpacity>
          </View>
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
          <Text style={styles.navTitle}>{t('listingUpload.navTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingMerchant ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand.orange} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Upload limit indicator */}
            {merchantInfo && (
              <View style={styles.limitBar}>
                <Text style={styles.limitText}>
                  {t('listingUpload.limitBar', { current: merchantInfo.current_count, limit: merchantInfo.upload_limit })}
                </Text>
                <View style={styles.limitTrack}>
                  <View style={[
                    styles.limitFill,
                    { width: `${Math.min(100, (merchantInfo.current_count / merchantInfo.upload_limit) * 100)}%` as any },
                    merchantInfo.current_count >= merchantInfo.upload_limit * 0.9 && styles.limitFillWarn,
                  ]} />
                </View>
              </View>
            )}

            {/* ① 卡片名稱 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listingUpload.step1')} <Text style={styles.required}>*</Text></Text>

              {fromPortfolio && selectedCard ? (
                // Coming from portfolio — card locked, no editing
                <View style={styles.selectedCardWrap}>
                  {selectedCard.images.small ? (
                    <Image source={{ uri: selectedCard.images.small }} style={styles.selectedCardImg} resizeMode="contain" />
                  ) : null}
                  <View style={styles.selectedCardInfo}>
                    <Text style={styles.selectedCardName}>{selectedCard.name}</Text>
                    {selectedCard.set.name ? (
                      <Text style={styles.selectedCardSet}>{selectedCard.set.name}</Text>
                    ) : null}
                    {selectedCard.rarity ? (
                      <Text style={styles.selectedCardRarity}>{selectedCard.rarity}</Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                // Direct listing — free text name input
                <View style={styles.searchBar}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('listingUpload.cardNamePlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={cardName}
                    onChangeText={setCardName}
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>
              )}
            </View>

            {/* ② 實物照片 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listingUpload.step2')}<Text style={styles.required}> *</Text></Text>
              <View style={styles.photoRow}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {photoUris.length < 4 && (
                  <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto}>
                    <Image source={require('../assets/icons/camera.png')} style={styles.photoAddIcon} />
                    <Text style={styles.photoAddText}>{t('listingUpload.addPhotoBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ③ 品相 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listingUpload.step3')} <Text style={styles.required}>*</Text></Text>
              <View style={styles.conditionRow}>
                {CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.condBtn,
                      condition === c.key && { backgroundColor: c.color, borderColor: c.color },
                    ]}
                    onPress={() => setCondition(c.key)}
                  >
                    <Text style={[styles.condBtnLabel, condition === c.key && styles.condBtnLabelActive]}>
                      {c.label}
                    </Text>
                    <Text style={[styles.condBtnDesc, condition === c.key && styles.condBtnDescActive]}>
                      {c.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ④ 售價 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listingUpload.step4')}<Text style={styles.required}>*</Text></Text>
              <View style={styles.priceRow}>
                <View style={styles.priceInputWrap}>
                  <Text style={styles.pricePrefix}>HK$</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    placeholderTextColor={colors.text.tertiary}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    textContentType="none"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.negoBtn, isNegotiable && styles.negoBtnActive]}
                  onPress={() => setIsNegotiable(v => !v)}
                >
                  <Text style={[styles.negoBtnText, isNegotiable && styles.negoBtnTextActive]}>
                    {isNegotiable ? t('listingUpload.negotiableOn') : t('listingUpload.negotiable')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ⑤ 數量 + 語言 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listingUpload.step5')} <Text style={styles.required}>*</Text></Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  textAlign="center"
                  textContentType="none"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                />
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(prev => String((parseInt(prev, 10) || 0) + 1))}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('listingUpload.languageLabel')}</Text>
              <View style={styles.langRow}>
                {LANGUAGES.map(lang => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langChip, languages.includes(lang) && styles.langChipActive]}
                    onPress={() => toggleLanguage(lang)}
                  >
                    <Text style={[styles.langChipText, languages.includes(lang) && styles.langChipTextActive]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ⑥ 備註 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listingUpload.step6')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('listingUpload.notesPlaceholder')}
                placeholderTextColor={colors.text.tertiary}
                value={notes}
                onChangeText={setNotes}
                maxLength={100}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{notes.length}/100</Text>
            </View>

            {/* Preview summary */}
            {selectedCard && price && (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>{t('listingUpload.previewTitle')}</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t('listingUpload.previewCard')}</Text>
                  <Text style={styles.previewValue}>{selectedCard.name}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t('listingUpload.previewSet')}</Text>
                  <Text style={styles.previewValue}>{selectedCard.set.name}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t('listingUpload.previewCondition')}</Text>
                  <Text style={[styles.previewValue, { color: CONDITIONS.find(c => c.key === condition)?.color }]}>
                    {condition} — {CONDITIONS.find(c => c.key === condition)?.desc}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{t('listingUpload.previewPrice')}</Text>
                  <Text style={[styles.previewValue, styles.previewPrice]}>
                    HK${parseFloat(price || '0').toLocaleString()}
                    {isNegotiable ? t('listingUpload.negotiableNote') : ''}
                  </Text>
                </View>
                {languages.length > 0 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{t('listingUpload.previewLanguage')}</Text>
                    <Text style={styles.previewValue}>{languages.join(' · ')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedCard || !price || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedCard || !price || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{t('listingUpload.submitBtn')}</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
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
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // No profile
    noProfileWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
    noProfileIcon: { width: 56, height: 56, tintColor: colors.border.strong, resizeMode: 'contain' },
    noProfileTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
    noProfileSub: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
    noProfileBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
    noProfileBtnIndividual: { flex: 1, backgroundColor: colors.brand.orange, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', gap: 3 },
    // '#fff' / rgba-white kept raw — text/icon on Card Orange brand fill
    noProfileBtnIndividualText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    noProfileBtnSubDark: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
    noProfileBtnMerchant: { flex: 1, backgroundColor: colors.surface.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', gap: 3, borderWidth: 2, borderColor: colors.brand.orange },
    noProfileBtnMerchantText: { fontSize: 15, fontWeight: '700', color: colors.brand.orange },
    // sits on the surface.card button above — keep raw orange-tint
    noProfileBtnSubWhite: { fontSize: 10, color: 'rgba(255,105,0,0.7)', fontWeight: '500' },

    // Limit bar
    limitBar: { backgroundColor: colors.surface.card, paddingHorizontal: 20, paddingVertical: 12, marginBottom: 8, gap: 6 },
    limitText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
    limitTrack: { height: 4, backgroundColor: colors.surface.section, borderRadius: 2, overflow: 'hidden' },
    limitFill: { height: '100%', backgroundColor: colors.brand.orange, borderRadius: 2 },
    // limitFillWarn '#EF4444' kept raw — semantic destructive (over-limit warning)
    limitFillWarn: { backgroundColor: '#EF4444' },

    // Sections
    section: { backgroundColor: colors.surface.card, padding: 20, marginBottom: 8, gap: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    // required asterisk red kept raw — semantic destructive
    required: { color: '#EF4444' },

    input: { backgroundColor: colors.surface.section, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.default },
    textArea: { height: 80, paddingTop: 12 },
    charCount: { fontSize: 11, color: colors.text.tertiary, textAlign: 'right' },

    // Card search
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface.section, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: colors.border.default },
    searchIcon: { width: 16, height: 16, resizeMode: 'contain', tintColor: colors.text.tertiary },
    searchInput: { flex: 1, fontSize: 15, color: colors.text.primary },

    searchResults: { borderWidth: 1, borderColor: colors.border.default, borderRadius: 16, overflow: 'hidden' },
    searchResultRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border.default },
    searchResultImg: { width: 44, height: 62, borderRadius: 6 },
    searchResultInfo: { flex: 1, gap: 2 },
    searchResultName: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
    searchResultSet: { fontSize: 12, color: colors.text.secondary },
    searchResultRarity: { fontSize: 11, color: colors.text.tertiary },

    selectedCardWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brand.peach, borderRadius: 16, padding: 14, gap: 12 },
    selectedCardImg: { width: 52, height: 72, borderRadius: 8 },
    selectedCardInfo: { flex: 1, gap: 2 },
    selectedCardName: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
    selectedCardSet: { fontSize: 12, color: colors.text.secondary },
    selectedCardRarity: { fontSize: 11, color: colors.text.tertiary },
    clearCardBtn: { backgroundColor: colors.surface.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    clearCardBtnText: { fontSize: 13, fontWeight: '600', color: colors.brand.orange },

    // Photos
    photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    photoThumbWrap: { width: 80, height: 80, position: 'relative' },
    photoThumb: { width: 80, height: 80, borderRadius: 12 },
    // photoRemove '#EF4444' / '#fff' kept raw — destructive action button (X to delete)
    photoRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
    photoRemoveText: { fontSize: 10, color: '#fff', fontWeight: '700' },
    photoAdd: { width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border.default, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surface.section },
    photoAddIcon: { width: 24, height: 24, resizeMode: 'contain', tintColor: colors.text.tertiary },
    photoAddText: { fontSize: 11, color: colors.text.tertiary },

    // Condition
    conditionRow: { flexDirection: 'row', gap: 8 },
    condBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface.section, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border.default, gap: 2 },
    condBtnLabel: { fontSize: 14, fontWeight: '800', color: colors.text.secondary },
    // condBtn active state fills with CONDITIONS.color (semantic) — text stays white
    condBtnLabelActive: { color: '#fff' },
    condBtnDesc: { fontSize: 9, color: colors.text.tertiary },
    condBtnDescActive: { color: 'rgba(255,255,255,0.85)' },

    // Price
    priceRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    priceInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface.section, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border.default },
    pricePrefix: { fontSize: 15, color: colors.text.tertiary, marginRight: 4 },
    priceInput: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text.primary, paddingVertical: 14 },
    negoBtn: { paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.surface.section, borderWidth: 1, borderColor: colors.border.default },
    // Semantic "go" green for negotiable confirmation — same hue both modes
    negoBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#22C55E' },
    negoBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
    negoBtnTextActive: { color: '#16A34A' },

    // Quantity
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
    qtyBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface.section, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.default },
    qtyBtnText: { fontSize: 22, color: colors.text.primary, fontWeight: '300' },
    qtyInput: { width: 60, height: 44, borderRadius: 12, backgroundColor: colors.surface.section, fontSize: 18, fontWeight: '700', color: colors.text.primary, borderWidth: 1, borderColor: colors.border.default },

    // Language
    langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    langChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface.section, borderWidth: 1, borderColor: colors.border.default },
    langChipActive: { backgroundColor: colors.brand.orange, borderColor: colors.brand.orange },
    langChipText: { fontSize: 13, fontWeight: '500', color: colors.text.secondary },
    // langChipTextActive '#fff' kept raw — on Card Orange
    langChipTextActive: { color: '#fff', fontWeight: '700' },

    // Preview
    previewBox: { backgroundColor: colors.surface.card, marginHorizontal: 16, marginBottom: 8, borderRadius: 20, padding: 20, gap: 10, borderWidth: 1, borderColor: colors.border.default },
    previewTitle: { fontSize: 14, fontWeight: '700', color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    previewLabel: { fontSize: 13, color: colors.text.secondary },
    previewValue: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
    previewPrice: { fontSize: 16, fontWeight: '800', color: colors.brand.orange },

    // Submit
    submitBtn: { marginHorizontal: 16, backgroundColor: colors.brand.orange, borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
    // submitBtnDisabled '#FED7B0' kept raw — desaturated Card Orange tint, theme-neutral
    submitBtnDisabled: { backgroundColor: '#FED7B0', opacity: 0.7 },
    // submitBtnText '#fff' kept raw — on Card Orange
    submitBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },

    // Success
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
    successIcon: { width: 64, height: 64, tintColor: colors.brand.orange, resizeMode: 'contain' },
    successTitle: { fontSize: 28, fontWeight: '800', color: colors.text.primary },
    successCardWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface.section, borderRadius: 20, padding: 16, gap: 14, width: '100%', borderWidth: 1, borderColor: colors.border.default },
    successCardImg: { width: 70, height: 98, borderRadius: 8 },
    successCardPlaceholder: { width: 70, height: 98, borderRadius: 8, backgroundColor: colors.surface.section },
    successCardInfo: { flex: 1, gap: 4 },
    successCardName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    successCardSet: { fontSize: 12, color: colors.text.secondary },
    successCondBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
    // successCondText '#fff' kept raw — on CONDITIONS.color semantic fill
    successCondText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    successPrice: { fontSize: 18, fontWeight: '800', color: colors.brand.orange, marginTop: 4 },
    successBtnPrimary: { backgroundColor: colors.brand.orange, borderRadius: 18, paddingVertical: 16, alignItems: 'center', width: '100%' },
    // successBtnPrimaryText '#fff' kept raw — on Card Orange
    successBtnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
    successBtnSecondary: { paddingVertical: 12, alignItems: 'center' },
    successBtnSecondaryText: { fontSize: 15, color: colors.text.tertiary, fontWeight: '500' },
  });
}
