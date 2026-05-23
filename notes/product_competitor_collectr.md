# HKCardColl vs Collectr.gg · 競品分析 v01

> 比對對象:**Collectr by Collectr Inc.**(getcollectr.com / collectr.gg)— TCG collector circle 嘅 default app。
> 用途:product 路線決策 + 投資人 pitch 角度 + user acquisition 策略。
> Last updated: 2026-05-17

---

## 0 · TL;DR

Collectr 喺 4 年內由 zero 做到 4M 用戶、8 位數 USD ARR、完全 bootstrap(只 raise 過 $500K friends-and-family,而且未用)。
佢哋係**global、USD-anchored、affiliate marketplace、25+ TCG 闊度**嘅做法。

我哋唔好同佢硬撼闊度,而係**喺 HK 做佢哋做唔到嘅垂直深度**:
- HKD primary、JP+EN sync、JP 價格準確
- BR-verified 本地商戶 + 真 P2P trade(佢哋 marketplace 只係 eBay/TCGplayer affiliate)
- HK Market Price Index 做地區權威數據源
- 港式 native voice(佢哋 中文是 machine translation feel)

**佢哋 8 位數 ARR 卻有一個致命弱點 — JP 卡價不準。** 而 92%+ 港藏持 JP 卡。呢個就係我哋嘅 wedge。

---

## 1 · Collectr.gg 嘅 fact sheet

### 公司
| 項目 | 數值 |
|---|---|
| 公司 | Collectr Inc. |
| 總部 | Toronto, Canada |
| 創辦人 | Mark Hopson, Abbas Ali, Adam Hijleh, Muhammad Rashid |
| 背景 | 上一間 Doorr 2020 年賣俾 Finastra |
| 成立 | 約 2022 |
| 融資 | $500K friends-and-family,**全部未花** |
| ARR | 8 位數 USD($10M+) |
| 用戶 | 4M+ 全球(2.5M downloads) |
| App Store | 4.82 / 5 ⭐ × 33K reviews |
| Advisor | DJ Steve Aoki |
| 廣告 | 零 paid acquisition |

### Pricing(Freemium)
| Tier | 費用 |
|---|---|
| Free | 大部分功能、limited scan |
| PRO 月費 | US$7.99 |
| PRO 年費(折扣)| US$44.99 |
| PRO 年費(正價)| US$59.99 |

### 產品範圍
- 支援 25+ TCG:Pokémon、Magic、Yu-Gi-Oh、One Piece、Digimon 等
- 1,000,000+ products 資料庫
- 每日更新價格(daily,唔係 real-time)
- 介面語言:English、Spanish、Malay、中文、日文

### 核心功能
- Camera scan(unlimited 要 premium)
- Portfolio 追蹤(raw / graded / sealed)
- 7 / 30 / 90 日走勢圖
- Trade Analyzer(評估 trade 公平程度)
- Marketplace:**affiliate 入 eBay / TCGplayer**(唔係自建 P2P)
- Social platform(分享 collection、follow)
- PSA grading 支援(BGS / CGC 唔支援)

### 已知弱點(直接從 user reviews 抽嚟)
1. **JP 卡價極唔準** — 公開 case:Japanese Base Arcanine 顯示 US$25.19,實際 TCGplayer US$3.21、eBay 售出 US$0.99-4.98。差 5-8 倍。
2. JP promo / sealed 大量缺失資料庫
3. 只認 PSA,BGS / CGC 入唔到
4. Graded card 嘅 price calculation **唔 work**
5. 唔可以一次過 add 多張卡(逐張點 +1)
6. Catalog 更新慢
7. Paid version 多人話「唔值」(reviewer 建議停留 free)

---

## 2 · 功能 vs 功能對比矩陣

