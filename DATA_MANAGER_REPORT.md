# Collectr — Data Manager 代碼審查報告
> 審查日期：2026-05-15 | 審查範圍：全庫（app、lib、constants、supabase/migrations、supabase/functions、contexts）
> 上次報告：2026-05-10

---

## 項目概覽

**Collectr** 是一個香港 Pokemon TCG 卡牌收藏 + 二手交易 App，技術棧為：
- **前端**：React Native (Expo Router)
- **後端**：Supabase (PostgreSQL + Edge Functions + Storage)
- **外部 API**：pokemontcg.io（卡牌資料）、PPT via `ppt-proxy` Edge Function、PriceCharting via `pc-proxy`

功能模組：投資組合、市場、社交、商家系統、內容審核、通知、聊天、管理後台、JP 圖片解析。

---

## ✅ 上次問題 — 已全部修正

| 問題 | 狀態 |
|------|------|
| API Keys 明文放進 Git | ✅ 已修正 — 全部改用 `EXPO_PUBLIC_*` env vars |
| `likes_count` 無 trigger | ✅ 已修正 — `20260511_likes_count_trigger.sql` |
| `notifications` INSERT policy 過寬 | ✅ 已修正 — `20260513_security_fixes_round2.sql` |
| `hk_market_prices` 任意 auth 用戶可寫 | ✅ 已修正 |
| `inbox`/`chat` 未登記於 `_layout.tsx` | ✅ 已修正 |
| `pg_cron` 在 migration 裡 | ✅ 已修正 — `20260512_fix_pg_cron_and_rls.sql` |
| 電話號碼 hardcode 進 git | ✅ 已移除 — 改為注釋佔位符 |
| `admin.tsx` 未在 `_layout.tsx` 登記 | ✅ 已修正 |
| Apple 登入死按鈕 | ✅ 已修正 — 改用 `expo-apple-authentication` native SDK |
| `price_hkd` 不存在的欄位名稱在 constraint | ✅ 已修正 — 現在正確使用 `price` |
| messages content 無上限 | ✅ 已修正 — `between 1 and 2000` |

---

## 🔴 嚴重問題（需要立即修正）

### 1. `admin_approve_merchant` 可以降級 admin/super_admin 的角色

**位置：** `supabase/migrations/20260514_admin_rpcs_and_role.sql`，第 77–80 行

```sql
-- 現狀（危險）
insert into public.user_roles (user_id, role, status)
  values (v_user_id, 'certified_merchant', 'active')
  on conflict (user_id) do update
    set role = 'certified_merchant', status = 'active';  -- 無條件覆蓋！
```

如果一個 `admin` 或 `super_admin` 用戶同時有 `merchant_profiles` 紀錄，任何 admin 批准該申請時，都會把他們的角色從 `admin` 降級為 `certified_merchant`。雖然機率低，但後果嚴重（被鎖定在管理後台以外）。

**同樣問題出現在 `admin_grant_admin`（第 175–178 行）：**

```sql
-- 危險：會把 super_admin 降級為 admin
on conflict (user_id) do update
  set role = 'admin', status = 'active';
```

**修正方案：**

```sql
-- admin_approve_merchant 修正
on conflict (user_id) do update
  set role = 'certified_merchant', status = 'active'
  where user_roles.role not in ('admin', 'super_admin');

-- admin_grant_admin 修正
on conflict (user_id) do update
  set role = 'admin', status = 'active'
  where user_roles.role not in ('super_admin');
```

若 `WHERE` 條件為 false，PostgreSQL 的 `ON CONFLICT DO UPDATE WHERE` 會靜默跳過 UPDATE（不報錯），從而保護現有特權角色。

---

## 🟠 重要問題（需要在下個版本修正）

### 2. 遷移文件日期錯誤 — `20250509_booster_box_prices.sql`

**位置：** `supabase/migrations/20250509_booster_box_prices.sql`

全庫 38 個 migration 文件都以 `2026` 開頭，唯獨此文件用了 `2025`。這不是功能性 bug（內容是 booster_box_prices 表的初始定義），但如果 Supabase 或 CI 工具按字典序排序 migrations，此文件會被視為最早的 migration（排在所有 `2026` 文件之前），這是正確的。

然而如果未來有人以日期作為 migration 時序的參考，這個 `2025` 的文件會造成混淆。建議重命名為 `20260509_booster_box_prices.sql`（與同日期的其他文件對齊），但需要注意重命名後 Supabase 可能重新應用此文件——**建議先備份並在 staging 環境測試**。

---

### 3. 聊天訊息沒有伺服器端內容過濾

