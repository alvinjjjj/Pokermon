# HKCARDCOLL UI / Code Review（多輪迭代）

## 核心決策

- **Auth 架構：Passwordless** — 移除 email+password，改用 Phone OTP（primary）+ Google OAuth + Apple Sign In（native `expo-apple-authentication`，非 web redirect）
- **Apple 登入：** 必須用 `AppleAuthentication.signInAsync()` + `supabase.auth.signInWithIdToken()`，不能用 `signInWithOAuth`（App Store 拒絕 web redirect flow）
- **Inbox 路由：** 移至 `app/(tabs)/inbox.tsx`，路徑為 `/(tabs)/inbox`，在 Tabs layout 用 `href: null` 隱藏但保留路由
- **Chat 分頁：** `loadOlderMessages()` + `onEndReached` + `hasMore` + `PAGE_SIZE = 40`，不再 `.limit(60)` 無分頁
- **Admin panel：** 全部用 SECURITY DEFINER RPC（`admin_list_merchant_applications`、`admin_approve_merchant`、`admin_reject_merchant`、`admin_grant_admin`、`admin_revoke_admin`、`admin_find_user_by_email`），RLS 不洩露跨用戶資料
- **圖片 cache：** JP 卡圖解析統一放 `lib/jpImages.ts`，artofpkm 快取放 `lib/artofpkm.ts`（module-level hit cache + miss cache）
- **Logout 清 cache：** `_layout.tsx` 監聽 `SIGNED_OUT` 事件後執行 `clearArtofpkmCaches()` + `clearJpImageCaches()`，防止共用裝置跨用戶資料洩露
- **SplashScreen：** 動態 WebP（`expo-image` 播放）+ 3 秒最短顯示（`SPLASH_MIN_MS = 3000`）確保品牌曝光
- **optimistic rollback 標準做法：** `social.tsx` 和 `user/[id].tsx` 的 `toggleFollow` 都有 rollback；`chat/[id].tsx` 的 `sendMessage` 在失敗時 `filter` 移除 tempId 訊息
- **圖片副檔名解析：** 統一用 `uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg'`，防止 query string 污染（已在 `listing-upload.tsx` 和 `edit-profile.tsx` 修正）
- **檔案大小限制：** 照片上傳統一 50MB 上限（`asset.fileSize > 50 * 1024 * 1024`）
- **StatusBar：** `<StatusBar style="dark" />` 放在 `_layout.tsx`，確保白底 app 的 iOS 狀態列可讀

---

## 待解問題

- **Header DB 效能：** `fetchUnread()` 每次 tab focus 觸發 3 次 DB 查詢（notifications + conversations 買家 + 賣家）。建議改用 Supabase Realtime channel 訂閱，或加 debounce（300ms）
- **Header inbox badge 樂觀清零：** `handleInboxPress()` 立即 `setUnreadMessages(0)`，但若用戶沒有讀完所有訊息，badge 永遠是 0 直到下次 tab focus
- **Tab bar 6 個 tab：** Apple HIG 建議最多 5 個（Home / Search / Portfolio / Shops / Social / Profile），需決定合并哪個
- **Header 兩行 layout：** row1（logo）+ row2（貨幣/圖示）合計約 80px，可考慮合并成單行節省 viewport

---

## 有用的事實 / 數據

- **Project 路徑：** `/Users/alvin/collectr`
- **Supabase OTP resend cooldown：** 30 秒（`RESEND_COOLDOWN = 30`）
- **OTP 長度：** 6 位（`OTP_LENGTH = 6`）
- **Listing 上傳限制：** 最多 50MB / 張，`LISTING_PRICE_MIN` 和 `LISTING_PRICE_MAX` 已定義
- **Chat 分頁大小：** `PAGE_SIZE = 40`
- **Splash 最短顯示：** 3000ms
- **HK 電話 E.164 轉換：** `digits.startsWith('852') ? \`+${digits}\` : \`+852${digits}\``
- **貨幣符號 map：** `{ USD: 'US$', HKD: 'HK$', JPY: '¥', CNY: 'CN\¥' }`
- **支援貨幣：** HKD / USD / JPY / CNY（`CURRENCIES = ['HKD', 'USD', 'JPY', 'CNY']`）
- **artofpkm key 格式：** `"<padded 3-digit localId>/<SET-CODE-UPPERCASE>"`（e.g. `"001/XY-P"`）
- **PPT JP 卡名格式：** `"<card name> - <localId>/<setHint>"`
- **Admin role 值：** `'admin'` 或 `'super_admin'`（兩者都能訪問 admin panel）

