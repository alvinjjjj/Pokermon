// Phase B.5 lite · Reservation management screen.
// Role-aware: certified merchants get a segmented Incoming/Outgoing control;
// other users see their own outgoing reservations only. Actions per row are
// gated by status + role to match the RLS policies on
// merchant_buy_reservations.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import { PSAGradeBadge, normalizeGrade } from '../components/PSAGradeBadge';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

type ReservationStatus = 'pending' | 'honored' | 'rejected' | 'expired' | 'cancelled';

type Reservation = {
  id:               string;
  buy_order_id:     string;
  buyer_id:         string;
  merchant_id:      string;
  card_id:          string;
  card_name:        string;
  reserved_price:   number;
  conditions:       string[];
  status:           ReservationStatus;
  expires_at:       string;
  honored_at:       string | null;
  rejected_at:      string | null;
  rejection_reason: string | null;
  buyer_note:       string | null;
  created_at:       string;
  other_party_name?: string;
};

type Mode = 'incoming' | 'outgoing';

export default function MyReservationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  const [userId,       setUserId]       = useState<string | null>(null);
  const [isMerchant,   setIsMerchant]   = useState(false);
  const [mode,         setMode]         = useState<Mode>('outgoing');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  // Reject reason modal
  const [rejectTarget, setRejectTarget] = useState<Reservation | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Role + identity detection. Runs once per focus; the result toggles the
  // segmented control. Merchants default to 'incoming' (the actionable
  // queue); buyers stay on 'outgoing'.
  const detectRole = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) { setUserId(null); setIsMerchant(false); return null; }
    setUserId(user.id);
    const { data: mp } = await supabase
      .from('merchant_profiles')
      .select('seller_type')
      .eq('user_id', user.id)
      .maybeSingle();
    const merchant = mp?.seller_type === 'certified_merchant';
    setIsMerchant(merchant);
    return { userId: user.id, isMerchant: merchant };
  }, []);

  // Fetch reservations + enrich with other-party display name. 2-step query
  // matches the B.3 pattern (avoid Supabase implicit-relation joins). The
  // 'other party' is whoever the current user ISN'T — buyer when we're the
  // merchant, merchant when we're the buyer.
  const fetchReservations = useCallback(async (uid: string, m: Mode) => {
    setLoading(true);
    try {
      const column = m === 'incoming' ? 'merchant_id' : 'buyer_id';
      const { data, error } = await supabase
        .from('merchant_buy_reservations')
        .select('*')
        .eq(column, uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error || !data) { setReservations([]); return; }
      const rows = data as Reservation[];
      if (rows.length === 0) { setReservations([]); return; }
      // 2-step name enrichment. NOTE: merchant_profiles.user_id is the FK
      // to auth.users — NOT merchant_profiles.id (which is the row PK).
      // Existing convention across the codebase (settings.tsx, shops.tsx,
      // edit-shop.tsx) all key on user_id.
      const otherIds = Array.from(new Set(
        rows.map(r => m === 'incoming' ? r.buyer_id : r.merchant_id),
      ));
      const { data: profs } = await supabase
        .from('merchant_profiles')
        .select('user_id, display_name, shop_name_zh, shop_name_en')
        .in('user_id', otherIds);
      const nameMap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => {
        nameMap.set(
          p.user_id,
          p.shop_name_zh || p.shop_name_en || p.display_name || t('cardDetail.buyOffers.fallbackMerchant'),
        );
      });
      const enriched = rows.map(r => ({
        ...r,
        other_party_name:
          nameMap.get(m === 'incoming' ? r.buyer_id : r.merchant_id)
          ?? t('cardDetail.buyOffers.fallbackMerchant'),
      }));
      setReservations(enriched);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Refresh whenever the screen comes into focus. Two-stage because we need
  // to detect role first (which decides default mode for first load).
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const ctx = await detectRole();
      if (cancelled || !ctx) return;
      // Default merchants to 'incoming' on first load only; preserve any
      // existing mode the user already picked.
      if (ctx.isMerchant && mode === 'outgoing' && reservations.length === 0) {
        setMode('incoming');
        await fetchReservations(ctx.userId, 'incoming');
      } else {
        await fetchReservations(ctx.userId, mode);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectRole, mode]));

  const switchMode = (next: Mode) => {
    if (next === mode || !userId) return;
    setMode(next);
    fetchReservations(userId, next);
  };

  // ── Action handlers ─────────────────────────────────────────────────
  const handleHonor = async (r: Reservation) => {
    if (actionInFlight) return;
    setActionInFlight(r.id);
    try {
      const { error } = await supabase
        .from('merchant_buy_reservations')
        .update({ status: 'honored', honored_at: new Date().toISOString() })
        .eq('id', r.id);
      if (error) { alert(t('myReservations.actionFailed')); return; }
      if (userId) await fetchReservations(userId, mode);
    } finally {
      setActionInFlight(null);
    }
  };

  const openRejectModal = (r: Reservation) => {
    setRejectTarget(r);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectTarget || actionInFlight) return;
    setActionInFlight(rejectTarget.id);
    try {
      const { error } = await supabase
        .from('merchant_buy_reservations')
        .update({
          status:           'rejected',
          rejected_at:      new Date().toISOString(),
          rejection_reason: rejectReason.trim() || null,
        })
        .eq('id', rejectTarget.id);
      if (error) { alert(t('myReservations.actionFailed')); return; }
      setRejectTarget(null);
      setRejectReason('');
      if (userId) await fetchReservations(userId, mode);
    } finally {
      setActionInFlight(null);
    }
  };

  const handleCancel = async (r: Reservation) => {
    if (actionInFlight) return;
    setActionInFlight(r.id);
    try {
      const { error } = await supabase
        .from('merchant_buy_reservations')
        .update({ status: 'cancelled' })
        .eq('id', r.id);
      if (error) { alert(t('myReservations.actionFailed')); return; }
      if (userId) await fetchReservations(userId, mode);
    } finally {
      setActionInFlight(null);
    }
  };

  // ── Status pill style picker ────────────────────────────────────────
  const statusStyle = (s: ReservationStatus) => {
    switch (s) {
      case 'pending':   return styles.statusBadgePending;
      case 'honored':   return styles.statusBadgeHonored;
      case 'rejected':  return styles.statusBadgeRejected;
      case 'expired':   return styles.statusBadgeExpired;
      case 'cancelled': return styles.statusBadgeCancelled;
    }
  };
  const statusTextStyle = (s: ReservationStatus) => {
    switch (s) {
      case 'pending':   return styles.statusTextPending;
      case 'honored':   return styles.statusTextHonored;
      case 'rejected':  return styles.statusTextRejected;
      case 'expired':   return styles.statusTextMuted;
      case 'cancelled': return styles.statusTextMuted;
    }
  };
  const statusLabel = (s: ReservationStatus) => t(`myReservations.status${s.charAt(0).toUpperCase() + s.slice(1)}`);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myReservations.screenTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segmented control — merchants only */}
      {isMerchant && (
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, mode === 'incoming' && styles.segmentActive]}
            onPress={() => switchMode('incoming')}
          >
            <Text style={[styles.segmentText, mode === 'incoming' && styles.segmentTextActive]}>
              {t('myReservations.tabIncoming')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, mode === 'outgoing' && styles.segmentActive]}
            onPress={() => switchMode('outgoing')}
          >
            <Text style={[styles.segmentText, mode === 'outgoing' && styles.segmentTextActive]}>
              {t('myReservations.tabOutgoing')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.listLoading}>
          <ActivityIndicator size="large" color={colors.brand.orange} />
        </View>
      ) : reservations.length === 0 ? (
        <View style={styles.listEmpty}>
          <Text style={styles.listEmptyText}>
            {mode === 'incoming'
              ? t('myReservations.emptyIncoming')
              : t('myReservations.emptyOutgoing')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {reservations.map(r => {
            // Phase B hardening (C-3): a row stored as 'pending' but past its
            // 24hr expires_at is functionally expired — no cron has flipped
            // the DB row yet, but the SLA contract is broken. Render as
            // 'expired' + hide pending actions. Server stays authoritative;
            // we never trust the client's flip — if the user beats the cron
            // and tries to honor/cancel, the action handler still hits the
            // DB and lets RLS / triggers decide.
            const isExpiredPending = r.status === 'pending'
              && Date.now() > new Date(r.expires_at).getTime();
            const effectiveStatus: ReservationStatus = isExpiredPending ? 'expired' : r.status;
            const showPendingActions = r.status === 'pending' && !isExpiredPending;
            const partyLabel = mode === 'incoming'
              ? t('myReservations.buyerLabel')
              : t('myReservations.merchantLabel');
            return (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowCardName} numberOfLines={1}>{r.card_name}</Text>
                  <View style={[styles.statusBadge, statusStyle(effectiveStatus)]}>
                    <Text style={[styles.statusBadgeText, statusTextStyle(effectiveStatus)]}>
                      {statusLabel(effectiveStatus)}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowMeta}>
                  <View style={styles.rowParty}>
                    <Text style={styles.rowPartyLabel}>{partyLabel}</Text>
                    <Text style={styles.rowPartyName} numberOfLines={1}>{r.other_party_name}</Text>
                  </View>
                  <Text style={styles.rowPrice}>
                    HK${r.reserved_price.toLocaleString()}
                  </Text>
                </View>

                {r.conditions.length > 0 && (
                  <View style={styles.rowConditions}>
                    {r.conditions.map(c => {
                      const norm = normalizeGrade(c);
                      const looksGraded = /^(raw|psa\s*9|psa\s*10)$/i.test(c.trim());
                      if (looksGraded && (norm === '10' || norm === '9' || norm === 'raw')) {
                        return (
                          <View key={c} style={{ marginRight: 0 }}>
                            <PSAGradeBadge grade={norm} size="sm" />
                          </View>
                        );
                      }
                      return (
                        <View key={c} style={styles.conditionChip}>
                          <Text style={styles.conditionChipText}>{c}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {r.buyer_note ? (
                  <Text style={styles.rowNote} numberOfLines={2}>{r.buyer_note}</Text>
                ) : null}

                {/* Closed-state metadata */}
                {r.status === 'honored' && r.honored_at && (
                  <Text style={styles.rowMetaMuted}>
                    {new Date(r.honored_at).toLocaleString()}
                  </Text>
                )}
                {r.status === 'rejected' && r.rejection_reason && (
                  <Text style={styles.rowMetaMuted} numberOfLines={2}>
                    {r.rejection_reason}
                  </Text>
                )}

                {/* Actions — role + status gated. showPendingActions
                    intentionally NOT just `r.status === 'pending'` so
                    expired-pending rows hide the buttons (see C-3 fix
                    above). */}
                {showPendingActions && mode === 'incoming' && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonHonor, actionInFlight === r.id && styles.actionButtonDisabled]}
                      onPress={() => handleHonor(r)}
                      disabled={actionInFlight === r.id}
                    >
                      <Text style={styles.actionButtonHonorText}>
                        {t('myReservations.honorButton')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonReject, actionInFlight === r.id && styles.actionButtonDisabled]}
                      onPress={() => openRejectModal(r)}
                      disabled={actionInFlight === r.id}
                    >
                      <Text style={styles.actionButtonRejectText}>
                        {t('myReservations.rejectButton')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {showPendingActions && mode === 'outgoing' && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonCancel, actionInFlight === r.id && styles.actionButtonDisabled]}
                      onPress={() => handleCancel(r)}
                      disabled={actionInFlight === r.id}
                    >
                      <Text style={styles.actionButtonCancelText}>
                        {t('myReservations.cancelButton')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Reject reason modal */}
      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="slide"
        onRequestClose={() => { setRejectTarget(null); setRejectReason(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.rejectModalBackdrop}
        >
          <View style={styles.rejectModalSheet}>
            <Text style={styles.rejectModalTitle}>
              {t('myReservations.rejectTitle')}
            </Text>
            <Text style={styles.rejectModalHint}>
              {t('myReservations.rejectHint')}
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t('myReservations.rejectReasonPlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              style={styles.rejectModalReasonInput}
              multiline
              maxLength={200}
            />
            <TouchableOpacity
              onPress={confirmReject}
              disabled={!!actionInFlight}
              style={[styles.rejectModalConfirm, !!actionInFlight && styles.actionButtonDisabled]}
            >
              <Text style={styles.rejectModalConfirmText}>
                {t('myReservations.rejectConfirm')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRejectTarget(null); setRejectReason(''); }}>
              <Text style={styles.rejectModalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface.card },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: colors.surface.section,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backText:    { fontSize: 28, color: colors.brand.orange, lineHeight: 32 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },

    segmentedControl: {
      flexDirection: 'row',
      borderBottomWidth: 1, borderBottomColor: colors.surface.section,
    },
    segmentButton: {
      flex: 1, paddingVertical: 12, alignItems: 'center',
      borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    segmentActive:     { borderBottomColor: colors.brand.orange },
    segmentText:       { fontSize: 14, color: colors.text.secondary, fontWeight: '600' },
    segmentTextActive: { color: colors.brand.orange, fontWeight: '700' },

    listLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listEmpty:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    listEmptyText: { fontSize: 14, color: colors.text.tertiary, textAlign: 'center' },
    listContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },

    row: {
      backgroundColor: colors.surface.card,
      borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: colors.border.default,
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowCardName: {
      fontSize: 15, fontWeight: '700', color: colors.text.primary,
      flex: 1, marginRight: 8,
    },

    rowMeta: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
      marginTop: 10,
    },
    rowParty:      { flex: 1, marginRight: 12 },
    rowPartyLabel: { fontSize: 11, color: colors.text.tertiary, fontWeight: '500' },
    rowPartyName:  { fontSize: 13, color: colors.text.primary, fontWeight: '600', marginTop: 2 },
    rowPrice:      { fontSize: 16, fontWeight: '800', color: colors.brand.orange },

    rowConditions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    conditionChip: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
      borderWidth: 1, borderColor: colors.text.primary,
    },
    conditionChipText: {
      fontSize: 10, fontWeight: '600', color: colors.text.primary, letterSpacing: 0.3,
      textTransform: 'uppercase',
    },

    // Status badges — outline-only per §A.3 reading; semantic color comes
    // from the text + border (no fill). Tokens: state.info / state.upStrong
    // / state.down / text.mute. Mute-state for expired/cancelled keeps
    // them visually settled (low priority).
    statusBadge: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
      borderWidth: 1,
    },
    statusBadgePending:   { borderColor: colors.state.info },
    statusBadgeHonored:   { borderColor: colors.state.upStrong },
    statusBadgeRejected:  { borderColor: colors.state.down },
    statusBadgeExpired:   { borderColor: colors.text.mute },
    statusBadgeCancelled: { borderColor: colors.text.mute },
    statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
    statusTextPending:  { color: colors.state.info },
    statusTextHonored:  { color: colors.state.upStrong },
    statusTextRejected: { color: colors.state.down },
    statusTextMuted:    { color: colors.text.tertiary },

    rowNote: {
      fontSize: 12, color: colors.text.secondary, marginTop: 8,
      fontStyle: 'italic',
    },
    rowMetaMuted: { fontSize: 11, color: colors.text.tertiary, marginTop: 6 },

    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionButton: {
      flex: 1, paddingVertical: 10, borderRadius: 8,
      alignItems: 'center', borderWidth: 1,
    },
    actionButtonDisabled: { opacity: 0.5 },
    actionButtonHonor:  { borderColor: colors.state.upStrong, backgroundColor: 'transparent' },
    actionButtonReject: { borderColor: colors.state.down, backgroundColor: 'transparent' },
    actionButtonCancel: { borderColor: colors.text.mute, backgroundColor: 'transparent' },
    actionButtonHonorText:  { fontSize: 13, fontWeight: '700', color: colors.state.upStrong, letterSpacing: 0.3 },
    actionButtonRejectText: { fontSize: 13, fontWeight: '700', color: colors.state.down, letterSpacing: 0.3 },
    actionButtonCancelText: { fontSize: 13, fontWeight: '700', color: colors.text.tertiary, letterSpacing: 0.3 },

    // ── Reject reason modal ────────────────────────────────────────────
    // 'rgba(0,0,0,0.5)' kept raw — universal modal scrim, theme-independent
    rejectModalBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
    },
    rejectModalSheet: {
      backgroundColor: colors.surface.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28,
    },
    rejectModalTitle: {
      fontSize: 18, fontWeight: '700', color: colors.text.primary,
      marginBottom: 8, textAlign: 'center',
    },
    rejectModalHint: {
      fontSize: 12, color: colors.text.tertiary,
      marginBottom: 14, textAlign: 'center', lineHeight: 16,
    },
    rejectModalReasonInput: {
      minHeight: 80, padding: 12, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border.default,
      backgroundColor: colors.surface.section,
      fontSize: 14, color: colors.text.primary,
      textAlignVertical: 'top',
      marginBottom: 14,
    },
    rejectModalConfirm: {
      paddingVertical: 14, borderRadius: 50, alignItems: 'center',
      backgroundColor: colors.state.down,
    },
    // '#fff' kept raw — always-white on solid danger fill
    rejectModalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    rejectModalCancel: {
      fontSize: 14, color: colors.text.tertiary, textAlign: 'center',
      paddingVertical: 14,
    },
  });
}
