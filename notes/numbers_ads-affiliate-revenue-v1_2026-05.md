# numbers · Ads + Affiliate Revenue v1

> 用途：HKCardColl 喺 Tier 02 訂閱以外嘅 affiliate / advertising 收入結構。
> 最後更新：2026-05-17
> 對話：HKCC · Numbers
> 狀態：**v1 freeze**。Founder 三個決策已拍板（見 02 章）。

---

## 01 · 一句話

HKCardColl 上線 Day 1 同步開啟 **2 條額外收入流**：
- **抽卡 / Mystery Box affiliate**（10–30% commission per referred purchase）
- **Sponsored Placement**（Tier 02 商戶付費 add-on，HK$200–3,000 / slot / 月）

兩條合計 Month 18 estimated MRR：**HK$15K–35K**，與 Tier 02 訂閱（HK$15K Base）並列，**zero 額外 OPEX**。

---

## 02 · Founder Decisions（2026-05-17 拍板）

| Decision | 選項 | 結果 |
|---|---|---|
| 1. 抽卡網 affiliate scope | **C · 全 in（含數碼 mystery box）** | 最高收入版本，承擔 brand + legal risk |
| 2. Sponsored Placement | **A · 即時做** | Month 3 founding 商戶 onboarding 時即上線 add-on |
| 3. Direct Ad Sales（B2B） | **延後** | Month 9+ 由 Growth / 外判 BD 啟動 |

---

## 03 · 抽卡 / Mystery Box Affiliate

### 3.1 收入結構

| Partner 類別 | Commission | 我嘅建議 |
|---|---|---|
| HK 直播開盒卡店（show-then-ship） | 10–20% per 單 | ✓ White list 即接 |
| HK 數碼 mystery box（如 DropPK、一抽） | 15–30% per 單 | ⚠ 接但加 legal disclaimer |
| HitParade / Whatnot / BurningStarCards（US） | 10–25% | ✓ 接（成熟 affiliate program） |
| JP Cardrush / タムタム 抽卡 | 5–15% | ✓ 接（HK 藏家高需求） |

### 3.2 Unit Economics

每個 referred 用戶嘅 cohort 表現：

| 指標 | Conservative | Base | Aggressive |
|---|---|---|---|
| 首單 conversion rate | 10% | 15% | 20% |
| 平均首單 HKD | 200 | 300 | 500 |
| Avg commission rate | 12% | 17% | 22% |
| **首單 commission** | **HK$24** | **HK$77** | **HK$220** |
| 6 個月 repeat purchase rate | 30% | 50% | 70% |
| Repeat 平均 HKD | 400 | 800 | 1,500 |
| **6 個月 LTV commission** | **HK$50** | **HK$200** | **HK$680** |

### 3.3 Revenue Projection（按 MAU 計）

假設 Click rate = 10% MAU / 月 → 抽卡 partner 站

| Month | MAU (Base) | Monthly clicks | Conversions (15%) | Avg commission (HK$77) | Repeat layer | **總 / 月** |
|---|---|---|---|---|---|---|
| Month 3 | 200 | 20 | 3 | HK$231 | HK$0 | **HK$231** |
| Month 6 | 800 | 80 | 12 | HK$924 | HK$300 | **HK$1,224** |
| Month 9 | 2,000 | 200 | 30 | HK$2,310 | HK$1,500 | **HK$3,810** |
| Month 12 | 3,500 | 350 | 53 | HK$4,081 | HK$3,500 | **HK$7,581** |
| Month 18 | 6,500 | 650 | 98 | HK$7,546 | HK$8,000 | **HK$15,546** |

→ Month 18 Base：**~HK$15,500 / 月**
→ Aggressive scenario：可至 **HK$40,000 / 月**（Month 18 10,000 MAU + 20% conversion）

### 3.4 Top 5 Partner Application 列表

優先申請順序：

1. **Whatnot** — 美國最大 live break 平台，affiliate signup at whatnot.com/affiliates
2. **HitParade** — affiliate@hitparade.com（10–25% commission tiers）
3. **Cardrush（JP）** — 透過 JP 中介 / EastBuy.jp 取得 affiliate 連結
4. **DropPK（HK 數碼）** — Cold email approach
5. **HK 直播開盒卡店** — Founding merchant 同步談（已 plan Week 1 拜訪卡店）

### 3.5 Legal Monitoring（不可忽略）

**HK《賭博條例》Cap. 148** 規定：

