# HKCardColl · product.md

> 這份是 HKCardColl 整個 project 的「事實基準」。
> 任何新對話開頭請說：「先讀 `/Users/alvin/collectr/product.md`，再回答後續問題。」
> 最後更新：2026-05-16

---

## 01 · Identity 身份

### 公司（法人主體）
| Field | Value |
|---|---|
| 英文名 | POTO Creative Tech Limited |
| 中文名 | 寶圖創意科技有限公司 |
| BR No. | 80363844 |
| 註冊地 | Hong Kong |
| 成立日 | 2026-05-11 |
| 公司形式 | 有限公司 |
| 業務 | App 開發 + 設計 |
| 聯絡 email | potodesignstudio@gmail.com（過渡中 → hello@hkcardcoll.hk）|

### 產品（Brand）
| Field | Value |
|---|---|
| 品牌名 | **HKCardColl** |
| 中文標語 | 香港藏家的索引 |
| 英文 tagline | A field guide to Hong Kong card collectors |
| 前身 | Collectr.（已 deprecated 2026-05-16）|
| Domain | `hkcardcoll.hk`（已註冊，2026-05-16）+ 待加 `.com` |
| 官方 email | hello@hkcardcoll.hk（待 HKDNR 帳號啟用後設定）|
| App Store name | HKCardColl |
| Bundle ID | `com.collectr.app`（**保留不換**，避免 TestFlight 用戶遺失）|

---

## 02 · The Product 產品

### 一句話
**香港首個專為寶可夢卡牌玩家的全方位平台。**

> 香港藏家現在面對三個問題：
> 1. **卡價難搵** — 要去 5 個平台搵日版英版再自己換算港幣
> 2. **收藏難管** — 用 Excel 記錄幾十萬的收藏，隨時睇唔到全局
> 3. **買賣不安全** — FB 群組、WhatsApp 無保障無記錄

### 4 個核心支柱（Four Pillars）

| # | 支柱 | 核心動作 |
|---|---|---|
| 01 | **Pricing 卡價** | 日版 + 英版即時定價，自動換算 HKD |
| 02 | **Portfolio 收藏** | 個人作品集追蹤、PSA / BGS 溢價追蹤、即時估值、價格走勢 |
| 03 | **Trade 交易** | 兩層商家系統（個人 + 認證）、HK 本地 P2P 二手市集 |
| 04 | **Community 社群** | 社交動態、開箱、追蹤、即時訊息 |

### 關鍵差異化（不被取代的理由）
**全港首個 JP + EN 同步定價平台**。資料來源 3 個：
- TCGplayer · EN · USD
- Cardmarket · EN · EUR
- 日本零售商 · JP · JPY

→ 即時換算 HKD，沒有其他平台做到。

### 商業模式（兩層商戶系統）
| 層 | 類型 | 限制 | 驗證 |
|---|---|---|---|
| Tier 01 | 個人賣家 | 最多 10 個 listing | 自行申報 |
| Tier 02 | **認證商戶** | 最多 100 個 listing | BR 文件核驗 + 認證徽章 |

認證商戶五個好處（merchant pitch 核心）：
1. 認證徽章 → 公信力
2. 24/7 數碼店面
3. 定價數據庫貢獻 → 影響 HK 市場指數
4. 即時 DM
5. 直接觸達 HK 藏家社群

---

## 03 · Target Users 目標用戶

### Primary persona
- **香港 Pokémon 卡藏家**，藏品價值 5 位數 ~ 7 位數港幣
- 同時持有 **JP + EN 卡**（佔大多數港藏特徵）
- 18-40 歲為主
- 目前痛點：用 Excel 記、用 FB 群組 / WhatsApp 交易、跨平台對價格累
- 平台習慣：IG / 小紅書 / FB groups

### Secondary persona
- **HK 卡店老闆 / 商戶**（Tier 02 認證商戶）
- 想要：更廣的銷售管道、品牌曝光、價格話語權

### 不是 target
- 純粹偶爾抽包的休閒玩家（不缺 portfolio 工具）
- 二手玩具拍賣場景（範圍太雜）

---

## 04 · Tech Stack 技術棧

### 前端 / App
| 類別 | 用什麼 |
|---|---|
| Framework | **Expo SDK 54** + React Native 0.81 + React 19 |
| Language | TypeScript 5.9 |
| Routing | `expo-router` 6 (file-based) |
| State | React Context（`contexts/`）|
| Navigation | @react-navigation/bottom-tabs + native |
| Charts | `react-native-gifted-charts` |
| Animations | `react-native-reanimated` 4 + Lottie |
| i18n | i18next + react-i18next（zh-TW / zh-CN / en / ja）|
| Storage | `@react-native-async-storage/async-storage` |
| Image | `expo-image` + `expo-image-picker` |

