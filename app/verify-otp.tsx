import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

/**
 * Phone OTP verification.
 *
 * Receives `phone` (E.164 format e.g. "+85291234567") + `type` ('phone_signup')
 * as query params. On successful verifyOtp, Supabase signs the user in and
 * `_layout.tsx`'s auth listener redirects to the tabs.
 */
const OTP_LENGTH      = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function VerifyOtpScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router  = useRouter();
  const { t }   = useTranslation();
  const params  = useLocalSearchParams<{ phone?: string; type?: string }>();

  const phone = (params.phone ?? '').trim();

  const [code, setCode]           = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown]   = useState(RESEND_COOLDOWN);
  const [error, setError]         = useState<string | null>(null);

  const inputs = useRef<Array<TextInput | null>>([]);

  // ─── Resend cooldown timer ──────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Auto-focus first box on mount
  useEffect(() => {
    setTimeout(() => inputs.current[0]?.focus(), 100);
  }, []);

  // ─── Input handling ─────────────────────────────────────────────────────
  const handleChange = (index: number, value: string) => {
    setError(null);

    // Handle paste of full code (e.g. user paste-clipboards "123456")
    const digits = value.replace(/\D/g, '');
    if (digits.length >= OTP_LENGTH) {
      const arr = digits.slice(0, OTP_LENGTH).split('');
      setCode(arr);
      inputs.current[OTP_LENGTH - 1]?.blur();
      setTimeout(() => verify(arr.join('')), 50);
      return;
    }

    const digit = digits.slice(-1);
    const next  = [...code];
    next[index] = digit;
    setCode(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (next.every(d => d.length === 1)) {
      setTimeout(() => verify(next.join('')), 50);
    }
  };

  const handleKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const next = [...code];
      next[index - 1] = '';
      setCode(next);
      inputs.current[index - 1]?.focus();
    }
  };

  // ─── Verify ─────────────────────────────────────────────────────────────
  const verify = async (fullCode?: string) => {
    const token = (fullCode ?? code.join('')).trim();
    if (token.length !== OTP_LENGTH) return;
    if (verifying) return;
    if (!phone)    { setError(t('verifyOtp.missingContact')); return; }

    setVerifying(true);
    setError(null);

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      phone, token, type: 'sms',
    });

    setVerifying(false);

    if (verifyErr) {
      setError(verifyErr.message);
      setCode(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
      return;
    }

    // User is now signed in. _layout.tsx auth listener will redirect, but
    // we replace eagerly for snappier UX.
    router.replace('/(tabs)' as any);
  };

  // ─── Resend ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    if (!phone) { Alert.alert(t('verifyOtp.missingContact')); return; }

    setResending(true);
    setError(null);

    const { error: resendErr } = await supabase.auth.signInWithOtp({ phone });

    setResending(false);

    if (resendErr) {
      Alert.alert(t('verifyOtp.resendFailed'), resendErr.message);
      return;
    }

    setCooldown(RESEND_COOLDOWN);
    Alert.alert(t('verifyOtp.resendSuccess'), t('verifyOtp.resendSuccessMsg'));
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          {/* Title + sub — no decorative icon; the OTP keyboard already
              dominates the bottom half, so the title alone is enough. */}
          <Text style={styles.title}>{t('verifyOtp.phoneTitle')}</Text>
          <Text style={styles.sub}>{t('verifyOtp.phoneSub', { contact: phone })}</Text>

          {/* 6 OTP boxes */}
          <View style={styles.boxRow}>
            {Array(OTP_LENGTH).fill(0).map((_, i) => (
              <TextInput
                key={i}
                ref={r => { inputs.current[i] = r; }}
                style={[
                  styles.box,
                  code[i] ? styles.boxFilled : null,
                  error ? styles.boxError : null,
                ]}
                value={code[i]}
                onChangeText={v => handleChange(i, v)}
                onKeyPress={e => handleKeyPress(i, e)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={OTP_LENGTH}
                autoComplete="one-time-code"
                editable={!verifying}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Error / hint */}
          {error
            ? <Text style={styles.error}>{error}</Text>
            : <Text style={styles.hint}>{t('verifyOtp.phoneHint')}</Text>
          }

          {/* Manual verify */}
          <TouchableOpacity
            style={[styles.verifyBtn, verifying && styles.btnDisabled]}
            onPress={() => verify()}
            disabled={verifying || code.some(d => !d)}
          >
            {verifying
              // '#fff' kept raw — always-white on Card Orange
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.verifyBtnText}>{t('verifyOtp.verifyBtn')}</Text>
            }
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>{t('verifyOtp.didntReceive')}</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
            >
              <Text style={[styles.resendLink, (cooldown > 0 || resending) && styles.resendLinkDisabled]}>
                {cooldown > 0
                  ? t('verifyOtp.resendIn', { sec: cooldown })
                  : resending
                    ? t('common.loadingEllipsis')
                    : t('verifyOtp.resend')}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.surface.card },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },

    backBtn:  { marginBottom: 16 },
    backText: { fontSize: 15, color: colors.brand.orange, fontWeight: '600' },

    title: { fontSize: 26, fontWeight: '800', color: colors.text.primary, marginTop: 24, marginBottom: 10 },
    sub:   { fontSize: 15, color: colors.text.secondary, lineHeight: 22, marginBottom: 32 },

    boxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    box: {
      width: 48, height: 56,
      borderWidth: 1.5, borderColor: colors.border.default,
      borderRadius: 12,
      textAlign: 'center',
      fontSize: 24, fontWeight: '700',
      color: colors.text.primary,
    },
    boxFilled: { borderColor: colors.brand.orange, backgroundColor: colors.brand.peach },
    boxError:  { borderColor: colors.state.down, backgroundColor: colors.state.down + '22' },

    hint:  { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', marginBottom: 24 },
    error: { fontSize: 13, color: colors.state.down, textAlign: 'center', marginBottom: 24, fontWeight: '600' },

    verifyBtn: {
      backgroundColor: colors.brand.orange, borderRadius: 50,
      paddingVertical: 18, alignItems: 'center',
      marginBottom: 24,
    },
    btnDisabled:     { opacity: 0.5 },
    // '#fff' kept raw — always-white on Card Orange
    verifyBtnText:   { fontSize: 17, fontWeight: '600', color: '#fff' },

    resendRow: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    },
    resendText:         { fontSize: 14, color: colors.text.tertiary },
    resendLink:         { fontSize: 14, color: colors.brand.orange, fontWeight: '700' },
    resendLinkDisabled: { color: colors.border.strong },
  });
}