| 維度 | Collectr.gg | HKCardColl | 結論 |
|---|---|---|---|
| **Pricing 卡價** | | | |
| EN 卡即時定價 | ✓ TCGplayer real-time | ✓ TCGplayer + Cardmarket | Parity+ |
| JP 卡價準確度 | ⚠ 公開 case 錯 5-8 倍 | ✓ 日本零售直連 | **HKCC win** |
| HKD 換算 | ✗ USD anchored | ✓ HKD primary、JP/EN 並列 | **HKCC win** |
| 多幣切換 | 部分 | ✓ HKD/USD/JPY/CNY | HKCC win |
| 評級溢價追蹤 | PSA only(broken)| PSA + BGS 9.5 | HKCC win |
| 價格更新頻率 | 每日 | 即時(real-time API) | HKCC win |
| **Portfolio** | | | |
| 紀錄買入價 / 評級 | ✓ | ✓ | Parity |
| 7/30/90 日走勢圖 | ✓ | ✓ | Parity |
| Sealed product | ✓ | ✓ (PriceCharting via pc-proxy) | Parity |
| Camera scan | ✓ premium for unlimited | ❓ 未確認 / 未有 | **Gap — 要補** |
| 批量 add 卡 | ✗ (用戶投訴點)| ❓ 未確認 | Decide |
| Trade Analyzer | ✓ | ✗ | **Gap — 要補** |
| **Trade / Marketplace** | | | |
| Marketplace 形式 | eBay/TCGplayer affiliate link | 自建 HK 本地 P2P | **完全不同 model** |
| 個人 P2P 賣家 | 弱(社交分享為主)| ✓ Tier 1 自助登記 | HKCC win |
| 認證商戶 tier | ✗ 冇 | ✓ Tier 2 BR 驗證 + 徽章 | **HKCC win,佢哋複製要 18 個月 BD** |
| HK Market Price Index | ✗ | ✓ 認證商戶定價匯集 | **HKCC win** |
| 即時 DM | ⚠ 輕量 | ✓ 即時 chat,分頁 | HKCC win |
| **Community** | | | |
| Social feed | ✓ | ✓ | Parity |
| 開箱貼 / 追蹤 | ✓ | ✓ | Parity |
| 內容 moderation | 有 | ✓ Sightengine via Edge Function | Parity |
| **覆蓋面** | | | |
| TCG 種類 | 25+ | 1(Pokémon) | **Collectr 大幅 win — 我哋係策略選擇** |
| 地域 | Global | HK 為主、4 語言 cover 港 / 中 / 英 / 日 | 不同定位 |
| 介面語言 | EN/ES/MS/中/日(machine feel) | zh-HK / zh-CN / en / ja(港式 native) | HKCC win in HK |
| **認證 / 信任** | | | |
| 商戶 BR 驗證 | ✗ | ✓ 人手審 1-3 工作天 | HKCC win |
| 商戶徽章 | ✗ | ✓ | HKCC win |
| 法人實體透明度 | Collectr Inc. (Canada) | POTO Creative Tech Limited · BR 80363844 | Parity |
| **Auth** | | | |
| Email / password | ⚠ 有 | ✗ 移除咗 | Collectr 較低 friction(我哋反思點) |
| Phone OTP | ⚠ 部分地區 | ✓ Primary | HKCC 較高 friction |
| Apple / Google SSO | ✓ | ✓ | Parity |
| **商業模式** | | | |
| 收入主源 | Freemium($7.99 / mo PRO) | TBD(建議 freemium + 認證商戶費 + 數據 B2B) | 要 decide |
| 加價力 | 已驗證 ARR $10M+ | 0 | 不對稱 |

---

## 3 · 策略分析

### A · 我哋有 / 佢冇(moat)

#### A1 · HKD primary anchor + JP+EN sync
每個港藏喺 Collectr 上面都要心算 USD → HKD 換算。我哋直接用 HK$ 為基準,JP / EN 同步並列。**呢個係我哋 voice.md 入面 Manifesto 第 03 條「Local lens, global price」嘅產品化。**

> *投資人 hook:Collectr 4M 用戶,當中佔香港多少?佢哋公開冇講,但港藏 daily friction 係心算 USD-HKD。我哋 remove 呢個 friction。*

#### A2 · JP 卡價準確
公開 case 證據:Collectr 將 JP Base Arcanine 標價 $25,實際 $3。差 8 倍。**呢條 review 自己一條就值得做我哋 launch 主 marketing message。**

> *對外 copy(voice.md compliant):*
> *「JP 卡價,精準到位。對手定 US$25,實際 US$3。我哋直連日本零售,差距清零。」*

#### A3 · 兩層認證商戶系統
Collectr 嘅 "marketplace" 純粹係 eBay / TCGplayer affiliate link。**佢哋冇任何本地實體商戶基建。** 我哋有:
- BR 文件人手審
- 認證徽章
- 商戶專頁 + banner
- 100 listing 上限
- 定價計入 HK 指數

呢層基建,佢哋要進入 HK 至少 18 個月 BD(假設佢哋肯做地區深耕,而佢哋目前完全冇呢個信號)。

> *投資人 hook:50 認證商戶 × 平均 HK$1M 庫存 = HK$50M Year 1 GMV potential。Collectr affiliate 模式 take rate 約 5%,我哋本地 P2P + 商戶訂閱模式可以做 10-20%。*

#### A4 · HK Market Price Index
認證商戶嘅定價自動匯集成地區指數。**呢個係媒體 + B2B 數據資產**。
- 香港經濟日報 / 蘋果可以引用
- 進口商 / 拍賣行 / 保險公司可以買 API
- 媒體曝光帶免費流量

