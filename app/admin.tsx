import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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

// Convert i18n language code to a JS Intl locale string for date formatting.
const localeFor = (lang: string): string =>
  lang === 'en' ? 'en-US' :
  lang === 'ja' ? 'ja-JP' :
  lang === 'zh-CN' ? 'zh-CN' :
  'zh-HK';

// ── Types ─────────────────────────────────────────────────────────────────────

type MerchantApplication = {
  id: string;
  user_id: string;
  display_name: string | null;
  shop_name_zh: string | null;
  shop_name_en: string | null;
  district: string | null;
  shop_description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  has_physical_store: boolean;
  address: string | null;
  business_hours: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  payment_methods: string[];
  br_number: string | null;
  br_document_url: string | null;
  status: 'pending' | 'active' | 'rejected';
  created_at: string;
  profiles?: { username: string | null; avatar_url: string | null };
};

type Tab = 'pending' | 'active' | 'rejected' | 'admins';

type AdminUser = {
  user_id: string;
  created_at: string;
  profiles?: { username: string | null; avatar_url: string | null };
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);

  const [isAdmin, setIsAdmin]         = useState<boolean | null>(null);
  // Track super_admin separately — only super_admin can demote certified
  // merchants. Regular admins see the active list but no demote button.
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tab, setTab]                 = useState<Tab>('pending');
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [loading, setLoading]         = useState(true);
  const [processing, setProcessing]   = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);

  // Admin accounts tab
  const [adminUsers, setAdminUsers]   = useState<AdminUser[]>([]);
  const [adminEmail, setAdminEmail]   = useState('');
  const [adminSearching, setAdminSearching] = useState(false);
  const [myUserId, setMyUserId]       = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    checkAdminAndLoad();
  }, [tab]));

  const checkAdminAndLoad = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login' as any); return; }

    // Accept both 'admin' and 'super_admin' — both can access the admin panel
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (!roleRow) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    setIsSuperAdmin(roleRow.role === 'super_admin');
    setMyUserId(user.id);
    if (tab === 'admins') {
      await loadAdmins();
    } else {
      await loadApplications();
    }
  };

  const loadApplications = async () => {
    // Use SECURITY DEFINER RPC — RLS on merchant_profiles blocks admins from
    // reading other users' pending/rejected rows directly.
    const { data, error } = await supabase
      .rpc('admin_list_merchant_applications', { p_status: tab });

    if (error) {
      if (__DEV__) console.error('[admin] list_applications error:', error.message);
    } else if (data) {
      // RPC returns flat shape; transform to MerchantApplication with nested profiles
      const rows: MerchantApplication[] = (data as any[]).map(r => ({
        id:                r.id,
        user_id:           r.user_id,
        display_name:      r.display_name ?? null,
        shop_name_zh:      r.shop_name_zh ?? null,
        shop_name_en:      r.shop_name_en ?? null,
        district:          r.district ?? null,
        shop_description:  r.shop_description ?? null,
        logo_url:          r.logo_url ?? null,
        banner_url:        r.banner_url ?? null,
        has_physical_store: !!r.has_physical_store,
        address:           r.address ?? null,
        business_hours:    r.business_hours ?? null,
        whatsapp:          r.whatsapp ?? null,
        website:           r.website ?? null,
        instagram:         r.instagram ?? null,
        payment_methods:   r.payment_methods ?? [],
        br_number:         r.br_number ?? null,
        br_document_url:   r.br_document_url ?? null,
        status:            r.status,
        created_at:        r.created_at,
        profiles:          { username: r.username ?? null, avatar_url: r.avatar_url ?? null },
      }));
      setApplications(rows);
    }
    setLoading(false);
  };

  const loadAdmins = async () => {
    // Use SECURITY DEFINER RPC — fetches admins + profile join in one call,
    // bypasses the user_roles RLS that restricts cross-user SELECT.
    const { data, error } = await supabase.rpc('admin_list_admins');
    if (!error && data) {
      // Map RPC return shape → AdminUser
      const rows: AdminUser[] = (data as any[]).map(r => ({
        user_id:    r.user_id,
        created_at: r.granted_at,
        profiles: { username: r.username ?? null, avatar_url: r.avatar_url ?? null },
      }));
      setAdminUsers(rows);
    } else if (error) {
      if (__DEV__) console.error('[admin] list_admins error:', error.message);
    }
    setLoading(false);
  };

  const addAdmin = async () => {
    const email = adminEmail.trim().toLowerCase();
    if (!email) return;
    setAdminSearching(true);
    try {
      // 1. Look up user by email via SECURITY DEFINER RPC
      //    (profiles table has no email column; emails live in auth.users)
      const { data: found, error: lookupErr } = await supabase
        .rpc('admin_find_user_by_email', { p_email: email });
      if (lookupErr) {
        Alert.alert(t('admin.error'), lookupErr.message);
        setAdminSearching(false);
        return;
      }
      const target = (found as any[])?.[0];
      if (!target) {
        Alert.alert(t('admin.userNotFound'), t('admin.userNotFoundMsg', { email }));
        setAdminSearching(false);
        return;
      }
      const targetId       = target.user_id as string;
      const targetUsername = target.username ?? email;
      const currentRole    = target.role_name as string;

      // Already admin?
      if (currentRole === 'admin' || adminUsers.some(a => a.user_id === targetId)) {
        Alert.alert(t('admin.alreadyAdmin'), t('admin.alreadyAdminMsg', { name: targetUsername }));
        setAdminSearching(false);
        return;
      }

      Alert.alert(
        t('admin.confirmAddTitle'),
        t('admin.confirmAddMsg', { name: targetUsername }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            onPress: async () => {
              const { error } = await supabase.rpc('admin_grant_admin', { p_user_id: targetId });
              if (error) {
                Alert.alert(t('admin.error'), error.message);
              } else {
                Alert.alert(t('admin.successAdd'), t('admin.successAddMsg', { name: targetUsername }));
                setAdminEmail('');
                await loadAdmins();
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(t('admin.error'), err.message ?? t('admin.actionFailed'));
    }
    setAdminSearching(false);
  };

  const removeAdmin = async (admin: AdminUser) => {
    if (admin.user_id === myUserId) {
      Alert.alert(t('admin.cantRemoveSelf'), t('admin.cantRemoveSelfMsg'));
      return;
    }
    const username = (admin.profiles as any)?.username ?? t('admin.unknownUser');
    Alert.alert(
      t('admin.confirmRemoveTitle'),
      t('admin.confirmRemoveMsg', { name: username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.remove'),
          style: 'destructive',
          onPress: async () => {
            setProcessing(admin.user_id);
            const { error } = await supabase.rpc('admin_revoke_admin', { p_user_id: admin.user_id });
            if (error) {
              Alert.alert(t('admin.error'), error.message);
            } else {
              setAdminUsers(prev => prev.filter(a => a.user_id !== admin.user_id));
            }
            setProcessing(null);
          },
        },
      ]
    );
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const approve = async (app: MerchantApplication) => {
    const shopName = app.display_name ?? app.shop_name_en ?? app.shop_name_zh ?? '';
    Alert.alert(
      t('admin.confirmApproveTitle'),
      t('admin.confirmApproveMsg', { name: shopName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.approve'),
          onPress: async () => {
            setProcessing(app.id);
            // Single SECURITY DEFINER RPC handles both merchant_profiles + user_roles atomically
            const { error } = await supabase.rpc('admin_approve_merchant', { p_merchant_id: app.id });
            if (error) {
              Alert.alert(t('admin.error'), error.message);
            } else {
              Alert.alert(t('admin.approved'), t('admin.approvedMsg', { name: shopName }));
              setApplications(prev => prev.filter(a => a.id !== app.id));
            }
            setProcessing(null);
          },
        },
      ]
    );
  };

  /**
   * Demote (super_admin only): strip a certified merchant of their status.
   * Two-step Alert confirm so a misclick doesn't kick out a legit shop.
   */
  const demote = (app: MerchantApplication) => {
    const shopName = app.shop_name_zh || app.shop_name_en || app.display_name || app.profiles?.username || '商家';
    Alert.alert(
      t('admin.confirmDemoteTitle'),
      t('admin.confirmDemoteMsg', { name: shopName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.demote'),
          style: 'destructive',
          onPress: async () => {
            setProcessing(app.id);
            const { error } = await supabase.rpc('admin_demote_merchant', { p_user_id: app.user_id });
            if (error) {
              Alert.alert(t('admin.error'), error.message);
            } else {
              Alert.alert(t('admin.demoted'), t('admin.demotedMsg', { name: shopName }));
              setApplications(prev => prev.filter(a => a.id !== app.id));
            }
            setProcessing(null);
          },
        },
      ],
    );
  };

  const reject = async (app: MerchantApplication) => {
    if (!rejectReason.trim()) {
      Alert.alert(t('admin.rejectReasonRequired'));
      return;
    }
    setProcessing(app.id);
    const { error } = await supabase.rpc('admin_reject_merchant', {
      p_merchant_id: app.id,
      p_reason:      rejectReason.trim(),
    });
    if (error) {
      Alert.alert(t('admin.error'), error.message);
    } else {
      Alert.alert(t('admin.rejected'), t('admin.rejectedMsg'));
      setRejectTarget(null);
      setRejectReason('');
      setApplications(prev => prev.filter(a => a.id !== app.id));
    }
    setProcessing(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isAdmin === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.accessDenied}>⛔ {t('admin.noAccess')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderCard = (app: MerchantApplication) => {
    const isExpanded   = expanded === app.id;
    const isProcessing = processing === app.id;
    const isRejectMode = rejectTarget === app.id;
    const username     = (app.profiles as any)?.username ?? t('admin.unknownUser');
    const shopName     = app.shop_name_zh || app.shop_name_en || app.display_name || t('admin.unnamedShop');
    const date         = new Date(app.created_at).toLocaleDateString(locale);

    return (
      <View key={app.id} style={styles.card}>
        {/* Header */}
        <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(isExpanded ? null : app.id)} activeOpacity={0.8}>
          <View style={styles.cardHeaderLeft}>
            {app.logo_url
              ? <Image source={{ uri: app.logo_url }} style={styles.logo} />
              : <View style={[styles.logo, styles.logoPlaceholder]}><Text style={styles.logoPlaceholderText}>{shopName.charAt(0)}</Text></View>
            }
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.meta}>@{username} · {date}</Text>
              {app.district && <Text style={styles.meta}>{app.district}</Text>}
            </View>
          </View>
          <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.details}>
            {app.shop_name_zh && <DetailRow label={t('admin.shopNameZh')} value={app.shop_name_zh} />}
            {app.shop_name_en && <DetailRow label={t('admin.shopNameEn')} value={app.shop_name_en} />}
            {app.shop_description && <DetailRow label={t('admin.description')} value={app.shop_description} />}
            {app.br_number && <DetailRow label={t('admin.brNumber')} value={app.br_number} />}
            {app.has_physical_store && app.address && <DetailRow label={t('admin.address')} value={app.address} />}
            {app.business_hours && <DetailRow label={t('admin.businessHours')} value={app.business_hours} />}
            {app.whatsapp && (
              <TouchableOpacity onPress={() => {
                // Strip everything except digits and leading '+' before building the URL
                const digits = app.whatsapp!.replace(/[^\d+]/g, '');
                Linking.openURL(`https://wa.me/${digits}`);
              }}>
                <DetailRow label="WhatsApp" value={app.whatsapp!} highlight />
              </TouchableOpacity>
            )}
            {app.website && (
              <TouchableOpacity onPress={() => Linking.openURL(app.website!)}>
                <DetailRow label={t('admin.website')} value={app.website!} highlight />
              </TouchableOpacity>
            )}
            {app.instagram && <DetailRow label="Instagram" value={`@${app.instagram}`} />}
            {app.payment_methods?.length > 0 && <DetailRow label={t('admin.paymentMethods')} value={app.payment_methods.join(', ')} />}

            {/* BR Document */}
            {app.br_document_url && (
              <TouchableOpacity style={styles.brBtn} onPress={() => Linking.openURL(app.br_document_url!)}>
                <Text style={styles.brBtnText}>{t('admin.viewBrDocument')}</Text>
              </TouchableOpacity>
            )}

            {/* Banner */}
            {app.banner_url && (
              <Image source={{ uri: app.banner_url }} style={styles.banner} resizeMode="cover" />
            )}
          </View>
        )}

        {/* Active tab — super_admin can demote (strip certified merchant) */}
        {tab === 'active' && isSuperAdmin && (
          <View style={styles.actions}>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.rejectBtn, { flex: 1 }]}
                onPress={() => demote(app)}
                disabled={isProcessing}
              >
                {isProcessing
                  ? <ActivityIndicator color="#E7000B" size="small" />
                  : <Text style={styles.rejectBtnText}>{t('admin.demote')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions — only for pending */}
        {tab === 'pending' && (
          <View style={styles.actions}>
            {isRejectMode ? (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectLabel}>{t('admin.rejectReason')}</Text>
                <TextInput
                  style={styles.rejectInput}
                  placeholder={t('admin.rejectReasonPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                />
                <View style={styles.rejectRow}>
                  <TouchableOpacity style={styles.cancelRejectBtn} onPress={() => { setRejectTarget(null); setRejectReason(''); }}>
                    <Text style={styles.cancelRejectText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmRejectBtn} onPress={() => reject(app)} disabled={isProcessing}>
                    {isProcessing
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmRejectText}>{t('admin.confirmReject')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => setRejectTarget(app.id)}
                  disabled={isProcessing}
                >
                  <Text style={styles.rejectBtnText}>{t('admin.reject')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approve(app)}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.approveBtnText}>{t('admin.approve')}</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('admin.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs — useFocusEffect with `tab` dep already triggers loadAdmins/loadApplications. */}
      <View style={styles.tabs}>
        {(['pending', 'active', 'rejected', 'admins'] as Tab[]).map(tabKey => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tabBtn, tab === tabKey && styles.tabBtnActive]}
            onPress={() => { setTab(tabKey); setExpanded(null); }}
          >
            <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
              {tabKey === 'pending' ? t('admin.pending')
                : tabKey === 'active' ? t('admin.active')
                : tabKey === 'rejected' ? t('admin.rejected')
                : t('admin.admins')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}><Loader size="large" /></View>
      ) : tab === 'admins' ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* Add admin input */}
          <View style={styles.addAdminBox}>
            <Text style={styles.addAdminTitle}>{t('admin.addAdmin')}</Text>
            <View style={styles.addAdminRow}>
              <TextInput
                style={styles.addAdminInput}
                placeholder={t('admin.addAdminPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={adminEmail}
                onChangeText={setAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.addAdminBtn}
                onPress={addAdmin}
                disabled={adminSearching || !adminEmail.trim()}
              >
                {adminSearching
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.addAdminBtnText}>{t('admin.add')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Current admins list */}
          <Text style={styles.adminListTitle}>{t('admin.currentAdmins', { count: adminUsers.length })}</Text>
          {adminUsers.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin.noAdmins')}</Text>
          ) : adminUsers.map(admin => {
            const username = (admin.profiles as any)?.username ?? t('admin.unknownUser');
            const avatar   = (admin.profiles as any)?.avatar_url;
            const isMe     = admin.user_id === myUserId;
            const isRemoving = processing === admin.user_id;
            return (
              <View key={admin.user_id} style={styles.adminCard}>
                {avatar
                  ? <Image source={{ uri: avatar }} style={styles.adminAvatar} />
                  : <View style={[styles.adminAvatar, styles.adminAvatarPlaceholder]}>
                      <Text style={styles.adminAvatarText}>{username.charAt(0).toUpperCase()}</Text>
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminName}>
                    {username}{isMe ? t('admin.youSuffix') : ''}
                  </Text>
                  <Text style={styles.adminDate}>
                    {t('admin.becameAdminOn', { date: new Date(admin.created_at).toLocaleDateString(locale) })}
                  </Text>
                </View>
                {!isMe && (
                  <TouchableOpacity
                    style={styles.removeAdminBtn}
                    onPress={() => removeAdmin(admin)}
                    disabled={isRemoving}
                  >
                    {isRemoving
                      ? <ActivityIndicator color="#DC2626" size="small" />
                      : <Text style={styles.removeAdminText}>{t('admin.remove')}</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : applications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {tab === 'pending' ? t('admin.noPending')
              : tab === 'active' ? t('admin.noApproved')
              : t('admin.noRejected')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {applications.map(renderCard)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: '#FF6900' }]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#F9FAFB' },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },

  // Nav
  nav:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  navBack:           { width: 40, alignItems: 'flex-start' },
  navBackText:       { fontSize: 28, color: '#FF6900', lineHeight: 32 },
  navTitle:          { fontSize: 16, fontWeight: '700', color: '#101828' },

  // Tabs
  tabs:              { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBtn:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive:      { borderBottomWidth: 2, borderBottomColor: '#FF6900' },
  tabText:           { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  tabTextActive:     { color: '#FF6900', fontWeight: '700' },

  // List
  list:              { padding: 16, gap: 12 },

  // Card
  card:              { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  cardHeaderLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logo:              { width: 48, height: 48, borderRadius: 12 },
  logoPlaceholder:   { backgroundColor: '#FF6900', alignItems: 'center', justifyContent: 'center' },
  logoPlaceholderText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  shopName:          { fontSize: 15, fontWeight: '700', color: '#101828' },
  meta:              { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  chevron:           { fontSize: 12, color: '#9CA3AF', marginLeft: 8 },

  // Details
  details:           { paddingHorizontal: 14, paddingBottom: 14, gap: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  detailRow:         { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  detailLabel:       { width: 72, fontSize: 12, color: '#9CA3AF', fontWeight: '500', paddingTop: 1 },
  detailValue:       { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  brBtn:             { backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 6 },
  brBtnText:         { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  banner:            { width: '100%', height: 100, borderRadius: 8, marginTop: 8 },

  // Actions
  actions:           { padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  btnRow:            { flexDirection: 'row', gap: 10 },
  approveBtn:        { flex: 1, backgroundColor: '#FF6900', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveBtnText:    { fontSize: 14, fontWeight: '700', color: '#fff' },
  rejectBtn:         { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  rejectBtnText:     { fontSize: 14, fontWeight: '700', color: '#DC2626' },

  // Reject box
  rejectBox:         { gap: 8 },
  rejectLabel:       { fontSize: 13, fontWeight: '600', color: '#374151' },
  rejectInput:       { backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, fontSize: 13, color: '#101828', minHeight: 72, textAlignVertical: 'top' },
  rejectRow:         { flexDirection: 'row', gap: 8 },
  cancelRejectBtn:   { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  cancelRejectText:  { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  confirmRejectBtn:  { flex: 1, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  confirmRejectText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Access denied
  accessDenied:      { fontSize: 18, fontWeight: '700', color: '#374151' },
  backBtn:           { backgroundColor: '#FF6900', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  backBtnText:       { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Empty
  emptyText:         { fontSize: 15, color: '#9CA3AF', fontWeight: '500', textAlign: 'center', paddingVertical: 20 },

  // Admin accounts tab
  addAdminBox:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  addAdminTitle:     { fontSize: 14, fontWeight: '700', color: '#101828' },
  addAdminRow:       { flexDirection: 'row', gap: 8 },
  addAdminInput:     { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#101828' },
  addAdminBtn:       { backgroundColor: '#FF6900', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  addAdminBtnText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  adminListTitle:    { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  adminCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  adminAvatar:       { width: 44, height: 44, borderRadius: 22 },
  adminAvatarPlaceholder: { backgroundColor: '#FF6900', alignItems: 'center', justifyContent: 'center' },
  adminAvatarText:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  adminName:         { fontSize: 15, fontWeight: '600', color: '#101828' },
  adminDate:         { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  removeAdminBtn:    { backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#FECACA' },
  removeAdminText:   { fontSize: 13, fontWeight: '600', color: '#DC2626' },
});
