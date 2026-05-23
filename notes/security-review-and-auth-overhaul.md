# Security Review & Auth Overhaul

## 核心決策

### Auth 架構
- **完全棄用 email+password**，改為 Phone OTP + Google OAuth + Apple Sign In（Passwordless）
- Apple Sign In 用 native `expo-apple-authentication` SDK（`signInAsync` + `signInWithIdToken`），**不**用 web OAuth flow（Apple 會拒審）
- 電話號碼統一 E.164 格式：8 位本地號碼自動加 `+852`，已有 852 prefix 的直接加 `+`
- `register.tsx` 和 `login.tsx` 底層邏輯相同（`signInWithOtp`），只是 UX framing 不同
- `verify-otp.tsx`：6-box OTP UI，支援 paste 整串、自動跳格、30 秒 resend cooldown

### Security 架構
- **所有 API key** 存 `EXPO_PUBLIC_*` env var，不 hardcode（`.env` gitignored，有 `.env.example`）
- **PPT API key** 只存 Supabase secrets，客戶端透過 Edge Function proxy（`ppt-proxy`）存取
- **Admin 操作**全部透過 SECURITY DEFINER RPC，不直接放寬 RLS
- `super_admin` 角色：不能被任何人撤銷（包括其他 super_admin），只能用 service_role SQL 手動修改
- **登出時清除 cache**：`clearArtofpkmCaches()` + `clearJpImageCaches()`，防止共享裝置資料洩漏

### RLS 修復歷史（已全部 deploy）
- `user_roles` privilege escalation：用戶只能從 viewer 升到 individual_seller，不能自升 certified_merchant
- `notifications` INSERT policy 完全移除（觸發器用 SECURITY DEFINER，不需要 client INSERT）
- `messages` UPDATE 限制只能改 `is_read` column，column-level grant 強制執行
- `messages_content_check`：用 `trim()` 後的長度作上下限（防止空白繞過）
- `posts` read policy：rejected 帖子對公眾隱藏
- `merchant-assets` storage：UPDATE/DELETE 限制為路徑第一段 = `auth.uid()`

### JP 卡圖片系統
- TCGPlayer CDN 403 問題：透過 artofpkm → TCGdex JA 兩層解析
- **strict match 原則**：必須 localId + set 完全吻合才顯示，寧可 placeholder 也不顯示錯誤卡圖
- `lib/artofpkm.ts`：處理 listing/shop 等已有 card_name 的場景
- `lib/jpImages.ts`：處理 PPT API 回來的熱門 JP 卡，有 SET_CODE_TO_ARTOFPKM_SLUG 完整 map

### Admin Panel
- `admin.tsx`：商家審核（pending/active/rejected tabs）+ 管理員管理
- 支援 `admin` 和 `super_admin` 兩個角色（`is_admin()` function 兩個都 return true）
- 拒絕升級申請時（individual_seller → certified_merchant 被拒），會 revert 回 individual_seller，不是 rejected terminal state
- WhatsApp URL 需要 sanitize：`app.whatsapp.replace(/[^\d+]/g, '')` 再建構 `wa.me/` URL

### _layout.tsx 架構
- 所有 Stack screens 必須明確在 `_layout.tsx` 列出，缺少時導航會壞掉
- `SIGNED_OUT` event 觸發 cache 清除
- Splash screen 最少顯示 3000ms（`SPLASH_MIN_MS`）
- `StatusBar style="dark"` 確保狀態列可見

---

## 待解問題

- **OCR scanner** 仍然 disabled（ML Kit 已移除，`ocr.space` 還沒接）；用戶還沒決定用哪個方案
- **`change-password.tsx` / `forgot-password.tsx` / `reset-password.tsx`**：Auth 改成 Passwordless 後這些 screen 已無 UI 入口，是否需要保留或刪除？（Google/Apple 用戶理論上沒有 password）
- **`settings.tsx` admin panel 入口**：isAdmin 狀態已讀取，但還沒確認是否已在 UI 加上跳轉 admin 的按鈕

---

## 有用的事實 / 數據

### App 基本資料
- Bundle ID (iOS): `com.collectr.app`
- Package (Android): `com.collectr.app`
- Expo Project ID: `eab0d040-923e-4705-bff8-1b77c06118a9`
- App scheme: `collectr://`
- iOS deployment target: 16.0
- Android compile/target SDK: 35

### 密碼規則（已棄用，留作參考）
- 最少 8 字元（register / change-password / reset-password 一致）

### 電話號碼規範
- 最少 8 digits（去除非數字後）
- HK 本地號碼自動加 `+852` prefix
- `maxLength={11}`（TextInput，允許輸入含 852 prefix）

### Edge Functions
- `ppt-proxy`：每用戶每小時 60 次限制（`PER_USER_HOUR_LIMIT = 60`），`ALLOWED_ENDPOINTS = ['/cards']`
- `delete-account`：依序刪除 post_reports → notifications → post_likes → post_comments → follows → messages → conversations → posts（+storage）→ listings → merchant_profiles → user_collection → portfolios → user_roles → profiles → auth.users

### 重要 constraints
- `messages_content_check`：`char_length(trim(content)) between 1 and 2000`
- Chat UI `maxLength`：500（比 DB 更嚴格）
- Listing photos：最多 4 張（UI），DB constraint `<= 10`
- Listing price：`> 0 and < 100000000`（DB constraint，`price` column）
- Listing price UI：`LISTING_PRICE_MIN = 1`，`LISTING_PRICE_MAX = 999999`（constants/config.ts）

### 賣家限制
- `individual_seller`：最多 10 個 active listings
- `certified_merchant`：最多 100 個 active listings

