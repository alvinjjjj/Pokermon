# Collectr Code Review — 2026-05-13

涵蓋今日新增/修改的所有檔案、相關 dependencies、以及一些舊有但今天 review 才浮現的問題。

---

## 🔴 P0 — 需要今天 / 明天前修

### 1. PPT API key **仍然會被打包進 bundle**

`constants/config.ts` 第 35-36 行：

```ts
export const POKEPRICE_API_KEY: string =
  process.env.EXPO_PUBLIC_POKEPRICE_KEY ?? '';
```

只要使用 `EXPO_PUBLIC_` 前綴，Expo 就會把這個變數寫進 JS bundle，**不管**程式碼有沒有用到它。`USE_PROXY = true` 只是讓 runtime 不去呼叫 PPT，但 key 本身仍然能被任何反編譯 IPA / AAB 的人撈出來。

同樣問題：`EXPO_PUBLIC_POKEMON_TCG_KEY`、`EXPO_PUBLIC_JUSTTCG_KEY`、`EXPO_PUBLIC_PRICECHARTING_TOKEN`（PriceCharting token 還更慘 — `lib/boosterPrices.ts` 直接 client-side 呼叫，所以實際在用）。

**修法：**
1. `.env` 把 `EXPO_PUBLIC_POKEPRICE_KEY` 改名成 `POKEPRICE_KEY`（沒前綴 → 只在 build server / Supabase secrets 看得到）。
2. 從 `constants/config.ts` 刪掉 `POKEPRICE_API_KEY` export。
3. `lib/pokeprice.ts` 把 `USE_PROXY = false` 那條 dead branch 整段刪掉，不要 import `POKEPRICE_API_KEY`。
4. PriceCharting：把 `fetchPriceCharting` 搬到 Edge Function（另開一個 `pc-proxy`，跟 ppt-proxy 同樣加 JWT），client 改打 proxy。

### 2. `supabase/functions/delete-account/index.ts` 有 schema mismatch — 帳號刪除會留 orphan data

對照 migration：
- 第 43 行 `post_reports` 用 `reported_user_id` — **這個欄位不存在**（只有 `reporter_id`）。
- 第 44 行 `notifications` 用 `recipient_id, sender_id` — 實際欄位是 `user_id, actor_id`。
- 第 46 行 `comments` table — 實際 table 名是 `post_comments`。

這些 query 都會回 error，但程式沒檢查每一條的 error，所以**靜默失敗**。用戶按「刪除帳號」之後，他的 notifications / comments / 部分 reports 還留在資料庫，違反 GDPR / Apple 帳號刪除政策。

```ts
// 改成：
await admin.from('post_reports').delete().eq('reporter_id', uid)
await admin.from('notifications').delete().or(`user_id.eq.${uid},actor_id.eq.${uid}`)
await admin.from('post_comments').delete().eq('user_id', uid)
```

並且每條 await 包進 `Promise.allSettled` 或者個別 try/catch + log，不要讓一個失敗導致整個 flow 中斷。

### 3. `moderate-post` Edge Function **完全沒有 auth**

跟今天剛修的 ppt-proxy 是同一個洞，但更嚴重 —— 它用 service role key 直接 update `posts.moderation_status`。任何人只要知道 URL 就能：
- 隨便傳 post_id 把別人的 post 改成 approved（繞過 AI 審核）
- 傳惡意 media_url 燒 Sightengine credits

**修法**（複製 ppt-proxy 的 JWT 驗證 pattern）：

```ts
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });
}
const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await userClient.auth.getUser();
if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... });

// 並且驗證 post_id 真的屬於這個 user：
const { data: postCheck } = await admin
  .from('posts').select('user_id').eq('id', post_id).single();
if (postCheck?.user_id !== user.id) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, ... });
}
```

### 4. `notifications_insert` policy 仍可被 spoof

今天改成 `with check (actor_id = auth.uid())` 本意是好的，但所有合法的 notification 都是 SECURITY DEFINER trigger 寫的（會 bypass RLS），**根本不需要 client 端 INSERT policy 存在**。

現在這個 policy 反而允許登入用戶手動 INSERT：
```
{ user_id: <victim_uuid>, actor_id: <self_uuid>, type: 'like', post_id: <any> }
```
→ 看起來像「我 like 了 victim 的某張 post」的假通知出現在 victim 的 inbox。

