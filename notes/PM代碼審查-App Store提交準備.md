# PM 代碼審查 — App Store 提交準備（共 10 輪）

## 核心決策

### 認證架構
- 最終採用**無密碼架構**：Phone OTP（主）+ Google OAuth + Apple Sign In（原生 SDK）
- 完全移除 email/password 登入流程
- Apple Sign In 使用 `expo-apple-authentication` + `supabase.auth.signInWithIdToken`，**不用** WebBrowser OAuth

### Apple App Store 合規
- `app.json` 加入 `"usesAppleSignIn": true`（ios 節點）
- `app.json` plugins 加入 `"expo-apple-authentication"`
- `delete-account` Edge Function 使用 `safeDelete` wrapper，正確清理所有表
- 帳號刪除清理順序：post_reports → notifications → post_likes → post_comments → follows → messages → conversations → posts（含 Storage） → listings → merchant_profiles → user_collection → portfolios → user_roles → profiles → auth.deleteUser()

### 安全架構
- 所有外部 API key 移至服務器端，不放 `EXPO_PUBLIC_` bundle
- PPT API 走 `ppt-proxy` Edge Function（JWT 驗證 + rate limiting）
- PriceCharting 走 `pc-proxy` Edge Function（JWT 驗證 + rate limiting）
- `proxy_usage` 表 + `bump_proxy_usage()` RPC 限制每用戶每小時 API 使用量
- Admin 操作全部走 SECURITY DEFINER RPC，不直接修改 RLS 保護的表
- notifications 移除 client INSERT policy（觸發器 bypass RLS 處理）
- messages UPDATE 限定只能改 `is_read` 欄位（column-level grant）

### 架構重構
- artofpkm 圖片邏輯抽出 `lib/artofpkm.ts`（含 positive/negative cache）
- JP 圖片解析抽出 `lib/jpImages.ts`（search、portfolio、index 共用）
- 登出時呼叫 `clearArtofpkmCaches()` + `clearJpImageCaches()`，防共用設備資料殘留
- `data/artofpkm-promo-map.json` 已確認無任何 import（代碼走 Supabase 表）

### Admin 系統
- `admin.tsx` + SECURITY DEFINER RPCs：`admin_approve_merchant`、`admin_reject_merchant`、`admin_revoke_admin`、`admin_list_merchant_applications`、`admin_list_admins`
- 角色層級：viewer → individual_seller → certified_merchant → admin → super_admin
- super_admin 不能被任何人撤銷（創辦人帳號保護）
- Admin 入口藏在 Settings 頁，只有 admin/super_admin 才看得到

### i18n
- 4 語言：zh-HK、en、ja、zh-CN
- 語言偵測優先序：AsyncStorage 儲存偏好 → 設備 locale → fallback zh-HK
- 738 個 leaf keys，4 語言完全同步（截至最後一輪）

---

## 待解問題

- `terms.tsx` + `privacy.tsx` 全是繁體中文硬編碼，英文/日文用戶無法閱讀服務條款（非 App Store 必須，但影響國際化體驗）
- `social.tsx` 超過 100 條帖子後用戶無法看到更早內容（分頁問題，連續 7 輪未修）

---

## 有用的事實 / 數據

### App 基本資料
- App 名稱：Collectr（顯示名）/ HKCARDCOLL（品牌）
- Bundle ID：`com.collectr.app`
- EAS Project ID：`eab0d040-923e-4705-bff8-1b77c06118a9`
- 版本：1.0.0
- iOS deployment target：16.0

### 技術棧
- Framework：Expo Router v6 + React Native 0.81.5 + TypeScript
- Backend：Supabase（auth、database、Edge Functions、Realtime、Storage）
- i18n：i18next + react-i18next + AsyncStorage
- Build：EAS Build

### API 服務
- pokemontcg.io：EN 卡牌資料（`EXPO_PUBLIC_POKEMON_TCG_KEY` — 公開 key，可留 bundle）
- PokemonPriceTracker (PPT)：JP/EN 價格、PSA 評級（走 `ppt-proxy`，key 僅在 Supabase secrets）
- PriceCharting：補賬箱/sealed product 價格（走 `pc-proxy`，key 僅在 Supabase secrets）
- artofpkm：JP 卡牌圖片（Supabase `artofpkm_card_images` 表）
- TCGdex JA：JP 卡牌圖片備用

### 重要表名（曾踩坑）
- **正確**：`post_likes`（曾誤寫為 `likes`，delete-account 用了 5 輪才修）
- **正確**：`post_comments`（曾誤寫為 `comments`）
- **正確**：`notifications`（actor_id + user_id 欄位）

### Rate Limiting
- PPT proxy：每用戶每小時 30 次（`ppt-proxy`）
- PC proxy：每用戶每小時 30 次（`pc-proxy`）
- PPT credit 估算：< 10% 每日 20,000 limit（假設 5,000 用戶）

### 影片上傳限制（new-post.tsx）
- 最長：60 秒
- 最大：50MB

---

## 行動項目

### 🔴 立即（影響 build）
1. **刪除 `_layout.tsx` 三個死路由**（指向已刪除的文件）：
   ```tsx
   // 刪除這三行：
   <Stack.Screen name="change-password" />
   <Stack.Screen name="forgot-password" />
   <Stack.Screen name="reset-password" />
   ```

### 🟠 重要
2. **`search.tsx` 第 435 行 `console.log` 加 `__DEV__` 包裹**：
   ```ts
   if (__DEV__) console.log('[Search] pokemontcg EN:', ...)
   ```
