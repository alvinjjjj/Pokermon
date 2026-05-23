# Collectr — App Store 上架 Checklist

最後更新：2026-05-15

照這份從上到下跑一遍。每個項目都標明：
- ⏱ 預估時間
- 🎯 在哪 click / 跑什麼 command
- 🚨 不做會發生什麼

---

## 🚨 24 小時內必做（Pre-submit Blockers）

如果這四項任何一個沒做，**Apple reviewer 會直接拒或者你會在線上爆**。

### 1. 部署 Security Migration ⏱ 5 分鐘

剛剛寫的 `20260514_security_hardening.sql` 還在你電腦上沒推。

```bash
cd /Users/alvin/collectr
supabase db push
```

驗證：
```bash
# 應該看到新 policy
supabase db remote --linked
psql $DATABASE_URL -c "select polname from pg_policy where polrelid = 'public.posts'::regclass;"
# 應該看到 "posts read approved"，不是 "posts read"
```

**🚨 不做的話**：rejected posts 仍對所有人可見；merchant avatar 可被任何認證用戶覆寫。

---

### 2. Rotate API Keys ⏱ 15 分鐘

`.env` 已 gitignored，但**假設曾經洩漏**，所有 server-side keys 全部轉一次：

| Key | 在哪 rotate |
|---|---|
| `POKEPRICE_API_KEY` | https://www.pokemonpricetracker.com/ → account → API → regenerate |
| `PRICECHARTING_TOKEN` | https://www.pricecharting.com/ → API settings → reset |
| `JUSTTCG_API_KEY` | 沒在用，**直接從 `.env` 刪掉** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → reset service_role |

Rotate 後：
```bash
# 更新 .env (本地)
nano .env

# 更新所有 edge function secrets
supabase secrets set POKEPRICE_API_KEY=新值
supabase secrets set PRICECHARTING_TOKEN=新值
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=新值

# 重新 deploy 受影響的 edge functions
supabase functions deploy ppt-proxy
supabase functions deploy pc-proxy
supabase functions deploy delete-account
supabase functions deploy moderate-post
```

**🚨 不做的話**：別人拿你的 PPT key 燒 credits（你會被 billed），或拿 service_role key 變相 admin。

---

### 3. Host Privacy Policy + Terms 到公網 ⏱ 10 分鐘

App Store Connect 提交時必填這兩個 URL，**不能是 app 內畫面**。

**最快做法**：Notion public page

1. 開 Notion → 建 page "Collectr Privacy Policy"
2. 把 `app/privacy.tsx` 內容貼進去
3. 右上 Share → "Share to web" → 開 ON → 複製連結
4. 同樣做 Terms

或用 GitHub Pages（更專業）：
```bash
cd /Users/alvin/collectr
mkdir -p docs
# 把 privacy.tsx / terms.tsx 內容轉 markdown 放進 docs/
git push
# 然後 GitHub Settings → Pages → Source: docs/
```

最後把兩個 URL 記下來：
```
Privacy: https://your-domain/privacy
Terms:   https://your-domain/terms
```

**🚨 不做的話**：App Store Connect submit 頁面卡死，必填欄位。

---

### 4. 改 Auth 為 Plan B：Apple Sign In + Google + Anonymous ⏱ 1-2 天（取代舊 Twilio plan）

> **⚠️ 2026-05-17 update**：Auth 策略改 Plan B。舊「Twilio Phone OTP」方案下面標 `(DEPRECATED)` 留 history。Phone OTP 移到 v1.1。

Apple reviewer 在 Cupertino。**收唔到 +852 SMS = 直接拒**。Plan B 嘅 fix：reviewer 用 **Apple Sign In with any Apple ID** 或者 **Browse as guest**，0 friction。

**Implementation tasks**（Claude Code 做）：

1. **Wire up Apple Sign In to Supabase Auth backend**
   - `expo-apple-authentication` 已安裝
   - 連 Supabase auth provider（Settings → Authentication → Providers → Apple）
   - test sign-in flow → user record 建好
2. **Enable Supabase Anonymous Auth**
   - Supabase Dashboard → Authentication → Providers → Enable Anonymous
   - app side：`supabase.auth.signInAnonymously()`
