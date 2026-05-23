# Collectr Code Review — 2026-05-13 Round 2

審查 4.6 session 完成的所有改動（shops/listing-upload/search/chat/index/my-listings/lib/artofpkm/admin/settings/locales）。

---

## ⛔ 嚴重程度總覽

| Severity | Count | 摘要 |
|---|---|---|
| **🔴 P0** | **6** | 4 個 admin 安全洞、1 個 admin 功能本身不 work、1 個 search 假修復 |
| **🟠 P1** | **8** | dead code 編譯失敗、chat 訊息重複、render 性能等 |
| **🟡 P2** | **5+** | i18n 硬編碼、命名一致性 |

---

## 🔴 P0 — 必須立刻修

### 1. `admin.tsx` 直接 client-side 改 user_roles / merchant_profiles — 是漏洞同時功能也壞掉

**位置：** `app/admin.tsx:165-167, 200-204, 230-233, 237-239, 263-265`

**問題：** admin 所有功能（核准、拒絕、加 admin、移除 admin）都用 client 端 `supabase.from(...).update/upsert/delete()` 直接寫 DB。

對照現有 RLS 看會發生什麼：

| 操作 | 目標 table | 現有 RLS WITH CHECK | 預期結果 |
|---|---|---|---|
| addAdmin → upsert | `user_roles` | `auth.uid()=user_id AND role IN ('viewer','individual_seller')` | **被擋**（admin 改別人 row，且 role 不是 viewer/individual_seller）|
| removeAdmin → delete | `user_roles` | 無 delete policy | **被擋** |
| approve → update | `merchant_profiles` | `auth.uid() = user_id` | **被擋**（admin 改別人 row）|
| reject → update | `merchant_profiles` | 同上 | **被擋** |

**所以 admin.tsx 整個功能根本不能 work** — 用戶按「批准」會看到 success 但實際 DB 沒動（或看到 RLS error）。

**修法 — 必須走 SECURITY DEFINER RPC：**

```sql
-- 新 migration: 20260513_admin_rpcs.sql

-- 工具函數：檢查 caller 是不是 admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'
  );
$$;

-- 批准商家
create or replace function public.admin_approve_merchant(p_merchant_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin';
  end if;

  select user_id into v_user_id
    from public.merchant_profiles where id = p_merchant_id;
  if v_user_id is null then raise exception 'merchant not found'; end if;

  update public.merchant_profiles
    set status = 'active', seller_type = 'certified_merchant'
    where id = p_merchant_id;

  insert into public.user_roles (user_id, role, status)
    values (v_user_id, 'certified_merchant', 'active')
    on conflict (user_id) do update
      set role = 'certified_merchant', status = 'active';
end;
$$;

create or replace function public.admin_reject_merchant(p_merchant_id uuid, p_reason text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  update public.merchant_profiles
    set status = 'rejected', rejection_reason = p_reason
    where id = p_merchant_id;
end;
$$;

create or replace function public.admin_grant_admin(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  insert into public.user_roles (user_id, role, status)
    values (p_user_id, 'admin', 'active')
    on conflict (user_id) do update set role = 'admin', status = 'active';
end;
$$;

create or replace function public.admin_revoke_admin(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot revoke self'; end if;
  -- 把 admin 改回 viewer（保留 row，避免 cascade）
  update public.user_roles set role = 'viewer' where user_id = p_user_id and role = 'admin';
end;
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

revoke all on function public.admin_approve_merchant(uuid) from public;
revoke all on function public.admin_reject_merchant(uuid, text) from public;
revoke all on function public.admin_grant_admin(uuid) from public;
revoke all on function public.admin_revoke_admin(uuid) from public;
grant execute on function public.admin_approve_merchant(uuid)   to authenticated;
grant execute on function public.admin_reject_merchant(uuid, text) to authenticated;
grant execute on function public.admin_grant_admin(uuid)        to authenticated;
grant execute on function public.admin_revoke_admin(uuid)       to authenticated;
```

然後 admin.tsx 改成：

```ts
// 改前
await supabase.from('user_roles').upsert({ user_id: targetId, role: 'admin' }, ...);

// 改後
await supabase.rpc('admin_grant_admin', { p_user_id: targetId });
```

四個 action 都改。**安全 + 真的能 work**。

---

### 2. `user_roles.role` constraint 沒包含 `'admin'` — 寫到一半會掛

**位置：** `supabase/migrations/20260509_merchant_system.sql:13`

```sql
role text not null default 'viewer'
  check (role in ('viewer', 'individual_seller', 'certified_merchant'))
```

你說「為 potodesignstudio@gmail.com 設為 admin」是手動在 Dashboard 改的，但 codebase **沒有 migration 紀錄這次改動**。