3. **`social.tsx` 改用 FlatList + cursor pagination**：
   ```ts
   .order('created_at', { ascending: false })
   .lt('created_at', lastSeenAt)   // cursor
   .limit(20)
   ```

### 🟡 小改動
4. **`CurrencyContext.tsx` 第 46 行**：`'價格待定'` 改為 `'--'` 或加 i18n key
5. **刪除 `data/artofpkm-promo-map.json`**（1MB，無任何 import，代碼走 Supabase 表）
6. **`terms.tsx` + `privacy.tsx`** 考慮加英文版

---

## 廢棄資訊

- ❌ Apple Sign In 用 `supabase.auth.signInWithOAuth({ provider: 'apple' })` + WebBrowser — 被 Apple Guideline 4.8 拒絕，已廢棄
- ❌ Email/password 登入流程 — 已完全移除（change-password、forgot-password、reset-password 均已刪除）
- ❌ `delete-account` 刪 `from('likes')` — 錯誤表名，正確是 `from('post_likes')`（花了 5 輪修正）
- ❌ `EXPO_PUBLIC_POKEPRICE_KEY` / `EXPO_PUBLIC_JUSTTCG_KEY` / `EXPO_PUBLIC_PRICECHARTING_TOKEN` — 已從 config.ts 移除，改走 proxy
- ❌ `app/home/index.tsx` — 孤兒 placeholder 文件，已刪除
- ❌ `app/inbox.tsx` — 已移至 `app/(tabs)/inbox.tsx`（原路由廢棄）
- ❌ `APP_VERSION = '1.0.0'` 硬編碼 — 已改為 `Constants.expoConfig?.version`
- ❌ OCR.space helloworld key 在 search.tsx — 已移除
- ❌ `getPSAPrice()` rawPrice × 3 fallback 估算 — 已被 PPT API 實際 PSA 數據取代
- ❌ JustTCG API — 已被 PokemonPriceTracker (PPT) API 取代
- ❌ `data/artofpkm-promo-map.json` 6.1MB — 後壓縮至 1MB，但仍無任何 import，屬廢棄資產

---

## 相關檔案

### App 主要頁面
- `app/_layout.tsx` — 根路由、splash、cache 清理
- `app/(tabs)/_layout.tsx` — Tab 導航
- `app/(tabs)/index.tsx` — 首頁（熱門卡牌、Portfolio 摘要）
- `app/(tabs)/search.tsx` — 搜尋（PPT + pokemontcg.io）
- `app/(tabs)/portfolio.tsx` — 收藏夾（卡牌 + 補賬箱）
- `app/(tabs)/shops.tsx` — 商店列表
- `app/(tabs)/social.tsx` — 社交帖子
- `app/(tabs)/profile.tsx` — 個人資料
- `app/(tabs)/inbox.tsx` — 訊息列表（hidden tab）
- `app/(tabs)/notifications.tsx` — 通知（hidden tab）
- `app/(tabs)/settings.tsx` — 設定（含語言、貨幣、Admin 入口）
- `app/(tabs)/card/[id].tsx` — 卡牌詳情
- `app/login.tsx` — 登入（Phone OTP + Google + Apple）
- `app/register.tsx` — 註冊（Phone OTP）
- `app/verify-otp.tsx` — OTP 驗證
- `app/admin.tsx` — Admin 後台
- `app/edit-shop.tsx` — 商店編輯
- `app/chat/[id].tsx` — 即時通訊
- `app/listing-upload.tsx` — 上架卡牌
- `app/new-post.tsx` — 發帖（圖片/影片）

### 庫和工具
- `lib/pokeprice.ts` — PPT API 封裝（含 in-memory + Supabase 兩層 cache）
- `lib/jpImages.ts` — JP 卡牌圖片解析（artofpkm + TCGdex 備用）
- `lib/artofpkm.ts` — artofpkm Supabase 查詢 helper
- `lib/boosterPrices.ts` — 補賬箱價格（走 pc-proxy）
- `lib/i18n.ts` — i18next 初始化 + 語言偵測
- `lib/supabase.ts` — Supabase client

### Supabase Edge Functions
- `supabase/functions/delete-account/index.ts` — 帳號刪除（safeDelete 架構）
- `supabase/functions/ppt-proxy/index.ts` — PPT API 代理（JWT + rate limit）
- `supabase/functions/pc-proxy/index.ts` — PriceCharting 代理（JWT + rate limit）
- `supabase/functions/moderate-post/index.ts` — 內容審核（Sightengine）

### 重要 Migrations
- `supabase/migrations/20260511_chat.sql` — conversations + messages 表
- `supabase/migrations/20260513_security_fixes.sql` — RLS 修補
- `supabase/migrations/20260513_security_fixes_round2.sql` — notifications/messages 進一步修補
- `supabase/migrations/20260513_proxy_rate_limit.sql` — proxy_usage 表 + bump_proxy_usage RPC
- `supabase/migrations/20260514_admin_rpcs_and_role.sql` — Admin 角色 + RPC
- `supabase/migrations/20260514_super_admin.sql` — Super Admin 角色

### 設定檔
- `app.json` — Expo config（usesAppleSignIn、expo-apple-authentication plugin）
- `constants/config.ts` — API base URL（無任何 secret key）
- `locales/en.json` / `zh-HK.json` / `zh-CN.json` / `ja.json` — 738 keys 各語言
