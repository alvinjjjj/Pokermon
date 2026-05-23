# numbers · Burn Rate + Runway v1

> 配對檔案：`/Users/alvin/collectr/Finance invoice and receive/POTO_Burn_Runway_v1.xlsx`
> 最後更新：2026-05-17
> 對話：HKCC · Numbers
> 狀態：**v1 freeze**。期間 2026-05 → 2027-10（18 個月）。

---

## 01 · 一句話

公司 18 個月平均淨燒錢 **HK$4,000–5,500 / 月**。**最關鍵發現：起始現金 HK$50,000 不足以撐到 Month 7 CCMF 入賬**，三情境（含 Base）都會在 Month 5–6 出現 negative cash gap。需要 founder 個人 bridge 約 HK$15,000–20,000 或預先 raise pre-seed。

---

## 02 · 模型核心假設

| 項目 | 數值 | 來源 |
|---|---|---|
| Period | Month 1 = 2026-05（公司成立月）→ Month 18 = 2027-10 | 對話 2026-05-17 |
| Director's Fee | HK$10,000 / 月 | 對話 2026-05-17 |
| Tier 02 月費 | HK$500 | `numbers_merchant-pricing-v1_2026-05.md` |
| Founding merchants | 10 個，2 個月 trial，終身鎖價 | 同上 |
| 公司起始現金 | HK$50,000（placeholder，**待確認**） | 估算 |
| 公司年度固定 | HK$15,820 / 年 = HK$1,318 / 月（公司秘書 + BR + 核數師 + domain + Apple Dev） | `notes/公司註冊...` |
| Technical OPEX | M1–2: HK$0 / M3–6: HK$585 / M7–12: HK$702 / M13–18: HK$1,217 | `notes/Collectr App 開發...` 5K MAU 估算 + 縮放 |
| CCMF | HK$100,000 入賬 Month 7（2026-11，假設 Aug 3 截止 + 2 個月評審） | `notes/公司註冊-基金申請...` |
| Easy BUD | HK$75,000（50% × HK$150K spending）入賬 Month 9（2027-01） | 同上 |
| YBHK HK$180K | **不計入模型**（屬免息貸款，是 debt 非 equity；要還） | 同上 |

USD/HKD = 7.8

---

## 03 · 三情境 input 差異

| 變數 | Lean | Base | Aggressive |
|---|---|---|---|
| 每月新 Tier 02 商戶（M4 起） | 1 | 2 | 4 |
| Monthly churn % | 10% | 5% | 3% |
| Marketing 預算 / 月 | HK$0 | HK$3,000 | HK$5,000 |
| CCMF 入賬機率 | 0%（不批） | 100% | 100% |
| Easy BUD 入賬機率 | 0% | 100% | 100% |
| Phase 2 啟動月 | 不啟動 | 不啟動 | Month 12 |
| Phase 2 ARPU × 訂閱數 | — | — | HK$50 × 100 = +HK$5,000 MRR |

---

## 04 · 結論（直接讀 Scenario Summary）

### 4.1 Closing Cash @ Milestones

| 月份 | Lean | Base | Aggressive |
|---|---|---|---|
| Month 3 (2026-07) | HK$20,460 | HK$14,460 | HK$10,460 |
| Month 6 (2026-10) | HK$2,555 | **−HK$9,448** | **−HK$13,488** |
| Month 9 (2027-01) | **−HK$12,396** | HK$149,024 | HK$153,651 |
| Month 12 (2027-04) | −HK$24,938 | HK$139,123 | HK$165,793 |
| Month 18 (2027-10) | −HK$48,319 | HK$132,467 | HK$246,869 |

**Lean 18 個月內破產（-HK$48K）。Base / Aggressive 在 Month 5–6 出現 cash gap，CCMF 入賬後恢復。**

### 4.2 Runway

| 指標 | Lean | Base | Aggressive |
|---|---|---|---|
| Months with positive cash (out of 18) | 6 | 16 | 16 |
| Min closing cash (任何月份) | −HK$48,319 | −HK$9,448 | −HK$13,488 |
| 平均淨燒錢 / 月 | HK$5,462 | HK$5,152 | HK$3,964 |

### 4.3 MRR（不含 grant）

| 月份 | Lean | Base | Aggressive |
|---|---|---|---|
| Month 6 | HK$6,355 | HK$7,852 | HK$10,822 |
| Month 12 | HK$8,063 | HK$12,395 | HK$25,985 |
| Month 18 | HK$8,971 | HK$15,734 | HK$34,450 |

對照 Grant docx Section 7 寫 Q3 2026 MRR target HK$50,000：**本模型 v1 顯示這個目標太樂觀**。即使 Aggressive 情境，到 Month 18（已經是 2027 Q4）才接近 HK$35K。Grant docx 那組數字假設 Phase 2 + Phase 3 同步啟動且高滲透率，需要在 CCMF Vol.02 重寫時 reset。