- 「unlawful gambling」三要素：consideration + chance + prize
- 數碼 mystery box 邊緣案例，HK 暫無大型起訴判例
- 但執法 stance 可能改變，特別係牽涉 minors 嘅情況

**Mitigation 條款（必須 implement）**：

1. **Age gate**：抽卡 tab 入口要求 18 歲以上自我聲明（一次過 dialog）
2. **Spending limit warning**：用戶 click 抽卡 partner 累計過 HK$3,000 / 月 顯示 banner「呢個月您已點擊抽卡 partner 超過 HK$3,000 等值。要 set 月度 limit 嗎？」
3. **Independent tab**：抽卡入口放喺 settings → 額外 features，唔放 home screen
4. **Disclaimer footer**：每個抽卡 partner card detail 寫「呢個係第三方平台、有隨機性、HKCardColl 從購買賺取佣金。賭博可能成癮。」
5. **Quarterly legal review**：每季 review HK 立法會 / Home Affairs 對 mystery box 嘅立場。若有任何 enforcement signal，72 小時內 disable 數碼 box partners

→ Action：開季度 review reminder（schedule task）

---

## 04 · Sponsored Placement（Type A）

### 4.1 定價菜單

Tier 02 商戶月費 HK$500 / 月 之上，**自由選購** add-on：

| Add-on | 月費 | 描述 | 庫存 |
|---|---|---|---|
| **Search Top Sponsored** | HK$1,000 / slot / 月 | 搜索結果頂 5 個 sponsored slot | 5 個（每月競投）|
| **Card Detail Featured Shop** | HK$300 / slot / 月 | 每張卡 detail page 顯示 3 個 sponsored shops | Unlimited（按卡分配） |
| **Home Banner（Rotating）** | HK$3,000 / banner / 月 | Home screen 頂部 rotating banner，6 banner cycle | 6 個 slot |
| **Push Notification Sponsorship** | HK$1,500 / push | 全 user 推送一條贊助訊息（限月 2 條） | 月 2 個 slot |

### 4.2 Bundle 套餐

| Bundle | 月費 | 包含 |
|---|---|---|
| Tier 02 Base | HK$500 | 100 listings + 認證 + 不含 sponsored |
| Tier 02 Visible | HK$1,200 | Base + 1 Card Detail Featured Shop + 1 Push / 季 |
| Tier 02 Top | HK$2,500 | Base + 1 Search Top + 2 Card Detail Featured + 月 1 Push |
| Tier 02 Max | HK$5,000 | Base + 1 Search Top + 3 Card Detail Featured + 1 Home Banner + 月 2 Push |

Founding 10 商戶嘅 grandfathered rate 適用於 base subscription（HK$500），add-on 同正常價。

### 4.3 Attach Rate 假設

| 商戶類型 | Sponsored Attach Rate | 平均 add-on 月支 |
|---|---|---|
| Founding 10 個 | 30% | HK$1,200 |
| Regular Tier 02 | 20% | HK$1,500 |

### 4.4 Revenue Projection

| Month | Founding 商戶 (paid) | Regular Tier 02 | Sponsored Founding | Sponsored Regular | **Total Sponsored** |
|---|---|---|---|---|---|
| Month 3 | 10 × 0 (trial) | 0 | 0 | 0 | **HK$0** |
| Month 4 | 10 | 2 | 3 × HK$1,200 = HK$3,600 | 0 | **HK$3,600** |
| Month 6 | 10 | 7 | HK$3,600 | 1 × HK$1,500 = HK$1,500 | **HK$5,100** |
| Month 12 | 10 | 25 | HK$3,600 | 5 × HK$1,500 = HK$7,500 | **HK$11,100** |
| Month 18 | 10 | 32 | HK$3,600 | 6 × HK$1,500 = HK$9,000 | **HK$12,600** |

→ Month 18 Base：**~HK$12,600 / 月**

### 4.5 商戶 onboarding 文件需要

要喺 **Founding Merchant onboarding 流程**加入 sponsored placement 介紹。Action item：寫 1 頁 Sponsored Placement spec sheet，內容：

- 4 種 slot 嘅 visual mockup
- 每種 slot 嘅 CTR / impression 估算
- 競投 / 排期機制（特別係 Search Top 5 slots 嘅月度競投）
- 自助 dashboard 點操作
- 月度 reporting（曝光、點擊、轉化）

呢份文件由 Growth / Product 對話落地，本檔只記 pricing。

---

## 05 · Combined Revenue Model（Month 12 + Month 18 對比）