**位置：** `app/chat/[id].tsx` + `supabase/migrations/20260511_chat.sql`

`messages` 表的 `content` 欄位有長度約束（1–2000 字符），但沒有任何內容審核層。相比之下，`posts` 表有 `moderate-post` Edge Function + Sightengine。

這意味著用戶可以在私信中發送圖片連結、騷擾性文字或色情內容，系統完全不會干預。對於一個有商家交易場景的 app，這個漏洞可以被用於欺詐或騷擾。

**建議：**
- 短期：在 `messages` RLS INSERT policy 加入基本文字過濾 trigger（例如 block 已知的 spam 關鍵字）
- 中期：創建 `moderate-message` Edge Function，對圖片 URL 類訊息調用 Sightengine

---

### 4. `_layout.tsx` 有三個不存在的 Stack.Screen 宣告

**位置：** `app/_layout.tsx`

```tsx
// 這三個文件不存在，auth 已改為 Phone OTP
<Stack.Screen name="change-password" ... />
<Stack.Screen name="forgot-password" ... />
<Stack.Screen name="reset-password" ... />
```

`change-password.tsx`、`forgot-password.tsx`、`reset-password.tsx` 這三個文件都不存在於 `app/` 目錄。Expo Router 在啟動時不會報錯，但如果這些路由被意外導航到（例如 deep link、舊版 app 緩存的路由），用戶會看到空白屏幕或 crash。

**修正方案：** 從 `_layout.tsx` 刪除這三個 `Stack.Screen` 宣告。

---

### 5. Proxy Edge Functions 在 rate-limit 失敗時 fail open

**位置：** `supabase/functions/ppt-proxy/index.ts` + `supabase/functions/pc-proxy/index.ts`

兩個 proxy 函數在調用 `bump_proxy_usage` RPC 失敗時（例如 Supabase 短暫宕機），都會記錄一個 warning 並**繼續轉發請求**（fail open）。這意味著在 rate-limit 表不可用的窗口期，用戶可以無限調用上游 API。

```ts
// 現狀
const { error } = await supabase.rpc('bump_proxy_usage', ...);
if (error) {
  console.warn('[ppt-proxy] rate-limit rpc failed, continuing:', error.message);
  // 繼續執行！沒有 return
}
```

這是一個有意識的設計取捨（優先可用性而非嚴格限流）。如果上游 API 費用按量計費，建議在生產環境改為 fail closed：

```ts
if (error) {
  return new Response(JSON.stringify({ error: 'rate limit service unavailable' }), {
    status: 503, headers: { 'Content-Type': 'application/json' }
  });
}
```

---

### 6. Photo 數量限制不一致：DB 允許 10，App 只允許 4

**位置：** `supabase/migrations/20260514_security_hardening.sql`（DB constraint）+ `app/listing-upload.tsx`

```sql
-- DB：允許最多 10 張
check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 10);
```

```tsx
// App：只允許 4 張
if (photoUris.length >= 4) return;
```

這不是 bug（用戶最多上傳 4 張，DB 允許 10 張是寬鬆的），但如果日後從其他入口（後台、API 直接調用）插入超過 4 張的 listing，UI 可能無法正確顯示。

**建議：** 統一為同一個常量。如果業務上 4 張是正確的限制，DB constraint 改為 `<= 4`；如果打算日後增加，在 `app` 裡用一個 `MAX_LISTING_PHOTOS = 10` 常量控制。

---

## 🟡 代碼質量問題

### 7. `app/(tabs)/card/[id].tsx` 與 `app/card/[id].tsx` 重複路由

兩個文件並存，tabs 版本在 `_layout.tsx` 裡設定了 `href: null`（隱藏於 tab bar），但兩者都是可解析的 Expo Router 路由。這可能造成導航到 `/card/[id]` 時 Expo 不確定應該用哪個版本。

**建議：** 確認哪一個是「真正在用的」版本，刪除另一個。

---

### 8. `moderate-post` Edge Function 在無 Sightengine 憑證時自動批准

**位置：** `supabase/functions/moderate-post/index.ts`

```ts
if (!SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET) {
  // Auto-approve when credentials not configured (dev mode)
  await supabase.from('posts').update({ moderation_status: 'approved' }).eq('id', postId);
  return new Response(...);
}
```

開發環境下這是合理的，但需要確認生產環境的 Supabase secrets 中已設置 `SIGHTENGINE_API_USER` 和 `SIGHTENGINE_API_SECRET`，否則所有帖子（包括色情圖片）都會自動通過審核。

---

