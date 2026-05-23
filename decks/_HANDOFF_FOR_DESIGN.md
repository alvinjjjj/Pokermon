# HKCardColl Decks · Handoff for Design

> 4 個 deck 內容已 lock + voice-compliant + 數據對齊 product.md / brand/voice.md / brand/app_store_copy_v02.md。
> 視覺由 Design 重做。呢份 brief 講 deck 範圍、target audience、必須保留嘅 brand element、開放讓 Design 重塑嘅嘢。
> 建立日：2026-05-17

---

## 01 · 4 個 deck 範圍

| File | Slides | Audience | When to use | Hard CTA |
|---|---|---|---|---|
| `HKCardColl_Company_Overview_v03_zh.pptx` | 10 | 商戶 / 媒體 / 潛在投資人 / 政府基金 (zh-HK) | 通用公司簡介；面對面 / email 附件 / Pitch night | 冇 hard ask（join waitlist / hello@） |
| `HKCardColl_Company_Overview_v03_en.pptx` | 10 | 同上，英文受眾（國際投資人、跨境媒體） | 同上 | 同上 |
| `HKCardColl_Merchant_Pitch_v02_zh.pptx` | 8 | 旺角 / 銅鑼灣 / 灣仔 / 觀塘 卡店老闆 (zh-HK) | Lane 2 outreach；in-person 5 分鐘 demo 後 leave-behind | Founding merchant 簽約，截止 2026-05-30 |
| `HKCardColl_Merchant_Pitch_v02_en.pptx` | 8 | 英文卡店老闆（少數，例如華資以外、外國藏家社群嘅 dealer） | 同上 | 同上 |

---

## 02 · Brand 必須保留嘅嘢（hard requirements）

呢啲係 Brand Book Vol.01 / `brand/voice.md` 鎖死，重做視覺都要 keep：

### 顏色
- **Paper `#F6F2EA`**：所有 slide 背景（除咗 closing slide）
- **Ink `#1A1814`**：主文字
- **Card Orange `#FF6A1F`**：**每張 slide 至多用一次嘅 accent**（重要規則）
  - Cover：用喺 founding merchant 倒數 bar
  - Stat callout：用喺最重要嗰個 stat（例如 ROI 嘅「HK$ 9,000 TOTAL · YEAR 1」）
  - Closing slide：用喺第一條 Manifesto line
- **Ink shades**（INK_90 / INK_60 / INK_30 / INK_10）：層級

### Typography
- Header / Body sans：Space Grotesk / 思源黑體 / Noto Sans HK（fallback：Helvetica Neue / system）
- Eyebrow / Footer / Mono labels：JetBrains Mono / Menlo
- 重做時 Design 可以揀更靚嘅 type pairing，但保留 sans + mono 對比

### 結構元素
- **Eyebrow line**（每張 slide 最上：`HKCARDCOLL · 01 · SECTION` + `VOL.X · 002 / 010`）
- **Footer line**（每張 slide 最底：section label + page number）
- 兩條 horizontal rules 之間放主內容
- 呢個 system 用嚟 anchor 觀眾 — 唔好移除

### Voice 嚴格規則（`brand/voice.md` v1）
所有文字唔可以加：
- Hype emoji（🎉🔥💥🚀✨）
- 「驚喜 / 必入 / 爆升 / 起飛 / 神奇 / 不要錯過 / 最後機會」
- 「！！」「！？」連用標點
- 「親 / 您 / 老師 / 大佬」連續尊稱

Design 重排視覺如果要加 caption / decorative text，**先 paste `brand/app_store_copy_v02.md` §9 QA Checklist 跑一次**。

---

## 03 · 可以重塑嘅嘢（open for Design）

- Cover treatment（hero image、video loop、icon）
- Slide template polish（rounded corners、subtle shadow、divider style）
- Icon system（4 pillars 每個一個 icon）
- Stat callout visual（big number 配 mini chart / sparkline）
- Closing slide manifesto rendering（typography hierarchy / texture）
- Transition animations
- Speaker note 補充
- Print version PDF export setting

**唔好重塑**：copy（已 voice-verified）、數字（已 cross-reference）、Manifesto 4 句、Founding 10/截止 2026-05-30/HK$0/12 個月嘅 deal terms。

---

## 04 · 內容 source of truth

如果 Design 對某個數字 / 句子有疑問，引用呢啲檔案，**唔好自己改**：

| 範疇 | Source of truth |
|---|---|
| 公司名 / BR / domain / app ID / pillars | `/Users/alvin/collectr/product.md` |
| Voice 規則 + 6 項 Checklist | `/Users/alvin/collectr/brand/voice.md` |
| App Store metadata（subtitle / category / age） | `/Users/alvin/collectr/brand/app_store_copy_v02.md` |
| Subtitle / Promo / Description × 4 lang | 同上 |
| Screenshot hero copy × 6 × 4 lang | `brand/app_store_copy_v02.md` §5 |
| Brand book（顏色 / typography / mark）| `HKCardColl — Brand Book Vol.01.pdf`（uploads） |
| Founding merchant deal terms | `MERCHANT_SPEC.md` |
| 24 個月 revenue projection | `notes/Collectr_市場策略與業務發展.md` §有用的事實 / 數據 |

