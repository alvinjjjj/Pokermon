# Bug 修復 — Production Readiness 提升

## 核心決策

- 目標：Production readiness 從 45% 提升到 80%
- 評分基準（專業評分）：Core functionality 75%、User data security 80%、UI/UX polish 65%、Production readiness 45%
- 修復策略：HIGH → MEDIUM 優先順序，逐一確認 Supabase `{ error }` pattern 全面覆蓋
- Supabase 原則確立：Supabase client **不會 throw**，必須明確 check `if (error)` — 不能只靠 try/catch

---

## 待解問題

- **LOW**：Portfolio image writeback 每次 focus 都觸發 100+ DB writes — 需要 dirty-flag 或 debounce
- **LOW**：`edit-profile.tsx` — 舊 avatar 檔案從未從 Supabase Storage 刪除（會累積孤兒檔案）
- **LOW**：`my-listings.tsx` / `listing-upload.tsx` — upload limit 在兩個地方硬編碼，應改為共享 constant（已有 `SELLER_UPLOAD_LIMITS` 但未統一）
- **MEDIUM**：`listing-upload.tsx` photos 仍然用 for loop 順序上傳，應改用 `Promise.all` 並行加速
- **MEDIUM**：portfolio sell button 傳送 raw USD `current_price` 到 listing-upload，幣別顯示可能不一致（listing-upload 內部是否正確處理 USD 需確認）
- 翻譯 key `merchant.paymentMethods` 需要加到所有語言的翻譯檔（zh-HK、zh-CN、en、ja）

---

## 有用的事實 / 數據

### React Native 特有 Bug 模式
| 問題 | 原因 | 正確做法 |
|------|------|----------|
| Storage 上傳 0 bytes | `resp.blob()` 在 iOS/Android 的 `file://` URI 返回空 blob | 改用 `resp.arrayBuffer()` |
| PanResponder stale closure | `PanResponder.create()` 只執行一次，closure 捕捉到第一次 render 的 `pts` | 用 `ptsRef = useRef(pts); ptsRef.current = pts;` 每 render 更新，callback 讀 `ptsRef.current` |
| Supabase error 被忽略 | `await supabase.from(...).insert()` 不 throw，error 在返回值 | 每次都要 `const { error } = await ...; if (error) { revert(); }` |
| Loading spinner 永遠轉 | `setLoading(false)` 在 throw 之前 → 錯誤時不執行 | 改放在 `finally {}` block |

### 檔案路徑參考
- Supabase client: `lib/supabase.ts`
- Currency context: `contexts/CurrencyContext.tsx`
- Upload limits constant: `constants/config.ts` → `SELLER_UPLOAD_LIMITS`
- Real card detail page: `app/(tabs)/card/[id].tsx`（`app/card/[id].tsx` 只是 redirect stub）

---

## 行動項目

- [ ] 把 `merchant.paymentMethods` 翻譯 key 加到所有語言檔
- [ ] Portfolio image writeback 加 dirty-flag / debounce（避免每次 focus 寫 100+ rows）
- [ ] `edit-profile.tsx` 更新 avatar 時刪除舊 Storage 檔案
- [ ] `listing-upload.tsx` 改用 `Promise.all` 並行上傳多張照片
- [ ] 確認 portfolio → listing-upload 的 `prefill_price` 是 USD 還是 HKD，確保顯示正確

---

## 已完成修復（此對話）

### HIGH priority ✅
1. **`app/(tabs)/index.tsx` MiniChart**
   - 加 `ptsRef` 解決 PanResponder stale closure
   - Tooltip 和 Y-axis 改用 `convert()` / `symbol`（幣別感知）
   - `<MiniChart>` call site 加 `convert={convert} symbol={symbol}` props

2. **`app/(tabs)/card/[id].tsx` PriceChart**
   - 加 `ptsRef` 解決 PanResponder stale closure（同上模式）
   - `fetchCard` 加 `res.ok` 檢查 + `json.data` null guard，防止非 200 response crash

3. **`app/listing-upload.tsx` loadMerchantInfo**
   - 包 `try/catch/finally`，`setLoadingMerchant(false)` 移到 `finally`

4. **`app/new-post.tsx` 孤兒 Storage 檔案**
   - 加 `uploadedFilePath` tracking
   - DB insert 失敗時自動 `supabase.storage.from('posts').remove([uploadedFilePath])`

### MEDIUM priority ✅
5. **`app/(tabs)/social.tsx`**
   - `loadAll` 開頭確認有 `setLoadError(false)`
   - `submitReport` 非 duplicate key error 現在會 `Alert.alert`（之前靜默丟棄）

6. **`app/user/[id].tsx` toggleFollow**
   - 加 `revert()` helper
   - 明確 check Supabase `{ error }` — 兩條路徑（insert / delete）都有 revert

7. **`app/merchant/[id].tsx`**
   - 硬編碼 `'付款方式'` 改為 `t('merchant.paymentMethods')`
   - `loadAll` 包 `try/catch/finally`

8. **`app/my-listings.tsx`** — `loadAll` 包 `try/catch/finally`
9. **`app/listing/[id].tsx`** — `loadListing` 包 `try/catch/finally`
10. **`app/edit-profile.tsx`** — `loadProfile` 包 `try/catch/finally`

### 更早的對話（context summary 前）✅
- `seller-registration.tsx` — `blob()` → `arrayBuffer()` 修復 0-byte upload
- `post-detail.tsx` — `toggleLike` / `deleteComment` / `confirmDeletePost` 加 error handling + revert
- `app/(tabs)/social.tsx` — `toggleFollow` 加 Supabase `{ error }` check + revert
- `contexts/CurrencyContext.tsx` — 硬編碼 `'價格待定'` 改為語言中立 `'—'`

---

## 廢棄資訊

- 舊版 `CurrencyContext.tsx` default 返回中文字串 `'價格待定'`（已改為 `'—'`）
- 舊版 `MiniChart` 沒有 `convert` / `symbol` props，tooltip 硬編碼 `HK$`
- 舊版 PanResponder 直接讀 `pts`（stale closure）

---

## 相關檔案

```
app/(tabs)/index.tsx          — Home screen + MiniChart（已修）
app/(tabs)/card/[id].tsx      — Card detail + PriceChart（已修）
app/(tabs)/social.tsx         — Social feed（已修）
app/(tabs)/portfolio.tsx      — Portfolio（LOW issues 待處理）
app/post-detail.tsx           — Post detail（已修）
app/listing-upload.tsx        — Listing upload form（已修）
app/new-post.tsx              — New post（已修）
app/merchant/[id].tsx         — Merchant profile（已修）
app/user/[id].tsx             — User profile（已修）
app/my-listings.tsx           — My listings（已修）
app/listing/[id].tsx          — Listing detail（已修）
app/edit-profile.tsx          — Edit profile（已修，avatar cleanup 待做）
app/seller-registration.tsx   — Seller registration（已修）
contexts/CurrencyContext.tsx  — Currency context（已修）
constants/config.ts           — SELLER_UPLOAD_LIMITS 等常數
lib/supabase.ts               — Supabase client
lib/pokeprice.ts              — PPT price fetching
lib/lowestPrices.ts           — HK lowest price fetching
```