**後果：**
- 新環境重 `db push` 會用舊 constraint → 不接受 `'admin'` role
- 任何企圖 `INSERT/UPDATE role = 'admin'` 都會 fail（check constraint violation）
- 上面 P0-1 我寫的 RPC 也會 fail 在 `insert into user_roles ... 'admin'`

**修法 — 補 migration：**

```sql
-- 新 migration: 20260513_add_admin_role.sql
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('viewer', 'individual_seller', 'certified_merchant', 'admin'));
```

---

### 3. `admin.tsx` 用 `profiles.email` 查用戶 — 欄位不存在

**位置：** `app/admin.tsx:134-138`

```ts
const { data: profileData } = await supabase
  .from('profiles')
  .select('id, username')
  .eq('email', email)        // ← profiles 沒有 email 欄位！
  .maybeSingle();
```

對照 `20260508000000_card_database.sql:169-177`，`profiles` 表只有 `id / username / display_name / avatar_url / display_currency / created_at / updated_at`，**沒有 email**。

**後果：** addAdmin 永遠回 `{ data: null, error: 'column profiles.email does not exist' }`，但 code 沒檢查 error，直接 fallthrough 到 `Alert.alert('找不到用戶', ...)`，看起來像「沒這個人」。**整個 addAdmin 功能完全不能用。**

**修法 — 寫 SECURITY DEFINER RPC 查 auth.users：**

```sql
create or replace function public.admin_find_user_by_email(p_email text)
returns table(id uuid, username text)
language sql security definer
set search_path = public, auth, pg_temp
as $$
  select u.id, p.username
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(p_email)
    and public.is_admin(auth.uid())
  limit 1;
$$;

revoke all on function public.admin_find_user_by_email(text) from public;
grant execute on function public.admin_find_user_by_email(text) to authenticated;
```

然後 admin.tsx 改：

```ts
const { data, error } = await supabase.rpc('admin_find_user_by_email', { p_email: email });
const targetId = data?.[0]?.id ?? null;
const username = data?.[0]?.username ?? email;
```

---

### 4. `search.tsx` 「移除估算乘數，只顯示真實 PPT 數據」**沒有真的移除**

**位置：** `app/(tabs)/search.tsx:64-65, 630, 636, 418-419, 592-593`

宣稱「移除所有估算乘數」，實際代碼還在：

```ts
const PSA_MULT_JP: Record<string, number> = { '10': 2.5, '9': 1.5, ... };
const PSA_MULT_EN: Record<string, number> = { '10': 4, '9': 2, ... };

// getDisplayPrice (line 630)
if (market > 0) return { usd: market * mult['10'], isEstimate: true };  // ← 還在乘！
```

PSA filter 為 `'10'` 或 `'9'` 且沒 PPT 資料時，會顯示 `market × 4`（EN）或 `market × 2.5`（JP）的**估算值**，標記 `≈`。

**修法選 1（真的移除）：** 把 `PSA_MULT_*` 砍掉，沒 PPT 資料就回 `{ usd: 0, isEstimate: false }`，UI 顯示 `t('search.pricePending')`。

**修法選 2（保留但說清楚）：** 保留代碼，但更新 review report / commit message 不要說「移除」。

---

### 5. `listing-upload.tsx` 8 個 TypeScript compile errors

**位置：** `app/listing-upload.tsx:146, 149, 154, 161, 163, 165, 170, 171`

```
error TS2304: Cannot find name 'setCardSearch'.
error TS2304: Cannot find name 'setSearchResults'.
error TS2304: Cannot find name 'setSearching'.
```

從 API 搜尋改自由輸入時，state 變數被刪了（`cardSearch / searchResults / searching`），但下面 3 個 helper function 還在引用 setter：

- `handleCardSearchChange` (line 145-151) — dead code
- `searchCards` (line 153-166) — dead code
- `selectCard` (line 168-172) — dead code

且 `searchCards` 還會打 pokemontcg.io API（已不需要）。

**修法：** 整段刪掉。

```ts
// 刪掉這三個 function 從第 145 行到第 172 行
// 同時刪掉 import 的 POKEMON_TCG_API_KEY 如果其他地方沒用
```

---

### 6. ~~index.tsx「從主頁移除」實際刪 Portfolio~~ — **驗證後不是 bug**

`app/(tabs)/index.tsx:660-681` 的 `removeCard` 是 DELETE `user_collection`，但 4 個 locale 都明確標明「從作品集 / 從收藏 / from your collection / コレクションから削除」，用戶不會誤會。**OK，無需修改。**

只是 function 名稱叫 `removeCard` 但實際是 deletePortfolioEntry，命名建議改 `deleteFromCollection` 或加 JSDoc，但不影響 functionality。

---

## 🟠 P1 — 這週內必修

