# Collectr App 開發、財務與會計總結

---

## 核心決策

### App 架構
- **API**: JustTCG 完全替換為 PokemonPriceTracker (PPT) API
- **API 安全**: PPT API key 只存在 Supabase secrets，所有調用通過 Edge Function `ppt-proxy` 路由，不進入 JS bundle
- **三層快取**: in-memory → Supabase `jtcg_price_cache`（24h TTL，Hot cards 6h）→ PPT API live call
- **Auth**: 全面轉為 Passwordless（電話 OTP + Google OAuth + Apple Sign In），移除 email+password 流程
- **i18n**: 全 app 使用 `react-i18next`（`useTranslation`），所有硬編碼中文字串已移至 i18n keys
- **多幣別**: `CurrencyContext`（`useCurrency`）統一管理 HKD / USD / JPY / CNY 顯示
- **Content moderation**: Sightengine 暫時繞過，`moderation_status` 預設 `'approved'`（MVP 決策）
- **Admin 系統**: SECURITY DEFINER RPC 模式，不放鬆 RLS，每個操作重新驗證 `is_admin(auth.uid())`
- **Super Admin**: 不能被任何人撤銷（包括其他 super_admin），只能透過 service_role SQL 操作

### 資料庫安全修復（已完成）
- `notifications` INSERT policy 完全移除，防止偽造通知
- `messages` UPDATE 用 column-level grant 鎖死只能改 `is_read`
- `messages_content_check` 改用 `trim()` 長度做上下限（1–2000 chars）
- `proxy_usage` 表 + `bump_proxy_usage()` RPC 實現 per-user per-hour 限流

### 圖表修復（已完成）
- `groupByPeriod` 完全重寫：1M = 30 daily buckets，3M = 13 weekly buckets，6M = 6 monthly buckets，MAX = 12 monthly buckets
- 新增 `cumulativeOverBuckets` helper，計算 window 開始前的底倉，圖表不再從零開始

### 會計 / 財務
- 所有公司支出按香港 IRD（稅務局）Cap. 112 分類
- 費用分為 s.16 可扣除（revenue 支出）和 s.17 不可扣除（capital 支出）
- 所有記錄需保存 7 年（s.51C）
- 已建立三個 Excel 檔案分別記錄 Invoice、Receipt、快查索引

---

## 待解問題

- **`profiles.tos_agreed_at` column** 是否已存在於 DB？`new-post.tsx` 讀/寫這個欄位，如果 column 不存在，用戶每次都會重複看到 ToS modal
- **`ppt-proxy` Edge Function source** 是否已 commit 進 repo？目前 `supabase/functions/` 沒看到，若只存在 Dashboard 則環境重置後消失
- **Content moderation** 正式上線前需決定：重新接 Sightengine，或建立人工審核流程（admin panel RPC 已具備基礎）

---

## 有用的事實 / 數據

### 成本估算（5,000 用戶/月）
| 服務 | 月費 (USD) | 備註 |
|---|---|---|
| Supabase Pro | $25 | 必須升級（超過 Free tier DB size / bandwidth） |
| PPT API | ~$30–50 | 估計 ~1,860 credits/day，日限 20,000，< 10% 使用率 |
| Supabase Storage | ~$10 | 用戶上傳圖片/影片 |
| Expo EAS Build | $0–29 | Free tier 可能足夠 |
| Sightengine | $0（暫停） | 恢復後約 $20/月 |
| **合計估算** | **~$65–115/月** | 5,000 活躍用戶 |

### Header unread badge 查詢成本
- 每次 tab focus 觸發 3 個 Supabase queries（notifications + 2 × conversations）
- 5,000 用戶 × 每人每天開 app 5 次 × 切 3 tab = ~75,000 次額外 DB reads/天
- 建議加 30 秒節流避免連環查詢

### PPT API Credit 預算
- Home screen hot 30 JP cards × 3 credits = 90，cached 6h → 360 credits/day
- Card detail ~500 unique cache misses × 3 = 1,500 credits/day
- 合計 ~1,860 / 20,000 daily limit（< 10%）

### 公司資料
- 公司名稱：POTO Design Studio（或類似）
- 聯絡 email：potodesignstudio@gmail.com
- 會計記錄適用法規：香港《稅務條例》Cap. 112

### 重要 URL / 路徑
- Supabase Dashboard：https://supabase.com/dashboard
- PPT API：https://www.pokemonpricetracker.com/api/v2
- Expo EAS Dashboard（需取真實 projectId UUID）：https://expo.dev

---

## 行動項目

### 緊急（上線前必須）
- [ ] **`app.json` 加 `"usesAppleSignIn": true`** 在 `ios` block，否則 App Store 審核失敗
- [ ] **EAS projectId** 替換為真實 UUID（現在是字串 `"collectr"`），到 https://expo.dev 取得
- [ ] **確認 `profiles.tos_agreed_at` column** 是否存在，若無需建 migration
- [ ] **確認 `ppt-proxy` Edge Function** source 已 commit 進 `supabase/functions/ppt-proxy/`
- [ ] **設定 super_admin**：在 Supabase SQL Editor 手動執行：
  ```sql
  update public.user_roles
     set role = 'super_admin', status = 'active'
     where user_id = '<YOUR_USER_UUID>';
  ```

