# Airwallex + eBay Business + eBay Developer API · 開戶 SOP

> 為 POTO Creative Tech Limited (BR 80363844) 開三條 channel：跨境收款戶口 + 二手 / 自營 eBay 賣家戶口 + eBay API 開發者帳號。
> 最後更新：2026-05-22

---

## 00 · TL;DR · 順序同 timeline

```
Day 0 (今日)  Airwallex apply  ─┐
Day 0 (今日)  eBay Dev sandbox │ (可 parallel，唔互相 block)
Day 1-2       Airwallex approval (48hr typical)
Day 3         eBay US seller register (要 Airwallex account # 做 payout)
Day 4-7       eBay seller verification
Day 7-10      eBay Dev production keys approval
Week 3        第一張 listing live + API 第一個 Browse call
```

**Total realistic timeline：3 週**，由 Airwallex apply 到 eBay listing + API live。

**Critical reality check (2026-05 verified)：**
- eBay Managed Payments **唔 support HK marketplace** → 必須喺 **eBay.com (US site)** 開 seller，唔係 eBay.com.hk
- eBay **Marketplace Insights API**（sold price 數據）**已 closed 獨立 developer**，要 partner status 先有
- 即係 sold comps 仲係要靠 Pokémon Price Tracker API（你已經有），eBay API 只可以攞 live listings

---

## 01 · Airwallex HK Business Account

### 1.1 點解 Airwallex（vs Statrys / Wise / HSBC SME）

| Provider | 點解選 / 唔選 |
|---|---|
| **Airwallex** | HK Cyberport company · 48hr approval · 11+ currency 同名虛擬戶口 · 免月費 · eBay payout supported · API-first 將來可 plug 入 HKCardColl |
| Statrys | HK fintech，service good 但月費 HK$ 88 起 · API 弱 |
| Wise | UK 公司，HK 收款限制比 Airwallex 多 · USD 戶口限額較細 |
| HSBC SME | 傳統銀行，要 in-person + 押金，approval 1-3 個月 · 不可能 short-term |

**結論**：Airwallex。

### 1.2 文件 checklist（POTO Creative Tech Limited）

收齊先 apply，唔好開咗單再補：

- [ ] **Business Registration Certificate (BR)** · 80363844 · PDF / JPG / PNG · ≤10MB
- [ ] **Certificate of Incorporation (CI)** · 由 e-Registry download
- [ ] **NNC1 (法團成立表格)** · 公司成立時用嘅，e-Registry 有
- [ ] **Articles of Association (M&A)** · 公司章程
- [ ] **Director HKID** · 雙面 clear scan，唔好遮住任何角
- [ ] **Proof of address** · 3 個月內水費 / 電費 / 銀行月結單，要 show 你個人地址
- [ ] **UBO (Ultimate Beneficial Owner) info** · 即係你自己（>25% 股權）
- [ ] **Proof of business operations** · hkcardcoll.hk landing page screenshot 已經 suffice，或者你 deck / 計劃書

**Tip**：如果 director 同 UBO 都係你一個人（typical solo founder），唔需要額外 letter of authority。

### 1.3 Signup 步驟

1. 去 `https://www.airwallex.com/hk/business-account`
2. 揀 **Sign up** → 輸入 hello@hkcardcoll.hk + 設密碼
3. **Business details**：
   - Legal name：`POTO Creative Tech Limited`
   - BR：`80363844`
   - Industry：`Software / Technology` 或 `E-commerce`（兩個都 acceptable）
   - Monthly volume estimate：保守填 `< HK$ 100k`（過咗第一個月有 transaction 自然會升 tier）
4. 上載 1.2 全部文件
5. **UBO declaration** 填你自己（>25% holder）
6. Submit → 等 48hr

### 1.4 Approval 之後即刻做

- [ ] 開 **HKD Global Account**（虛擬戶口 + 同名 IBAN）
- [ ] 開 **USD Global Account**（eBay payout 用，要 US ACH number + routing number）
- [ ] 申請 **virtual debit card** · 即時出，免費
- [ ] 設 **2FA** · authenticator app 唔好 SMS only
- [ ] 加 **second admin**（如果有 co-founder / 會計師）

