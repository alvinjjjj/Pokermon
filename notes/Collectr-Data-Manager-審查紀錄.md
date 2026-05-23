# Collectr Data Manager 審查紀錄

> 涵蓋範圍：多輪對話（~Session 1–9）| 最後更新：2026-05-15

---

## 核心決策

### 架構選擇
- **Admin 系統**：使用 SECURITY DEFINER RPCs（非放寬 RLS），讓 admin 能操作其他用戶的資料，同時保持 RLS 完整性。所有 RPC 都在 DB 層重新驗證 `is_admin()`，客戶端另有 `user_roles` query 做 UI 守衛（兩層防禦）。
- **API Key 保護**：所有外部 API key 改用 `process.env.EXPO_PUBLIC_*`（客戶端公開 key）或 Supabase secrets（私密 key，只在 Edge Functions 中使用）。不再有任何 hardcode key。
- **Proxy 設計**：`ppt-proxy` 和 `pc-proxy` Edge Functions 負責把上游 API key 放在 server side，前端只調用 proxy endpoint，並有 JWT 驗證 + 每用戶 rate limit + endpoint 白名單。
- **通知系統**：`notifications` 表的 client INSERT policy 完全刪除，所有通知只通過 SECURITY DEFINER trigger 寫入，防止用戶騷擾他人。
- **JP 圖片解析**：使用嚴格匹配（無模糊 fallback）避免顯示錯誤卡牌圖片；caches 在 `SIGNED_OUT` 時清除防止跨用戶資料洩漏。
- **`super_admin` 角色**：透過手動 SQL 在生產 DB 授予（不 hardcode 在 migration 裡），`admin_revoke_admin` 無法撤銷 super_admin，`is_admin()` 同時承認 `admin` 和 `super_admin`。
- **Apple 登入**：改用 `expo-apple-authentication` native SDK（舊版死按鈕已廢棄）。
- **Auth 方式**：Phone OTP 為主，Google OAuth + Apple Sign In 為輔。密碼登入已完全移除。

---

## 待解問題

- `fx_rates` 表仍是死的——`CurrencyContext` 使用固定匯率（USD:1, HKD:7.8, JPY:155），尚無 Edge Function 拉取真實匯率
- `user_collection.card_id` 仍是 `text` 而非 UUID FK，與 `cards` 表無法直接 JOIN，遷移計劃無具體時間表
- JustTCG（舊 JTCG）API 已廢棄（`20260513_drop_dead_jtcg_cache.sql`），但 `lib/justtcg.ts` 的狀態未確認是否已清理
- 聊天訊息無伺服器端內容過濾（posts 有 Sightengine，messages 沒有）
- `pending` 帖子對所有已登入用戶可見，是否有意為之未明確確認

---

## 有用的事實 / 數據

### 技術棧
- **前端**：React Native + Expo Router（file-based routing）
- **後端**：Supabase（PostgreSQL + Edge Functions + Storage + Realtime）
- **外部 API**：pokemontcg.io、PPT（PokemonPriceTracker）、PriceCharting、Sightengine（圖片審核）、artofpkm（JP 卡圖）、TCGdex JA

### 角色系統（`user_roles.role`）
```
viewer | individual_seller | certified_merchant | admin | super_admin
```

### Migration 文件總數：38 個（截至 2026-05-15）
- 最早：`20250509_booster_box_prices.sql`（⚠️ 日期應為 20260509，有錯字）
- 最新：`20260514_super_admin.sql`

### Edge Functions（4 個）
```
supabase/functions/delete-account/index.ts
supabase/functions/moderate-post/index.ts
supabase/functions/pc-proxy/index.ts
supabase/functions/ppt-proxy/index.ts
```

### Rate Limits
- `ppt-proxy`：60 requests/hour/user
- `pc-proxy`：30 requests/hour/user

### Key 文件路徑
```
lib/supabase.ts          — Supabase client（env vars only）
lib/artofpkm.ts          — JP 圖片 Supabase 查詢 + cache
lib/jpImages.ts          — JP 圖片雙策略解析器
lib/lowestPrices.ts      — 最低價查詢（⚠️ 無分頁，大量 cardIds 會拉太多數據）
constants/config.ts      — 公開設定（env vars only）
contexts/CurrencyContext.tsx — 固定匯率 fallback（待接真實 API）
app/admin.tsx            — Admin 後台
app/_layout.tsx          — Expo Router root layout
```

### EAS Project ID
`eab0d040-923e-4705-bff8-1b77c06118a9`（非敏感）

---

## 行動項目

