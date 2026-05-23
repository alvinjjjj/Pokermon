import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>隱私政策</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.lastUpdated}>最後更新：2026 年 5 月 10 日</Text>

        <Text style={styles.intro}>
          HKCARDCOLL（下稱「本平台」、「我們」）非常重視用戶的個人私隱。本隱私政策說明我們如何收集、使用、儲存及保護您的個人資料。本政策符合香港《個人資料（私隱）條例》（第 486 章）的要求。
        </Text>

        <Section title="1. 我們收集的資料">
          <Para>我們可能收集以下類型的個人資料：</Para>

          <SubTitle>1.1 您直接提供的資料</SubTitle>
          <BulletList items={[
            '帳戶資料：電郵地址、用戶名稱、個人簡介、頭像',
            '認證商家資料：商業名稱、聯絡資訊（如適用）',
            '收藏資料：您添加至個人作品集的卡牌資訊',
            '交易資料：您在市場刊登的商品資訊',
            '通訊資料：您的留言、帖子及與他人的互動內容',
          ]} />

          <SubTitle>1.2 自動收集的資料</SubTitle>
          <BulletList items={[
            '裝置資訊：裝置型號、操作系統版本、應用程式版本',
            '使用資料：功能使用頻率、瀏覽記錄、互動行為',
            '錯誤報告：應用程式崩潰日誌（不含個人識別資料）',
          ]} />
        </Section>

        <Section title="2. 資料的使用目的">
          <Para>我們使用您的個人資料用於以下目的：</Para>
          <BulletList items={[
            '建立及管理您的帳戶',
            '提供及改善本平台的功能與服務',
            '顯示您的收藏作品集及社交帖子',
            '處理市場交易相關的資訊配對',
            '進行內容審核以維護平台安全',
            '發送系統通知（如審核結果、互動提醒）',
            '分析平台整體使用情況以優化用戶體驗',
            '遵守適用的法律義務',
          ]} />
        </Section>

        <Section title="3. 資料的分享與披露">
          <Para>
            我們不會將您的個人資料出售予第三方。我們僅在以下情況下分享您的資料：
          </Para>

          <SubTitle>3.1 平台內公開資料</SubTitle>
          <Para>
            以下資料將在本平台內對其他用戶公開顯示：用戶名稱、頭像、個人簡介、公開帖子、收藏作品集及市場商品。您可在設定中調整帳戶資訊。
          </Para>

          <SubTitle>3.2 服務供應商</SubTitle>
          <Para>
            我們使用以下第三方服務運營本平台，這些服務商僅在必要範圍內處理您的資料：
          </Para>
          <BulletList items={[
            'Supabase — 資料庫及身份驗證服務（伺服器位於美國）',
            'Sightengine — 自動化內容審核服務（僅處理您上傳的媒體檔案）',
          ]} />

          <SubTitle>3.3 法律要求</SubTitle>
          <Para>
            如果法律要求、政府命令或司法程序有所需要，我們可能披露您的資料。
          </Para>
        </Section>

        <Section title="4. 資料儲存與安全">
          <Para>
            您的個人資料儲存於加密的雲端資料庫，我們採取以下措施保護您的資料安全：
          </Para>
          <BulletList items={[
            '傳輸加密：所有資料傳輸均採用 TLS 加密',
            '存取控制：僅授權人員可存取用戶資料，且須遵守保密義務',
            '資料隔離：每位用戶的資料均受行級安全策略（RLS）保護',
            '密碼安全：您的密碼以加鹽雜湊方式儲存，我們無法讀取原文',
          ]} />
          <Para>
            請注意，沒有任何互聯網傳輸或儲存系統能保證 100% 的安全性。如發現任何安全漏洞，請立即聯絡我們。
          </Para>
        </Section>

        <Section title="5. 媒體內容">
          <Para>
            您上傳至本平台的圖片及影片儲存於雲端儲存服務中。所有上傳的媒體內容將接受自動化內容審核，審核過程中媒體檔案將暫時發送至 Sightengine 服務進行分析，分析完成後不會保留副本。
          </Para>
          <Para>
            被審核系統標記為違規的媒體檔案將從儲存服務中永久刪除。
          </Para>
        </Section>

        <Section title="6. Cookie 及追蹤技術">
          <Para>
            本平台應用程式使用本地儲存（AsyncStorage）保存您的登入狀態及應用程式偏好設定。我們不使用第三方廣告 Cookie 或跨平台追蹤技術。
          </Para>
        </Section>

        <Section title="7. 您的資料權利">
          <Para>
            根據香港《個人資料（私隱）條例》，您享有以下權利：
          </Para>
          <BulletList items={[
            '查閱權：要求查閱我們持有的您的個人資料',
            '更正權：要求更正不準確的個人資料',
            '刪除權：要求刪除您的帳戶及相關個人資料',
            '反對權：反對我們以特定方式處理您的資料',
          ]} />
          <Para>
            如需行使上述權利，請聯絡 support@hkcardcoll.com。我們將在 30 個工作日內回覆您的請求。
          </Para>
        </Section>

        <Section title="8. 資料保留期限">
          <Para>我們保留您個人資料的期限如下：</Para>
          <BulletList items={[
            '帳戶資料：在您帳戶有效期間及帳戶刪除後 30 天',
            '帖子及媒體：在帖子存在期間，刪除後立即移除',
            '收藏資料：在您帳戶有效期間',
            '系統日誌：最多保留 90 天',
          ]} />
        </Section>

        <Section title="9. 未成年人">
          <Para>
            本平台不向 18 歲以下的未成年人提供服務。如果您未滿 18 歲，請勿使用本平台或提供任何個人資料。如我們得知不慎收集了未成年人的個人資料，我們將立即刪除相關資料。
          </Para>
        </Section>

        <Section title="10. 跨境資料傳輸">
          <Para>
            本平台使用的部分服務（如 Supabase）的伺服器位於香港以外地區。透過使用本平台，您同意您的個人資料可能被傳輸至並儲存於香港以外的國家或地區。我們確保所有資料傳輸均符合適用的隱私法規。
          </Para>
        </Section>

        <Section title="11. 隱私政策的更新">
          <Para>
            我們可能不時更新本隱私政策。重大變更將透過應用程式通知或電郵告知用戶。繼續使用本平台即表示您接受更新後的隱私政策。
          </Para>
        </Section>

        <Section title="12. 聯絡我們">
          <Para>
            如對本隱私政策有任何疑問，或希望行使您的資料權利，請聯絡：
          </Para>
          <Para style={styles.contactText}>📧 support@hkcardcoll.com</Para>
          <Para style={styles.contactNote}>
            我們的個人資料保護主任將盡快處理您的查詢。
          </Para>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SubTitle({ children }: { children: string }) {
  return <Text style={styles.subTitle}>{children}</Text>;
}

function Para({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.para, style]}>{children}</Text>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB',
  },
  navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navBackText: { fontSize: 28, color: '#101828', fontWeight: '300' },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#101828' },

  content: { paddingHorizontal: 20, paddingTop: 20 },
  lastUpdated: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  intro: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 24 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#101828',
    marginBottom: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  subTitle: {
    fontSize: 14, fontWeight: '700', color: '#374151',
    marginTop: 10, marginBottom: 6,
  },
  para: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 10 },
  contactText: { color: '#FF6900', fontWeight: '600' },
  contactNote: { color: '#9CA3AF', fontSize: 13 },

  bulletList: { marginBottom: 10, gap: 6 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 14, color: '#FF6900', lineHeight: 22, width: 12 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
});