3. **Build "Browse as guest" entry on onboarding screen**
   - First screen 兩個 button：「Sign in」+「Browse as guest」
   - Guest mode → 全 app 可讀，所有 write action（加卡、刊登、DM）trigger sign-in sheet
4. **Remove email/password UI**（保留 backend account schema，畀 Phone OTP v1.1 用）
5. **Migrate sign-in modal copy** 套 voice.md（精準、本地、克制）

**提交 Apple Review 時嘅 Demo Account section**：
```
Demo Method 1 (Recommended for Reviewer):
  Tap "Browse as guest" on first screen.
  Full read-only access to portfolio, marketplace, community, search.
  No sign-in required.

Demo Method 2 (Full Feature Test):
  Tap "Sign in with Apple" with any Apple ID.
  Auto-creates account, full write access.

No phone number, no SMS, no test credentials needed.
```

**🚨 不做的話**：Reviewer 在登入頁卡死 → 直接拒 4.0 Minimum Functionality；OR 用 Anonymous 進去但發現 UI 仍寫 email/password = 4.1 placeholder content 拒。

---

#### 4-DEPRECATED · 設定 Twilio Test 帳號給 Reviewer（已棄用，Phase 1.1 重啟）

> 2026-05-17 stopped using this approach. Phone OTP 留 v1.1 加入。
> 4 個 phone 帳號 (+852 6100 0001-04 / OTP 111111-444444) 維持喺 Supabase 做 dev debug，但**唔再喺 App Store submit 引用**。
> 詳見 `notes/decision-log-2026-05-17.md` Decision 03。

---

## 🟠 一週內必做（Pre-launch P1）

### 5. 接 Sentry Crash Reporting ⏱ 30 分鐘

線上崩潰你看不到 = 盲飛。

```bash
cd /Users/alvin/collectr
npx expo install @sentry/react-native
```

`app.json` 加 plugin：
```json
"plugins": [
  ...,
  ["@sentry/react-native/expo", {
    "organization": "your-org",
    "project": "collectr",
    "url": "https://sentry.io/"
  }]
]
```

`app/_layout.tsx` top of file：
```ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_DSN_HERE',
  enableNative: true,
  tracesSampleRate: 0.1, // 10% 取樣
});
```

註冊 sentry.io → New Project → React Native → 拿到 DSN 貼上去。

驗證：把 app 弄崩一次（throw error），看 Sentry 收到。

---

### 6. EAS Build Production Profile ⏱ 1 小時（含 build 時間）

```bash
cd /Users/alvin/collectr
eas login
eas build:configure
```

`eas.json` 確認有 production profile：
```json
{
  "build": {
    "production": {
      "ios": {
        "autoIncrement": true,
        "distribution": "store"
      }
    }
  }
}
```

跑：
```bash
eas build --profile production --platform ios
```

第一次會問你：
- Apple ID + App-specific password
- Bundle Identifier (你 app.json 已有 `com.collectr.app`)
- Provisioning profile (自動產生)
- Distribution certificate (自動產生)

Build 完成後 → 自動上傳 TestFlight。

---

### 7. 跑 Trainer 卡 Scraper ⏱ 30 分鐘（一次性）

讓 Sightseer 等 trainer 卡有圖：

```bash
cd /Users/alvin/collectr
node scripts/scrape-artofpkm.mjs --characters-all
node scripts/import-to-supabase.mjs
```

跑完應該看到類似：
```
✅ Sightseer  ✅ 6 cards | tag-team-gx-all-stars/192, ...
✅ Cynthia    ✅ 8 cards | ...
...
```

驗證：
```sql
select count(*) from artofpkm_card_images where key like '%tag-team-gx-all-stars%';
-- 應該 ≥ 5 筆
```

---

## 📲 App Store Connect 設定（提交頁面填什麼）

到 https://appstoreconnect.apple.com → My Apps → Collectr

### App Information
- **Bundle ID**: `com.collectr.app`
- **SKU**: `collectr-ios`
- **Primary Language**: Chinese (Traditional, Hong Kong) 或 English (US)
- **Category**: Primary: **Shopping**（不是 Games！）/ Secondary: **Lifestyle**