### 4.4 Total Paying Tier 02 商戶

| 月份 | Lean | Base | Aggressive |
|---|---|---|---|
| Month 6 | 13 | 16 | 22 |
| Month 12 | 16 | 25 | 42 |
| Month 18 | 18 | 32 | 59 |

對照 Grant docx「6 個月內 20 個 certified merchants」目標：Base 情境 Month 6 = 16 個（差 4 個）、Aggressive = 22 個（超標）。**Base 是達標下界，Aggressive 才能輕鬆達標。**

---

## 05 · 三個 Critical Findings

### 5.1 Month 5–6 是現金最緊張的時段

不論 Base 或 Aggressive，CCMF 入賬前的 5–6 個月就會出現 negative closing cash（−HK$9K 至 −HK$13K）。這是因為：

- 公司首 6 個月燒緊全部 OPEX（Director's Fee HK$60K + 技術 + 固定 + marketing）
- Founding 商戶頭 2 個月免費，Month 3 才開始有 HK$5K MRR
- CCMF Aug 3 截止後，最快 2 個月評審 + disbursement，所以 Month 7（2026-11）才到帳

**解法選擇**（按優先序）：

1. **Founder 個人 bridge HK$20K**：Month 5 從個人戶口轉 HK$20K 入公司 bank account。最簡單。HK$20K 比 HK$15K 略多以避免 buffer 太薄。
2. **首兩個月 Director's Fee 暫不領**：公司現金少 HK$20K outflow。Founder 個人少 HK$20K 收入。對沖效果同 #1，但帳面更乾淨（無需 founder 注資 → 公司 → founder 工資的三角）。
3. **加快 CCMF 申請**：理論上若 6 月（Aug 3 前 6 週）提交 = 8 月評審 = 10 月入賬 = Month 6。但這個 timing 不在你 control。
4. **預先 raise HK$50K pre-seed angel**：可以 cover 整個 cash gap + 18 個月 buffer，但 dilutive。

**我建議：方案 2（首 2 個月 Director's Fee = HK$0，由 Month 3 起 HK$10K / 月）**。理由：sweat equity log 已經 capture 你的勞力投入，金錢上不領薪 = 你已有 sweat equity 紀錄 + 公司多 HK$20K 現金 cushion + 對外 pitch 時可以講「founder 起步 2 個月零薪」= 強 commitment signal。

### 5.2 Lean 情境如果 CCMF 不批，公司會在 Month 9 破產

Lean 假設 0 grant。Closing cash Month 9 = −HK$12,396。即使一直撐，Month 18 closing = −HK$48,319。

**Minimum viable seed need**（若拒絕一切 grant 假設）= 起始 HK$50K + 補 cash gap HK$50K = **HK$100,000 額外 cash**。

這就是 pre-seed angel raise 的 floor 數字。若想留 6 個月 buffer，建議 raise **HK$150,000–250,000**。

### 5.3 Grant docx Section 7 的 MRR 目標需要重 calibrate

| 來源 | Q3 2026 MRR | Q4 2026 MRR | Q1 2027 MRR |
|---|---|---|---|
| Grant docx (Collectr v1) | HK$50,000 | HK$200,000 | HK$500,000 |
| 本模型 v1 (Base) | HK$8K | HK$12K | HK$14K |
| 本模型 v1 (Aggressive) | HK$11K | HK$26K | HK$35K |

差距 4–35 倍。CCMF Vol.02 重寫時，**必須把 MRR 預測 down-revise** 並換 anchor：

- Q3 2026: HK$8K–11K MRR（首 10 founding 全部 conversion）
- Q4 2026: HK$12K–25K MRR（Tier 02 持續招新）
- Q1 2027: HK$14K–35K MRR（Phase 2 在 Aggressive 啟動）

這份 down-revised 數字更 defensible，CCMF 評審員看到原版「HK$500K MRR by Q1 2027」會直接質疑可行性。

---

## 06 · Sensitivity Tests

### 6.1 對起始現金敏感

起始現金 → Month 18 closing cash (Base):

| 起始 | Min cash | Month 18 closing |
|---|---|---|
| HK$30,000 | −HK$29K | HK$112K |
| HK$50,000 | −HK$9K | HK$132K |
| HK$70,000 | +HK$11K | HK$152K |
| HK$100,000 | +HK$41K | HK$182K |

→ 每 HK$1 起始現金 = +HK$1 終值。要 cover Month 6 cash gap，起始現金需 ≥ HK$60K。

### 6.2 對 Director's Fee 敏感

Director's Fee → 平均淨燒錢 (Base):

| Dir Fee / 月 | Avg net burn |
|---|---|
| HK$0（純 sweat） | −HK$5K（公司淨流入） |
| HK$5,000 | HK$0 |
| HK$10,000 | HK$5K |
| HK$20,000 | HK$15K |

