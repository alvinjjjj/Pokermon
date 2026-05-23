# Collectr 市場策略與業務發展

> 對話日期：2026年5月16日
> 對話角色：Claude 擔任市場策略師 + 全端支援

---

## 核心決策

### 產品定位
- **最終定位**：「香港 Pokemon 卡資產管理平台」（不是「交易平台」）
- **品牌 Tagline**：「收藏不只是興趣——它是文化，是社群，也是資產。」/ "More than a hobby — it's culture, community, and value."
- **核心差異化**：全球首個同時追蹤日版 + 英版 Pokemon 卡市場並以港幣顯示的平台（競爭壁壘）

### 用戶架構（已確認）
- Tier 0：普通收藏家（免費）
- Tier 1：個人賣家（自行申報，最多 10 listings）
- Tier 2：認證商戶（BR 核驗，最多 100 listings，付費）
- Admin / Super Admin（創辦人級別，不可撤銷）

### 商業模式（已確認四條收入線）
1. **認證商戶年費**：HK$3,000/年（HK$250/月）—— 第一階段，上線即啟動
2. **用戶高級訂閱**：HK$48/月（30/90/180日走勢圖、深度分析）—— 1,000 用戶後啟動
3. **交易佣金**：2–3%（平台成熟後）
4. **商戶置頂廣告**：HK$800–1,500/月 —— 上線 6 個月後

### GTM 策略（已確認）
- **先搶商戶，用商戶帶用戶**（不是先搶用戶）
- 上線前親身拜訪旺角/銅鑼灣/觀塘卡店，目標簽下 8 間「創始商戶」
- 創始商戶策略：免費 + 「首批認證商戶」徽章，降低摩擦

### Onboarding 文案方向（已確認）
- 三屏順序改為：**定價（最獨特）→ 收藏 → 社群**（原版三屏都太平）
- 第一屏主打 JP + EN 雙市場 HKD 定價
- 四語言版本：繁中、English、简中、日本語

### 個人 / 公司簡介（已確認方向）
- 個人：資深 Pokemon 卡收藏家，找不到合適平台所以親手建造
- 公司：香港首個 Pokemon TCG 資產管理平台
- 一腳踢：Founder + Designer + Developer

---

## 待解問題

- 認證商戶年費定價 HK$3,000 是否最終確認？（建議上線前鎖定）
- Referral 計劃具體獎勵機制未定（邀請朋友雙方得什麼？）
- 交易佣金何時啟動、如何向用戶溝通（需要提前設計 UX）
- 澳門 / 台灣擴展的時間線未確認
- 媒體接觸計劃（UNWIRE、香港 01）未執行
- App 的 `edit-profile.tsx` 路徑問題（放錯目錄 `app/app/`）未修復
- API Keys 安全問題：pokemontcg.io key 是否需要移去 `.env`（現 EXPO_PUBLIC_ 前綴，官方說可以）

---

## 有用的事實 / 數據

### 產品數據
- 36 個頁面（.tsx）
- ~22,000 行 TypeScript
- 25 個 Supabase 數據表 + 1 個 View
- 39 個數據庫 migration 文件
- 4 種語言：繁中 / English / 日本語 / 简中
- 4 種貨幣：HKD / USD / JPY / CNY
- 52 個日版補充包系列追蹤
- 18 個香港地區
- 6 個定價數據來源（TCGplayer、Cardmarket、Cardrush、Yuyutei、PriceCharting、pokemontcg.io）
- Bundle ID：`com.collectr.app`
- EAS Project ID：`eab0d040-923e-4705-bff8-1b77c06118a9`

### 市場數據
- 全球 TCG 市場：US$15B+，年增長約 8%
- 香港 Pokemon 卡年度市場估計：HK$500M+
- 香港現時主要交易渠道：Facebook 群組（無任何數字化平台）

### 收入預測
| 時間 | 用戶 | 商戶 | 月收入 |
|------|------|------|--------|
| 上線第 1 個月 | 200 | 10 間 | HK$2,500 |
| 第 3 個月 | 700 | 20 間 | HK$5,000 |
| 第 6 個月 | 1,000 | 30 間 | HK$14,900 |
| 第 12 個月 | 3,000 | 40 間 | HK$27,200 |
| 第 18 個月 | 7,000 | 50 間 | HK$44,300 |
| 第 24 個月 | 10,000 | 60 間 | HK$59,000 |

### 聯絡 / 帳號
- 創辦人 Email：potodesignstudio@gmail.com
- 建議 IG 帳號：@collectrhk

