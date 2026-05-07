import { useRouter } from 'expo-router';
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

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      alert('請填寫所有欄位');
      return;
    }
    if (password !== confirmPassword) {
      alert('兩次密碼不一致');
      return;
    }
    if (password.length < 6) {
      alert('密碼最少 6 個字元');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else {
      alert('註冊成功！請檢查你的電郵確認帳戶');
      router.replace('/login');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <Text style={styles.logo}>HKCARDCOLL</Text>
          <Text style={styles.title}>創建您的帳戶</Text>
          <Text style={styles.sub}>寶可夢卡片收藏平台</Text>

          {/* Email */}
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
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>密碼</Text>
          <View style={[styles.inputBox, password ? styles.inputBoxActive : null]}>
            <TextInput
              style={styles.input}
              placeholder="最少 6 個字元"
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

          {/* Confirm Password */}
          <Text style={styles.label}>確認密碼</Text>
          <View style={[styles.inputBox, confirmPassword ? styles.inputBoxActive : null]}>
            <TextInput
              style={styles.input}
              placeholder="再次輸入密碼"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
              <Image
                source={showConfirm
                  ? require('../assets/icons/eye-off.png')
                  : require('../assets/icons/eye.png')
                }
                style={styles.eyeIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Register Button */}
          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerBtnText}>立即註冊</Text>}
          </TouchableOpacity>

          {/* Login */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>已有帳戶？ </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>立即登入</Text>
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
  label: { fontSize: 15, fontWeight: '700', color: '#101828', marginBottom: 10 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 20 },
  inputBoxActive: { borderColor: '#FF6900' },
  input: { flex: 1, fontSize: 15, color: '#101828' },
  eyeIcon: { width: 22, height: 22, tintColor: '#9CA3AF' },
  registerBtn: { backgroundColor: '#FF6900', borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginBottom: 24, marginTop: 8 },
  registerBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginText: { fontSize: 14, color: '#9CA3AF' },
  loginLink: { fontSize: 14, color: '#FF6900', fontWeight: '700' },
});