→ Director's Fee 是最大可變支出。每 HK$1,000 / 月 = HK$18K 18 個月差。如果想極端 conservative，可以前 6 個月設 HK$0（純 sweat），由 Month 7 CCMF 入賬後才開始領 HK$10K。

### 6.3 對 CCMF 不批的敏感

若 Base 情境 CCMF 不批（其他不變）：
- Month 7 不再有 HK$100K 入賬
- Month 18 closing 由 +HK$132K → +HK$32K
- 仍然有 positive runway，因為 Easy BUD HK$75K 仍假設批准

若 CCMF + Easy BUD 都不批：
- 等於 Lean 情境的 cash flow，但保留 marketing spend
- Month 18 closing ≈ −HK$95K

→ **單一 grant 不批不致命，兩個都不批就要靠 raise。**

---

## 07 · Seed Funding Implications

基於本模型，pre-seed raise 的決策框架：

### 7.1 如果只想 cover 到 Month 18 不破產

- **HK$0 raise**（純靠 grant + bridge）：要 Base scenario 才安全；高度依賴 CCMF + Easy BUD 雙批
- **HK$50,000 raise**（Friends & Family）：covered Lean scenario 18 個月
- **HK$150,000 raise**（小 angel）：18 個月後仍有 HK$100K+ cushion，可以 ride 出 Y2

### 7.2 如果想 push Aggressive scenario

需要在 Month 8–10 啟動 Phase 2 開發（提早 2–4 個月）。預估需要：

- 第一位 part-time engineer：HK$25K / 月 × 6 個月 = HK$150K
- Phase 2 marketing：HK$10K / 月 × 6 個月 = HK$60K
- 合計：HK$210K incremental

→ Aggressive scenario raise target ≈ **HK$250,000–400,000**

### 7.3 估值方法（Pre-seed HK）

HK pre-seed 沒有強 comparable，建議用兩個 anchor 三角：

1. **Sweat equity floor**：HK$480K–1.35M（cap table v1 估算）。Founder 已投入這麼多，pre-money 不應低於 HK$1M
2. **Future revenue multiple**：Aggressive Month 18 MRR HK$34K × 12 = ARR HK$400K。Early-stage SaaS 5–10x ARR = HK$2M–4M 估值範圍
3. **Comparable**：HK pre-seed Pokemon TCG / niche marketplace 沒 public comp。最接近的是 HK gaming / collectibles startup pre-seed valuation HK$5M–15M（pre-money）

**建議 pre-money 目標**：HK$5M–8M（中位 HK$6.5M）

**Raise HK$250K @ HK$6.5M pre-money = 3.7% dilution**。可接受。

---

## 08 · 行動項目

### 即時（本週）
- [ ] **確認公司起始現金實際 balance**：去 Airwallex（或其他公司 bank）查當前 balance，update Assumptions!B$3
- [ ] 決定 Month 5–6 cash gap 解法：方案 1 (個人 bridge) / 方案 2 (前 2 月零薪) / 方案 4 (pre-seed raise)

### 30 日內
- [ ] 開始記 sweat equity log（建立 valuation justification）
- [ ] Unit Economics v1（CAC / LTV / Payback）— 需要在 CCMF Vol.02 引用

### 6 月底前（CCMF 截止前 5 週緩衝）
- [ ] CCMF Vol.02 重寫，含 down-revised MRR 預測

### Q3 2026（上線後 4–6 週）
- [ ] 觀察前 4 週商戶 onboarding 速度，update Assumptions!new_tier02 反映實際
- [ ] 決定是否 raise pre-seed（視乎 traction 數據 + grant 結果）

---

## 09 · 模型限制與後續 v2 待改善

1. **商戶數變成小數**（17.9 而非整數）：因為 churn rate 連續應用。實際是離散事件，但對 cash flow 影響 < 1%
2. **沒有 CCMF spending 限制**：CCMF 規定資金用於特定支出類別（40% marketing / 35% product / 25% legal）。本模型把 CCMF 當作純現金注入。實際使用要按 Cyberport 規定 reporting
3. **沒有稅務**：HK profits tax 8.25% 首 HK$2M assessable profit。前 18 個月若 net loss，無稅。Y2 才需建稅模型
4. **沒有 Stripe / Airwallex 手續費**：訂閱收入 ~3% 應扣除 = 微微 down-revise revenue（每 HK$10K MRR 少 HK$300）
5. **沒有 founder bridge / pre-seed**：若決定 raise，要建 v2 含 dilution + 估值流向

---

## 10 · Changelog

| Date | Version | Change | Source |
|---|---|---|---|
| 2026-05-17 | v1 | 初版建立。18 個月 + 三情境 + Scenario Summary。1,125 公式零錯 | HKCC · Numbers 對話 2026-05-17 |