### 後端 / 資料層
| 類別 | 用什麼 |
|---|---|
| BaaS | **Supabase** (PostgreSQL + Auth + Edge Functions + Storage) |
| Auth | Phone OTP via Twilio + Apple Sign In |
| Edge Functions | `ppt-proxy`、`pc-proxy`、`delete-account`、`moderate-post` 等 |
| 卡價資料源 | Pokemon Price Tracker API、PriceCharting API、TCGplayer、Cardmarket、JP 零售（建構中）|
| 卡片資料 | `pokemontcgsdk` + 自建 `artofpkm_card_images` 表（trainer 卡圖補完）|

### 部署 / 監控
| 類別 | 用什麼 |
|---|---|
| Build | EAS Build（production profile）|
| Distribution | App Store / TestFlight + Google Play |
| EAS Project ID | `eab0d040-923e-4705-bff8-1b77c06118a9` |
| Crash Reporting | Sentry（計劃中，未接）|
| Analytics | 待定 |

### App identifiers
| 欄位 | 現值 | 動作 |
|---|---|---|
| App Name | Collectr | → **HKCardColl** |
| Bundle ID | `com.collectr.app` | **保留** |
| Slug | `collectr` | 維持（rename 影響 EAS）|
| Scheme | `collectr://` | → `hkcardcoll://` |

---

## 05 · Brand Voice 品牌口吻

### 三大原則
1. **Precise 精準** — 給數字、給版本、給日期。「PSA 10」比「狀態好」有用
2. **Local 本地** — 用港式中文、混雜英文 jargon 不避諱
3. **Calm 克制** — 不喊「驚喜」、不放鞭炮。Hype 留給市集，不留給介面

### Voice 範例
| ✓ Do | × Don't |
|---|---|
| 「你的 Charizard PSA 10 過去 30 日升 +12%」 | 「驚喜！你的卡牌爆升！🎉🔥」 |

> 詳細規則見 `/Users/alvin/collectr/brand/voice.md`（即將建立）

### 視覺
- 詳細 brand book：**HKCardColl — Brand Book Vol.01**（PDF in uploads / 待存到 brand/）
- Primary color: **Card Orange `#FF6A1F`**（每頁只用一個橙色元素）
- Foundation: Ink `#1A1814` / Paper `#F6F2EA`
- Display font: Space Grotesk / 思源黑體
- Mono: JetBrains Mono

---

## 06 · Current State 目前進度

### Phase: Pre-launch
| 軸線 | 狀態 |
|---|---|
| 公司成立 | ✅ 2026-05-11 |
| Domain 註冊 | ✅ hkcardcoll.hk 2026-05-16（HKDNR 帳號待驗證）|
| 商標申請 | ⏳ 待辦 |
| Brand book Vol.01 | ✅ 完成 |
| Company Overview Vol.01 | ✅ 完成（Collectr 版，需 Vol.02 重做）|
| App codebase | ✅ Production-ready（細節見 APP_STORE_CHECKLIST.md）|
| Supabase backend | ✅ 部署中 |
| EAS production build | 🔄 進行中 |
| Apple Review | ⏳ 預計 14 天內提交 |
| Google Play | ⏳ 待提交 |
| Waitlist | 0 / 300 |
| Certified merchants | 0 / 10（Week 1 將拜訪旺角/銅鑼灣/灣仔/觀塘卡店）|

### 關鍵 to-do（從 APP_STORE_CHECKLIST.md 摘）
- 🚨 Deploy security migration
- 🚨 Rotate API keys
- 🚨 Host Privacy Policy + Terms（用 Notion 過渡，等 domain 啟用後遷移）
- 🚨 Twilio test accounts for Apple reviewer
- 🟠 Sentry 接入
- 🟠 EAS production build
- 🟠 Trainer 卡 scraper 跑完

---

## 07 · Test Credentials 測試帳號

> **2026-05-17 update**：Auth 策略改為 Plan B（Apple Sign In + Google + Anonymous）。
> Phone OTP 移到 v1.1。下表測試 phone 帳號**保留作為 dev debug**，但 App Store reviewer **唔再用**。

