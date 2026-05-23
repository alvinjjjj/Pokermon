# Pokemon 卡盒價格表 與 Collectr App Code Review

## 核心決策

### Pokemon 價格表
- 新簡化表格格式：**編號 — 日文名 — 英文名 — 建議零售價(HKD) — 現在香港市場的價格(HKD)**，全部 HKD，去掉之前的 eBay USD 欄
- M1 分拆為兩個獨立系列：**M1L（メガブレイブ / Mega Brave）** 和 **M1S（メガシンフォニア / Mega Symphonia）**
- JPY → HKD 換算率：**100 JPY = HK$5.2**
- USD → HKD 換算率：**1 USD = HK$7.83**
- 日本原價換算：¥5,400/box（¥180/pack × 30）≈ **HK$280**；¥6,000/box（¥200/pack × 30）≈ **HK$310**

### Collectr App — May 14 Round 2 Fixes 共識
- Admin 功能全部改走 **SECURITY DEFINER RPC**，不再直接 upsert/delete `user_roles` / `merchant_profiles`（RLS 繞不過去）
- `PSA_MULT_JP` / `PSA_MULT_EN` 常數已刪除；有真實 PPT 資料才顯示價格，沒有就顯示 `pricePending`（不再造假估算），UI 用 `≈` 標示 estimate
- `artofpkm.ts` 和 `jpImages.ts` 加了 module-level cache（`_imageCache` + `_missCache`），logout 時統一 clear（防跨用戶 cache 洩漏）
- `_layout.tsx` 監聽 `SIGNED_OUT` event → `clearArtofpkmCaches()` + `clearJpImageCaches()`
- Chat dedupe：optimistic message 與 realtime 回來的真實 message 用 id 做 dedupe，不再出現雙份
- Search abort：`AbortController` + 8s timeout，`setLoading(false)` 移到 `finally`
- `shops.tsx`：`renderListingCard` 包 `useCallback`，`useFocusEffect` 加正確 deps
- `new-post.tsx` ToS：AsyncStorage 先查（offline-first）→ DB 查 → 寫回本機；`tosShownRef` 防 hot-reload 重複彈
- Admin + settings + search 全部 i18n，4 個 locale（zh-HK / zh-CN / en / ja）同步
- `tsc --noEmit` 最終 **0 error**

---

## 待解問題

- **`portfolio.tsx` fetchCards 的 `setLoading` 漏洞**：`fetchHiresJPImages`（jpShaped block）沒有 `try/catch`，如果 throw 則 spinner 永不消失。需加 `try/finally` 包住整個 image batch 段
- **`CurrencyContext.convert` 硬編碼 `'價格待定'`**：Context 層拿不到 `t()`，切語言不會變。建議 `convert` 回傳 `null`，讓 caller 自己顯示 i18n pending 字串
- **`card/[id].tsx` `generateHistory` 仍是假數據**：`Math.sin(seed + i * 9301 + 49297)` 生成看似真實的假趨勢，沒 PPT 資料時應改為 empty state 而非模擬數據
- Supabase migration `20260514_admin_rpcs_and_role.sql` 需手動在 Dashboard 跑（未確認已 deploy）
- 圖片自動下載腳本（`pokemon_box_downloader.py`）無法在 sandbox 安裝 `duckduckgo-search`，用戶需手動蒐集圖片

---

## 有用的事實 / 數據

### 日版 Pokemon TCG 原價
| Pack 價 | Box（30 packs） | HKD 約 |
|---------|----------------|--------|
| ¥180    | ¥5,400         | HK$280 |
| ¥200    | ¥6,000         | HK$310 |
| ¥165    | ¥4,950         | HK$257 |（Sword & Shield）
| ¥162    | ¥4,860         | HK$252 |（Sun & Moon 早期）
| ¥150    | ¥3,000         | HK$156 |（BW，20 packs/box）

### 重要 set 名稱修正
| 編號  | 正確日文名           | 英文名                  |
|-------|---------------------|------------------------|
| M1L   | メガブレイブ          | Mega Brave             |
| M1S   | メガシンフォニア       | Mega Symphonia         |
| M2    | インフェルノX          | Inferno X              |
| M2a   | MEGAドリームex        | MEGA Dream ex          |
| M3    | ニルの虚空             | Nihil Zero             |
| M4    | ニンジャスピナー       | Ninja Spinner          |
| M5    | アビスアイ             | Abyss Eye（2026/5/22） |
| SV8a  | バトルパートナーズ     | Battle Partners        |
| SV9   | ホットエアアリーナ     | Hot Air Arena          |
| SV9a  | ロケット団の栄光       | Glory of Team Rocket   |