### Pricing
- **Price**: Free
- **Availability**: HK / TW / SG / JP / US（看你目標市場）

### Privacy
**必填**「Privacy Practices」問卷：

| 問題 | 你的答案 |
|---|---|
| Do you collect data? | Yes |
| Contact Info (Email via Apple Sign In) | Yes — for account auth |
| Identifiers (Apple ID, Google ID, User ID) | Yes |
| Usage Data | Yes — for app functionality |
| Diagnostics (Crash data) | Yes — Sentry |
| Photos | Yes — user-uploaded listing photos |
| Linked to user identity? | Yes |
| Used for tracking? | **NO**（你沒 ads） |

Privacy Policy URL：填第 3 點 host 好的連結。

### Version Information (1.0.0)
- **What's New**: "Collectr 1.0 — HK 首個 Pokemon TCG 收藏管理 + 二手市集 + 社群"
- **Description**: 200 字內，重點：
  ```
  Collectr 是香港首個專為寶可夢卡牌玩家設計的全方位平台。
  
  • 收藏管理 — 追蹤你的卡片價值、PSA 等級、漲跌趨勢
  • 二手市集 — 認證商家 + 個人賣家，HK 本地交易
  • 即時報價 — 整合 eBay / TCGplayer / artofpkm 全球行情
  • 社群分享 — 開箱、評卡、討論
  
  支援繁中、簡中、英文、日文。
  ```
- **Keywords**: `pokemon,寶可夢,寵物小精靈,TCG,二手,卡牌,PSA,收藏,香港`（100 字元內）
- **Support URL**: 隨便弄個 mailto:support@collectr.app 或 GitHub issues
- **Marketing URL**: 可選

### Screenshots（**這個 90% reviewer 看 screenshots 就決定**）

**必交**：
- 6.7" (iPhone 15 Pro Max) — **6 張，每張 1290×2796**
- 6.5" (iPhone 11 Pro Max) — 6 張，1284×2778

建議 6 張依序：
1. 主頁（顯示卡片 chart）
2. 搜尋 + 熱門卡
3. 卡片詳情頁 + 價格圖表
4. 作品集
5. 二手市集（shops）
6. 商家頁面 / chat

**用真實截圖**，不要用 mockup framework 套圖（Apple 認得出）。

### App Review Information（**2026-05-17 updated · Plan B auth**）
- **Sign-in required**: NO（Anonymous guest mode 提供 full read access）
- **Demo Account**: 不需要 — see Notes below
- **Notes for reviewer**:
  ```
  This is HKCardColl — a P2P marketplace and portfolio app for physical
  Pokémon trading cards. Operated by POTO Creative Tech Limited
  (Hong Kong Business Registration 80363844).

  ── DEMO INSTRUCTIONS ──
  Method 1 (Recommended):
    Tap "Browse as guest" on first screen.
    Full read access to portfolio, marketplace, community, search.

  Method 2 (Full features):
    Tap "Sign in with Apple" with any Apple ID.
    Auto-creates account, full write/trade access.

  No phone number, no SMS, no test credentials required.

  ── BUSINESS NOTES ──
  Sales of physical cards are processed off-app between buyer and seller.
  No IAP applicable for v1.0.
  PRO subscription (HK$58/month) is planned for v1.1 — not in this release.

  Marketplace tiers:
    - Tier 1 Individual Seller: free, up to 10 listings
    - Tier 2 Certified Merchant: HK$500/month subscription, up to 100 listings,
      requires verified Hong Kong Business Registration.

  ── CONTACT ──
  hello@hkcardcoll.hk
  ```

### Age Rating
跑問卷，預期結果：**12+**（因為 Mild/Infrequent Simulated Gambling — 收藏卡有 secondary market）

---

## ❌ Apple 常見拒絕原因 & 怎麼避免