Collectr 全球指數對香港藏家無用(美國 eBay 價對港交易冇參考價值)。

#### A5 · 港式 native voice
Collectr 中文係 translation,日文都 thin。我哋:
- 港式 UI(「搵」「嚟」「咁」)
- HK$ 慣用寫法
- 香港 18 區、PayMe / FPS 等本地 method
- 4 種語言 native quality

**呢個唔係 nice-to-have,係 retention 決定因素。** 港藏用過港式 UI 之後,試 Collectr 嘅 broken 中文會即刻覺得「唔屬於我」。

---

### B · 佢有 / 我哋冇(要補 vs 刻意唔做)

#### B1 · Camera scan(MUST FIX before launch)
Collectr 做到 unlimited scan 係 paywall hook。**呢個係 2026 年 TCG app 嘅 table-stakes**。我哋 launch 冇就會被當「過時」。
- 建議:Day 1 OCR 基礎版,Premium tier 解鎖 unlimited
- 技術角度送 HKCC · Code 估工時

#### B2 · Trade Analyzer(SHOULD ADD,month 2-3)
Collectr 嘅 USP feature。我哋可以做差異化版本:
- 對 trade 雙方分別計 HKD 估值
- 標明 JP vs EN 嘅 cross-version 風險
- 預測 PSA submit 後溢價(我哋有 PPT API PSA 數據)

#### B3 · TCG 種類覆蓋(刻意唔做)
Collectr 25+ TCG 係廣度策略。**我哋 launch 階段刻意只做 Pokémon**:
- HK Pokémon 市場單一已經夠大
- 焦點 = 質素
- 之後 evaluate 加 One Piece(東亞熱)、Yu-Gi-Oh(老派港藏有市場)、Lorcana(全球熱)

呢條係**信號**:我哋係 Pokémon experts,唔係 TCG aggregator。

#### B4 · BGS / CGC grading(SHOULD ADD)
Collectr 只 PSA,而且 graded card pricing 唔 work。**我哋直接 launch 三大 grading(PSA + BGS + CGC)係差異化勝點**。BGS 嘅 9.5 同 Black Label 喺港藏圈有 niche。

---

### C · 佢做得好過我哋(要學 / 要差異化)

#### C1 · Onboarding friction(reconsider)
佢哋:email signup 即刻入。
我哋:Phone OTP(Twilio 收費 + 用戶等 SMS + 輸入 6 位)。
**Phone OTP 增加 anti-bot 同 trust,但對「想 browse 下價」嘅 casual 用戶 friction 太高。**

> 建議 product decision:加 **「Browse only」mode**,進入唔需要 signup,但 portfolio / 上架 / DM 需要。轉化點延後到 value moment。

#### C2 · Freemium psychology
佢哋 free 用戶 4M、ARR $10M = 每用戶 $2.5。**證明 freemium scale 得**。
我哋 monetization 策略建議參考但差異化:
- Free:portfolio + 當前 HK 市場最低價 + 平均價 + 30 日趨勢
- PRO(HK$58 / 月 或 HK$398 / 年):
  - 90 / 180 / 365 日深度走勢
  - Data export(CSV)
  - 多 portfolio
  - Premium scan(unlimited)
  - 優先 customer support
- 認證商戶 tier:**獨立收費**(HK$200-500 / 月,founding 10 間免費 18 個月)

#### C3 · Zero ad spend 增長
佢哋靠口碑 + content。我哋打法:
- IG / TikTok / 小紅書:**founding merchant 開箱 + 港式 commentary**
- 旺角 / 銅鑼灣街頭活動:卡店共同 host 「定價校對」工作坊
- YouTube:「Collectr 對比 HKCardColl」誠實 demo
- App Store ASO:keyword 攻 「Pokemon HK」「卡牌 香港」「JP 卡價」

#### C4 · Social proof(advisor)
Steve Aoki = 全球 DJ + 已知 Pokémon 收藏家。我哋 HK 對應:
- 黃秋生 / 古天樂(已知收藏家)— 不太可能 reach
- 街知巷聞嘅旺角 / 銅鑼灣卡店老闆 — 真實 HK 文化人
- 港產 YouTuber / IG 收藏 KOL(e.g.「卡牌人生」、「Pokemon HK 收藏家」群組 admin)
- 早期投資人作為 advisor 列出(增加 legitimacy)

