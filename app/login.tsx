import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
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

export default function LoginScreen() {
  const [step, setStep] = useState<'choose' | 'email'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) { alert('請填寫所有欄位'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    // _layout.tsx 會自動偵測 session 並跳轉
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'collectr://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    if (error) { alert(error.message); return; }
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'collectr://'
      );
      // _layout.tsx 會自動偵測 session 並跳轉
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <Text style={styles.logo}>HKCARDCOLL</Text>
          <Text style={styles.title}>登入您的帳戶</Text>
          <Text style={styles.sub}>寶可夢卡片收藏平台</Text>

          {step === 'choose' ? (
            <>
              <TouchableOpacity style={styles.socialBtn} onPress={() => setStep('email')}>
                <Image source={require('../assets/icons/Email.png')} style={styles.socialIcon} />
                <Text style={styles.socialText}>使用 Email 登入</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleLogin}>
                <Image source={require('../assets/icons/Google.png')} style={styles.socialIcon} />
                <Text style={styles.socialText}>使用 Google 登入</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialBtn}>
                <Image source={require('../assets/icons/Apple.png')} style={styles.socialIcon} />
                <Text style={styles.socialText}>使用 Apple 登入</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.keepRow} onPress={() => setKeepSignedIn(!keepSignedIn)}>
                <View style={[styles.checkbox, keepSignedIn && styles.checkboxActive]}>
                  {keepSignedIn && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.keepText}>Keep me signed in</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginBtn} onPress={() => setStep('email')}>
                <Text style={styles.loginBtnText}>Login</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => setStep('choose')} style={styles.backBtn}>
                <Text style={styles.backText}>← 返回</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputBox, email ? styles.inputBoxActive : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="johndoe@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>

              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputBox, password ? styles.inputBoxActive : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Image
                    source={showPassword
                      ? require('../assets/icons/eye-off.png')
                      : require('../assets/icons/eye.png')
                    }
                    style={styles.eyeIcon}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.keepRow} onPress={() => setKeepSignedIn(!keepSignedIn)}>
                <View style={[styles.checkbox, keepSignedIn && styles.checkboxActive]}>
                  {keepSignedIn && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.keepText}>Keep me signed in</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>還沒有帳戶？ </Text>
            <TouchableOpacity onPress={() => router.push('/register' as any)}>
              <Text style={styles.registerLink}>立即註冊</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 24, paddingBottom: 40 },
  logo: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: '#101828', textAlign: 'center', paddingTop: 16, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: '#101828', marginBottom: 6 },
  sub: { fontSize: 15, color: '#9CA3AF', marginBottom: 32 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FF6900', borderRadius: 12, paddingVertical: 16, marginBottom: 14, gap: 12 },
  socialIcon: { width: 22, height: 22, resizeMode: 'contain' },
  socialText: { fontSize: 16, fontWeight: '600', color: '#101828' },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  keepText: { fontSize: 14, color: '#101828' },
  loginBtn: { backgroundColor: '#FF6900', borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginBottom: 24 },
  loginBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 13, color: '#9CA3AF' },
  backBtn: { marginBottom: 20 },
  backText: { fontSize: 15, color: '#FF6900', fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 10 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  forgotText: { fontSize: 14, color: '#FF6900', fontWeight: '600' },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 20 },
  inputBoxActive: { borderColor: '#FF6900' },
  input: { flex: 1, fontSize: 15, color: '#101828' },
  eyeIcon: { width: 22, height: 22, tintColor: '#9CA3AF' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  registerText: { fontSize: 14, color: '#9CA3AF' },
  registerLink: { fontSize: 14, color: '#FF6900', fontWeight: '700' },
});