| Guideline | 怎麼避免 |
|---|---|
| **4.0 Minimum Functionality** | 確保所有 tab 都有真實內容，不要有「Coming Soon」 |
| **4.3 Spam** | 別套版型 — 你已經有自己 design |
| **5.1.1(v) Account Deletion** | ✅ delete-account 已有 |
| **5.1.1(ix) Sign in with Apple** | ✅ expo-apple-authentication 已裝 |
| **2.1 App Completeness** | 別讓任何 button 是 placeholder。每個 alert 都要有文字 |
| **3.1.1 IAP for digital goods** | Collectr 賣**實體卡**，**完全不需要 IAP**。Reviewer notes 必寫「physical goods marketplace」否則他可能誤判 |
| **2.5.1 Private APIs** | Expo SDK 不會用 private API，安全 |
| **1.6 Child Safety** | 你 12+ 評級就行，沒問題 |
| **5.1.2 Data Use & Sharing** | Privacy Policy 必須說清楚收集什麼 |

---

## 🧪 Pre-submit 自我測試（建議花 1 小時）

跑這些 scenario，確認都過：

### 新用戶第一次開
- [ ] App 開啟不崩
- [ ] Splash 顯示 3 秒
- [ ] 進 onboarding 流暢
- [ ] 註冊（用 +852 61000001 + 111111）成功
- [ ] 第一次進主頁 — 卡片空狀態正確顯示「無卡片，去搜尋」

### 核心 flow
- [ ] 搜尋「Charizard ex」→ 有結果
- [ ] 點卡片 → 詳情頁正常開啟、有 chart
- [ ] 加入作品集 → 作品集出現該卡
- [ ] 點作品集 edit icon → 改價格 / 數量 / 購入價成功
- [ ] 長按卡片 → 刪除流程
- [ ] 開 listing-upload → 拍照 → 填價 → 上架成功
- [ ] 點 shops → 看到自己 listing
- [ ] 點 social → 看到帖子 → 點讚 / 留言 / 分享
- [ ] Chat — 對另一個帳號發訊息 → 即時收到

### Edge cases
- [ ] **飛航模式** 打開 app — 不崩，顯示錯誤訊息
- [ ] 飛航模式關掉重新整理 — 恢復正常
- [ ] **超長卡片名稱** 不會 overflow
- [ ] **照片上傳失敗**（弄假 service_role）— 顯示錯誤，不靜默
- [ ] **logout → login 另一個帳號** — 看不到第一個用戶的資料

### 多語系
- [ ] 設定切繁中 → 全部文字變中文
- [ ] 切英文 → 全部文字變英文
- [ ] 切日文 → 全部文字變日文（不能有英文 fallback）

---

## 📈 上線後監控（第一週每天看一次）

- [ ] **App Store Connect → Sales and Trends** — 下載數
- [ ] **App Store Connect → Reviews** — 1-2 星評論立刻回應
- [ ] **Sentry Dashboard** — Crashes、Errors
- [ ] **Supabase Dashboard → Database → Logs** — error rate
- [ ] **Twilio Console → Logs** — SMS 發送成功率
- [ ] **Supabase Dashboard → Auth → Users** — 註冊曲線

---

## 🎯 我評估的時程

| Phase | 時間 | 目標 |
|---|---|---|
| **本週末** | 1 天 | 跑完 P0（migration、API rotate、privacy URL、Twilio test）+ Sentry + EAS Build |
| **下週一–三** | 3 天 | TestFlight Beta，找 10–20 個朋友測 |
| **下週四–五** | 2 天 | 修 TestFlight 抓到的 bug |
| **再下週一** | 半天 | App Store submit |
| **再下週四–五** | Apple review，平均 24–48 小時 |
| **再下週末** | 上架 🚀 |

**總計：12–14 天到正式上架**。

---

## ⚠️ 最後忠告

1. **送審前一定 build production**：dev build 一堆東西不一樣（splash 速度、status bar、deep linking）。
2. **送審前一定在真機跑一次**，simulator 看不到的 bug 真機會出。
3. **第一個版本 1.0.0 就好，不要 1.0.1**：reviewer 看到「我們已經修了」會疑心。
4. **準備好被拒一次** — Apple 拒第一次很常，回信講清楚就過。

加油 — 你的 app 比 90% 第一次送審的 indie app 完整很多。