### 1.5 等緊 approve 時間做嘅嘢

唔好乾等。同時可以做：
- eBay Developer sandbox 註冊（下面 03）
- 寫 eBay listing template / shipping policy draft
- 影一張 founder 卡準備拍 listing 相

---

## 02 · eBay Business Account (US site)

### 2.1 點解係 US site（eBay.com）唔係 HK site

| Site | Pokemon TCG 月成交量（rough） | Managed Payments | 結論 |
|---|---|---|---|
| eBay.com (US) | ~ US$ 50M+ / 月 | ✓ Support HK seller payout 入 Airwallex / 銀行 | ✅ 主場 |
| eBay.com.hk | 細 · 主要 inbound buyer | ✗ Managed Payments 唔 support HK marketplace | ❌ 唔開 |
| eBay.co.uk | 中型 · 歐洲 PSA buyer base | ✓ Support | 後期考慮 |

**結論**：eBay.com (US)。如果你聽過「eBay 香港」 site，搵咗都係 ad / informational 性質，唔係 marketplace。

### 2.2 文件 checklist

- [ ] **Airwallex USD account number + routing #**（1.4 攞到先）
- [ ] **公司 legal name**：`POTO Creative Tech Limited`
- [ ] **公司地址**：HK 註冊地址（如果你用 secretarial address 都 OK）
- [ ] **Phone**：HK +852 mobile（驗證 OTP）
- [ ] **Director HKID** 或 **passport**
- [ ] **Business email**：`hello@hkcardcoll.hk` (一定唔好用 Gmail，eBay 對 business gmail 比較多 trust issue)
- [ ] **W-8BEN-E** 表格 · HK 非 US entity，向 eBay 申明 non-US tax status，避免 30% backup withholding

### 2.3 Signup 步驟

1. 去 `https://www.ebay.com/sl/sell`（**注意 .com 唔係 .com.hk**）
2. 揀 **Create a business account**（唔好揀 personal）
3. 填公司資料（2.2 全部）
4. **Country / region of business**：`Hong Kong SAR`
5. **Payments setup**：揀 **Bank account** → 填 Airwallex USD account
6. 上載 W-8BEN-E（PDF）
7. 等 verification（typical 3-7 working days，有時 eBay 會 ask for additional ID）

### 2.4 Store Subscription 揀邊個

新賣家 fee schedule（2026-05 US site）：

| Tier | US$/月 | Zero insertion fee listings/月 | 適合 |
|---|---|---|---|
| **No store** | 0 | 250 (general) · Pokemon TCG 不限 | < 50 張卡/月 · 試水 |
| **Starter** | 4.95 | 250 | 50-200 張/月 |
| Basic | 21.95 | 1,000 | 200-1,000 張/月 |
| Premium | 59.95 | 10,000 | 規模化 |

**推薦**：開頭 **No store**，等你 list 過 30 張，每月 fee 預期 > 月費差距，先升 Starter。

### 2.5 Pokemon TCG 賣家 fees（2026-05）

- **Final Value Fee (Trading Card Games)**：13.25% on item + shipping
- **Per-order fee**：US$ 0.30
- **PayPal age tax** 已唔存在（Managed Payments 取代）
- **$250+ graded card**：自動入 **Authenticity Guarantee** program，eBay 安排免費 PSA 驗證再 forward 畀買家，賣家唔使俾錢但 payout 慢 3-5 日

### 2.6 New Seller Limit

- 頭 90 日：**10 items 或 US$ 500 / 月**（whichever first）
- 想 lift：list 5 張 + 全部 successful sale + 100% feedback → 第 30 日打去 eBay seller helpline 要求 increase
- Pokemon TCG 因為 fraud risk 高，會 conservatively raise

### 2.7 Shipping 策略（HK → US buyer）