### 9. `pending` 帖子對公眾可見

**位置：** `supabase/migrations/20260514_security_hardening.sql`，第 19–26 行

```sql
create policy "posts read approved" on public.posts
  for select using (
    moderation_status in ('approved', 'pending')  -- pending 對所有人可見
    or auth.uid() = user_id
  );
```

`pending` 狀態的帖子（尚未審核）對所有已登入用戶可見。這是否有意為之？如果用戶看到一個 `pending` 的帖子中有違規圖片，而系統後來才審核拒絕，這段時間已有人看到了。

如果希望 `pending` 只對帖子作者本人可見：

```sql
using (
  moderation_status = 'approved'
  or auth.uid() = user_id
);
```

---

## 📋 架構補充說明（本次發現的新功能）

### PPT + PC Proxy 設計
Edge Functions `ppt-proxy` 和 `pc-proxy` 實現了正確的 JWT 驗證 + 每用戶速率限制 + endpoint 白名單 + 參數 clamp。API keys 完全在 Supabase secrets 中，不暴露於客戶端。設計良好。

### `artofpkm.ts` + `jpImages.ts` — JP 圖片解析
雙層 cache（命中 + 未命中），在 `SIGNED_OUT` 事件時清除 cache 防止跨用戶資料洩漏。TCGdex 查詢使用嚴格匹配（無模糊 fallback），設計決策正確——避免顯示錯誤卡牌圖片。

### 管理後台 (admin.tsx) 架構
客戶端先查詢 `user_roles` 做 UI 守衛，所有操作通過 SECURITY DEFINER RPCs 在 DB 層重新驗證 admin 身份。兩層驗證設計正確。`super_admin` 角色在 `20260514_super_admin.sql` 中正確添加並保護不被普通 admin 撤銷。

---

## 優先修正清單（按緊急程度）

| 優先級 | 問題 | 修正難度 |
|--------|------|--------|
| 🔴 | `admin_approve_merchant` + `admin_grant_admin` 可降級特權角色 | 低（兩行 WHERE clause） |
| 🟠 | 刪除 `_layout.tsx` 中三個幽靈 Stack.Screen | 低（刪除三行） |
| 🟠 | 確認生產環境 Sightengine 憑證已設置 | 低（Supabase Dashboard 確認） |
| 🟠 | 明確 `pending` 帖子可見性策略 | 低（一行 SQL 修改） |
| 🟠 | 統一 photo 上傳限制（DB 10 vs App 4） | 低（改常量） |
| 🟡 | `20250509_booster_box_prices.sql` 日期錯誤 | 中（需 staging 測試） |
| 🟡 | 聊天訊息無伺服器端過濾 | 高（需建新 Edge Function） |
| 🟡 | Proxy rate-limit fail open → fail closed | 低（加 return 語句） |
| 🟡 | 刪除重複的 `card/[id]` 路由 | 低（刪除一個文件） |

---

## 數據庫表結構總覽（最新）

```
auth.users
  ├── profiles          (1:1) 用戶資料
  ├── user_roles        (1:1) 角色控制 (viewer | individual_seller | certified_merchant | admin | super_admin)
  ├── user_collection   (1:N) 收藏品（card + box）
  ├── merchant_profiles (1:1) 商家資料 (pending | active | rejected)
  ├── listings          (1:N) 商品上架
  ├── posts             (1:N) 社交帖子
  ├── follows           (N:N) 關注關係
  ├── post_likes        (N:N) 帖子讚好 → sync_likes_count() trigger ✅
  ├── post_comments     (1:N) 帖子留言 → sync_comments_count() trigger ✅
  ├── post_reports      (1:N) 舉報
  ├── notifications     (1:N) 通知 (SECURITY DEFINER trigger only) ✅
  ├── conversations     (N:N) 聊天對話
  ├── messages          (1:N) 聊天訊息
  └── proxy_usage       (1:1) API proxy 每小時用量追蹤

sets ──────────── cards ─── card_prices_raw    (每次爬蟲記錄)
                         └── card_prices_daily  (每日匯總)
                              └── card_latest_price (view)

fx_rates                  (匯率，目前無數據 — CurrencyContext 仍用固定值)
booster_box_prices        (封箱價格快取，TTL 3天)
hk_market_prices          (HK 市場即時最低價，service_role only 可寫) ✅
hk_price_history          (HK 市場價格歷史，每日一筆)
artofpkm_card_images      (JP 卡牌圖片 Supabase 快取)
shops                     (靜態店舖種子數據)
```

---

*報告由 Data Manager 生成 — 2026-05-15*