### App Store Reviewer 用嘅 demo flow
```
Option 1: Tap "Browse as guest" on onboarding — full read-only access
Option 2: Tap "Sign in with Apple" with any Apple ID — full feature access
No phone, no SMS, no test account required.
```

### Dev debug 用嘅 phone 帳號（v1.1 啟用 Phone OTP 後恢復）
| Role | Phone | OTP |
|---|---|---|
| Admin | +852 6100 0001 | 111111 |
| User 2 | +852 6100 0002 | 222222 |
| User 3 | +852 6100 0003 | 333333 |
| Certified Merchant | +852 6100 0004 | 444444 |

---

## 08 · Key Files & Paths 重要檔案

### 程式碼
```
/Users/alvin/collectr/
├── app/                       # expo-router 頁面
├── components/                # UI components
├── contexts/                  # React contexts
├── lib/                       # Supabase client、utils
├── data/                      # 靜態資料
├── locales/                   # zh-TW / zh-CN / en / ja
├── scripts/                   # 工具腳本（scraper 等）
├── supabase/                  # DB migrations、edge functions
├── assets/                    # 圖片、字型
├── app.json                   # Expo config
└── eas.json                   # EAS Build config
```

### Brand / Marketing
```
/Users/alvin/collectr/
├── brand/                     # Brand book、voice、設計規格
│   └── voice.md               # 品牌口吻說明書（即將建立）
├── decks/                     # pptx 投資人 / 商戶 decks
├── notes/                     # 舊對話遷移過來的精華
└── journal/                   # 每週 review、決策紀錄
```

### Specs / Docs
```
/Users/alvin/collectr/
├── APP_STORE_CHECKLIST.md     # 上架完整 checklist
├── MERCHANT_SPEC.md           # 認證商戶系統規格
├── DATA_MANAGER_REPORT.md     # 資料管理員報告
├── CODE_REVIEW_2026-05-13.md  # Code review 第一輪
├── CODE_REVIEW_2026-05-13_round2.md
├── FIXES_2026-05-14.md
└── product.md                 # 本檔案
```

### 舊資產（Collectr 版，等 rebrand）
- `Collectr_Company_Overview.pptx` → 重做 `HKCardColl_Company_Overview_Vol02.pptx`
- `Collectr_Investor_Deck.pptx` → 重做
- `Collectr_Grant_Application.docx` → 重做

---

## 09 · 對話分工

新對話開頭建議貼上：
```
請先讀 /Users/alvin/collectr/product.md。
本對話專責：[code / product / growth / numbers / command]
之後回答請以 HKCardColl Brand Voice 為準（讀 brand/voice.md）。
```

### 對話結構
| Chat | 用途 | 參考檔 |
|---|---|---|
| HKCC · Command | 跨領域決策、整體規劃 | product.md、所有 notes/ |
| HKCC · Product | UX / UI / Feature 設計 | product.md、MERCHANT_SPEC.md |
| HKCC · Growth | Marketing / BD / Research | product.md、brand/voice.md |
| HKCC · Code | 工程實作（建議改用 Claude Code）| 全部 spec + code |
| HKCC · Numbers | Finance / Funding / Pricing | product.md |

---

## 11 · Business Model（new · locked 2026-05-17）

> Source of truth：本節 + `notes/numbers_merchant-pricing-v1_2026-05.md` + `notes/product_pro_features.md` + `notes/decision-log-2026-05-17.md`
> 所有其他文件如有衝突，以本節為準。

### 11.1 收入 lane（4 條）

| Lane | 對象 | 定價 | Status |
|---|---|---|---|
| **PRO Subscription** | 個人重度藏家 | HK$58 / 月 · HK$398 / 年 | v1 spec ready，paywall trigger 設計完 |
| **認證商戶月費** | HK 卡店（Tier 02）| HK$500 / 月 | 定價 lock |
| **Affiliate** | 卡片詳情頁全球參考價 | TCGplayer 5-7% · eBay 1-4% · Amazon JP 1-3% | v1 spec ready |
| **In-app Ads** | 業界 only（卡盒 / grading / set drop）| HK$1,500-3,000 / 月 / advertiser | v1 spec ready |

**唔做嘅嘢**：transaction commission（v1 維持 0%）、AdMob / 第三方 ad network、reward video。

### 11.2 PRO Tier · 8 個 feature

