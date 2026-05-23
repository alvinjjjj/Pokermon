# HKCardColl · Auto Social Flow 規格 v01

> 自動生成 social media post + 週一 HK Market 靜態圖。
> 對應 backlog #22(auto social poster)+ #23(auto weekly Index poster)。
> Voice: brand/voice.md(precise / local / calm)。
> Last updated: 2026-05-17

---

## 0 · 目的

零預算嘅 social proof + media coverage 機制。**手動發 IG / Threads 太貴;自動化跑,人類只做最後 approve。**

平台優先序:**Threads → IG → 小紅書**
理由:
- Threads HK 用戶增長最快,algorithm 對純文字 + 數字友善 → voice.md 嘅 calm/precise 反而正中文化
- IG 視覺 carousel 適合週報靜態圖
- 小紅書 zh-CN 流量大,但需要本地化用語

---

## 1 · 兩個 auto-flow

### Flow A · 每週一 HK Market Index 靜態圖(backlog #23)
**Cadence:** 每週一 09:00 香港時間
**Output:** 1 張 1080×1080 PNG + 對應 caption(zh-HK + zh-CN + en + ja)
**Trigger:** scheduled task

### Flow B · 動態事件 social post(backlog #22)
**Cadence:** Triggered by event
**Output:** Threads post + IG carousel option + 小紅書 post draft
**Trigger:** 事件驅動(見下)

---

## 2 · Flow A · 週一靜態圖規格

### 內容
```
┌─────────────────────────┐
│ HKCardColl              │
│ HK Pokemon Market 週報  │
│ Week of 2026-05-XX      │
├─────────────────────────┤
│ ↑ Top 5 升幅(7 日)    │
│  · Charizard PSA 10   +14.2%
│  · Pikachu V-Union     +9.8%
│  · ...                          │
├─────────────────────────┤
│ ↓ Top 5 跌幅(7 日)    │
│  · ...                          │
├─────────────────────────┤
│ ⚡ 本週成交亮點         │
│  · 旺角商戶售出 PSA 10 │
│    Black Lotus...HK$ XX K       │
├─────────────────────────┤
│ HKCardColl · 詳細數據 app 內 │
└─────────────────────────┘
```

### 視覺規格
- Background: Paper `#F6F2EA`
- Text: Ink `#1A1814`
- Accent(唯一橙色元素): 升幅嘅 ↑ icon, Card Orange `#FF6A1F`
- 跌幅 icon: 中性灰
- Font: Space Grotesk / JetBrains Mono
- Logo: 左上角細
- 唔出現嘅: emoji(🎉🔥)、漸層、陰影

### Caption(各語言)
```
zh-HK:
HK Pokemon 市場週報 · Week of 2026-05-XX
本週 Top 5 升 / 跌幅、本週成交亮點。
完整數據:hkcardcoll(app)
#HKCardColl #PokemonHK #PSA #TCG

zh-CN:
HK 宝可梦市场周报 · Week of 2026-05-XX
本周 Top 5 涨跌、本周成交亮点。
完整数据:HKCardColl App
#HKCardColl #香港宝可梦 #PSA #TCG

en:
HK Pokémon Market Weekly · Week of 2026-05-XX
This week's top movers + standout deals.
Full data in HKCardColl.
#HKCardColl #PokemonHK #PSA #TCG

ja:
HK ポケモン市場週報 · 2026-05-XX 週
今週の上昇 / 下降 Top 5、注目取引。
詳細データは HKCardColl アプリで。
#HKCardColl #ポケカ香港 #PSA #TCG
```

### 數據來源
- HK Market Index 表(認證商戶定價匯集)
- 上週對比本週,計 7 日 / 30 日變動
- 過濾條件:Volume > 5 transactions / cards / week(避免 outlier)

### 人類審批
1. 系統生成草稿 → 存喺 admin panel「待發 social」清單
2. Admin 開電郵 / push 收 alert
3. 30 秒內可 approve / reject / edit caption
4. Approve 後 post 到 Threads(API)、IG(Graph API)、小紅書(手動 fallback,或 RPA)

---

## 3 · Flow B · 動態事件 post 規格

### Event triggers(7 條)