### Cache TTL
- PPT hot cards (JP/EN)：6 小時
- PPT 單張卡：24 小時

---

## 行動項目

- [ ] **OCR scanner**：決定並實作（ocr.space free key 或 @react-native-ml-kit/text-recognition）
- [ ] **刪除死 code**：`change-password.tsx`、`forgot-password.tsx`、`reset-password.tsx`（如確認不再需要）
- [ ] **Admin panel UI 入口**：確認 `settings.tsx` 已有跳轉 `/admin` 的按鈕給 isAdmin 用戶
- [ ] **`super_admin` 設定**：用 Supabase SQL editor 手動執行（見 migration 注釋，用自己的 user UUID）
- [ ] **EAS Build**：`expo-apple-authentication` 需要 native build，不能用 Expo Go 測試 Apple Sign In
- [ ] **Supabase 驗證查詢**（post-deploy 執行）：
  ```sql
  -- posts policy
  select polname, polcmd, qual from pg_policy where polrelid = 'public.posts'::regclass;
  -- merchant-assets storage
  select policyname, cmd, qual from pg_policies where tablename = 'objects' and policyname like '%merchant-assets%';
  -- listings constraint
  insert into public.listings (..., price, ...) values (..., -5, ...); -- should fail
  ```

---

## 廢棄資訊

- ~~Apple Sign In 用 `supabase.auth.signInWithOAuth({ provider: 'apple' })` web flow~~ → 改用 native SDK
- ~~Email + Password 登入/註冊~~ → 改用 Phone OTP Passwordless
- ~~`password.length < 6` 最短密碼~~ → 改為 8 字元（後來整個 auth 改掉）
- ~~`user_roles` 允許用戶自己升級角色~~ → 修復 privilege escalation
- ~~notifications 允許 client INSERT~~ → 移除，只靠 SECURITY DEFINER trigger
- ~~`messages` UPDATE 沒有 column 限制~~ → 加 column-level grant（只能改 `is_read`）
- ~~`posts` 顯示 rejected 帖子給公眾~~ → 修復 read policy
- ~~`merchant-assets` 任何 auth user 可覆寫~~ → 改為 owner-by-path
- ~~`security_hardening.sql` 用 `price_hkd` column~~ → 修正為 `price`（正確的 column 名）
- ~~`super_admin.sql` hardcode 真實電話號碼~~ → 移除，改為注釋說明手動執行
- ~~`edit-shop.tsx` console.error 沒有 `__DEV__` guard~~ → 已修復
- ~~`login.tsx` 顯示文字 logo "HKCARDCOLL"~~ → 改用 `Logo.png` 圖片
- ~~`settings.tsx` 顯示 `email` subtitle（phone 用戶會空白）~~ → 改為 `email ?? phone`

---

## 相關檔案

### 主要修改的 App 檔案
- `app/login.tsx` — Passwordless redesign（Phone OTP + Google + Apple）
- `app/register.tsx` — Phone OTP only，加 button disable 驗證
- `app/verify-otp.tsx` — 新增，6-box OTP UI
- `app/_layout.tsx` — 加 SplashScreen、cache clear on logout、所有 screens 齊全
- `app/admin.tsx` — 新增，商家審核 + 管理員管理
- `app/edit-shop.tsx` — 新增，商家資料編輯
- `app/(tabs)/settings.tsx` — 移除 password section，加 admin check，修 phone display
- `app/chat/[id].tsx` — Realtime chat，maxLength 500
- `app/listing-upload.tsx` — 加 file size check + extension parsing fix
- `app/new-post.tsx` — 加 file size check（50MB）
- `app/change-password.tsx` — （dead code，可考慮刪除）
- `app/forgot-password.tsx` — （dead code，可考慮刪除）
- `app/reset-password.tsx` — （dead code，可考慮刪除）

### Lib 檔案
- `lib/supabase.ts` — env var，AsyncStorage session
- `lib/pokeprice.ts` — PPT API proxy client，3-layer cache
- `lib/artofpkm.ts` — 新增，artofpkm 圖片解析（listing/shop 用）
- `lib/jpImages.ts` — 新增，JP 卡高清圖片解析（artofpkm + TCGdex JA fallback）
- `lib/lowestPrices.ts` — batch fetch 最低價
- `constants/config.ts` — 所有 constants，全部用 `process.env.EXPO_PUBLIC_*`

### Migrations（已全部修復）
- `20260511_fix_user_roles_rls.sql` — user_roles privilege escalation fix
- `20260513_security_fixes.sql` — notifications + messages round 1
- `20260513_security_fixes_round2.sql` — notifications INSERT 完全移除，messages column-level grant
- `20260511_chat.sql` — conversations + messages tables + RLS
- `20260514_admin_rpcs_and_role.sql` — admin role + 7 個 SECURITY DEFINER RPCs
- `20260514_super_admin.sql` — super_admin role（founder 用）
- `20260514_security_hardening.sql` — posts visibility，merchant-assets storage，listings price constraint

### Edge Functions
- `supabase/functions/ppt-proxy/index.ts` — PPT API proxy，JWT 驗證 + rate limit + param allowlist
- `supabase/functions/delete-account/index.ts` — 帳號刪除，sequential cleanup
- `supabase/functions/moderate-post/index.ts` — 內容審核
- `supabase/functions/pc-proxy/index.ts` — pc proxy

### Config 檔案
- `app.json` — `expo-apple-authentication` in plugins，`usesAppleSignIn: true`
- `.env` — （gitignored）所有 `EXPO_PUBLIC_*` keys
- `.env.example` — key 名稱範本，無真實值
