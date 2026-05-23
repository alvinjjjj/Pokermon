# HKCardColl · PRO vs Free 分隔規格 v01

> Monetization model 鎖定文件。對應 product backlog 第 #20 條(PRO features gate spec)。
> Voice: brand/voice.md(precise / local / calm)。
> Last updated: 2026-05-17

---

## 0 · 大方向(Decision Log)

| 項目 | 決定 | 理由 |
|---|---|---|
| 收費模式 | Freemium | 對標 Collectr($10M ARR 已驗證 model)|
| **完全唔收** | **Transaction commission** | 同 Carousell 一致;低 friction = 高 GMV = 大 affiliate pool |
| 主要收入 4 條 | PRO 訂閱 + Affiliate + In-app Ads + 認證商戶月費 | 多元降風險 |
| PRO 月費 | **HK$58** | 略平過 Collectr US$7.99(≈ HK$62);心理錨點低於 HK$60 |
| PRO 年費 | **HK$398** | 月費 ×7 折(原本 ×12 = 696);心理錨點低於 HK$400 |
| 認證商戶月費 | **HK$500 / 月** 或 **HK$5,000 / 年**(月 1-3 免費)| 等於商戶 1 張 PSA 10 commission |
| Founding 商戶優惠 | 首 10 間 3 個月免費 | 短期試水,3 個月見唔到 traction 自然退 |

---

## 1 · Free Tier 包乜(Day 1 全部用戶免費拎到)

| 範疇 | Free 內容 |
|---|---|
| Portfolio | **無限卡**(唔限收藏數量)|
| 即時卡價 | HK$ 為基準,JP / EN 同步 |
| 走勢圖 | **30 日** 內 |
| Card scan | 每日 **20 次**(v1.1 上嗰陣)|
| Search | 無限 |
| Tier 1 listing(個人賣家)| 10 張(現有上限)|
| Social feed | 無限 |
| Follow / DM | 無限 |
| HK Market Index | 當前 **最低 / 平均 / 最高** 三個價 |
| 商戶頁瀏覽 | 全部 |
| 開箱 / 社群 post | 無限 |
| Notification | 系統 + DM 即時 |
| 語言 | 4 語言全 |
| 貨幣 | 4 種全 |

**設計原則:** 基本體驗完整,唔搞「半 app」感覺。讓用戶愛上產品再 monetize。

---

## 2 · PRO Tier 包乜(HK$58 / 月 · HK$398 / 年)

8 條 PRO feature:

| # | Feature | 用戶價值 |
|---|---|---|
| 01 | **深度走勢圖** — 90 / 180 / 365 日 + 自定義時段 | 真投資者要長期 trend |
| 02 | **資料匯出** — CSV / Excel,包稅務、保險用格式 | 港藏報稅 / 報保險用 |
| 03 | **Multi-portfolio** — 可開「個人」/「店舖」/「投資」/「朋友寄賣」 多個獨立組合 | 嚴肅藏家或代客寄存場景 |
| 04 | **Unlimited card scan** | Free 限 20/日,PRO 無限 |
| 05 | **自定義價格提醒** — e.g.「Charizard PSA 10 升穿 HK$30,000 通知我」 | 投資者剛需 |
| 06 | **Deal record 完整保留** — Free 只記 90 日,PRO 永久 | 報稅 / 證明出處 |
| 07 | **PRO badge on profile** | 社交身份信號 |
| 08 | **Priority customer support** — 24 小時內回覆(Free 標 3 工作天)| 高價值用戶禮遇 |

### 對標檢驗

| 項目 | HKCardColl PRO | Collectr PRO |
|---|---|---|
| 月費 | HK$58 ≈ US$7.40 | US$7.99 ≈ HK$62 |
| 年費 | HK$398 ≈ US$51 | US$44.99(promo)/ US$59.99 |
| 深度走勢 | ✓(自定義時段)| ✓ |
| CSV 匯出 | ✓ | ✓ |
| Multi-portfolio | ✓ | ⚠ 未確認 |
| Unlimited scan | ✓(v1.1)| ✓ |
| 價格提醒 | ✓ | ⚠ 未確認自定義 |
| 完整 deal history | ✓ | ⚠ 未確認 |
| PSA / BGS 同步 | ✓ | PSA only |
| JP 卡價準 | ✓ | ✗ 8x error case |

**結論:** Feature parity + 略平 + JP 準確 + BGS 支援 = 港藏 PRO 一定揀我哋。

---

## 3 · Paywall Trigger 設計

**唔好「撞牆式」paywall。** 用「value moment」設計:

| Trigger | 觸發位置 | Paywall copy(voice.md 規格)|
|---|---|---|
| 揀 90 日走勢 | Portfolio 走勢圖 tab 切換 | `90 日走勢 PRO 解鎖 · HK$58/月`|
| 第 21 次 scan(當日)| 掃到第 21 張卡 | `今日 scan 達 20 次上限 · PRO 解除限制` |
| 開第 2 個 portfolio | Portfolio settings | `Multi-portfolio PRO 解鎖 · 適合代客寄存 / 投資組合分隔` |
| 設價格提醒 | Card 詳情頁 alert 按鈕 | `價格提醒 PRO 解鎖 · 自定義你嘅 trigger` |
| 匯出 CSV | Portfolio 詳情頁右上 | `CSV 匯出 PRO 解鎖 · 報稅 / 保險用` |

**絕對唔做:**
- 開啟 app 就彈 paywall
- 「3 日試用,自動扣費」式陷阱
- 蓋住內容嘅 modal full-screen paywall(用 sheet half-screen)
- 紅色 emoji 或「!!」hype