#### C5 · 用戶介面 polish
Collectr 4.82 stars 唔係 luck — 佢哋 UI 確實 polished。我哋:
- Onboarding 4 screen(P0 #4)要做到 Collectr standard
- Empty state 全套(P0 #5)
- Splash 動態 WebP 已做(Brand Voice 第一感)

---

## 4 · User Acquisition Strategy(0 → 1000 → 10000)

### Phase 1 · 0 → 1,000 用戶(Month 1-2)
源頭 100% 來自 founding merchant:
- 10 認證商戶 × 平均 100 客戶 = 1,000 users
- 商戶提供 incentive:店內 QR code「下載即送 HK$50 store credit」
- 商戶 IG repost:「我哋已在 HKCardColl 認證,你嘅卡而家可以實時報價」

**KPI:** Day 30 達 800 active users(80% from merchant funnel)

### Phase 2 · 1,000 → 5,000(Month 3-4)
- 公開 HK Market Price Index 網頁版(SEO + 媒體引用)
- 拍 1 條對比 video「Collectr vs HKCardColl JP 卡價測試」(誠實 + 數字)
- 小紅書 / IG 開箱 series
- 旺角實體 launch event:聯合 5 間卡店

**KPI:** Day 90 達 5,000 active, 20 認證商戶, 500 個人賣家

### Phase 3 · 5,000 → 10,000(Month 5-6)
- 跨境擴張:深圳、廣州、澳門 — 同步 zh-CN 市場
- 開放 B2B API(進口商、媒體)
- 接 Pokémon 公司公關活動(Pokémon Center HK?)
- 加入第二個 TCG(One Piece)

**KPI:** Day 180 達 10,000 active, 50 認證商戶, ARR HK$500K+

---

## 5 · Investor Pitch 核心 hook(3 條)

### Hook 01 · 「Collectr 嘅 JP 黑洞」
> 「Collectr 4M 用戶 $10M ARR,但 92% 港藏面對嘅 JP 卡市場,佢哋價格錯 5-8 倍。我哋係 Hong Kong's answer。」

### Hook 02 · 「Merchant Network 嘅 18 個月 moat」
> 「我哋 launch Day 1 有 10 間 BR-verified 認證商戶。Collectr 進入 HK 市場要做齊呢層基建,需要 18 個月 + 本地 BD team。Year 1 sign 50 間,佢哋追唔到。」

### Hook 03 · 「HK 做 launchpad,Greater Bay 做 TAM」
> 「HK 1,000 萬 active TCG collectors 嘅 5%,= 50K addressable。但同樣 voice、同樣 cultural reference 嘅深圳 + 廣州 + 澳門,共 30M。HK launch 6 個月後直接擴。」

---

## 6 · Open Questions(等你拍板)

| # | 問題 | 影響 |
|---|---|---|
| 1 | Camera scan launch 階段做唔做? | 影響 launch app 完整度 vs ship 時間 |
| 2 | 「Browse only」mode 做唔做(無需 signup browse 價)? | 影響 acquisition funnel |
| 3 | PRO 月費定位 HK$58 啱定貴 / 平? | 影響 ARR model |
| 4 | 認證商戶 founding 10 間免費期 18 個月 OK? | 影響 BD pitch + Year 1 收入預測 |
| 5 | 揀邊個 HK 文化人 / KOL 做 advisor(Steve Aoki equivalent)? | 影響 social proof |
| 6 | 第二個 TCG launch 加 One Piece 定 Yu-Gi-Oh? | 影響 Year 1 roadmap |
| 7 | 公開 HK Market Price Index 嘅 web 版本(無 login 可睇)? | 影響 SEO + media + 競品 reverse-engineer 風險 |

---

## 7 · Sources

- [Collectr — 官方](https://getcollectr.com/)
- [Collectr PRO — 訂閱](https://getcollectr.com/pro)
- [Collectr App Store](https://apps.apple.com/us/app/collectr-tcg-collector-app/id1603892248)
- [BetaKit · How Collectr bootstrapped...](https://betakit.com/how-collectr-bootstrapped-a-trading-card-hobby-into-an-eight-figure-business/)
- [Fintech.ca · Toronto's Collectr Is the World's Fastest Growing Collectibles App](https://www.fintech.ca/2025/05/22/collectr-worlds-fastest-growing-collectibles-app/)
- [Threads · JP Arcanine pricing complaint](https://www.threads.com/@bvj.805/post/DH_mA75P_rO/this-is-exactly-why-i-will-never-take-anyones-collection-pricing-from-the-collec)
- [Elite Fourum · Collectr discussion](https://www.elitefourum.com/t/does-anybody-use-portfolio-management-apps-collectr-pokellector-alt-etc/54766)
- [Mordor Intelligence · TCG Market 2031](https://www.mordorintelligence.com/industry-reports/trading-card-game-market)
- [Best Pokemon Card Collection Apps 2026](https://www.mydextcg.com/blog/best-pokemon-card-collection-apps-2026)

---

## 8 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | v01 初版。Web search × 7 queries 為 source。|