**修法**：把 INSERT policy 整個刪掉，notifications 只能透過 SECURITY DEFINER trigger 寫入。

```sql
drop policy if exists "notifications_insert" on public.notifications;
-- 故意不重建任何 insert policy
```

---

## 🟠 P1 — 這週內修

### 5. `app/notifications.tsx` 是 dead file（同樣的 inbox bug 在這裡重複）

今天 #2 修了 inbox 的問題，但**完全一樣的問題**還在 notifications 上：

- `app/notifications.tsx`（376 行）已經沒有任何 route 指向它（grep 全 codebase 唯一的 `router.push('.../notifications')` 指向 `/(tabs)/notifications`）
- `app/_layout.tsx` 第 55 行 `<Stack.Screen name="notifications" />` 跟舊 inbox stack screen 一樣是死設定

**修法**：
- 刪除 `app/notifications.tsx`
- 從 `app/_layout.tsx` 移除 `<Stack.Screen name="notifications" />`

### 6. `lib/justtcg.ts` 和 `lib/cardPrices.ts` 也是 dead code

完整 grep `from '.../(justtcg|cardPrices)'` 全 0 hit，但兩個檔案總共 608 行還在。`pokeprice.ts` 開頭的註解也明確說「Replaces lib/justtcg.ts and lib/cardPrices.ts」。

同時 `jtcg_price_cache` 這張 table（在 `fix_rls_policies.sql` 創建）整個 app 端 0 使用。可以一起 drop。

### 7. Migration 命名 / 結構問題

- `card_price_cache.sql`、`fix_rls_policies.sql` 沒有日期前綴 → Supabase CLI 用字母排序時會跑在所有日期前綴的 migration **前面**，破壞 dependency 順序。
- `card_price_cache.sql` 跟 `fix_rls_policies.sql` 重複定義同一張 table（兩個都有 `create table if not exists public.card_price_cache`）。雖然 idempotent，但維護地獄。
- 今天 `20260513_security_fixes.sql` 是另一輪 hotfix，等於同一張表已經改過 3 次。

**建議**：
- 把兩個無日期 migration 改名加日期前綴並 squash 進一個 baseline
- 或者把所有 cache table 的 schema 整合到一個檔案

### 8. `messages_content_check` 有微妙的繞過

```sql
check (char_length(trim(content)) > 0 and char_length(content) <= 2000)
```

上限用的是非 trim 的 `char_length(content)`。攻擊者可以送 1900 個 space + 100 個惡意字元，仍然合法。實務上影響很小（前端會顯示空白），但建議統一用 trim：

```sql
check (char_length(trim(content)) between 1 and 2000)
```

### 9. `msg_update_read` policy 太寬

```sql
create policy "msg_update_read" on public.messages
  for update using (sender_id <> auth.uid() and ...)
```

收件人能 update 自己 conversation 裡的別人訊息 — 不只是 `is_read`，**整個 row** 都能改（包括 content）。`USING` 子句沒對應的 `WITH CHECK`，所以新 row 也用 `USING` 條件，等於沒限制欄位。

**修法**：column-level grant：

```sql
revoke update on public.messages from authenticated;
grant update (is_read) on public.messages to authenticated;
```

或者在 policy 上加 `with check` 確保 content / sender_id / created_at 不變（這 RLS 做不到 column-level，所以還是用 revoke/grant）。

### 10. `ppt-proxy` 缺 rate limit + 缺 params clamp

JWT 驗證解決了 anon 濫用，但**一個登入帳號還是能輪詢**。最壞情況：攻擊者用一個免費 Collectr 帳號狂打 proxy → 20,000 daily credits 一個下午燒光。

**短期**：在 Edge Function 加參數 clamp：
```ts
if (params.limit && parseInt(params.limit) > 50) params.limit = '50';
if (params.includeHistory === 'true' && params.days && parseInt(params.days) > 30) params.days = '30';
```

**中期**：用 Supabase pg 加一張 `ppt_proxy_usage` 計數表，每 user_id 每小時最多 N 次。或接 Upstash Redis（Edge Function 友善）。

### 11. `loadHotCards('')` 在 render phase 被呼叫

`app/(tabs)/search.tsx` 第 336-339 行：

```tsx
if (!didLoad.current) {
  didLoad.current = true;
  loadHotCards('');   // ← 這會 setHotLoading(true) 在 render 中
}
```

