import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';

export default function SettingsScreen() {
  const [publicPortfolio, setPublicPortfolio] = useState(true);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* 標題 */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>設定</Text>
        </View>

        {/* 用戶資料 */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View>
            <Text style={styles.profileName}>收藏家玩家</Text>
            <Text style={styles.profileEmail}>collector@hkcardcoll.com</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 帳戶 */}
        <Text style={styles.sectionLabel}>帳戶</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowIcon}>🔒</Text>
            <Text style={styles.rowText}>密碼與安全</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 隱私 */}
        <Text style={styles.sectionLabel}>隱私</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>👁️</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowText}>公開作品集</Text>
              <Text style={styles.rowSub}>允許其他用戶查看您的收藏</Text>
            </View>
            <Switch
              value={publicPortfolio}
              onValueChange={setPublicPortfolio}
              trackColor={{ false: '#E5E7EB', true: '#FF6900' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* 支援與關於 */}
        <Text style={styles.sectionLabel}>支援與關於</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowIcon}>📄</Text>
            <Text style={styles.rowText}>服務條款</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowIcon}>📋</Text>
            <Text style={styles.rowText}>隱私政策</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowIcon}>ℹ️</Text>
            <Text style={styles.rowText}>關於我們</Text>
            <Text style={styles.versionText}>v1.0.0</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 帳戶操作 */}
        <Text style={styles.sectionLabel}>帳戶操作</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowIcon}>↪️</Text>
            <Text style={styles.rowText}>登出</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowIcon}>🗑️</Text>
            <Text style={[styles.rowText, styles.deleteText]}>刪除帳戶</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  titleSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', color: '#101828' },
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 20, backgroundColor: '#fff' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#6B7280' },
  divider: { height: 8, backgroundColor: '#F3F4F6' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#fff' },
  section: { backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  rowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowText: { flex: 1, fontSize: 16, color: '#101828' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rowArrow: { fontSize: 20, color: '#9CA3AF' },
  versionText: { fontSize: 14, color: '#9CA3AF' },
  separator: { height: 0.5, backgroundColor: '#F3F4F6', marginLeft: 58 },
  deleteText: { color: '#E7000B', flex: 1 },
});