# Decision Log · 2026-05-17

> Command chat 由 HKCC · Numbers / Product / Growth chats 嘅 v1 文件 surface 嘅 4 個 cross-chat conflict + 1 個 secondary calibration。
> Locked by user (Alvin) 2026-05-17，由 Command chat 記錄。
> 所有其他 chat 之後嘅輸出**必須以呢份決定為準**。

---

## Decision 01 · Founding Merchant Trial = **3 個月**

| Item | Value |
|---|---|
| Trial length | **3 個月**（不是 2 個月） |
| 首月計費 | Month 4 起 HK$500 / 月 |
| Source decision | User 2026-05-17 |
| 對齊 | `product_pro_features.md` v01「月 1-3 免費」一致 |

### 衝突解決
| 文件 | 原本寫 | 行動 |
|---|---|---|
| `numbers_merchant-pricing-v1` | 2 個月 trial | Numbers chat 出 v2 改成 3 個月 |
| `numbers_burn-runway-v1` | Month 3 MRR HK$5K | v2 變 Month 4 MRR HK$5K |
| `product_pro_features` | 月 1-3 免費 | ✓ 已對齊 |
| `app_store_copy_v02` | (未具體寫 trial 期) | 加上「3-month founding trial」如有引用 |
| Merchant Pitch deck v02 | 之前我寫嘅版本標「0% 6 個月」 | 全部改 3 個月 |
| Landing page `growth/landing/index.html` | (待 check) | Growth chat verify |

### 商業理由
- 對 founding 商戶誠意更強（vs 普通 Tier 02 嘅 14 日）
- 3 個月足夠商戶上架完整貨架 + 經歷一個季度 ROI 周期
- 換 5 項 founding 權益嘅承諾合理
- 終身鎖價 HK$500 仍然保留

---

## Decision 02 · Cash Gap 解法 = **前 3 個月 Director's Fee 全部 deferred (應計但唔出)**

| Item | Value |
|---|---|
| Director's Fee Month 1-3 | **HK$0 cash 出**（公司唔轉錢俾 founder） |
| Director's Fee Month 1-3 accrued | **HK$30,000 應計**（公司簿記為 "Due to Director" liability） |
| Director's Fee Month 4+ | HK$10,000 / 月 cash + 0 accrual |
| 何時清還 30K 應計 | 由公司 cash position 足夠時開始分期還，最快 Month 7（CCMF 入賬後）|

### 點解係 deferred 而唔係純零薪

**「前 X 月零薪 + 不算」**：founder 個人 sweat investment 唔留下任何 claim
**「前 X 月零薪 + accrued」（呢個方案）**：
- ✅ P&L 仍記 HK$30K Director's Fee expense（看 burn rate 一致）
- ✅ Balance Sheet 加 HK$30K "Accrued Salary Payable to Director" liability
- ✅ Founder 將來公司有現金時可以分期領，係 enforceable claim（唔係 lost）
- ✅ Pitch 講「founder 起步 3 個月零現金薪」係強 signal
- ✅ Sweat equity log 仍然分開 track（兩條 stream 唔重疊）

### Cash Flow Impact

| 指標 | 原本 v1 (Base) | 新方案 |
|---|---|---|
| Month 1-3 cash outflow（薪）| HK$30K | **HK$0** |
| Month 6 closing cash | -HK$9,448 | **預估 +HK$15K（待 v2 模型 confirm）**|
| Month 18 closing cash | +HK$132K | **預估 +HK$132K**（之後分期還 30K accrued 抵消）|

### 點記入 Numbers 模型 v2
1. Add 「Director's Fee Cash Paid」row（M1-3 = 0；M4+ = 10K）
2. Add 「Director's Fee Accrued」row（M1-3 = 10K；M4+ = 0）
3. P&L expense = Cash Paid + Accrued
4. Balance Sheet "Accrued Salary" tracking liability
5. Cash repayment schedule（推薦 Month 7-12 每月 5K，6 個月清還）

### 對 CCMF 文件嘅影響
寫 founding story 時可以加：「Founder 起步 3 個月不領現金薪，HK$30K accrued 作為公司資產緩衝。」呢個 narrative 強過「creator 投資 HK$30K」因為佢突顯 commitment + 財務嚴謹。

---

## Decision 03 · Login Strategy = **Plan B**

```
Apple Sign In + Google OAuth + Anonymous (Browse as guest)
移走 email/password 同 Phone OTP
```