React 規則：render phase 不能呼叫 setState（不管是直接還是間接）。現在能 work 是因為 React 的容忍機制 + ref guard 防止 infinite loop，但會在 React 19 / Strict Mode 下出警告。

**修法**：

```tsx
useEffect(() => {
  if (!didLoad.current) {
    didLoad.current = true;
    loadHotCards('');
  }
}, []);
```

### 12. `app/new-post.tsx` `handlePost` 沒 double-tap guard

對比 `listing-upload.tsx` 和 `login.tsx` 都有 `if (submitting/loading) return`，`new-post.tsx` 只靠 `disabled={uploading}` 在 UI 防護。如果按鈕 disable 有 race（在 setState 跟 onPress 之間），可能會跑兩次上傳 → 兩個 post + double moderation invoke。

```tsx
const handlePost = async () => {
  if (uploading) return;             // ← 加這行
  if (!media) { ... return; }
  setUploading(true);
  // ...
};
```

另外失敗的 catch 有 `setUploading(false)`，但**成功路徑沒有 reset** —— 靠 `router.replace` 卸載組件來「處理」。如果 navigation 失敗（少見但可能），按鈕永遠 stuck。建議把 reset 放 finally。

### 13. Hardcoded 中文字串 in `search.tsx`

```tsx
// 第 728 行
card_name: `${selectedBox.nameJP} 盒`,
// 第 1178-1179 行
`${jpCards.length}... 張`
// 第 1193 行
<Text>— 已顯示全部 —</Text>
```

這些都應該進 locale。日文 / 簡中 / 英文用戶會看到中文字。

---

## 🟡 P2 — 之後優化

### 14. Header `fetchUnread` 沒 cleanup

`components/Header.tsx` 的 `useFocusEffect` 在 user 切換 tab 時觸發，但：
- 沒有 `AbortController`，組件 unmount 時 setState 會 warning
- 每次切 tab 都 3 條 query（notifications + buyer + seller convs）— 對 5,000 用戶 / 每天 100 次 tab 切換來說，是 1.5M req/day 純 badge query

你提到的 Realtime subscribe 是對的方向，但成本考量：
- Supabase Realtime 每 connection 計費。如果 5,000 DAU 同時連，會超 free tier
- **折衷方案**：用 Supabase Realtime 但只訂閱**自己的** `notifications` row（`filter: user_id=eq.<my_uuid>`），不訂閱 conversations（用戶在 inbox 頁時才即時，其他時間用 polling）

或者更便宜：把 fetchUnread 改成最多每 30 秒呼叫一次（debounce），focus 切太頻繁也不會狂打 DB。

### 15. `parseFloat(price)` 沒處理千分位

`listing-upload.tsx` 第 236 行 `const priceNum = parseFloat(price);` — 用戶輸入 "1,500"，`parseFloat` 會回 1（停在第一個逗號）。香港用戶習慣輸入逗號千分位。

```ts
const priceNum = parseFloat(price.replace(/,/g, ''));
```

### 16. `notify_on_follow` 的 `on conflict do nothing` 是 no-op

```sql
insert into public.notifications(user_id, actor_id, type)
values (new.following_id, new.follower_id, 'follow')
on conflict do nothing;
```

`notifications` 沒有 unique constraint，所以 `on conflict do nothing` 永遠不會觸發。用戶 follow → unfollow → follow 同一人會疊三個通知。

**修法**：要嘛加一個 partial unique index：
```sql
create unique index notifications_follow_unique
  on public.notifications(user_id, actor_id, type)
  where type = 'follow';
```
要嘛在 trigger 裡先 delete 舊的再 insert。

### 17. `loadAll(true)` 在 my-listings 後做了 optimistic update + reload — 多餘

```tsx
setListings(prev => prev.map(l => l.id === actionTarget.id ? { ...l, status: newStatus } : l));
loadAll(true);
```

樂觀更新已經把 UI 改好，又 `loadAll` 重新拉 → 多一次 DB query，且如果 server 端有 trigger 修改了其他欄位（如 `updated_at`），會看到輕微閃爍。如果信任 server 寫成功（沒 error 才進這個 branch），可以**只**樂觀更新，不 reload。

### 18. `new-post.tsx` 用 `arrayBuffer()` 上傳 50MB video

```ts
const response = await fetch(media.uri);
const arrayBuffer = await response.arrayBuffer();
```

把整個 50MB 載入 JS heap，低階 Android（4GB RAM）可能 OOM。改用 FormData：

