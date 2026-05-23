# numbers · 認證商戶定價 v1

> 用途：HKCardColl Tier 02 認證商戶訂閱定價、Founding Merchant 條款的事實基準。
> 最後更新：2026-05-17
> 對話：HKCC · Numbers
> 狀態：**v1 已 freeze**，pricing 由首 10 個 founding 商戶 onboard 後 90 日 review。

---

## 01 · 一句話

**HKCardColl Tier 02 認證商戶月費定價 HK$500 / 月 / storefront。**
首 10 個簽約商戶為 **Founding Merchant**，享 2 個月 free trial + 5 個專屬權益（包括終身鎖價 HK$500）。

---

## 02 · 三層商戶結構

| Tier | 對象 | Listings 上限 | 驗證 | 月費 |
|---|---|---|---|---|
| 01 · Personal | 個人賣家 | 10 | 自行申報 | HK$0 |
| 02 · Certified | 卡店 / 認證商戶 | 100 | BR 文件核驗 + 認證徽章 | **HK$500 / 月** |
| 02F · Founding | 首 10 個 Tier 02 | 100 | 同 Tier 02 | **HK$500 / 月**（終身鎖價 + 2 個月 free trial） |

來源：`product.md` 02.4「商業模式（兩層商戶系統）」+ 本對話 2026-05-17 決定。

---

## 03 · Tier 02 訂閱條款

| 項目 | 內容 |
|---|---|
| 月費 | HK$500 / 月 / storefront |
| 計費週期 | 月結，自動續訂 |
| 帳單貨幣 | HKD |
| 收款方式 | Stripe HK / Airwallex（待 P2 確認）|
| Free trial | 14 日（普通 Tier 02 商戶；不適用於 Founding，見下） |
| 取消 | 隨時取消，當期結束生效，無違約金 |
| 升降級 | 隨時可由 Tier 01 → Tier 02（補差價，按日比例） |
| Listings 上限 | 100 |
| 認證費用 | 一次性 HK$0（BR 文件核驗）|

**Anchor 來源**：
- HK SaaS for SMB 慣例範圍 HK$200–1,500 / 月
- Shopify Basic US$29 ≈ HK$226 / 月（但僅 storefront tooling，無 marketplace 流量）
- 卡店每月利潤口徑 HK$30K–80K（內部估算，N=3 訪談 ── 待補正式 reference）
- HK$500 / 月 = HK$17 / 日，於商戶月利潤 < 1%，屬「忽略級」固定成本

---

## 04 · Founding Merchant 條款（首 10 個）

### 4.1 條款摘要

| 元件 | 內容 |
|---|---|
| 名額 | **10 個**（先到先得，截止日待定）|
| 月費 | HK$500 / 月（與普通 Tier 02 同價）|
| Free trial | **2 個月**（取代 14 日）|
| 鎖價 | **終身 grandfathered HK$500 / 月**，平台未來加價（例：HK$700 / 月）不影響 founding 10 個 |
| Founding 身份 | 永久（不會 expire），但須持續維持帳號 active 狀態 |

### 4.2 五個專屬權益

1. **終身鎖價（Grandfathered）** — 平台日後正常 Tier 02 月費調升至 HK$700 / HK$900 / 任何水平，Founding 10 個維持 HK$500 / 月終身。
2. **Founding 認證徽章** — UI 上獨立標記，與普通 Tier 02 區分。標題例：「Founding Merchant · 旺角 Mint」。
3. **Listing 代上架服務（一次性）** — Founder 親自協助首 50 張卡上架。內部估值：5 小時 × HK$1,000 / h = HK$5,000 / 商戶。
4. **IG / 媒體開業 feature** — HKCardColl 官方 IG 每間 founding 商戶一篇 dedicated post + 一次合拍短片。
5. **Pricing data contributor 身份** — 成交數據納入 HK 市場指數計算。Phase 2（Q3 2026）Premium Data 推出時，Founding 商戶於 dashboard 顯示其數據貢獻佔比。

### 4.3 條款失效條件

Founding 身份**永久**，但以下情況觸發 review：
- 連續 3 個月 0 active listings → 暫停 Founding 身份（保留鎖價，但失去 5 項權益）
- 違反 community guidelines 或 BR 文件造假 → 取消 Founding 身份 + 帳號封停

---

## 05 · 為什麼是這個結構

### 5.1 為什麼 HK$500 / 月（不是 HK$300 / HK$700）

- HK$300：太接近個人 Carousell 心理價，無 anchor 商戶「我哋係專業商家」的識別效應
- HK$500：HK$17 / 日，於卡店月利潤約 0.6–1.6%（按 HK$30K–80K 利潤區間），可忽略
- HK$700：仍可接受但無 traction data 證明價值前過於 aggressive，啟動 friction 增加

→ Day 1 用 HK$500 anchor，6–12 個月後（有 case study + 用戶數）再 review 是否調至 HK$700–900。Founding 10 個鎖價，不受 review 影響。

### 5.2 為什麼用 2 個月 free trial（不是 14 日 / 6 個月）

- 14 日：對普通 Tier 02 適用（Shopify 慣例），但對 Founding Merchant 不夠誠意
- 6 個月：在 SaaS frame 下偏長，信號「平台不確信自己 deliver 到價值」
- **2 個月**：足夠 founding 商戶上架 + 體驗一個完整月度週期 + 第二個月驗證 ROI，但 cutoff 清晰

### 5.3 為什麼用「終身鎖價」做主要 founding 福利（不是長 discount）

