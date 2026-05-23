# numbers · Sweat Equity Log 使用指南

> 配對檔案：`/Users/alvin/collectr/Finance invoice and receive/POTO_Sweat_Equity_Log.xlsx`
> 最後更新：2026-05-17
> 對話：HKCC · Numbers

---

## 01 · 為什麼要建這個 log

Founder 至今投入未支薪工作量是 HKCardColl 估值論述的核心 anchor。Cap table v1（`numbers_cap-table-v1_2026-05.md` 04 章）估算 founder 累計 sweat equity 為 **HK$480K – HK$1.35M 區間**，這是憑記憶的粗估，**不能用於對外文件**。

要 unlock 三個用途：

1. **CCMF / YBHK / Easy BUD 申請**：評審員會問「founder 投入幾多」。沒有 weekly log，答 250–800 hours 範圍 = 信任度低；有 log，答「截至 YYYY-MM 累計 X hours、按市場時薪 Y 估值 HK$Z」= 可信。
2. **Seed pitch valuation justification**：HK pre-seed 沒有強 comparable，VC 看的是 founder commitment。具體小時數比「我做咗好耐」有說服力。
3. **未來 co-founder / advisor / 員工加入時**的 founder contribution 量化基準。

---

## 02 · 檔案結構（5 個 sheet）

| Sheet | 用途 | 操作 |
|---|---|---|
| **README** | 使用說明（檔內版本） | 唯讀 |
| **Rate Card** | 5 個 category 的時薪 anchor | 藍色字 = 可改 |
| **Weekly Log** | 逐日逐項時數紀錄 | 主要填寫區 |
| **Monthly Summary** | 自動 aggregate 每月總時數 / 估值 / 分類拆解 | 唯讀（公式自動算） |
| **Cumulative** | 自動 aggregate 累計時數 / 估值 | 唯讀（公式自動算） |

---

## 03 · 五個 Category 與時薪 anchor

依香港自由接案市場 HK$800–1,500 / h 範圍設定：

| Category | 涵蓋工作 | 時薪 (HK$/h) |
|---|---|---|
| Engineering | Code、debug、架構、Supabase、DB | 1,500 |
| Product Design | UX、UI、原型、用戶研究 | 1,200 |
| BD | 商戶招募、合作洽談、客戶會議 | 1,000 |
| Marketing | 內容、IG/FB、廣告、PR、Brand | 1,000 |
| Ops | 行政、會計、法務、註冊、續期 | 800 |

時薪可在 Rate Card sheet 直接改，**所有歷史紀錄會自動重算**。

---

## 04 · 每週填寫 SOP（10 分鐘 / 週）

### 4.1 固定排程

建議：**每週日晚** 21:00–21:15 開檔填寫上週工作。

### 4.2 操作步驟

開 `POTO_Sweat_Equity_Log.xlsx` → 去 **Weekly Log** sheet → 由上一次最後填的 row 接住寫。

每一 row 填四欄：

| 欄位 | 填什麼 | 範例 |
|---|---|---|
| Date | 工作日期 | 2026-05-15 |
| Category | 用 dropdown 選五項之一 | Engineering |
| Hours | 該日該 category 投入小時數（可填小數） | 4.5 |
| Description / Output | 做咗咩、有咩 deliverable | "Fix unread badge throttle bug; portfolio chart cumulativeOverBuckets refactor" |

**其他欄位（Day / Week No / Month / Rate / Value）全部自動算，不要改。**

### 4.3 一日多 category

如果同一日做了 3 小時 code + 2 小時 BD，填**兩 row**：

| Date | Category | Hours | Description |
|---|---|---|---|
| 2026-05-15 | Engineering | 3 | ... |
| 2026-05-15 | BD | 2 | ... |

---

## 05 · 紀錄品質規則（影響對外引用可信度）

### 5.1 Description 必須具體

✓ Do：「Stripe HK webhook integration for Tier 02 merchant subscription, 4 endpoints + retry logic」
✗ Don't：「寫 code」

### 5.2 時數要誠實

- **算進去的**：思考 / 設計 / 寫 code / debug / 開會 / Email 來往 / 文件 / 寫 deck
- **不算進去的**：刷 Twitter、IG 機械式滑動、睇與工作無關內容、用餐、通勤（除非通勤途中真係做工作）

### 5.3 不可回補超過 3 個月

當下漏記，3 個月內可以補（記入「Description」內備註「補記」）。超過 3 個月寧願留空，不要造數。CCMF 評審員若 sample 抽查發現異常密集的回補，整份 log 信任度歸零。

---

## 06 · 對外引用語句範本

### 6.1 CCMF / YBHK / Easy BUD application

```
Founder Kuo Tsz Lung 自 2026 年 [起始月] 月起為 HKCardColl 投入未支薪工作。
截至 [YYYY-MM]，累計投入工作時數為 [X] 小時，依香港自由接案市場時薪
HK$800-1,500 / 小時換算，等值勞力投入為 HK$[Y]（區間下界）至 HK$[Z]（上界）。
按項目分布：Engineering [X1] 小時、Product Design [X2] 小時、BD [X3] 小時、
Marketing [X4] 小時、Ops [X5] 小時。
```

### 6.2 投資人 pitch deck

引用 **Cumulative sheet** 的最後一行（最近月份）「Cum. Value」單一數字 + footnote：

> *依香港自由接案市場時薪 HK$800-1,500 / 小時 blended 換算，weekly log 紀錄起自 [起始日]*

### 6.3 不可引用的場合

- IG / 公開推廣文：屬內部財務數據，不公開
- 給未簽 NDA 的潛在投資人 / partner：等簽 NDA 才提供

---

## 07 · 開始記錄前要做的事

1. **確認起始日**：你想由哪一日起算？建議由 2026-02-01（公司開始策劃 HKCardColl 起點）或 2026-05-11（公司正式成立日）。決定後，去 Weekly Log 由該日第一週開始記。
2. **檢查 Rate Card**：5 個時薪 anchor 你 OK 嗎？若想改去 Rate Card sheet 改。
3. **設 calendar reminder**：每週日 21:00。

---

## 08 · 維護週期

| 頻率 | 動作 |
|---|---|
| 每週日 | 填上週 7 日紀錄 |
| 每月最後一日 | Review Monthly Summary，確認無缺漏 |
| 每季 | Review Rate Card，是否需要按市場行情調整 |
| 每年報稅前 | 配合 Cap Table 與 Director's Fee 紀錄，整理 founder contribution 總表 |

---

## 09 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | 初版建立。模板含 5 sheets、1,380 條公式、200 行 Weekly Log 預留 |