```ts
const formData = new FormData();
formData.append('file', { uri: media.uri, name: media.fileName, type: media.mimeType } as any);
// 然後用 supabase.storage....upload(filePath, formData, ...)
```

### 19. `pokeprice.ts` Search 函式沒 in-memory cache

`searchJPCards` / `searchENCards` 每次都打 PPT API。用戶搜「皮卡丘」按 Enter，又改 filter 又重打。同一個 query 過 30 秒內可以 cache。

```ts
const _searchMem = new Map<string, { data: PPTCard[]; at: number }>();
const SEARCH_TTL = 30 * 1000;

export async function searchJPCards(name: string, limit = 100) {
  const key = `jp_${name.toLowerCase().trim()}_${limit}`;
  const mem = _searchMem.get(key);
  if (mem && Date.now() - mem.at < SEARCH_TTL) return mem.data;
  // ... fetch
  _searchMem.set(key, { data: cards, at: Date.now() });
  return cards;
}
```

### 20. `handleSearch` 沒 useCallback

`search.tsx` 第 519 行 `const handleSearch = (text: string) => { ... }` — 每 render 都重建。傳給 `<TextInput onChangeText>` 會讓 TextInput 重渲染。實際影響小，但搜尋欄輸入時很敏感。

---

## ✅ 已驗證 OK 的部分

- 今日 #1 `fetchAllCharacterIds()` 分頁 regex（`[?&]page=${page + 1}(?:[^0-9]|$)`）✓ 正確
- 今日 #3 `zh-CN.json` `newPost.fileTooLarge` — 4 個 locale key 完全一致，0 缺失 ✓
- 今日 #4 `loadAll(true)` 修復 — 樂觀更新後傳 `true` 觸發 `refreshing` 而非 `loading` ✓
- 今日 #5 ppt-proxy JWT 驗證 — 邏輯正確（除上面 P1 的 rate-limit 缺口）
- `card_price_cache` RLS：anon read + authenticated upsert/update，policy 正確 ✓
- `messages_content_check` 加 2000 字上限 — 上限有了（雖然有 P1 的 trim 細節）
- `artofpkm_card_images` authenticated insert/update — 配合 service role import script 正常運作
- `login.tsx`、`register.tsx`、`listing-upload.tsx`、`post-detail.tsx`、`social.tsx` 的 double-tap guard 都有正確 reset（finally 或 explicit setSubmitting(false)）
- Inbox tab 隱藏 / Header badge UI / 4 locale 都更新 ✓

---

## 📋 建議的修復順序

**今晚（睡前 30 分鐘）**
1. `supabase functions deploy ppt-proxy --no-verify-jwt`（你今天 todo 提到的）
2. 同樣 deploy `moderate-post` 之前先在本機加 JWT 驗證程式碼，然後一起 deploy 兩個
3. drop `notifications_insert` policy（一行 migration）

**明天**
4. 處理 PPT/PriceCharting API key bundle 洩漏（重命名 env + 把 PriceCharting 搬 proxy）
5. 修 delete-account 的 schema mismatch
6. 刪 `app/notifications.tsx` + `<Stack.Screen name="notifications" />`

**這週內**
7. 刪 `lib/justtcg.ts`、`lib/cardPrices.ts`、`jtcg_price_cache` table
8. 規範化 migration 命名
9. `search.tsx` 改 `useEffect` 取代 render-phase setState
10. PPT proxy params clamp + 簡單 rate limit

**之後 sprint**
11. P2 全部
12. Header 改 Realtime（如果用戶留在 app 行為 > 5min 中位數）

---

## 📊 整體評估

| 維度 | 評分 | 備註 |
|---|---|---|
| Security | 6 / 10 | RLS 大致對，但 edge function auth 一致性差 |
| Code quality | 7 / 10 | 命名 / 結構乾淨，但有 dead code 和 hardcoded string |
| i18n | 8 / 10 | 4 locale 同步，只有 search.tsx 漏幾個 string |
| Migration hygiene | 5 / 10 | 命名混亂，hotfix 套 hotfix |
| Performance | 7 / 10 | 多層 cache 設計好，但 search 缺 mem cache |
| 帳號刪除合規 | 3 / 10 | schema mismatch 導致 orphan data |

**最該優先處理**：API key bundle 洩漏（#1）和 delete-account schema mismatch（#2）。其餘可漸進處理。