| Option | Cost | Speed | 適合 |
|---|---|---|---|
| HK Post AirMail (Registered) | HK$ 50-80 | 7-14 日 | Raw 卡 < US$ 20 |
| HK Post SpeedPost | HK$ 150-250 | 3-5 日 | Raw 卡 US$ 20-100 |
| DHL eCommerce | HK$ 120-180 | 5-7 日 | Raw 卡 batch |
| **DHL Express** | HK$ 350+ | 2-3 日 | PSA slab / 高貨值 ≥ US$ 200 |

**Slab 保護**：top loader + team bag + bubble mailer + **rigid mailer outer**。Pokemon 賣家 dispute 95% 都係「damaged in transit」or「item not as described」，rigid mailer 解決 80%。

---

## 03 · eBay Developer Program

### 3.1 Reality check（必讀）

**好消息**：sandbox + 基本 production keys 你可以即攞，1-2 工作日 approval。

**壞消息（2026-05 confirmed）**：
- **Marketplace Insights API**（sold / completed listings 數據）**已 closed 獨立 developer**。eBay 官方 community thread 答：「access cannot be granted at this time for independent developers」
- **Finding API** (legacy `findCompletedItems`)：已 deprecated + rate limit 1st call 就出 error，唔可靠
- **要拎 sold comps 數據**：要申請 **eBay Partner / Tier 2** status，需要：already-built app + monthly call volume justification + use case review

**Strategic implication**：
- eBay Dev API 你 **拎得到 live listings (Browse API)**，可以 show「依家市場 ask 緊」
- **拎唔到 sold prices** → 繼續用 **Pokémon Price Tracker (PPT) API**（你 already pay）做 historical comps
- 將來 HKCardColl scale 到 10k+ user，可以再 apply Marketplace Insights partner，到時 case much stronger

### 3.2 即時可拎嘅 API

| API | 用途 | HKCardColl use case |
|---|---|---|
| **Browse API** (REST) | 即時 search live listings | Show「呢張卡 eBay 而家 ask US$ X-Y」range |
| **Catalog API** | eBay product catalog | Reference master card metadata |
| **Sell APIs** (Inventory / Account / Marketing / Fulfillment) | 操作自己嘅 listing | 將來你個人賣卡 automation，或者商戶 sync |
| **Trading API** (XML legacy) | 舊式，部分 feature 仲喺度 | 唔建議新 build |

### 3.3 Signup 步驟

1. 去 `https://developer.ebay.com`
2. **Register** → 用 hello@hkcardcoll.hk 同 eBay seller account 連埋（同一個 email 最 clean）
3. **Create App**：
   - App name：`HKCardColl Production`
   - Use case 寫：`Hong Kong-based Pokémon TCG portfolio management app. Browse API used to display live eBay market listings to HK collectors for price reference. No bulk scraping, real-time per-user query only.`
4. 攞 **Sandbox keys**（即時）：
   - App ID (Client ID)
   - Cert ID (Client Secret)
   - Dev ID
5. **Sandbox test**：用 OAuth 2.0 token endpoint，跑一條 Browse API call 確認 work
6. **Apply Production keys**：在 dashboard 撳 Promote to Production，填 use case
7. 等 1-3 工作日 approval

### 3.4 Production rate limits（default）

- Browse API：5,000 calls / day
- Catalog API：5,000 calls / day
- Sell APIs：daily quota per call type
- 要 raise：show 你 app 真實 user load + traffic pattern

### 3.5 唔好做嘅嘢

- ✗ **唔好** bulk scrape，eBay 會 ban app ID 唔通知
- ✗ **唔好** 用 1 個 API key serve 多 client（要 multi-tenant 用 OAuth per user）
- ✗ **唔好** cache sold price 然後 redistribute（違反 Data License agreement）
- ✗ **唔好** 將 eBay listing data 整個 mirror 入 HKCardColl（只可以 per-user lookup）

### 3.6 EPN (eBay Partner Network) — Optional revenue layer

eBay 嘅 affiliate program。HKCardColl 將來可以喺 app 入面 show「Buy on eBay」link → 用家點咗去 buy → 你抽 commission (Pokemon TCG category typical 1-4%)。