### Month 12 (2027-04)

| 來源 | Base | Aggressive |
|---|---|---|
| Tier 02 subscription | HK$12,500 | HK$21,000 |
| 抽卡 affiliate | HK$7,600 | HK$15,000 |
| Sponsored Placement | HK$11,100 | HK$18,000 |
| Phase 2 Premium Data | — | HK$5,000 |
| **Total MRR** | **HK$31,200** | **HK$59,000** |

對比 v1 Burn Runway（只 Tier 02）：
- Base：HK$12.5K → HK$31.2K（**+150%**）
- Aggressive：HK$21K → HK$59K（**+180%**）

### Month 18 (2027-10)

| 來源 | Base | Aggressive |
|---|---|---|
| Tier 02 subscription | HK$15,750 | HK$29,500 |
| 抽卡 affiliate | HK$15,500 | HK$40,000 |
| Sponsored Placement | HK$12,600 | HK$22,000 |
| Phase 2 Premium Data | — | HK$10,000 |
| **Total MRR** | **HK$43,850** | **HK$101,500** |

對比 v1：
- Base Month 18：HK$15.7K → **HK$43.9K**（接近 3 倍）
- Aggressive Month 18：HK$34.5K → **HK$101.5K**（突破 6 位數 / 月）

---

## 06 · 對 Director's Loan + 個人現金嘅 impact

v1 模型 Director's Fee 由 Month 7 開始 HK$10K / 月。v1.1 模型增加額外 revenue，公司現金流加速：

| 場景 | Director's Loan 完全還清月份 | 18 個月累計 Founder 收入 |
|---|---|---|
| v1（only Tier 02 subscription） | Month 6（公司有少量 surplus） | HK$120K |
| **v1.1（加 affiliate + Sponsored）** | **Month 6（更早 + 更大 cushion）** | **HK$180K + 大量公司 cash reserve** |

額外現金嘅用途優先序：

1. **加快 Director's Fee back-pay**：原本 Month 7 補發 4 個月 = HK$40K → 可以 Month 6 補發 + Month 7-10 加碼 HK$15K / 月（拎返 founding period）
2. **個人貸款加速還款**：你個人 HK$200K loan 月供 HK$15K，呢個 cashflow 可以讓你 Y2 開始額外還 principal HK$5K–10K / 月，shortened maturity 12–18 個月
3. **HKCardColl growth reserve**：Year 2 Phase 2 / Phase 3 開發資金，唔使 raise seed

---

## 07 · Top 5 Implementation Tasks

按 priority + dependency：

1. **Week 1**（pre-launch）：申請 TCGplayer Affiliate + Whatnot Affiliate + HitParade affiliate（3 個 email）
2. **Week 2**：Supabase Edge Function `outbound-redirect` + `affiliate_clicks` table + `affiliate_revenue` table
3. **Week 3**：App 內加「Buy at TCGplayer / Whatnot」buttons on card detail page
4. **Month 3**：寫 Sponsored Placement 1-pager + 入 Tier 02 onboarding flow
5. **Month 3**：「抽卡 Live Break」獨立 tab implementation（含 age gate + spending warning + disclaimer）

Tech work 屬 Code / Claude Code 對話。本檔只記 numbers。

---

## 08 · Risk Register

| Risk | Mitigation | Owner |
|---|---|---|
| HK Cap. 148 enforcement against mystery box | 季度 review、72 小時 disable mechanism、age gate、spending warning | Founder + Numbers |
| Affiliate partner cut commission rate | 分散：no single partner > 40% revenue | Founder |
| Sponsored 商戶 conflict（多個搶同一 slot） | Monthly auction model + transparent ranking | Product / Code |
| Brand voice 被稀釋（抽卡 hype 入侵主流程） | 抽卡 tab 隔離；search / pricing 主流程禁 sponsored cards | Product / Brand |
| 廣告影響 Tier 02 trust | Sponsored 標籤永遠顯示「贊助」字樣 + opt-out from sponsored results | Product |
| Tax treatment of foreign affiliate income | HK profits tax @ 8.25%（首 HK$2M），與 subscription 同基礎 | Accountant Year 1 review |

---

## 09 · Changelog

| Date | Version | Change | Source |
|---|---|---|---|
| 2026-05-17 | v1 | 初版建立。Founder 拍板 3 decisions：抽卡全 in、Sponsored 即時上、Direct Ad delay | HKCC · Numbers 對話 2026-05-17 |
