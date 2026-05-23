import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type Profile = {
  username: string | null;
  avatar_url: string | null;
  tos_agreed_at: string | null;
};

type SellerStatus = {
  seller_type: 'individual_seller' | 'certified_merchant';
  status: string;
  display_name: string;
} | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [contactInfo, setContactInfo] = useState<string | null>(null);
  const [seller, setSeller]         = useState<SellerStatus>(null);
  const [loading, setLoading]       = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin]       = useState(false);

  useFocusEffect(useCallback(() => { loadUser(); }, []));

  const loadUser = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    // Phone OTP users have no email — show phone instead so the profile card
    // subtitle is never blank.
    setContactInfo(user.email ?? user.phone ?? null);

    const [profileRes, sellerRes, adminRes] = await Promise.all([
      supabase.from('profiles').select('username, avatar_url, tos_agreed_at').eq('id', user.id).single(),
      supabase.from('merchant_profiles').select('seller_type, status, display_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']).maybeSingle(),
    ]);

    setProfile(profileRes.data ?? null);
    setSeller(sellerRes.data ?? null);
    setIsAdmin(!!adminRes.data);
    setLoading(false);
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.logoutConfirmTitle'), t('settings.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'), style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const [deletingAccount, setDeletingAccount] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [showLangModal, setShowLangModal] = useState(false);
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language);

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccountTitle'),
      t('settings.deleteAccountMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.confirmDelete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings.finalConfirmTitle'),
              t('settings.finalConfirmMsg'),
              [
                { text: t('settings.goBack'), style: 'cancel' },
                { text: t('settings.permanentDelete'), style: 'destructive', onPress: confirmDeleteAccount },
              ]
            );
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t('settings.deleteFailed'));

      await supabase.auth.signOut();
      router.replace('/onboarding');
    } catch (err: any) {
      if (__DEV__) console.error('[DeleteAccount]', err);
      Alert.alert(t('settings.deleteFailed'), err.message ?? t('settings.deleteFailedMsg'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const sellerLabel = seller
    ? seller.seller_type === 'certified_merchant' ? t('settings.certifiedMerchant') : t('settings.individualSeller')
    : null;
  const sellerStatusLabel = seller?.status === 'active' ? t('settings.statusActive') : seller?.status === 'pending' ? t('settings.statusPending') : '';

  const tosDate = profile?.tos_agreed_at
    ? new Date(profile.tos_agreed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.titleSection}>
          <Text style={styles.title}>{t('settings.title')}</Text>
        </View>

        {/* ── 用戶資料 ── */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/edit-profile' as any)}>
          {loading ? (
            <View style={styles.avatar}><ActivityIndicator color="#FF6900" /></View>
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Image source={require('../../assets/icons/profile.png')} style={{ width: 32, height: 32, tintColor: '#9CA3AF' }} />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{loading ? t('settings.loadingName') : (profile?.username ?? t('settings.nameNotSet'))}</Text>
            <Text style={styles.profileEmail}>{contactInfo ?? ''}</Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* ── 帳戶 ── */}
        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <View style={styles.section}>
          <SettingsRow icon={require('../../assets/icons/pen.png')} label={t('settings.editProfile')} onPress={() => router.push('/edit-profile' as any)} />
        </View>

        <View style={styles.divider} />

        {/* ── 語言 ── */}
        <Text style={styles.sectionLabel}>語言 / Language</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={() => setShowLangModal(true)}>
            <View style={styles.rowIconWrap}>
              <Text style={{ fontSize: 22 }}>{currentLang?.flag ?? '🌐'}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowText}>{currentLang?.label ?? '繁體中文'}</Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Language picker modal */}
        <Modal visible={showLangModal} transparent animationType="slide" onRequestClose={() => setShowLangModal(false)}>
          <Pressable style={styles.langOverlay} onPress={() => setShowLangModal(false)}>
            <View style={styles.langSheet}>
              <Text style={styles.langSheetTitle}>語言 / Language</Text>
              {SUPPORTED_LANGUAGES.map((lang, i) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, i < SUPPORTED_LANGUAGES.length - 1 && styles.langOptionBorder]}
                  onPress={() => { setLanguage(lang.code); setShowLangModal(false); }}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>
                    {lang.label}
                  </Text>
                  {language === lang.code && <Text style={styles.langCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.langCancel} onPress={() => setShowLangModal(false)}>
                <Text style={styles.langCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <View style={styles.divider} />

        {/* ── 賣家帳號 ── */}
        <Text style={styles.sectionLabel}>{t('settings.sellerAccount')}</Text>
        <View style={styles.section}>
          {seller ? (
            <>
              <SettingsRow
                icon={require('../../assets/icons/shops.png')}
                label={`${sellerLabel}${sellerStatusLabel ? ` · ${sellerStatusLabel}` : ''}`}
                sub={t('settings.manageListings')}
                onPress={() => router.push('/my-listings' as any)}
              />
              <Sep />
              <SettingsRow
                icon={require('../../assets/icons/pen.png')}
                label={t('settings.editShopProfile')}
                sub={t('settings.editShopProfileSub')}
                onPress={() => router.push('/edit-shop' as any)}
              />
            </>
          ) : (
            <SettingsRow
              icon={require('../../assets/icons/shops.png')}
              label={t('settings.becomeSeller')}
              sub={t('settings.becomeSellerSub')}
              onPress={() => router.push('/(tabs)/shops' as any)}
              labelColor="#FF6900"
            />
          )}
        </View>

        <View style={styles.divider} />

        {/* ── 法律 ── */}
        <Text style={styles.sectionLabel}>{t('settings.legal')}</Text>
        <View style={styles.section}>
          <SettingsRow
            icon={require('../../assets/icons/notification.png')}
            label={t('settings.termsOfService')}
            sub={tosDate ? t('settings.agreedOn', { date: tosDate }) : undefined}
            onPress={() => router.push('/terms' as any)}
          />
          <Sep />
          <SettingsRow icon={require('../../assets/icons/password.png')} label={t('settings.privacyPolicy')} onPress={() => router.push('/privacy' as any)} />
        </View>

        <View style={styles.divider} />

        {/* ── 支援 ── */}
        <Text style={styles.sectionLabel}>{t('settings.support')}</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Image source={require('../../assets/icons/version.png')} style={styles.rowIconImg} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowText}>{t('settings.version')}</Text>
            </View>
            <Text style={styles.versionText}>v{APP_VERSION}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── 管理員 (hidden, only for admins) ── */}
        {isAdmin && (
          <>
            <Text style={styles.sectionLabel}>{t('settings.adminSectionLabel')}</Text>
            <View style={styles.section}>
              <SettingsRow
                icon={require('../../assets/icons/shops.png')}
                label={t('settings.adminPanel')}
                sub={t('settings.adminPanelSub')}
                onPress={() => router.push('/admin' as any)}
                labelColor="#FF6900"
              />
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* ── 帳戶操作 ── */}
        <Text style={styles.sectionLabel}>{t('settings.accountActions')}</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleSignOut} disabled={signingOut}>
            <View style={styles.rowIconWrap}>
              <Image source={require('../../assets/icons/logout.png')} style={[styles.rowIconImg, { tintColor: '#FF6900' }]} />
            </View>
            {signingOut
              ? <ActivityIndicator color="#FF6900" style={{ flex: 1 }} />
              : <Text style={[styles.rowText, styles.logoutText]}>{t('settings.logout')}</Text>
            }
          </TouchableOpacity>
          <Sep />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={deletingAccount}>
            <View style={styles.rowIconWrap}>
              <Image source={require('../../assets/icons/delete.png')} style={[styles.rowIconImg, { tintColor: '#E7000B' }]} />
            </View>
            {deletingAccount
              ? <ActivityIndicator size="small" color="#E7000B" style={{ flex: 1 }} />
              : <Text style={[styles.rowText, styles.deleteText]}>{t('settings.deleteAccount')}</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, sub, onPress, labelColor,
}: {
  icon: ImageSourcePropType; label: string; sub?: string; onPress?: () => void; labelColor?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      {({ pressed }) => (
        <>
          <View style={styles.rowIconWrap}>
            <Image
              source={icon}
              style={[styles.rowIconImg, { tintColor: pressed ? '#FF6900' : '#6B7280' }]}
            />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowText, labelColor ? { color: labelColor, fontWeight: '600' } : {}]}>
              {label}
            </Text>
            {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
          </View>
          {onPress && <Text style={[styles.arrowText, pressed && { color: '#FF6900' }]}>›</Text>}
        </>
      )}
    </Pressable>
  );
}

function Sep() {
  return <View style={styles.separator} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

  titleSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '800', color: '#101828' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 20, backgroundColor: '#fff',
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { fontSize: 32 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 3 },
  profileEmail: { fontSize: 13, color: '#9CA3AF' },

  divider: { height: 8, backgroundColor: '#F3F4F6' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
    backgroundColor: '#fff', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  section: { backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 14 },
  rowPressed: { backgroundColor: '#FFF3E8' },
  rowIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  rowIconImg: { width: 20, height: 20, resizeMode: 'contain' },
  rowBody: { flex: 1 },
  rowText: { fontSize: 16, color: '#101828' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  arrowText: { fontSize: 20, color: '#C7C7CC' },
  versionText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  separator: { height: 0.5, backgroundColor: '#F3F4F6', marginLeft: 58 },
  logoutText: { color: '#FF6900', fontWeight: '600', flex: 1 },
  deleteText: { color: '#E7000B', flex: 1 },
  // Language modal
  langOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  langSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 0 },
  langSheetTitle:  { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', marginBottom: 12 },
  langOption:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14 },
  langOptionBorder:{ borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  langFlag:        { fontSize: 24 },
  langLabel:       { flex: 1, fontSize: 16, color: '#101828' },
  langLabelActive: { color: '#FF6900', fontWeight: '700' },
  langCheck:       { fontSize: 18, color: '#FF6900', fontWeight: '700' },
  langCancel:      { marginTop: 8, marginHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  langCancelText:  { fontSize: 16, color: '#6B7280', fontWeight: '600' },
});
