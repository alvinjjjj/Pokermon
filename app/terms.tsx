import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { type ColorTokens } from '../constants/colors';

export default function TermsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  // Sub-components live inside so they close over themed `styles`.
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const Para = ({ children, style }: { children: React.ReactNode; style?: object }) => (
    <Text style={[styles.para, style]}>{children}</Text>
  );

  const BulletList = ({ items }: { items: string[] }) => (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>服務條款</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.lastUpdated}>最後更新：2026 年 5 月 10 日</Text>

        <Text style={styles.intro}>
          歡迎使用 HKCARDCOLL（下稱「本平台」、「我們」）。本平台為香港集卡愛好者提供集卡收藏、交流及交易服務。使用本平台前，請仔細閱讀以下服務條款（下稱「本條款」）。一旦您使用本平台，即表示您已閱讀、理解並同意遵守本條款的所有內容。
        </Text>

        <Section title="1. 適用範圍">
          <Para>
            本條款適用於所有透過本平台應用程式（iOS / Android）存取或使用本平台服務的用戶，包括：
          </Para>
          <BulletList items={[
            '瀏覽、搜尋或查看卡牌資訊',
            '建立帳戶並管理個人收藏',
            '在社交功能中發佈帖子、留言或互動',
            '在市場功能中刊登或購買卡牌商品',
          ]} />
        </Section>

        <Section title="2. 帳戶註冊與安全">
          <Para>
            使用本平台的完整功能需要您建立帳戶。您同意：
          </Para>
          <BulletList items={[
            '提供真實、準確及完整的註冊資料',
            '妥善保管您的登入憑證，不向他人洩露密碼',
            '一旦發現帳戶被未授權使用，立即通知我們',
            '一人只可持有一個帳戶',
          ]} />
          <Para>
            您對在您帳戶下發生的所有活動負全部責任。我們保留在您違反本條款時暫停或終止您帳戶的權利。
          </Para>
        </Section>

        <Section title="3. 用戶生成內容">
          <Para>
            本平台允許用戶上傳圖片、影片、文字等內容（下稱「用戶內容」）。您在上傳內容時，聲明並保證：
          </Para>
          <BulletList items={[
            '您擁有或已獲授權發佈該內容',
            '該內容不侵犯任何第三方的知識產權、隱私權或其他合法權益',
            '該內容不包含任何非法、有害、騷擾性、誹謗性或淫穢的資料',
          ]} />
          <Para>
            您授予本平台一個非獨家、全球性、免版稅的授權，以儲存、顯示及傳播您的用戶內容，用於運營本平台服務之目的。
          </Para>
        </Section>

        <Section title="4. 禁止行為">
          <Para>使用本平台時，您不得：</Para>
          <BulletList items={[
            '上傳任何含有裸露、色情、暴力、仇恨或不雅內容的圖片或影片',
            '發佈虛假、誤導或欺詐性資訊',
            '冒充他人或虛假代表任何機構',
            '對其他用戶進行騷擾、霸凌或威嚇',
            '在平台上進行未經授權的商業推廣或廣告',
            '嘗試入侵、攻擊或破壞本平台的技術系統',
            '利用本平台進行任何違反香港法律的活動',
            '出售偽造、翻新或虛假分級的卡牌商品',
          ]} />
          <Para>
            我們採用自動化內容審核系統對所有上傳內容進行審查。違規內容將被移除，嚴重或屢次違規者帳戶將被永久封禁。
          </Para>
        </Section>

        <Section title="5. 內容審核">
          <Para>
            本平台採用多層內容審核機制以維護安全的社區環境：
          </Para>
          <BulletList items={[
            '自動審核：所有上傳的帖子將在發佈後即時接受 AI 系統審核',
            '用戶舉報：用戶可對違規內容進行舉報，我們承諾在 48 小時內跟進',
            '人工審核：針對被多次舉報或AI標記的內容，我們的審核團隊將進行人工複核',
          ]} />
          <Para>
            待審核的帖子僅對帖子作者可見。審核結果將透過應用程式通知告知用戶。
          </Para>
        </Section>

        <Section title="6. 市場交易規則">
          <Para>
            本平台提供卡牌商品的刊登及交易功能。賣家須遵守以下規定：
          </Para>
          <BulletList items={[
            '商品描述必須真實準確，包括卡牌狀況、評級等資訊',
            '所有刊登商品必須為真品，禁止出售仿冒品',
            '刊登的 PSA 評級卡牌必須附有真實的評級編號',
            '賣家須在議定時間內完成交收',
            '禁止刊登任何法律禁售的商品',
          ]} />
          <Para>
            本平台僅為買賣雙方提供資訊交流平台，不直接參與任何交易。交易糾紛由買賣雙方自行協商解決，本平台不承擔任何交易責任。
          </Para>
        </Section>

        <Section title="7. 認證商家">
          <Para>
            申請成為認證商家（Certified Merchant）的用戶，需額外遵守以下條款：
          </Para>
          <BulletList items={[
            '提交真實有效的身份證明文件',
            '遵守香港《商品說明條例》及相關法規',
            '保持良好的交易紀錄及用戶評價',
            '認證資格由本平台審核批准，我們保留撤銷認證的權利',
          ]} />
        </Section>

        <Section title="8. 知識產權">
          <Para>
            本平台的設計、標誌、介面及所有原創內容均受版權保護，歸本平台所有。未經書面許可，不得複製、修改或再分發。
          </Para>
          <Para>
            Pokémon 相關品牌及圖像為 Nintendo / Creatures Inc. / GAME FREAK inc. 的商標。本平台與上述公司並無官方關聯。
          </Para>
        </Section>

        <Section title="9. 免責聲明">
          <Para>
            本平台以「現狀」提供服務，不作任何明示或暗示的保證，包括但不限於：
          </Para>
          <BulletList items={[
            '卡牌價格資訊僅供參考，不構成買賣建議',
            '我們不保證平台服務不會中斷或無錯誤',
            '本平台不對用戶之間交易的真實性或安全性作出保證',
            '我們不對因使用本平台而導致的任何直接或間接損失負責',
          ]} />
        </Section>

        <Section title="10. 服務變更與終止">
          <Para>
            我們保留以下權利，且無需事先通知：
          </Para>
          <BulletList items={[
            '修改、暫停或終止部分或全部服務功能',
            '因違反本條款而終止任何用戶的帳戶',
            '修改本條款（修改後將於應用程式內通知用戶）',
          ]} />
          <Para>
            您可隨時要求刪除帳戶，請聯絡 support@hkcardcoll.com。
          </Para>
        </Section>

        <Section title="11. 適用法律">
          <Para>
            本條款受香港特別行政區法律管轄。因本條款引起的任何爭議，雙方同意提交香港法院的專屬管轄。
          </Para>
        </Section>

        <Section title="12. 聯絡我們">
          <Para>
            如對本條款有任何疑問，請透過以下方式聯絡我們：
          </Para>
          <Para style={styles.contactText}>📧 support@hkcardcoll.com</Para>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface.section },
    nav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.surface.card, borderBottomWidth: 0.5, borderBottomColor: colors.border.default,
    },
    navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navBackText: { fontSize: 28, color: colors.text.primary, fontWeight: '300' },
    navTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },

    content: { paddingHorizontal: 20, paddingTop: 20 },
    lastUpdated: { fontSize: 12, color: colors.text.tertiary, marginBottom: 16 },
    intro: { fontSize: 14, color: colors.text.primary, lineHeight: 22, marginBottom: 24 },

    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 16, fontWeight: '700', color: colors.text.primary,
      marginBottom: 10, paddingBottom: 8,
      borderBottomWidth: 1, borderBottomColor: colors.border.default,
    },
    para: { fontSize: 14, color: colors.text.primary, lineHeight: 22, marginBottom: 10 },
    contactText: { color: colors.brand.orange, fontWeight: '600' },

    bulletList: { marginBottom: 10, gap: 6 },
    bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    bullet: { fontSize: 14, color: colors.brand.orange, lineHeight: 22, width: 12 },
    bulletText: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 22 },
  });
}