---

## 行動項目

- [ ] **`_layout.tsx` L86–88：** 刪除 `change-password` / `forgot-password` / `reset-password` 三個 Stack.Screen（對應文件已刪，passwordless 後不再需要，是計時炸彈）
- [ ] **`listing/[id].tsx`：** 加 `useCurrency()` hook，把硬寫的 `HK$` 改為跟貨幣設定一致
- [ ] **`merchant/[id].tsx`：** 同上，加 `useCurrency()` hook
- [ ] **`settings.tsx` L259–265：** 法律區塊圖示換成語義正確的圖示（「使用條款」= notification.png ❌，「隱私政策」= password.png ❌，應換成 document / shield 類）
- [ ] **刪除 `components/LanguagePicker.tsx`：** Settings 已用 inline Modal，此組件從未 import 過
- [ ] **刪除 7 個 Expo 範本組件：** `external-link` / `haptic-tab` / `hello-wave` / `parallax-scroll-view` / `themed-text` / `themed-view` / `ui/collapsible`（全是 expo init boilerplate，app 從未使用）
- [ ] **`SplashScreen.tsx` L9：** 修正 JSDoc 注釋（寫了「進入程序」但 JSX 沒有 Text，注釋與代碼不符）
- [ ] **Header：** 考慮改用 Supabase Realtime 訂閱取代 `useFocusEffect` 查詢，解決每次 tab 切換 3 次 DB 查詢的問題
- [ ] **Tab bar：** 決定是否將 6 個 tab 縮減為 5 個（Apple HIG 要求）

---

## 廢棄資訊

- **Apple 登入舊做法：** `supabase.auth.signInWithOAuth({ provider: 'apple' })` — 會開 web browser，App Store 拒絕，已廢棄
- **Email + Password login：** `handleLogin()` + `signInWithPassword()` — 已移除，改為 passwordless
- **`app/inbox.tsx`（根目錄）：** 已刪除，inbox 改為 `app/(tabs)/inbox.tsx`
- **`app/change-password.tsx`：** 已刪除（passwordless 後不需要）
- **`app/forgot-password.tsx`：** 已刪除
- **`app/reset-password.tsx`：** 已刪除
- **`_tosShownThisSession` 全局變數：** 已廢棄，改用 `AsyncStorage` 持久化 TOS 狀態
- **Module-level OTP flag：** 已廢棄，改用 `tosShownRef`（useRef）
- **`app/modal.tsx`：** Expo init 範本殘留（"This is a modal"），與 app 無關
- **`alart.png` typo：** 舊版 Header 用了錯誤的圖示路徑，已改為 `notification.png`
- **Header HKCARDCOLL 文字 logo：** 已改為 `Logo.png` 圖片
- **`notifications` 路由在根目錄：** 已移至 `app/(tabs)/notifications.tsx`
- **Chat `keyboardVerticalOffset: 0`：** 已改為 `Platform.OS === 'ios' ? 60 : 0`
- **Chat `.limit(60)` 無分頁：** 已改為有 `loadOlderMessages` 的完整分頁機制
- **`_layout.tsx` 舊版 inbox Stack.Screen：** 已刪除（inbox 移至 tabs 後此項無效）
- **Login 雙重入口 bug：** Email 社交按鈕 + 橙色 loginBtn 都跳同一個 step，已修（重做為 passwordless 後自然消失）
- **Login dead styles：** `keepRow / checkbox / checkboxActive / checkmark / keepText` 已全部刪除