---

## 05 · Slide-by-slide quick reference

### Company Overview v03（10 slides，zh + en 同步）

| # | Section | Layout type | Voice note |
|---|---|---|---|
| 01 | Cover | hero title + accent bar | Founding deadline bar 用 ORANGE single accent |
| 02 | The Problem | 3-col with num/sublabel/body | 3 個港藏痛點 |
| 03 | The Product (4 pillars) | 4-col | Pricing / Portfolio / Trade / Community |
| 04 | The Differentiator | 3-stat callout | JP+EN 同步定價，3 個資料源 |
| 05 | Portfolio | 3-stat callout | Sample HK$ 684,200 demo value，orange accent |
| 06 | Marketplace | 2-col compare | Tier 1 vs Tier 2，含 BR ✓ badge |
| 07 | Community | 4-col | 社交動態 / 開箱 / Follow / DM |
| 08 | Merchant Value | 5-col | 5 個 founding 好處，sub-header 提 deadline |
| 09 | Traction & Roadmap | 4-stat callout | 36 screens / 52 sets / 4 lang / 10 founding |
| 10 | Closing | Manifesto on Ink bg | 4 句 Manifesto，第一句 ORANGE |

### Merchant Pitch v02（8 slides，zh + en 同步）

| # | Section | Layout type | Voice note |
|---|---|---|---|
| 01 | Cover | hero title + accent bar | 4 區 12 target shops 喺 accent bar |
| 02 | The Gap | 3-col | FB / IG / TCGplayer 3 個錯位 |
| 03 | Your Problem | 3-col | 商戶 3 個痛點 |
| 04 | Why Certified | 5-col | 5 個實際好處 |
| 05 | The Deal | 4-stat callout | HK$0 (orange) / 100 / BR / INDEX |
| 06 | ROI · Year 1 | 4-stat callout | HK$ 500 / 6,000 / 3,000 / 9,000 (orange) |
| 07 | Get Started | 3-col | 3 步：Download / Submit BR / Listing |
| 08 | Closing | Manifesto on Ink bg | "Trade with proof" + 預約 5 分鐘 demo |

---

## 06 · Visual QA pass

第二輪 render（2026-05-17 11:18 HKT）跑完 36 張 slide subagent 視覺檢查：

- 0 個 overflow defects
- 0 個 overlap defects
- 0 個 CJK 字 fallback box（□）
- 0 個 copy mismatch（zh ↔ en 對齊）
- Cover 字體大小 dynamic adjust（en 自動 48pt 因為 title 較長）
- Stat callout 用 length table 自動縮細：≤5 chars 56pt → 6–7 chars 40pt → 8–9 chars 30pt → 10–12 chars 26pt → 13+ chars 22pt

Pre-Design baseline：4 個 file 內容 production-ready，視覺係 80% acceptable / 20% rough，純等 Design 重做 polish。

---

## 07 · 舊版 deck 處理

```
/Users/alvin/collectr/
├── Collectr_Investor_Deck_DEPRECATED.pptx          ← 舊 Collectr branding
├── Collectr_Company_Overview_DEPRECATED.pptx       ← 舊 Collectr branding
└── decks/
    ├── HKCardColl_Company_Overview_Vol02_DEPRECATED.pptx   ← rebranded 但舊 tagline
    ├── HKCardColl_Merchant_Pitch_DEPRECATED.pptx           ← 舊 founding deadline 2026-06-30
    ├── HKCardColl_Company_Overview_v03_zh.pptx             ✓ ACTIVE
    ├── HKCardColl_Company_Overview_v03_en.pptx             ✓ ACTIVE
    ├── HKCardColl_Merchant_Pitch_v02_zh.pptx               ✓ ACTIVE
    ├── HKCardColl_Merchant_Pitch_v02_en.pptx               ✓ ACTIVE
    └── _HANDOFF_FOR_DESIGN.md                              ← 你而家睇緊呢份
```

**唔好 submit / present 任何 `_DEPRECATED` 嘅 file。** 保留係做 history reference 同 audit trail。

---

## 08 · 問問題

Design 有任何問題，先 check 上面 §04 source of truth。如果 source of truth 入面冇答案：

- Brand voice 問題 → Growth chat（HKCC · Growth）
- 數字 / 數據問題 → Numbers chat
- 產品 feature 問題 → Product chat
- App icon / UI screenshot → Code chat / Product chat
- 跨領域決策 → Command chat

---

## 09 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | v01 建立，配 4 個新 deck handoff |
