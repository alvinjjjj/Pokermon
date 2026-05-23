# numbers · Cap Table v1

> 用途：POTO Creative Tech Limited（HKCardColl 法人主體）股權結構的 day-0 基準。
> 最後更新：2026-05-17
> 對話：HKCC · Numbers
> 狀態：**v1 已 freeze**。任何股權變動（advisor / SAFE / seed）須建 v2，不直接覆寫本檔。

---

## 01 · 公司資料

| Field | Value |
|---|---|
| 法人主體 | POTO Creative Tech Limited（寶圖創意科技有限公司）|
| 公司編號 | 80363844 |
| BR 號碼 | 80363844-000-05-26-0 |
| 成立日 | 2026-05-11 |
| 註冊地 | Hong Kong（HKSAR Companies Registry）|
| 唯一董事 | Kuo Tsz Lung（Alvin）|
| 註冊地址 | Flat E, 6/F, Block 7, Harmony Garden, Siu Sai Wan |
| 業務 | Software development, mobile application publishing and digital design services |
| 旗下品牌 | HKCardColl（唯一 active product，2026-05-16 完成 Collectr → HKCardColl rebrand）|

來源：`notes/公司註冊-基金申請-Apple開發者.md`、Certificate of Incorporation 150146979.pdf、BRC_150146979.pdf。

---

## 02 · Cap Table Day 0（2026-05-11）

| Shareholder | Role | Shares Issued | % Equity | Vesting | Notes |
|---|---|---|---|---|---|
| Kuo Tsz Lung | Founder & Director | **TBD** | **100%** | 無（founder shares fully vested） | 待從 NNC1 / Annual Return 補確切 share count |

### 2.1 重要事實

- **股東**：1 人（Kuo Tsz Lung）
- **股權**：100% 完全由 founder 持有
- **Founder vesting**：**無**。HK 私人公司 founder 通常不設 vesting cliff，除非有 co-founder 或外部投資人要求。
- **Option pool / ESOP**：**未建**。第一輪正式融資前無需。
- **Advisor shares**：**未發**。
- **可轉換工具（SAFE / Convertible Note）**：**未發**。
- **Pre-money valuation**：**未定**。Day 0 公司無外部估值。

### 2.2 待補資料

需從 NNC1 表格（公司成立文件）或 Companies Registry 查冊確認以下三項：
- 法定股本（Authorised Share Capital）總額
- 已發行股份數（Issued Shares）
- 每股面值（Par Value，HK 私人公司常見為 HK$1 / share）

→ Action：下次登入 [www.icris.cr.gov.hk](https://www.icris.cr.gov.hk/) 用公司編號 80363844 查冊，把實際 share count 填入本檔 02 表。費用約 HK$22 / 份。

---

## 03 · 預留 Slot（未啟動）

以下結構**已預留但尚未發行**，等到實際觸發事件才啟動 v2。

| Slot | 預留 % | 觸發事件 | v2 處理方式 |
|---|---|---|---|
| ESOP / Option Pool | 10–15% | 首位非 founder 全職員工到職 OR seed round | Pre-seed 階段建議 10%；seed 後標準 15–20% |
| Advisor Shares | 0.25–1% / 名 | 簽 advisor agreement（建議用 FAST template）| Total advisor pool 上限 2% |
| SAFE / Convertible Note | N/A（dilutive 視 cap 而定） | 首位 angel / pre-seed 投資人簽 SAFE | YC SAFE 模板 + valuation cap |
| Seed Round Equity | 15–25% | 正式 priced round | 視 raise 金額 / pre-money valuation 而定 |

### 3.1 ESOP 估算示範

若 Y2 簽 1 位 senior dev + 1 位 BD：
- Senior dev：0.5–1.5%（典型 HK seed-stage early hire）
- BD：0.25–0.75%
- 4 年 vesting + 1 年 cliff（標準 4/1 vesting）

→ ESOP 10% pool 內可支援約 5–8 個 early hire。

---

## 04 · Sweat Equity 估值（用於 valuation justification）

Founder 至今投入未支薪工作，需建立量化紀錄以支持日後估值論述。

| 計算項 | 數值 | 來源 |
|---|---|---|
| 投入起始日 | 2026-02 月（保守估計，待 founder 確認）| 待填 |
| 至 2026-05-17 累計週數 | ~15 週 | 待 founder 確認 |
| 每週投入時數 | 估 40–60 h | 待 sweat equity log 補確切 |
| 時薪區間（市場 anchor） | HK$800 – HK$1,500 / h | 香港 UIUX / Senior Mobile Dev 自由接案行情 |
| **累計 sweat equity（區間估算）** | **HK$480K – HK$1.35M** | 區間：15 × 40 × 800 ~ 15 × 60 × 1500 |

→ 完整 log 由 `Finance invoice and receive/POTO_Sweat_Equity_Log.xlsx` 維護（見另檔）。

**用途**：CCMF / 投資人 pitch 時，作為「founder 已投入 HK$480K–1.35M 等值勞力」的事實基準，配合「現金 investment 只需 HK$X」的論述。

---

## 05 · 未來變動觸發事件

以下事件**必須**建立 cap-table-v2、v3、...，並 reference 本 v1 為前序版本：

1. 任何新股東加入（含 advisor / 共同創辦人）
2. SAFE / Convertible Note 簽署
3. Priced round（pre-seed / seed / series A）
4. ESOP / Option pool 建立或擴充
5. Founder shares 任何 transfer / 回購
6. 公司增資 / 減資

每次 v2+ 必須包含：
- Pre-transaction cap table
- Post-transaction cap table（fully diluted）
- 變動原因 + reference 文件（合約 / SAFE / Board resolution）
- Effective date

---

## 06 · 對外引用規則

本 cap table 屬**內部基準**。對外場合（投資人 deck、CCMF 申請、YBHK 面試）引用時：

- **可以**講「100% founder-owned, single director」
- **可以**講「pre-money baseline established 2026-05-17」
- **不要**寫具體 share 數量（涉及內部結構，等到投資人簽 NDA 後才提供）
- **可以**附上 sweat equity 估值區間（含計算口徑）

對外語氣樣板（書面中文）：
> 「截至 2026 年 5 月，POTO Creative Tech Limited 由創辦人 Kuo Tsz Lung 100% 持有，未進行外部融資，未發行任何 advisor shares、員工期權或可轉換工具。創辦人自 [日期] 起累計投入勞力以市場時薪計算估值為 HK$480,000 至 HK$1,350,000。」

---

## 07 · Open Items

1. **Founder 投入起始日**：需確認（影響 sweat equity 累計）
2. **Sweat equity log**：未開始正式紀錄。本檔之 04 為估算區間，**不可用於正式對外文件**直至有 weekly log
3. **Authorised share capital 確切數字**：待查冊
4. **是否考慮 founder vesting**：HK 一人公司無強制要求，但若 Y1 內加入 co-founder / 全職員工，建議補加 4 年 vesting cliff 條款
5. **公司秘書尚未委任**：影響日後股權變動文件處理（HK Companies Ordinance 要求 NSC1 / NAR1 等表格須由公司秘書簽署）

---

## 08 · Changelog

| Date | Version | Change | Source |
|---|---|---|---|
| 2026-05-17 | v1 | 初版建立。Founder 100%，無任何 dilution、無 ESOP、無 SAFE | HKCC · Numbers 對話 2026-05-17 |