---

## 相關檔案

### 核心 App 文件
- `app/_layout.tsx` — Root layout，auth guard，SplashScreen，cache 清除
- `app/(tabs)/_layout.tsx` — Tab bar 配置（6 tabs）
- `app/(tabs)/index.tsx` — Home screen，portfolio chart，市場數據
- `app/(tabs)/search.tsx` — 搜尋，JP 圖片補全
- `app/(tabs)/portfolio.tsx` — 個人收藏，N+1 batch 修正
- `app/(tabs)/social.tsx` — 社交 feed，optimistic follow
- `app/(tabs)/shops.tsx` — 商店頁，artofpkm 圖片
- `app/(tabs)/profile.tsx` — 個人主頁
- `app/(tabs)/settings.tsx` — 設定，語言切換 Modal，admin 入口
- `app/(tabs)/inbox.tsx` — 訊息列表（移入 tabs）
- `app/(tabs)/notifications.tsx` — 通知
- `app/login.tsx` — Passwordless login（Phone OTP + Google + Apple）
- `app/register.tsx` — Phone OTP 注冊
- `app/verify-otp.tsx` — 6格 OTP 驗證畫面
- `app/admin.tsx` — Admin panel（需在 _layout.tsx Stack 顯式注冊）
- `app/chat/[id].tsx` — 即時聊天，optimistic rollback，分頁
- `app/edit-profile.tsx` — 編輯個人資料
- `app/edit-shop.tsx` — 編輯商店資料
- `app/listing-upload.tsx` — 上架，50MB 限制，副檔名修正
- `app/listing/[id].tsx` — 商品詳情（⚠️ 硬寫 HK$，待修）
- `app/merchant/[id].tsx` — 商戶頁（⚠️ 硬寫 HK$，待修）
- `app/user/[id].tsx` — 用戶主頁，toggleFollow rollback
- `app/post-detail.tsx` — 貼文詳情，ActionSheetIOS Platform guard
- `app/new-post.tsx` — 新貼文，AsyncStorage TOS
- `app/onboarding.tsx` — 新手引導
- `app/public-portfolio/[userId].tsx` — 公開作品集

### Components
- `components/Header.tsx` — Logo 圖片，雙徽章（訊息 + 通知），貨幣切換
- `components/SplashScreen.tsx` — 動態 WebP splash（⚠️ JSDoc 注釋有誤）
- `components/SkeletonCard.tsx` — 骨架屏

### Libs
- `lib/artofpkm.ts` — artofpkm 圖片查詢 + module cache + clearArtofpkmCaches()
- `lib/jpImages.ts` — JP 卡圖解析共用（artofpkm + TCGdex JA）+ clearJpImageCaches()
- `lib/pokeprice.ts` — 價格 API
- `lib/lowestPrices.ts` — HK 平台最低價
- `lib/supabase.ts` — Supabase client
- `lib/i18n.ts` — i18n 設定
- `contexts/CurrencyContext.tsx` — 貨幣 context（HKD/USD/JPY/CNY）
- `contexts/LanguageContext.tsx` — 語言 context

### Supabase Edge Functions
- `supabase/functions/delete-account/index.ts`
- `supabase/functions/moderate-post/index.ts`
- `supabase/functions/ppt-proxy/index.ts`

### 待刪 Dead Code
- `components/LanguagePicker.tsx` — 從未 import
- `components/external-link.tsx` — Expo boilerplate
- `components/haptic-tab.tsx` — Expo boilerplate
- `components/hello-wave.tsx` — Expo boilerplate
- `components/parallax-scroll-view.tsx` — Expo boilerplate
- `components/themed-text.tsx` — Expo boilerplate
- `components/themed-view.tsx` — Expo boilerplate
- `components/ui/collapsible.tsx` — Expo boilerplate
- `components/ui/icon-symbol.ios.tsx` — Expo boilerplate
- `components/ui/icon-symbol.tsx` — Expo boilerplate
- `constants/theme.ts` — 定義了 token 但 app 從未 import