### 7. `chat/[id].tsx` Realtime + optimistic 競態 → 訊息重複

**位置：** `app/chat/[id].tsx:70-87, 195-208`

當用戶送訊息：
1. Optimistic insert 加入 `temp-XXX` ID 的 message
2. `insert().select().single()` 寫進 DB
3. **Realtime subscription 同時收到 INSERT 事件 → push 真實 message**（line 77-80 用 `m.id === newMsg.id` 去重，但 temp ID 跟 real ID 不一樣）
4. `.then(data => ...)` 把 temp 替換成 real（line 207）

如果順序 2 → 3 → 4，那 step 3 加進去的 real message 跟 step 4 替換出來的 real message 變**雙份**（同 id）→ React unique key warning 重新出現。

4.6 加 `<React.Fragment key={item.id}>` 是治標 — React 仍會抱怨同 id 兩個 element。

**修法 — 改 line 207 dedupe：**

```ts
} else {
  setMessages(prev => {
    const realAlreadyIn = prev.some(m => m.id === data.id);
    return realAlreadyIn
      ? prev.filter(m => m.id !== tempId)               // realtime 先到，移除 temp
      : prev.map(m => m.id === tempId ? data : m);      // realtime 沒到，替換 temp
  });
}
```

順便把 line 236 的 `<React.Fragment key={item.id}>` 可以保留也可以拿掉（FlatList 用 keyExtractor 已經給 key 了，Fragment 加 key 是冗餘但無害）。

### 8. `shops.tsx` `renderListingCard` 仍每次 render 重建

**位置：** `app/(tabs)/shops.tsx:562-564`

`ListingCard` 雖然抽出去（OK 解決 Invalid Hook Call），但 parent 的 `renderListingCard = ({ item }) => <ListingCard ... />` 是 inline arrow，每 render 一次函式 identity。FlatList 看到 renderItem 變了會重渲染所有 visible row。

**修法：**
```ts
const renderListingCard = useCallback(
  ({ item }) => <ListingCard item={item} artofpkmMap={artofpkmMap} />,
  [artofpkmMap]
);
```

### 9. `shops.tsx` `useFocusEffect` 缺 deps

**位置：** `app/(tabs)/shops.tsx:169-172`

```ts
useFocusEffect(useCallback(() => {
  loadMerchants();
  resetAndLoadListings();
}, []));  // ← 缺 deps
```

當 filter 變化後切 tab 回來，仍用舊 closure 的 filter 值。包進 useCallback 或加實際 deps。

### 10. `search.tsx` PPT search 無 abort signal

**位置：** `app/(tabs)/search.tsx:537-617`

`AbortController` 只接到 `pokemontcg.io` fetch，**沒接到** `searchENCards(...)` / `searchJPCards(...)` / `fetchHiresJPImages(...)`。當用戶快速打字，舊請求仍會打 PPT。

純數字 query「369」之所以一直 loading，是因為：
- `searchENCards` 對純數字結果空，OK
- `searchJPCards` 對「369」可能跑很久（PPT 沒索引純數字搜尋）
- 沒有 timeout → spinner 不消失

**修法：** 把 `signal` 透傳給 `searchJPCards` / `searchENCards` 並在 `pptFetch` 內判斷。或在 client 端加 5s timeout：
```ts
const timeout = setTimeout(() => controller.abort(), 5000);
try { ... } finally { clearTimeout(timeout); }
```

### 11. `lib/artofpkm.ts` filter 反邏輯 — 有 user photo 跳過、有 broken card_image_url 仍跑

**位置：** `lib/artofpkm.ts:22`

```ts
const missing = items.filter(l => !l.photo_urls?.[0]);
```

只看 `photo_urls[0]` 是否存在。**沒看 `card_image_url` 是否 broken**。即使原本就有合法的 `card_image_url`（pokemontcg.io），也會跑 artofpkm 查詢（多了一次無用 DB query）。

註解寫的意圖是「即使 card_image_url 存在也查一次以防 broken URL」—— OK 那實際做法是對的，但**沒做 cache**，每次 `loadAll` 都重打。my-listings.tsx 的 `loadAll` 每次 tab focus 都跑 → 重複查詢。

**修法：** 在 helper 內加 module-level cache：
```ts
const cache = new Map<string, string>();
// ...
const uncached = missing.filter(l => !cache.has(l.card_name));
```

### 12. `admin.tsx` 切 tab 觸發兩次 loadAdmins

**位置：** `app/admin.tsx:72-74` (useFocusEffect 已會跑) + line 427 (inline onPress 又跑一次)

```ts
<TouchableOpacity onPress={() => { setTab('admins'); loadAdmins(); }}>
```

useFocusEffect 監聽 tab 變化已經會 loadAdmins，再手動 call 一次 → 重複 query。

