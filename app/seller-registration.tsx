import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

// ── Constants ────────────────────────────────────────────────────────────────

const CONTACT_TYPES = ['WhatsApp', 'Telegram', 'Instagram'];

const HK_DISTRICTS = [
  '中西區', '灣仔', '東區', '南區',
  '油尖旺', '深水埗', '九龍城', '黃大仙', '觀塘',
  '荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SellerRegistration() {
  const router = useRouter();
  const { t } = useTranslation();

  const PAYMENT_OPTIONS = ['FPS', 'PayMe', 'Alipay HK', 'WeChat Pay', t('sellerReg.cash'), t('sellerReg.bankTransfer')];

  const [displayName, setDisplayName]       = useState('');
  const [district, setDistrict]             = useState('');
  const [contactType, setContactType]       = useState<string>('WhatsApp');
  const [contactValue, setContactValue]     = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [avatarUri, setAvatarUri]           = useState<string | null>(null);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);
  const [loading, setLoading]               = useState(false);
  const [success, setSuccess]               = useState(false);

  const togglePayment = (p: string) => {
    setPaymentMethods(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarUri) return null;
    try {
      const ext      = avatarUri.split('.').pop() ?? 'jpg';
      const filename = `avatars/${userId}.${ext}`;
      const resp        = await fetch(avatarUri);
      const arrayBuffer = await resp.arrayBuffer();
      const { error } = await supabase.storage
        .from('merchant-assets')
        .upload(filename, arrayBuffer, { upsert: true, contentType: `image/${ext}` });
      if (error) return null;
      const { data } = supabase.storage.from('merchant-assets').getPublicUrl(filename);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      Alert.alert(t('sellerReg.fillName'));
      return;
    }
    if (!contactValue.trim()) {
      Alert.alert(t('sellerReg.fillContact'));
      return;
    }
    if (!declarationAgreed) {
      Alert.alert(t('sellerReg.agreeDeclaration'));
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('sellerReg.notLoggedIn'));

      // Check if already has profile
      const { data: existing } = await supabase
        .from('merchant_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        Alert.alert(t('sellerReg.alreadySeller'), t('sellerReg.alreadySellerMsg'));
        setLoading(false);
        return;
      }

      const avatarUrl = await uploadAvatar(user.id);

      const { error } = await supabase.from('merchant_profiles').insert({
        user_id:            user.id,
        seller_type:        'individual_seller',
        display_name:       displayName.trim(),
        district:           district || null,
        contact_type:       contactType,
        contact_value:      contactValue.trim(),
        payment_methods:    paymentMethods,
        avatar_url:         avatarUrl,
        declaration_agreed: declarationAgreed,
        // status will be set to 'active' automatically by DB trigger
      });

      if (error) throw error;

      // Update user_roles
      await supabase
        .from('user_roles')
        .upsert({ user_id: user.id, role: 'individual_seller', status: 'active' });

      setSuccess(true);
    } catch (err: any) {
      Alert.alert(t('sellerReg.regFailed'), err.message ?? t('common.tryAgainLater'));
    }
    setLoading(false);
  };

  // ── Success screen ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <Text style={styles.successTitle}>{t('sellerReg.successTitle')}</Text>
          <Text style={styles.successSub}>{t('sellerReg.successSub')}</Text>
          <TouchableOpacity
            style={styles.successBtnPrimary}
            onPress={() => router.replace('/listing-upload' as any)}
          >
            <Text style={styles.successBtnPrimaryText}>{t('sellerReg.successListBtn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.successBtnSecondary}
            onPress={() => router.replace('/(tabs)/shops' as any)}
          >
            <Text style={styles.successBtnSecondaryText}>{t('sellerReg.backToShops')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
          <Text style={styles.navTitle}>{t('sellerReg.navTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerWrap}>
            <Image source={require('../assets/icons/profile.png')} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>{t('sellerReg.headerTitle')}</Text>
            <Text style={styles.headerSub}>{t('sellerReg.headerSub')}</Text>
          </View>

          {/* Avatar */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sellerReg.avatarLabel')}</Text>
            <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Image source={require('../assets/icons/camera.png')} style={styles.avatarPlaceholderIcon} />
                  <Text style={styles.avatarPlaceholderText}>{t('sellerReg.avatarPick')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Display name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sellerReg.displayName')} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={t('sellerReg.namePlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={30}
            />
            <Text style={styles.hint}>{t('sellerReg.displayNameHint')}</Text>
          </View>

          {/* District */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sellerReg.district')}</Text>
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

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sellerReg.contact')} <Text style={styles.required}>*</Text></Text>
            <View style={styles.contactTypeRow}>
              {CONTACT_TYPES.map(ct => (
                <TouchableOpacity
                  key={ct}
                  style={[styles.contactTypeBtn, contactType === ct && styles.contactTypeBtnActive]}
                  onPress={() => setContactType(ct)}
                >
                  <Text style={[styles.contactTypeBtnText, contactType === ct && styles.contactTypeBtnTextActive]}>
                    {ct === 'WhatsApp' ? 'WhatsApp' : ct === 'Telegram' ? 'Telegram' : 'Instagram'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder={
                contactType === 'WhatsApp'  ? t('sellerReg.placeholderWhatsApp') :
                contactType === 'Telegram'  ? t('sellerReg.placeholderTelegram') :
                t('sellerReg.placeholderInstagram')
              }
              placeholderTextColor="#9CA3AF"
              value={contactValue}
              onChangeText={setContactValue}
              keyboardType={contactType === 'WhatsApp' ? 'phone-pad' : 'default'}
              autoCapitalize="none"
            />
          </View>

          {/* Payment methods */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sellerReg.payment')}</Text>
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

          {/* Declaration */}
          <View style={styles.declarationBox}>
            <Text style={styles.declarationTitle}>{t('sellerReg.declarationTitle')}</Text>
            <Text style={styles.declarationText}>
              {t('sellerReg.declarationText')}
            </Text>
            <TouchableOpacity
              style={styles.declarationCheck}
              onPress={() => setDeclarationAgreed(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, declarationAgreed && styles.checkboxActive]}>
                {declarationAgreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.declarationCheckText}>{t('sellerReg.declarationAgree')} <Text style={styles.required}>*</Text></Text>
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!declarationAgreed || loading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!declarationAgreed || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{t('sellerReg.submitBtn')}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>{t('sellerReg.footerNote')}</Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navBackText: { fontSize: 28, color: '#101828', fontWeight: '300' },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },
  scrollContent: { paddingBottom: 40 },

  headerWrap: { backgroundColor: '#fff', padding: 24, alignItems: 'center', gap: 6, marginBottom: 8 },
  headerIcon: { width: 40, height: 40, tintColor: '#FF6900', resizeMode: 'contain' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#101828' },
  headerSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  section: { backgroundColor: '#fff', padding: 20, marginBottom: 8, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 4 },
  required: { color: '#EF4444' },
  hint: { fontSize: 12, color: '#9CA3AF' },

  input: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#101828', borderWidth: 1, borderColor: '#E5E7EB' },

  avatarPicker: { alignSelf: 'center' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  avatarPlaceholderIcon: { width: 24, height: 24, tintColor: '#9CA3AF', resizeMode: 'contain' },
  avatarPlaceholderText: { fontSize: 11, color: '#9CA3AF' },

  chipRow: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  contactTypeRow: { flexDirection: 'row', gap: 8 },
  contactTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  contactTypeBtnActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  contactTypeBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  contactTypeBtnTextActive: { color: '#fff' },

  payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  payBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  payBtnText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  payBtnTextActive: { color: '#3B82F6', fontWeight: '700' },

  declarationBox: { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  declarationTitle: { fontSize: 15, fontWeight: '700', color: '#101828' },
  declarationText: { fontSize: 13, color: '#374151', lineHeight: 22 },
  declarationCheck: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  declarationCheckText: { fontSize: 14, color: '#374151', flex: 1 },

  submitBtn: { marginHorizontal: 16, backgroundColor: '#FF6900', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  submitBtnDisabled: { backgroundColor: '#FED7B0', opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  footerNote: { textAlign: 'center', fontSize: 13, color: '#9CA3AF' },

  // Success screen
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  successIcon: { fontSize: 72 },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#101828' },
  successSub: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 26 },
  successBtnPrimary: { backgroundColor: '#FF6900', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', width: '100%', marginTop: 8 },
  successBtnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  successBtnSecondary: { paddingVertical: 12, alignItems: 'center' },
  successBtnSecondaryText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
});