### 中期（正式上線前）
- [ ] Header `fetchUnread` 加 30 秒節流，避免 tab 快速切換時連環 DB 查詢
- [ ] 決定 content moderation 方案（重接 Sightengine 或人工審核）
- [ ] 將所有 API key 確認只在 `process.env.EXPO_PUBLIC_*` 或 Supabase secrets，不在任何 JS 檔案

### 財務
- [ ] 每月更新 Invoice Log 和 Receipt Log（新收據記錄進去）
- [ ] 每年報稅前確認所有支出有原始單據（7 年保存）

---

## 廢棄資訊

- **JustTCG API** — 已被 PokemonPriceTracker (PPT) 完全取代，`lib/justtcg.ts` 不再使用
- **Email + Password 登入** — 已移除，現在只有 Passwordless（OTP / Google / Apple）
- **硬編碼 API key** — `const API_KEY = 'b58e91e7-...'` 已從 `index.tsx` 移除
- **hardcoded dummy data** — shops.tsx、social.tsx、notifications.tsx 的假資料全部已替換為真實 Supabase 查詢
- **靜態 `groupByPeriod`** — 舊版用 `M/D` 做 key 導致 1M 和 3M 圖表完全一樣，已完全重寫
- **`lib/cardPrices.ts`** — 被 `lib/pokeprice.ts` 取代
- **`app/app/register.tsx`, `app/app/edit-profile.tsx`, `app/home/index.tsx`, `app/modal.tsx`** — 已刪除
- **中文命名 icon 檔案**（`主頁.png`, `作品集.png` 等）— 已刪除，改用英文命名
- **Sightengine content moderation** — 暫時繞過（`moderation_status` 預設 `'approved'`），日後恢復

---

## 相關檔案

### App Source
- `app/(tabs)/index.tsx` — Home screen，圖表修復，PPT 整合，certified merchants
- `app/(tabs)/search.tsx` — 完整重寫，PPT API，image picker，ML Kit（disabled on simulator）
- `app/(tabs)/shops.tsx` — 真實 Supabase merchant 系統
- `app/(tabs)/social.tsx` — 真實 posts/likes/follows，三個 feed tabs
- `app/(tabs)/portfolio.tsx` — 編輯 modal，boxes，race condition fix（`renamingSavedRef`）
- `app/(tabs)/notifications.tsx` — 完整重寫，真實通知，時間分組
- `app/(tabs)/profile.tsx` — `useFocusEffect`，Instagram-style stats overlay，路由修復
- `app/(tabs)/settings.tsx` — 真實用戶資料，語言切換，admin badge，刪帳號
- `app/_layout.tsx` — SplashScreen（3秒最小顯示），`LanguageProvider`，`CurrencyProvider`，auth routing
- `app/login.tsx` — Passwordless：OTP + Google + Apple Sign In
- `app/new-post.tsx` — ToS gate（AsyncStorage + DB dual-layer），postCategory
- `app/onboarding.tsx` — i18n，Logo.png，Skip button
- `components/Header.tsx` — CurrencyContext，live unread badges（notifications + messages）

### Lib
- `lib/pokeprice.ts` — PPT API service，3-layer cache，proxy routing
- `lib/jpImages.ts` — JP card hi-res image fetching
- `lib/artofpkm.ts` — artofpkm image fetching for shops
- `lib/lowestPrices.ts` — HK platform lowest price fetching
- `lib/i18n.ts` — react-i18next 配置
- `lib/supabase.ts` — URL/key 從 `process.env.EXPO_PUBLIC_*` 讀取

### Migrations（重要）
- `supabase/migrations/20260513_security_fixes.sql` — 三個安全漏洞修補
- `supabase/migrations/20260513_security_fixes_round2.sql` — notifications spoofing，messages column-level grant
- `supabase/migrations/20260513_proxy_rate_limit.sql` — `proxy_usage` 表 + `bump_proxy_usage()` RPC
- `supabase/migrations/20260514_admin_rpcs_and_role.sql` — Admin SECURITY DEFINER RPCs
- `supabase/migrations/20260514_super_admin.sql` — super_admin role，保護創辦人帳號

### 財務檔案
- `/Users/alvin/collectr/Finance invoice and receive/POTO_Expense_Invoice_Log.xlsx` — 所有發票，IRD 合規分類
- `/Users/alvin/collectr/Finance invoice and receive/POTO_Payment_Receipt_Log.xlsx` — 所有收據，FX rates，HKD 等值
- `/Users/alvin/collectr/Finance invoice and receive/POTO_Invoice_Register.xlsx` — 快查索引（Invoice + Receipt 號碼）
- `/Users/alvin/collectr/POTO_公司支出記錄_完整版.xlsx` — 完整版支出記錄，含分類匯總表