---

## 4 · 認證商戶 Tier(另收費)

| Tier | 費用 | 包乜 |
|---|---|---|
| 個人賣家(Tier 1) | **永遠免費** | 10 listing、Tier 1 徽章 |
| **Founding 認證商戶**(限首 10 間) | **月 1-3 免費,月 4+ HK$500/月** | 100 listing、認證徽章、商戶頁、HK Index 計入、優先 onboarding |
| 認證商戶(月 11+ 申請) | **HK$500 / 月** 或 **HK$5,000 / 年(8.3 折)** | 同上 |

### Add-on(將來)
- 搜尋結果置頂:HK$1,000 / 月(限 5 個 slot,以 bid 形式)
- 首頁推廣 carousel:HK$500 / 週

---

## 5 · Affiliate Revenue 規格

呢個 part 對應 backlog #21。原則:**affiliate link 唔擋本地 listing。**

### Display rule
```
卡片詳情頁 →
1. HK 認證商戶 listing(優先)
2. 個人賣家 listing(次)
3. 「全球參考價」section ← Affiliate
   · Buy on TCGplayer · US$X.XX
   · Buy on Cardmarket · €X.XX
   · Buy on eBay · US$X.XX-X.XX
```

### 接哪些 affiliate
| Source | Affiliate ID 要求 | 估計 commission |
|---|---|---|
| TCGplayer Affiliate | ✓ 有公開 program | 5-7% |
| eBay Partner Network | ✓ HK 可申請 | 1-4% |
| Amazon Associates(日本)| ⚠ 要 JP entity 或 HK 跨境 | 1-3% |
| Cardmarket | ⚠ 冇正式 program | N/A |

### Disclosure copy(voice.md compliant)
> *「全球參考價來自合作夥伴連結。透過呢度購買,HKCardColl 會收到佣金,唔影響你嘅價錢。」*

放喺 Settings → 關於 → 收益模式 頁;每張卡 affiliate section 旁邊用「ⓘ」icon。

---

## 6 · In-app Ads 規格(Backlog #24)

**唔賣俾廣告網絡(AdMob 等),只賣俾相關業界:**

| Ad 類型 | 位置 | 規格 | 售價(estimate)|
|---|---|---|---|
| Set drop 預告 | Home feed 第 5 條 | 卡 set 圖 + 倒數 + CTA | HK$3,000 / 週 |
| Grading service 推廣(PSA HK / BGS HK 代理) | Card 詳情頁底部 | 文字 + logo | HK$2,000 / 月 |
| 卡盒 / sleeve 商家 | Profile / Portfolio 邊欄 | 圖 + 短文 | HK$1,500 / 月 |
| Founding merchant 自家 ads | 限 Tier 2,3 個 slot | 1080×1080 | 免費(founding 福利)|

**絕對唔做:**
- Banner 滿天飛
- 影片自動播
- Reward video「睇 30 秒解鎖」
- 第三方 ad network(可能洩露用戶數據)

**Voice rule:** Ad 文案都要過 voice.md 審核。Hype 不可、純資訊式。

---

## 7 · 收入模型估算(Year 1)

| 收入源 | 用戶 / 商戶數 | ARR estimate(HK$)|
|---|---|---|
| PRO 訂閱 | 1,000 PRO(10% conversion of 10K active)| 1,000 × 398 = **398,000** |
| 認證商戶月費 | 30 商戶(扣 10 founding 3 個月免費)| (30-10×0.25) × 6,000 = **165,000** |
| Affiliate(TCGplayer / eBay)| 5% conversion × 10K × 200 GMV × 3% commission | **300,000** |
| In-app ads | 4 advertiser × HK$2,000 × 12 | **96,000** |
| **Year 1 ARR 總計** | | **~ HK$960,000** |

**唔係驚天動地數字,但係 zero ad spend 嘅 organic ARR。Year 2 + 5x 估算 HK$5M。**

---

## 8 · Trade-off + Risk

| 風險 | 影響 | Mitigation |
|---|---|---|
| Free tier 太豐富,PRO 轉化率低 | ARR 低過預估 | A/B test paywall trigger,如果 conversion < 5% 收緊 free quota |
| 認證商戶 3 個月後唔肯 pay HK$500 | Tier 2 流失 | 出 case study 證明 sales lift;唔肯 pay 嘅自然降回 Tier 1 |
| Affiliate revenue 不穩定 | 月收入波動 | 多 source(TCGplayer + eBay + Amazon);維持 PRO 為穩定 anchor |
| 用戶反感 ads | 評分下降 | 嚴控 ads 數量同質素;voice 一致 |

---

## 9 · 開發 dependency

要 ship 完整 monetization model,以下 component 要做齊:

1. **In-app purchase** — Apple StoreKit + Google Play Billing(PRO 訂閱)
2. **Affiliate link tracker** — UTM + click event,或 server-side proxy 統計轉化
3. **Ad placement engine** — Server-managed,可即時改 ad slot 內容
4. **Paywall sheet UI** — 5 個 trigger 對應 5 個 variant(voice 一致)
5. **PRO badge rendering** — Profile + comment + listing 上顯示
6. **Quota counter** — Scan 計數、deal record 90 日清理 cron

呢層全部 send HKCC · Code chat 估工時。我哋 product 角度負責 spec + 文案 + paywall trigger design。

---

## 10 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | v01 初版。Founding 期由 18 個月改 3 個月;新增 No transaction commission;加 affiliate + ads 策略;PRO 8 條 feature 定價 HK$58 / HK$398。|