| Event | 觸發條件 | 內容方向 |
|---|---|---|
| 大幅升 / 跌 | 單張卡 24 hr 變動 > 10% | `Charizard ex JP +12.4% 過去 24 小時。HK Market 平均價 HK$X` |
| 新 set 上架 | 新 expansion 進 DB | `2026 SV9 「Battle Partners」資料庫已 sync。1,234 張卡入庫。HK 認證商戶率先定價中` |
| 新認證商戶 | 商戶批核完成 | `[商戶名] [地區] 已成為 HKCardColl 認證商戶。[3 個事實 bullet]` |
| Founding 招募進度 | Founding 名額剩 5 / 3 / 1 | `Founding 認證商戶名額剩 [N] 個 · [截止日]` |
| HK 區成交破紀錄 | 單張卡售價超過歷史最高 | `[卡名] [評級] HK 區歷史新高:HK$X · [日期]` |
| 港藏 portfolio milestone | 任何 portfolio 過 HK$1M(opt-in)| `匿名分享:HK 區 PRO 用戶 portfolio 突破 HK$1M。組合詳情(已同意公開)→ ...` |
| 媒體引用我哋數據 | Admin 標記 | `多謝 [媒體名] 引用我哋 [數據]。完整 dataset 喺 app 內` |

### Caption 生成 logic
- 套 voice.md 嘅 4 種範本(範本 A / B / C / D)
- 數字、卡名、評級、地區 為 variable
- AI 生成草稿,Admin 30 秒 approve

### 平台分發 strategy
- Threads:純文字 + 1-2 數據點(algo 友好)
- IG:carousel,第 1 張 hook,第 2-5 張深度數據
- 小紅書:1080×1350 圖 + 長 caption
- (X / Twitter — Phase 2 視乎人手)

---

## 4 · 技術 dependency(送 HKCC · Code)

呢層全部係 server-side scheduled task + admin UI:

1. **Scheduled task runner** — 已有 mcp__scheduled-tasks 機制
2. **Image generation** — server-side Canvas / Puppeteer / 後端模板系統,出 1080×1080 PNG
3. **Admin approval UI** — `app/admin/social-queue.tsx` 列出待發 post,one-tap approve/reject
4. **Platform API integration**:
   - Threads:Threads API v1.0
   - IG:Instagram Graph API
   - 小紅書:暫時手動 fallback(冇 official API);用 admin 一鍵 copy clipboard + 圖片下載
5. **Event listener** — Supabase realtime channel 監察:
   - `hk_market_prices` 表 update,計 24 hr / 7 day diff
   - `cards` 表 INSERT
   - `merchants` 表 status update → active
   - `listings` 表 sold + price > historical max

---

## 5 · 啟動時間表

| 階段 | 何時 | 內容 |
|---|---|---|
| Phase 0 | 而家 | 手動 IG / Threads(我親自 post,測 voice + engagement)|
| Phase 1 | App launch + 4 週 | 半自動:系統生成草稿,人手審核 + post(每週一 + 新 merchant approve 兩條 trigger 先做)|
| Phase 2 | Launch + 8 週 | 半自動:7 條 trigger 全做,Threads + IG API 直 post |
| Phase 3 | Launch + 12 週 | 全自動:Admin 可設「免審核」白名單(e.g. 週一靜態圖 自動 post,內容修改 trigger 唯一 require 審) |

---

## 6 · KPI 同停損點

| 指標 | 4 週目標 | 8 週目標 | 12 週目標 |
|---|---|---|---|
| Threads follower | 200 | 800 | 2,000 |
| IG follower | 100 | 500 | 1,500 |
| 單條 post engagement rate | > 3% | > 5% | > 5% |
| 每週 post 帶嚟 app install | 20 | 100 | 300 |
| Media pickup | 0 | 1 | 3 |

**停損:** 8 週唔達 KPI,reframe message + 唔再投入工程時間到 Phase 3。

---

## 7 · 風險

| 風險 | 影響 | Mitigation |
|---|---|---|
| Threads / IG ban auto-post | 平台沒收 | 維持半自動人手 approve,睇似真人 |
| 連續發 post 質素差 → 取消 follow | 失去早期 follower | 嚴守 voice.md;Admin reject rate 應 < 20% |
| 卡價數據錯誤導致 post 錯 | 信任崩 | Source 至少 2 個 cross-check;單 source 唔出 post |
| 用戶誤會我哋 promo / spam | 撤訪 | Threads 一日最多 3 post;IG 一週最多 5 post |

---

## 8 · Voice rules(額外 reminder)

每條 auto-post 出 voice.md 4 條 checklist:
- 第一句有具體數字 / 版本 / 日期?
- 冇用「!」連發 / hype emoji?
- 冇用「驚喜 / 爆升 / 必入 / 起飛」?
- 引用數字有出處?

如 Admin approval rate < 80%,即 voice template 要重寫。

---

## 9 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | v01 初版。對應 user decision「Threads + 自動 flow + IG 週報」。|