| # | Feature |
|---|---|
| 01 | 深度走勢圖（90/180/365 日 + 自定義）|
| 02 | 資料匯出（CSV / Excel 含稅務、保險用格式）|
| 03 | Multi-portfolio（個人 / 店舖 / 投資 / 寄賣）|
| 04 | Unlimited card scan（Free 限 20/日）|
| 05 | 自定義價格提醒 |
| 06 | Deal record 永久保留（Free 僅 90 日）|
| 07 | PRO badge on profile |
| 08 | Priority customer support（24h vs 3 工作天）|

Paywall trigger 設計：value moment 出現時 sheet half-screen，**唔做** 開 app 即彈 / 蓋住內容 / hype 詞。詳見 `notes/product_pro_features.md` §3。

### 11.3 三層商戶結構

| Tier | 對象 | Listings 上限 | 認證 | 月費 |
|---|---|---|---|---|
| 01 · Personal | 個人賣家 | 10 | 自行申報 | HK$0 |
| 02 · Certified | 卡店 | 100 | BR 文件核驗 | **HK$500 / 月** |
| 02F · Founding | 首 10 個 Tier 02 | 100 | 同 Tier 02 | **HK$500 / 月**（**終身鎖價** + **3 個月 free trial**）|

### 11.4 Founding Merchant Deal（locked 2026-05-17）

| 元件 | 內容 |
|---|---|
| 名額 | 10 個（先到先得）|
| **截止申請日期** | **2026-05-30**（13 日後）|
| 月費 | HK$500 / 月（與普通 Tier 02 同價）|
| **Free trial** | **3 個月**（取代普通 14 日）|
| 鎖價 | **終身 grandfathered HK$500 / 月** |
| 失效條件 | 連續 3 個月 0 listing 或違規 |

**5 個專屬權益**：
1. 終身鎖價（即使平台日後加價到 HK$700/900 都唔變）
2. Founding 認證徽章（UI 上獨立標記）
3. Listing 代上架服務（首 50 張卡，內部估值 HK$5,000 / 商戶）
4. IG / 媒體開業 feature（HKCardColl 官方 IG dedicated post + 合拍）
5. Pricing data contributor 身份（Phase 2 Premium Data 上線時顯示貢獻佔比）

### 11.5 Auth 策略 = **Plan B**（locked 2026-05-17）

```
Apple Sign In · Google OAuth · Anonymous (Browse as guest)
```

- ✅ Apple 4.8 合規（有 Apple Sign In）
- ✅ Apple Reviewer 用 Anonymous 或 Apple Sign In 即可完整測試
- ❌ 移走 email/password UI
- ⏳ Phone OTP via Twilio 留 v1.1（4-6 週後加）

### 11.6 Director's Fee · Deferred 3 個月（locked 2026-05-17）

| 月份 | Cash Out | P&L Expense | Balance Sheet 影響 |
|---|---|---|---|
| Month 1-3 | HK$0 | HK$10K / 月（accrued）| +HK$30K 「Due to Director」liability |
| Month 4+ | HK$10K / 月 | HK$10K / 月 | 平 |
| Month 7-12 | +HK$5K / 月 額外 | — | 分期還 30K accrued |

**用意**：保留 founder 嘅 enforceable claim（vs 純零薪 = 失去）+ pitch story 強化「founder 起步 3 個月零現金薪」。

### 11.7 Year 1 收入估算

| 收入源 | 估算 ARR (HK$) |
|---|---|
| PRO 訂閱（1,000 user × HK$398）| 398,000 |
| 認證商戶月費（30 商戶，扣 founding 3 月免）| 165,000 |
| Affiliate（TCGplayer + eBay，5% × 200 GMV × 3%）| 300,000 |
| In-app Ads（4 advertiser × HK$2K × 12）| 96,000 |
| **Year 1 ARR 總計** | **~ HK$960,000** |

> Year 2+ 估算 5x。Numbers chat 嘅 burn / runway 模型用 conservative anchor（HK$5K MRR Month 4 起）。Investor pitch 用呢個 ARR 框架。

---

## 10 · Changelog

| Date | Change |
|---|---|
| 2026-05-16 | 初版建立。完成 Collectr → HKCardColl rebrand 文件化 |
| 2026-05-17 | §11 Business Model locked：PRO HK$58/月 · 認證商戶 HK$500/月 · Founding 3 月 trial · Auth Plan B · Director's Fee deferred 3 個月 · 截止 2026-05-30 |
| 2026-05-17 | §07 Test Credentials 更新：Apple Reviewer 改用 Anonymous / Apple Sign In flow，phone 帳號降級為 dev-only |