### App 技術架構
- Framework：React Native + Expo Router
- Backend：Supabase（Auth + DB + Storage + Edge Functions）
- 價格數據：PokemonPriceTracker (PPT) API，透過 Supabase Edge Function proxy（key 不進 bundle）
- 圖片解析順序：artofpkm.com → TCGdex JA → pokemontcg.io（tcgplayer-cdn 403 不可用）
- PPT cache：in-memory（session）→ Supabase DB（hot: 6h TTL，individual: 24h TTL）→ PPT API
- 語言：zh-HK / zh-CN / en / ja（i18next）
- Supabase Project ID：`vudqydqzrlgetcdegfvc`

### Admin RPCs（全 SECURITY DEFINER）
`is_admin`, `admin_approve_merchant`, `admin_reject_merchant`, `admin_grant_admin`, `admin_revoke_admin`, `admin_find_user_by_email`, `admin_list_admins`

---

## 行動項目

- [ ] **Fix `portfolio.tsx`**：`fetchHiresJPImages` 段加 `try/finally { setLoading(false) }`
- [ ] **Fix `CurrencyContext`**：`convert` 回傳 `null`（usdPrice ≤ 0），caller 自行顯示 i18n 文字
- [ ] **Fix `card/[id].tsx`**：移除 `generateHistory` fallback，沒真實 PPT history 時顯示 empty state
- [ ] **Deploy migration**：`supabase/migrations/20260514_admin_rpcs_and_role.sql` → Supabase Dashboard SQL Editor 跑
- [ ] **測試 admin panel**：用 `potodesignstudio@gmail.com` 登入，測 approve/reject merchant + addAdmin flow
- [ ] **手動整理 Pokemon 卡盒圖片**：按 `001_M1L_xxx.png` 格式命名，放入 `pokemon_box_images/` 目錄
- [ ] **抽共用 util**：`estimatePSA10(base, isJp)` 集中管理 `base * (isJp ? 3 : 4)` 邏輯（目前分散在 `search.tsx` 4處 + `index.tsx` 2處）

---

## 廢棄資訊

- ~~`PSA_MULT_JP = 3` / `PSA_MULT_EN = 4` 常數~~ → 已刪，改為 `pricePending` + `isEstimate: true`
- ~~Admin 直接 upsert `user_roles`~~ → 改 RPC
- ~~`profiles.email` 查詢~~ → `profiles` 沒有 email 欄，改用 `admin_find_user_by_email` RPC 查 `auth.users`
- ~~`listing-upload.tsx` 的 `handleCardSearchChange` / `searchCards` / `selectCard`~~ → dead code，已刪
- ~~Pokemon 圖片自動下載（eBay/Google/DuckDuckGo scraping）~~ → 全部因反爬蟲被擋，放棄，改手動
- ~~原版完整價格表（10 欄，含 eBay USD）~~ → 改為 5 欄 HKD 版本
- ~~`渲染 today's hot` 和 `認證商店` 一直 loading 的問題~~ → 尚未確認根因，用戶未提供更多 console log

---

## 相關檔案

### 產出檔案
- `/Users/alvin/collectr/日版Pokemon卡盒價格表_簡化版_2026年5月.xlsx` — 5欄 HKD 版，113款卡盒
- `/Users/alvin/collectr/日版Pokemon卡盒完整價格表_2026年5月.xlsx` — 舊版 10 欄完整表（可刪）
- `/Users/alvin/collectr/Pokemon卡盒編號對照表.txt` — 001–106 號碼對照純文字版
- `/Users/alvin/collectr/pokemon_box_downloader.py` — 圖片下載+去背腳本（需手動安裝 `duckduckgo-search` + `rembg`）

### App 核心檔案（今天修改過）
- `app/_layout.tsx` — 加 SIGNED_OUT cache clear
- `app/(tabs)/index.tsx` — home screen，portfolio chart，hot cards
- `app/(tabs)/search.tsx` — 搜尋，booster box，abort signal
- `app/(tabs)/portfolio.tsx` — 收藏列表，image batch-fetch（**setLoading bug 未修**）
- `app/(tabs)/shops.tsx` — 商店列表，useCallback fix
- `app/(tabs)/card/[id].tsx` — 卡片詳情，**假 chart data 未修**
- `app/(tabs)/settings.tsx` — i18n fix
- `app/admin.tsx` — 全改 RPC + i18n
- `app/new-post.tsx` — ToS AsyncStorage cache
- `app/login.tsx` — Phone OTP + Google + Apple
- `app/edit-profile.tsx` — 改 username/bio/avatar
- `lib/artofpkm.ts` — module cache + `clearArtofpkmCaches()`
- `lib/jpImages.ts` — 共用 JP 圖片解析 + `clearJpImageCaches()`
- `lib/pokeprice.ts` — PPT API service，abort signal，8s timeout
- `contexts/CurrencyContext.tsx` — **`'價格待定'` 硬編碼未修**
- `supabase/migrations/20260514_admin_rpcs_and_role.sql` — **需 deploy**
- `FIXES_2026-05-14.md` — 今日修改記錄