- Apply: `https://partnernetwork.ebay.com`
- 要：active eBay seller account + 公司 website（hkcardcoll.hk）
- Approval：~1 週
- Payout：US$ 10 minimum，via PayPal 或 direct deposit（可入 Airwallex USD）

**Strategic value**：低成本 monetization layer，唔影響 user experience，但需要 user click-through volume 先有意義。Launch 後 6 個月再開都唔遲。

---

## 04 · Cross-system linking · payout flow

```
eBay buyer (US, USD)
   ↓ Pays eBay
eBay Managed Payments (holds 1-2 日)
   ↓ Payout to bank
Airwallex USD Global Account
   ↓ FX (mid-market + Airwallex tiny spread)
Airwallex HKD Global Account
   ↓ Withdraw / spend
你個 HSBC / 商業 HKD account · 或者直接 Airwallex Visa card spend
```

**HK 中間商比 mid-market 高 1.5-3%**，Airwallex 通常 0.4-0.6%（large volume tiered）。每 US$ 1,000 payout 大概慳 HK$ 80-160。

---

## 05 · 風險 / 注意事項

### 5.1 eBay 新賣家 hold

- 頭 90 日 payout **default hold 14 日**，等 buyer confirm delivery 先 release
- 高貨值卡 ≥ US$ 200 hold 21 日
- **影響 cashflow**：你 list 一張 US$ 500 卡，由賣出到攞錢可能 25 日
- 早期 list 細卡 (< US$ 50) 累積 feedback 多過追求高貨值

### 5.2 W-8BEN-E 必須填

- 唔填 → eBay 預設你係 US person，扣 30% backup withholding
- 填咗 → 0% withholding (HK 同 US 冇 tax treaty，但 W-8BEN-E 仍然證明 non-US person)
- Form 有效期 3 年，到期 eBay 會 prompt 你 renew

### 5.3 Pokemon TCG fraud rate 高

- Buyer dispute「item not as described」喺 Pokemon category 比一般類目高
- **必做**：開箱影片 (full unboxing, no cuts) + 寄出前每張卡正反 close-up + tracking 全部 paid for
- Dispute 唔好 cold-deny，先 ask buyer photo evidence

### 5.4 Marketplace Insights API blocked — 唔好誤判

- 你可能聽過 reseller 用 eBay sold price 做 model
- **2026 現實**：99% 係用 third-party scraper（違反 ToS）或者 PPT 類 API（合規）
- HKCardColl 用 PPT API 係正路，唔好為咗「自己有 eBay sold data」而行灰色

---

## 06 · Action items（今日可以做）

優先順序：

1. **[15 min]** Airwallex 開始 signup · 1.3 步驟
2. **[15 min]** 收齊 1.2 文件 checklist 入一個 folder (`/Users/alvin/collectr/ops/legal/`)
3. **[5 min]** eBay Developer 註冊 + 攞 Sandbox keys · 3.3 步驟
4. **[等 48hr]** Airwallex approval → 開 USD account
5. **[Day 3]** eBay US seller register · 2.3 步驟
6. **[Day 3]** eBay Dev Production keys apply · 3.3 步驟 7
7. **[Day 7+]** 第一張 listing live (建議 raw 卡 < US$ 20，pure 累積 feedback)

---

## 07 · HKCardColl × eBay 策略定位（俾你諗）

eBay **唔係** HKCardColl 嘅 core，但有 3 個用法：

1. **Founder credibility** — 你個人 seller account 累積 feedback，將來 raise round 講「我 personally 賣過 HK$ X 卡」有 weight
2. **Comp layer** — Browse API 加去 app，「同卡 eBay 而家 ask US$ X」做 price reference 一個 source
3. **Affiliate revenue** — EPN 接入，user point click-out 抽 commission（launch 後 6 月再諗）

**唔好** 攪到變 eBay reseller business 分散 HKCardColl focus。eBay 投放時間每月 cap 5-10 hr，多咗就係 distraction。

---

## 08 · Changelog

| Date | Change |
|---|---|
| 2026-05-22 | v1 初版。Airwallex 48hr / eBay US site / Marketplace Insights API blocked reality check |