**修法：** 刪掉 onPress 裡的 `loadAdmins()`。

### 13. `admin.tsx` 用 `'admin'` 角色 + 沒有 `'admin'` constraint

雖然今天討論時你說手動加 `'admin'` 到 constraint 了，但 codebase 沒 migration → 重 deploy 失誤。見 P0-2 修法。

### 14. `listing-upload.tsx` 改自由輸入 → `selectedCard.id` 永遠是 null

**位置：** `app/listing-upload.tsx:236`

```ts
const effectiveName = fromPortfolio ? selectedCard?.name : cardName.trim();
```

但 `listings.card_id` 仍從 `selectedCard.id` 取（line 287 邏輯）：
```ts
card_id: selectedCard.id,
```

如果不是從 portfolio 來，`selectedCard` 是 null → `selectedCard.id` 會 throw。

**Verify 一下，可能已經被改成 nullable，但保險起見要 check：**

```ts
card_id: selectedCard?.id ?? null,
card_image_url: selectedCard?.images?.small ?? null,
```

需要看 line 287 附近的實際代碼。

---

## 🟡 P2 — 之後可優化

### 15. admin.tsx 全部硬編碼中文，沒用 t()

`app/admin.tsx` 全文 30+ 處 hardcoded Chinese strings。日文 / 英文 / 簡中用戶看到亂七八糟混合 UI。

加 locale keys（`admin.title`、`admin.pending`、`admin.approve`、`admin.removeAdminConfirm` 等），全部走 i18n。

### 16. settings.tsx admin section 也硬編碼

`app/(tabs)/settings.tsx:282, 286-287`:
```tsx
<Text>管理員</Text>           // ← 應該 t('settings.admin')
<SettingsRow label="商家審核" sub="審核認證商家申請" ... />  // ← 同上
```

### 17. admin.tsx `toLocaleDateString('zh-HK')` 硬編碼

`app/admin.tsx:298, 490` — 用 i18n.language 動態決定 locale。

### 18. search.tsx 還有硬編碼中文

P1 R1 review 已指出，4.6 沒修：
- `app/(tabs)/search.tsx:736` `selectedBox.nameJP} 盒`
- `app/(tabs)/search.tsx:1190-1191` ` 張`
- `app/(tabs)/search.tsx:1205` `— 已顯示全部 —`

### 19. `app/_layout.tsx` 沒註冊 admin Stack.Screen

`<Stack.Screen name="admin" />` 沒加。expo-router 用 file-based routing 仍能 route，但少了 screen options 自訂機會。Polish。

---

## 📋 必須建立的新 migration

把以下 3 個 SQL 整合到 1 個 migration：

**`supabase/migrations/20260514_admin_rpcs_and_role.sql`**

1. 加 `admin` 進 `user_roles_role_check` constraint
2. `is_admin(uuid)` helper function
3. `admin_approve_merchant(uuid)` RPC
4. `admin_reject_merchant(uuid, text)` RPC
5. `admin_grant_admin(uuid)` RPC
6. `admin_revoke_admin(uuid)` RPC
7. `admin_find_user_by_email(text)` RPC

全部 SECURITY DEFINER + `is_admin(auth.uid())` gate。

---

## 📝 必須修的 client code

**`app/admin.tsx`**：所有 4 個 action（approve / reject / addAdmin / removeAdmin）改用 `supabase.rpc(...)` 取代 `.from().update/upsert/delete()`。

**`app/listing-upload.tsx`**：刪除 lines 145-172 的 dead code（`handleCardSearchChange` / `searchCards` / `selectCard`），順便刪掉相關 styles 如果沒被引用。

**`app/chat/[id].tsx`**：line 207 加 dedupe 邏輯。

**`app/(tabs)/search.tsx`**：
- 真的移除 PSA_MULT 或更新 commit message
- 加 timeout 給 PPT search

**`app/(tabs)/shops.tsx`**：
- `renderListingCard` 包 `useCallback`
- useFocusEffect 加 deps

**`lib/artofpkm.ts`**：加 module-level cache map

**4 個 locale 檔**：加 admin.* / settings.admin / search.box / search.cardsUnit / search.allShown 等 keys

---

## 🛡️ 安全結論

**現在 admin 功能既不安全也不能用 —— 在補 P0-1/P0-2/P0-3 之前，不要讓任何用戶看到 admin entry 入口。**

settings.tsx 第 280 行的 `isAdmin && (...)` gate 雖然防止一般用戶看到入口，但：
- 任何**已知是 admin 的攻擊者**仍能直接 call Supabase 失敗
- **更重要的是 — admin 自己用了也不會 work**，會 silent fail 認為「批准成功」但實際沒生效

→ 立即優先處理 P0-1 ~ P0-5。