### 🔴 立即（本 Sprint）
- [ ] **修正 `admin_approve_merchant`**：加 `WHERE user_roles.role not in ('admin', 'super_admin')` 防止降級特權角色
  - 位置：`supabase/migrations/20260514_admin_rpcs_and_role.sql`，第 79–80 行
- [ ] **修正 `admin_grant_admin`**：加 `WHERE user_roles.role not in ('super_admin')` 防止降級 super_admin
  - 位置：同上，第 176–178 行

建議新增 migration `20260515_fix_admin_conflict_update.sql`，用 `CREATE OR REPLACE` 修正這兩個 RPC

### 🟠 本版本
- [ ] 刪除 `_layout.tsx` 裡的三個幽靈 Stack.Screen（`change-password`, `forgot-password`, `reset-password`）
- [ ] 在 Supabase Dashboard 確認生產環境已設置 `SIGHTENGINE_API_USER` + `SIGHTENGINE_API_SECRET`，否則所有帖子自動通過審核
- [ ] 明確 `pending` 帖子可見性策略：若只應對作者本人可見，將 `moderation_status in ('approved', 'pending')` 改為 `moderation_status = 'approved'`
- [ ] 統一 photo 上傳上限：DB constraint 是 10，app 是 4——挑一個，統一

### 🟡 技術債（1–2 個月）
- [ ] 修正 `20250509_booster_box_prices.sql` 日期錯字（重命名前先在 staging 測試）
- [ ] `lib/lowestPrices.ts` 的 `fetchLowestPrices` 改用 PostgreSQL `DISTINCT ON (card_id)` 在 DB 端取最低價，避免拉大量數據到客戶端
- [ ] Proxy rate-limit 失敗時從 fail open 改為 fail closed（`ppt-proxy` 和 `pc-proxy` 各加一個 `return` 語句）
- [ ] 刪除 `app/(tabs)/card/[id].tsx` 或 `app/card/[id].tsx` 其中一個重複路由
- [ ] `CurrencyContext` 接入真實匯率 API，讓 `fx_rates` 表活起來（建議用 frankfurter.app，每日 cron）
- [ ] `user_collection.card_id` 遷移到 UUID FK（先加 `cards_uuid` nullable 欄位，用 `external_id` 對應填入，驗證後切換）
- [ ] 聊天訊息伺服器端過濾（短期：RLS trigger 基本文字過濾；中期：`moderate-message` Edge Function）

---

## 廢棄資訊

- **密碼登入**：已完全移除。`change-password.tsx`、`forgot-password.tsx`、`reset-password.tsx` 已棄用，對應 Stack.Screen 還沒清理（待辦）
- **JustTCG (JTCG) 價格 cache**：`jtcg_price_cache` 表已在 `20260513_drop_dead_jtcg_cache.sql` 刪除，功能廢棄
- **`price_hkd` 欄位**：從未存在過。`listings` 表的實際欄位是 `price`。`20260514_security_hardening.sql` 的早期版本有誤用 `price_hkd`，已修正
- **`notifications` insert policy `with check (true)`**：已刪除。舊版在 `20260510_social_comments_notifications.sql`，現已被 `20260513_security_fixes_round2.sql` 覆蓋
- **`hk_market_prices` authenticated 可寫 policy**：已刪除，現在只有 service_role / trigger 可寫
- **電話號碼 `85262183666`**：曾在 `20260514_super_admin.sql` hardcode，已移除並替換為注釋
- **`app/app/` 路由結構**：曾存在 `app/app/edit-profile.tsx`、`app/app/register.tsx` 等重複路徑，確認已清理（或仍待清理——需再確認）

---

## 相關檔案

### 本對話產出 / 修改的檔案
```
/Users/alvin/collectr/DATA_MANAGER_REPORT.md     — 主審查報告（最新版 2026-05-15）
/Users/alvin/collectr/notes/Collectr-Data-Manager-審查紀錄.md  — 本文件
```

### 本對話重點審查的檔案
```
supabase/migrations/20260514_security_hardening.sql
supabase/migrations/20260514_admin_rpcs_and_role.sql
supabase/migrations/20260514_super_admin.sql
supabase/migrations/20260511_likes_count_trigger.sql
supabase/migrations/20260513_security_fixes_round2.sql
supabase/functions/ppt-proxy/index.ts
supabase/functions/pc-proxy/index.ts
supabase/functions/delete-account/index.ts
supabase/functions/moderate-post/index.ts
app/_layout.tsx
app/login.tsx
app/admin.tsx
app/chat/[id].tsx
app/listing-upload.tsx
lib/supabase.ts
lib/artofpkm.ts
lib/jpImages.ts
constants/config.ts
contexts/CurrencyContext.tsx
```
