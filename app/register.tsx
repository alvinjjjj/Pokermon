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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

/**
 * Passwordless phone OTP registration.
 *
 * Same `signInWithOtp({ phone })` call as login — Supabase auto-creates the
 * auth.user on first successful verifyOtp. So "register" vs "login" is just
 * UX framing; the backend treats them identically.
 */
export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t }  = useTranslation();

  const [phone, setPhone]     = useState('');     // Local 8-digit HK number, no +852
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (loading) return;

    const digits = phone.replace(/\D/g, '');
    if (!digits)              { Alert.alert(t('register.fillPhone')); return; }
    if (digits.length < 8)    { Alert.alert(t('register.invalidPhone')); return; }

    // If user typed local 8-digit HK number, prepend +852.
    // If they typed with country code (e.g. "85291234567"), normalize to + prefix.
    const e164 = digits.startsWith('852') ? `+${digits}` : `+852${digits}`;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);

    if (error) {
      Alert.alert(t('register.registerFailed'), error.message);
      return;
    }

    router.replace({
      pathname: '/verify-otp',
      params:   { phone: e164, type: 'phone_signup' },
    } as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <Image
            source={require('../assets/images/Logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('register.title')}</Text>
          <Text style={styles.sub}>{t('register.platformSub')}</Text>

          {/* Phone input */}
          <Text style={styles.label}>{t('register.phone')}</Text>
          <View style={[styles.inputBox, phone ? styles.inputBoxActive : null]}>
            <Text style={styles.countryCode}>+852</Text>
            <TextInput
              style={styles.input}
              placeholder="91234567"
              placeholderTextColor={colors.text.tertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={11}
              autoFocus
            />
          </View>
          <Text style={styles.helperText}>{t('register.phoneHelper')}</Text>

          {/* Register button */}
          {(() => {
            const phoneDigits = phone.replace(/\D/g, '');
            const phoneValid  = phoneDigits.length >= 8;
            return (
          <TouchableOpacity
            style={[styles.registerBtn, (!phoneValid || loading) && { opacity: 0.45 }]}
            onPress={handleRegister}
            disabled={!phoneValid || loading}
            accessibilityLabel={t('login.sendCode')}
          >
            {loading
              // '#fff' kept raw — always-white on Card Orange
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.registerBtnText}>{t('register.registerBtn')}</Text>}
          </TouchableOpacity>
            );
          })()}

          {/* Link to login */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('register.haveAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>{t('register.loginNow')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe:      { flex: 1, backgroundColor: colors.surface.card },
    container: { paddingHorizontal: 24, paddingBottom: 40 },
    logoImg:   { height: 40, width: 160, alignSelf: 'center', marginTop: 16, marginBottom: 32 },
    title:     { fontSize: 28, fontWeight: '800', color: colors.text.primary, marginBottom: 6 },
    sub:       { fontSize: 15, color: colors.text.tertiary, marginBottom: 32 },

    label:           { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 10 },
    inputBox:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border.default, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 8 },
    inputBoxActive:  { borderColor: colors.brand.orange },
    countryCode:     { fontSize: 15, fontWeight: '600', color: colors.text.secondary, marginRight: 8 },
    input:           { flex: 1, fontSize: 15, color: colors.text.primary },
    helperText:      { fontSize: 12, color: colors.text.tertiary, marginBottom: 20 },

    registerBtn:     { backgroundColor: colors.brand.orange, borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginTop: 12, marginBottom: 24 },
    // '#fff' kept raw — always-white on Card Orange
    registerBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },

    loginRow:        { flexDirection: 'row', justifyContent: 'center' },
    loginText:       { fontSize: 14, color: colors.text.tertiary },
    loginLink:       { fontSize: 14, color: colors.brand.orange, fontWeight: '700' },
  });
}