### Apple Review
- 等待時間：約 14 天
- 這段時間是最重要的 marketing window

---

## 行動項目

### 即時（等 Apple Approve 期間）
- [ ] 準備商戶拜訪 deck（用公司概覽 PDF）
- [ ] 印製商戶介紹卡（A5，帶 QR code）
- [ ] 準備 iPhone App demo 流程（5 分鐘版本）
- [ ] 拜訪旺角 / 銅鑼灣 / 觀塘卡店（目標 10 間，確認 8 間承諾）
- [ ] 建立 Instagram 帳號 @collectrhk
- [ ] 建立小紅書帳號
- [ ] 在 Facebook 群組建立等待名單帖（用「搵意見」角度，不是廣告）
- [ ] 建立 Google Form 收 email 等待名單（目標 300+）
- [ ] 拍攝 30 秒「即將上線」預告片

### 上線第 1 天（同步執行）
- [ ] 通知所有等待名單 email
- [ ] 8 間商戶同步在各自 IG 發佈加入消息
- [ ] Facebook 全部群組發帖
- [ ] Instagram + 小紅書發帖

### 上線後持續
- [ ] 每週一：「本週最熱 Pokemon 卡 Top 5」（用 App 數據）
- [ ] 每週三：「精選認證商戶」帖子
- [ ] 每週六：「你的收藏今週升定跌？」互動帖
- [ ] 每月初：「香港 Pokemon 卡市場月報」免費 PDF
- [ ] 接觸香港科技媒體：UNWIRE、香港 01

### 技術待修
- [ ] 修復 `app/app/edit-profile.tsx` 路徑錯誤（應為 `app/edit-profile.tsx`）
- [ ] 確認 API Keys 安全設定（移去 `.env` 環境變數）
- [ ] 修復帳號刪除 Edge Function schema mismatch（App Store 上線前）

### 文件待更新
- [ ] 把收入模型數字（HK$3,000 年費 / HK$48 訂閱）加入 Pitch Deck
- [ ] 把詳細 Marketing 路線圖加入基金申請書
- [ ] Onboarding 四語言文案更新入 code（i18n 框架已接好）

---

## 廢棄資訊

- ~~定位為「Pokemon 卡交易平台」~~ → 升級為「資產管理平台」
- ~~Onboarding 第一屏是 Collection~~ → 改為 JP+EN 定價（最獨特功能放第一）
- ~~三屏內容都太平淡~~ → 重寫，突出差異化
- ~~`±5 card-count tolerance` 圖片匹配邏輯~~ → 已換成嚴格 set-code 匹配（避免顯示錯誤卡圖）
- ~~沒有 `user_id` 的 collection insert~~ → 已修復（舊版所有用戶數據混在一起）
- ~~CJK 命名的 icon 文件（主頁.png 等）~~ → 已換成英文命名（home.png 等）

---

## 相關檔案

### 產出文件（全部在 /Users/alvin/collectr/）
- `/Users/alvin/collectr/Collectr_Investor_Deck.pptx` — 12 頁投資者 Pitch Deck
- `/Users/alvin/collectr/Collectr_Grant_Application.docx` — 英文政府基金申請書
- `/Users/alvin/collectr/Collectr_基金申請書.docx` — 繁體中文政府基金申請書
- `/Users/alvin/collectr/Collectr_Company_Overview.pptx` — 中英雙語公司概覽（商戶 / 媒體用）
- `/Users/alvin/collectr/notes/Collectr_市場策略與業務發展.md` — 本文件

### Live Artifact
- **Collectr 作戰指揮中心** — 永久保存在 Cowork sidebar
  - 上線前 Checklist（可打勾，進度儲存）
  - 上線後 Marketing 計劃
  - 收入模型圖表
  - 核心策略
  - 筆記功能

### 上傳文件
- `Collectr — Company Overview · Vol.01.pdf` — 用戶上傳的公司概覽設計稿（已審閱）

### App 主要文件（/Users/alvin/collectr/）
- `app/_layout.tsx` — Auth guard + route 定義
- `app/(tabs)/index.tsx` — 主頁 + Portfolio 圖表（1,155 行）
- `app/(tabs)/search.tsx` — 搜尋頁（1,666 行，最大）
- `app/(tabs)/portfolio.tsx` — Portfolio 管理
- `app/(tabs)/shops.tsx` — 商店 / 市場
- `app/(tabs)/social.tsx` — 社交動態
- `lib/supabase.ts` — Supabase 客戶端 + Session 持久化
- `lib/jpImages.ts` — JP 卡圖解析共享模塊