| 方案 | 對商戶感覺 | 平台代價 |
|---|---|---|
| 6 個月免費 | 短期着數，但 month 7 churn 風險高 | HK$30,000 forgone |
| 終身鎖價 HK$500 + 2 個月 trial | 「我哋係創辦時期 partner」身份感 + 長期 ROI（平台日後加價，佢哋無感）| 2 個月 × 10 × HK$500 = HK$10,000 forgone + 未來加價收入差額 |

Forgone revenue 較低，留客誘因較強，且建立「founder commitment」品牌敘事。

---

## 06 · 收入模型（敏感度）

### 6.1 Year 1（保守情境）

假設：Q2 2026 上線、首 10 個 founding 商戶於 Q2 內 onboard、Q3 開始累積普通 Tier 02。

| 時間點 | Tier 02 商戶數 | 含 founding 計費 | 月度 MRR |
|---|---|---|---|
| Month 1（上線） | 5（含 5 個 founding trial 中）| 0 | HK$0 |
| Month 2 | 10（5 founding trial + 5 founding 試用第 2 個月）| 0 | HK$0 |
| Month 3 | 10 founding（trial 結束開始收費） | 10 × HK$500 | HK$5,000 |
| Month 6 | 10 founding + 5 普通 | 15 × HK$500 | HK$7,500 |
| Month 9 | 10 founding + 10 普通 | 20 × HK$500 | HK$10,000 |
| Month 12 | 10 founding + 15 普通 | 25 × HK$500 | HK$12,500 |

**Year 1 累計 Tier 02 收入估算：~HK$70,000–90,000**。

> 注：Grant docx Section 7 寫 Q3 2026 MRR target HK$50,000、Q4 HK$200,000，那組數字假設 Phase 2（Premium Data）+ Phase 3（B2B API）同步啟動。本表只計 Phase 1。Phase 2 / 3 模型另檔。

### 6.2 加價情境（Y2 後）

若 Month 13 起普通 Tier 02 月費調至 HK$700：
- Founding 10 個維持 HK$500 → MRR 貢獻 HK$5,000
- 普通 Tier 02 假設 30 個 → MRR 貢獻 HK$21,000
- **合計 MRR：HK$26,000 / 月**

Founding 鎖價的長期 forgone：HK$200 / 月 × 10 × 12 = HK$24,000 / 年。可接受。

---

## 07 · 對比業界 anchor

| 平台 | 商戶月費 | Trial | 抽成 |
|---|---|---|---|
| Shopify Basic | US$29 ≈ HK$226 | 14 日 | 信用卡 2.9% + 30¢（用 Shopify Payments）|
| Square HK | HK$0 | — | 2.7%（線下）/ 3.4%（線上） |
| Carousell Pro | HK$98–598 / 月 | 7 日 | 1% 上架費 |
| HKCardColl Tier 02 | **HK$500** | 14 日（普通）/ 2 個月（founding） | **無**（v1 不抽成）|

HKCardColl 採純訂閱（無抽成）的理由：
- 商戶現有競品（Carousell、FB 群組、IG）都唔抽 → 抽成會被當「貴」
- HK 卡店成交常以現金或銀行轉帳結算，平台難以強制抽成
- 認證徽章 + 數據貢獻 + 流量 = 訂閱費的價值對應

---

## 08 · Open Items（v1 freeze 後待議）

1. **年費 prepay 優惠**：建議 12 個月一次付 HK$5,000（等於 10 個月價，送 2 個月）。等首 5 個 founding 簽約後再決定推不推。
2. **Tier 01 商戶升 Tier 02 是否有 onboarding 優惠**：建議首 3 個月半價（HK$250 / 月）。待 Tier 01 用量資料夠了再定。
3. **Annual price review cadence**：建議每年 Q1 review 一次，調整以新簽用戶為主，現有用戶 6 個月前通知。
4. **多店面（multi-storefront）定價**：第 2 間鋪以後是否打折？建議第 2 間 8 折（HK$400 / 月），第 3 間 7 折。待第一個多店商戶出現再定。
5. **Transaction commission 決策**：v1 維持 0%。若 Year 2 加入 escrow service 或代收功能，再評估 1–2% 抽成。
6. **Founding 名額是否擴充**：硬上限 10 個。若超額需求，啟動 waitlist + 第 11–20 個轉「Early Supporter」身份（享鎖價但不享代上架 / IG feature）。

---

## 09 · 行動項目

### 即時（本週 / 配合上架）
- [ ] **Merchant one-pager 中文版**寫稿 → 印 / IG carousel 兩用
- [ ] App 內 Tier 02 訂閱 flow 接入 Stripe HK 或 Airwallex（具體支付架構待 Code 對話定）
- [ ] BR 核驗 SOP 文件（哪個 staff 收 → 多久回覆 → 拒絕條件）

### 30 日內
- [ ] 首 10 個 founding merchant 簽約合約模板（含 grandfathered 鎖價條款書面化）
- [ ] Listing 代上架服務 SOP（5 小時 / 商戶的 deliverable 清單）

### 90 日內
- [ ] 收集首 10 個 founding 的 retention + listing volume → 決定第 11 個之後是否調價
- [ ] Phase 2（Premium Data）定價模型 v1

---

## 10 · Changelog

| Date | Change | Source |
|---|---|---|
| 2026-05-17 | 初版建立。Anchor 定 HK$500 / 月。Founding 2 個月 trial + 5 權益 + 終身鎖價 | HKCC · Numbers 對話 2026-05-17 |