### Apple 4.8 合規確認
- ✅ 有 Apple Sign In（必要因為有 Google）
- ✅ 用戶其他選擇有 Google
- ✅ Anonymous 入口畀 Apple Reviewer 0-friction 測試

### App Store Demo Account
- ~~Phone: +852 6100 0001~~（廢棄）
- ~~OTP: 111111~~（廢棄）
- **新版本**：
  ```
  Reviewer Instructions:
  - Option 1: Tap "Browse as guest" on first screen — full read-only access
  - Option 2: Tap "Sign in with Apple" with any Apple ID — full feature access
  - No phone number, no SMS, no test account needed.
  ```

### Code chat / Claude Code 必做 list（按優先）
1. **wire up Apple Sign In** to Supabase Auth backend
2. **enable Supabase Anonymous Auth**
3. **build "Browse as guest" entry** in onboarding
4. **modal-style sign-in trigger** when guest tries write action
5. **remove email/password UI**（保留 backend account schema，畀 Phone OTP v1.1 用）
6. **Update reviewer notes** in App Store Connect

### v1.1 後續（4-6 週後可以加）
- Phone OTP via Twilio（如果發現 HK 用戶反饋強烈想用 phone）
- 但 v1.0 launch 唔需要

---

## Decision 04 · PRO 訂閱寫入 product.md

`product.md` 加 §11 Business Model，包含：
- 4 條收入 lane（PRO / 認證商戶 / Affiliate / Ads）
- Founding Merchant Deal 完整條款
- Auth Plan B strategy
- Deferred Director's Fee accounting note

`product.md` §06 Current State 加 changelog entry：
- 2026-05-17 · Business model v1 locked
- 2026-05-17 · Auth strategy Plan B confirmed

---

## Cross-chat 跟進清單

### HKCC · Numbers chat（**最高優先**）
- [ ] 出 `numbers_burn-runway-v2_2026-05.md`，含：
  - Trial = 3 個月（MRR shift to Month 4）
  - Director's Fee deferred 3 個月（accrued HK$30K liability）
  - Cash repayment schedule for the accrued 30K
- [ ] 更新 cap table v2（如有需要反映 sweat equity 變化）
- [ ] CCMF Vol.02 draft 用 v2 數字

### HKCC · Growth chat
- [ ] Landing page `growth/landing/index.html` confirm 文案 founding trial = 3 個月
- [ ] Merchant Pitch deck v02 兩個語言（zh + en）改「3 個月 free trial」（如有錯）
- [ ] A5 介紹卡印刷前 reconfirm trial 期
- [ ] App Store copy v02 §4 founding deal section 加「3-month free trial」

### HKCC · Product chat
- [ ] `pro_features.md` 已對齊 ✓
- [ ] Paywall sheet UI design 加 Apple Sign In auth gate
- [ ] Onboarding 三屏文案 加「Browse as guest」option

### HKCC · Code chat / Claude Code
- [ ] **P0**：Rotate hardcoded API keys（仍未做，每日燒緊）
- [ ] **P0**：Implement Plan B auth（Apple + Google + Anonymous）
- [ ] **P0**：Brand color #FF6A1F unify
- [ ] **P0**：`fx_rates` 接真匯率 API
- [ ] **P0**：App Store Marketing URL 改 hkcardcoll.hk
- [ ] **P1**：Sentry 接 + EAS production build
- [ ] **P1**：Setting → 關於頁面 add "PRO" + monetization disclosure

### HKCC · Command chat（自己）
- [ ] ✓ 寫呢份 decision log
- [ ] ✓ Patch product.md §11
- [ ] ✓ Patch APP_STORE_CHECKLIST.md
- [ ] 通知 Project Hub artifact 加 founding 倒數 13 日

---

## Founding 倒數

```
Today:    2026-05-17
Deadline: 2026-05-30
Days remaining: 13
```

到 2026-05-30 之前必須完成嘅事：
- 7-10 個 founding merchant 簽約（Growth Lane 2）
- Apple Review 提交（v1.0）
- Privacy / ToS host 上 hkcardcoll.hk 或 Notion
- Domain hkcardcoll.hk DNS 啟用

---

## Open Follow-up

1. **HKDNR account verification 進度** — owner 親自做
2. **Airwallex / 公司 bank balance 實際數字** — 用於 Numbers v2 起始現金
3. **首位 founding merchant 簽約合約模板** — Numbers chat 寫
4. **Notion or hkcardcoll.hk privacy/ToS hosting** — Command chat 決定

---

*Logged by Command chat. Last updated 2026-05-17.*
