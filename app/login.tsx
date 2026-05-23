import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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

WebBrowser.maybeCompleteAuthSession();

/**
 * Passwordless login. Three options:
 *   1. Phone OTP   — primary, no password ever
 *   2. Google      — OAuth, Google manages credentials
 *   3. Apple       — Apple Sign In, required by App Store when offering OAuth
 *
 * No email+password flow. Users without phone can still sign in via Google/Apple.
 */
type LoginStep = 'choose' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const { t }  = useTranslation();

  const [step, setStep]       = useState<LoginStep>('choose');
  const [phone, setPhone]     = useState('');          // Local digits, no +852
  const [loading, setLoading] = useState(false);

  // ─── Phone OTP ──────────────────────────────────────────────────────────
  const handlePhoneLogin = async () => {
    if (loading) return;
    const digits = phone.replace(/\D/g, '');
    if (!digits || digits.length < 8) {
      Alert.alert(t('login.invalidPhone')); return;
    }
    const e164 = digits.startsWith('852') ? `+${digits}` : `+852${digits}`;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);

    if (error) {
      Alert.alert(t('login.loginFailed'), error.message);
      return;
    }
    router.push({
      pathname: '/verify-otp',
      params:   { phone: e164, type: 'phone_signup' },
    } as any);
  };

  // ─── Google OAuth ───────────────────────────────────────────────────────
  // Note: deep-link redirect only works on dev / production builds, NOT Expo Go.
  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'collectr://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    if (error) { Alert.alert(t('login.loginFailed'), error.message); return; }
    if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, 'collectr://');
    }
  };

  // ─── Apple Sign In (native) ─────────────────────────────────────────────
  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });
      if (error) Alert.alert(t('login.loginFailed'), error.message);
    } catch (e: any) {
      // User cancelled — silent
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('login.loginFailed'), e.message);
      }
    }
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
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.sub}>{t('login.platformSub')}</Text>

          {step === 'choose' ? (
            <>
              {/* Phone — primary */}
              <TouchableOpacity style={[styles.socialBtn, styles.primaryBtn]} onPress={() => setStep('phone')}>
                <Image
                  source={require('../assets/icons/message.png')}
                  style={[styles.socialIcon, { tintColor: '#fff' }]}
                />
                <Text style={[styles.socialText, { color: '#fff' }]}>{t('login.phoneLogin')}</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('login.orLoginWith')}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OAuth options */}
              <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleLogin}>
                <Image source={require('../assets/icons/Google.png')} style={styles.socialIcon} />
                <Text style={styles.socialText}>{t('login.googleLogin')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialBtn} onPress={handleAppleLogin}>
                <Image source={require('../assets/icons/Apple.png')} style={styles.socialIcon} />
                <Text style={styles.socialText}>{t('login.appleLogin')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            // step === 'phone'
            <>
              <TouchableOpacity onPress={() => setStep('choose')} style={styles.backBtn}>
                <Text style={styles.backText}>{t('login.backBtn')}</Text>
              </TouchableOpacity>

              <Text style={styles.label}>{t('register.phone')}</Text>
              <View style={[styles.inputBox, phone ? styles.inputBoxActive : null]}>
                <Text style={styles.countryCode}>+852</Text>
                <TextInput
                  style={styles.input}
                  placeholder="91234567"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoFocus
                />
              </View>
              <Text style={styles.helperText}>{t('login.phoneHelper')}</Text>

              {(() => {
                const phoneDigits = phone.replace(/\D/g, '');
                const phoneValid  = phoneDigits.length >= 8;
                return (
                  <TouchableOpacity
                    style={[styles.loginBtn, (!phoneValid || loading) && { opacity: 0.45 }]}
                    onPress={handlePhoneLogin}
                    disabled={!phoneValid || loading}
                    accessibilityLabel={t('login.sendCode')}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loginBtnText}>{t('login.sendCode')}</Text>}
                  </TouchableOpacity>
                );
              })()}
            </>
          )}

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={() => router.push('/register' as any)}>
              <Text style={styles.registerLink}>{t('login.registerNow')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  container:   { paddingHorizontal: 24, paddingBottom: 40 },
  // Logo.png is 4:1 — height 40 → width 160, centered with top padding for visual balance
  logoImg:     { height: 40, width: 160, alignSelf: 'center', marginTop: 16, marginBottom: 32 },
  title:       { fontSize: 28, fontWeight: '800', color: '#101828', marginBottom: 6 },
  sub:         { fontSize: 15, color: '#9CA3AF', marginBottom: 32 },

  // Buttons
  socialBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FF6900', borderRadius: 12, paddingVertical: 16, marginBottom: 14, gap: 12 },
  primaryBtn:  { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  socialIcon:  { width: 22, height: 22, resizeMode: 'contain' },
  socialText:  { fontSize: 16, fontWeight: '600', color: '#101828' },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 13, color: '#9CA3AF' },

  // Phone step
  backBtn:        { marginBottom: 20 },
  backText:       { fontSize: 15, color: '#FF6900', fontWeight: '600' },
  label:          { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 10 },
  inputBox:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 8 },
  inputBoxActive: { borderColor: '#FF6900' },
  countryCode:    { fontSize: 15, fontWeight: '600', color: '#6B7280', marginRight: 8 },
  input:          { flex: 1, fontSize: 15, color: '#101828' },
  helperText:     { fontSize: 12, color: '#9CA3AF', marginBottom: 20 },

  loginBtn:       { backgroundColor: '#FF6900', borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginBottom: 24 },
  loginBtnText:   { fontSize: 17, fontWeight: '600', color: '#fff' },

  // Register link
  registerRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  registerText:   { fontSize: 14, color: '#9CA3AF' },
  registerLink:   { fontSize: 14, color: '#FF6900', fontWeight: '700' },
});
