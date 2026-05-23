# HKCARDCOLL — Merchant System Specification
> 給 coding 用的完整商店功能文件

---

## 1. 用戶三層結構 (User Tiers)

| Tier | 類型 | 上傳限制 | 需要證明 | 認證徽章 | 價格計入 HK DB |
|------|------|---------|---------|---------|---------------|
| 0 | 普通用戶 (Viewer) | 10 張（個人收藏） | ❌ | ❌ | ❌ |
| 1 | 個人賣家 (Individual Seller) | 10 張 | ❌ 自行申報 | ❌ | ❌ |
| 2 | 認證商家 (Certified Merchant) | 100 張 | ✅ BR 文件 | ✅ | ✅ |

### Supabase user_roles table
```sql
user_id        uuid (FK → auth.users)
role           enum: 'viewer' | 'individual_seller' | 'certified_merchant'
status         enum: 'active' | 'pending' | 'rejected'
created_at     timestamp
```

---

## 2. 個人賣家登記 (Individual Seller Registration)

### 表單欄位
```
display_name        string, required       // 顯示名稱／暱稱
avatar_url          image upload, optional // 頭像
district            enum, required         // 所在地區（香港18區）
contact_type        enum                   // WhatsApp | Telegram | Instagram
contact_value       string, required       // 聯絡方式數值
payment_methods     multi-select           // PayMe | FPS | 銀行轉帳 | 現金
declaration         boolean, required      // 勾選聲明：非商業用途
```

### 聲明文字
> 「本人確認以個人身分出售自身收藏，並非以商業形式經營。」

### 批核方式
- 自動批核，即時生效，無需人手審核

---

## 3. 認證商家登記 (Certified Merchant Registration)

### 表單欄位
```
shop_name_zh        string, required       // 店舖中文名稱
shop_name_en        string, required       // 店舖英文名稱
logo_url            image upload, required // 店舖 Logo
banner_url          image upload, optional // 店舖 Banner（批核後可更換）
br_number           string, required       // BR 號碼
br_document_url     file upload, required  // BR 文件（jpg/pdf）
has_physical_store  boolean                // 有否實體店
address             string, optional       // 實體地址（如有）
business_hours      string, optional       // 營業時間
whatsapp            string, required       // WhatsApp Business 號碼
website             string, optional       // 網站連結
instagram           string, optional       // Instagram 帳號
shop_description    text, optional         // 店舖簡介（max 200字）
payment_methods     multi-select           // PayMe | FPS | 銀行轉帳 | 現金
```

### 批核流程
```
用戶提交申請
→ status = 'pending'
→ 管理員人手審核 BR 文件（1–3 個工作天）
→ 批核：status = 'active'，push notification 通知
→ 拒絕：status = 'rejected'，push notification + 原因
```

### Push Notification 文字
```
✅ 批核成功：
Title: 恭喜！認證商家審核通過
Body: [店舖名稱] 已獲認證，立即上傳你的卡牌庫存

❌ 審核未通過：
Title: 申請需要補充資料
Body: 請重新上傳清晰的 BR 文件，或聯絡我們了解詳情
```

---

## 4. 商家專頁 (Merchant Profile Page)

### 頁面結構
```
┌─────────────────────────────────────┐
│  [ Banner 圖片 1200x400 ]           │  ← 可上傳替換
│                                     │
│  [Logo 圓形]  店舖名稱              │
│               ✅ 認證商家            │
│  📍 旺角      🕐 12:00–21:00       │
│  📱 WhatsApp  🌐 Instagram          │
│                                     │
│  店舖簡介文字...                    │
├─────────────────────────────────────┤
│  [商品 Tab] │ [關於 Tab] │ [評價 Tab]│
├─────────────────────────────────────┤
│  [卡] [卡] [卡]                     │
│  [卡] [卡] [卡]   ← Grid Layout    │
└─────────────────────────────────────┘
```

### Banner 邏輯
- 未認證 / 待審核：顯示「申請認證商家」CTA Banner
- 審核中：顯示「審核中，請稍候 1–3 工作天」Banner
- 批核後：顯示商家自己上傳的 Banner 圖片（或預設佔位圖）

---

## 5. 商品 Card Layout（統一用於 Search、商家頁、主頁）

```
┌──────────────────┐
│  [卡牌官方圖片]  │
│  （或實物照片）  │
│                  │
│  Charizard ex    │  ← 卡名
│  Obsidian Flames │  ← Set 名
│  ♦♦♦♦ Double Rare│  ← 稀有度
│                  │
│  HK$ 280         │  ← 商家定價
│  ✅ 認證商家     │  ← 或 👤 個人賣家
│  旺角 · 實體店   │  ← 地區 + 類型
└──────────────────┘
```

---

## 6. 商品上傳表單 (Product Upload Form)

### 步驟流程
```
Step 1 — 搜尋卡牌
  輸入：卡名 / Set 名 / 卡號
  系統自動填入：卡名、Set、稀有度、官方卡圖

Step 2 — 上傳實物照片（選填）
  最多 4 張
  選項：[拍照] [從相冊選擇]

Step 3 — 卡況 (Condition)
  ● NM — Near Mint（近全新）
  ○ LP — Lightly Played（輕微磨損）
  ○ MP — Moderately Played（中度磨損）
  ○ HP — Heavily Played（嚴重磨損）
  ○ D  — Damaged（受損）

Step 4 — 定價及詳情
  price           number, required    // HK$
  is_negotiable   boolean             // 可議價
  quantity        number, required    // 數量
  
Step 5 — 版本（選填，multi-select）
  ☐ 日版  ☐ 英版  ☐ 韓版  ☐ 中版
  ☐ 首版  ☐ Shadow  ☐ Holo

Step 6 — 備註（選填）
  text, max 100字
  e.g. 附 sleeve、有 top loader
```

### Supabase listings table
```sql
id                  uuid
seller_id           uuid (FK → users)
seller_type         enum: 'individual_seller' | 'certified_merchant'
card_id             uuid (FK → cards) // 官方卡牌資料
photo_urls          text[]             // 實物照片（最多4張）
condition           enum: 'NM' | 'LP' | 'MP' | 'HP' | 'D'
price               numeric
is_negotiable       boolean
quantity            integer
language            text[]             // 日版/英版 etc.
notes               text
status              enum: 'active' | 'sold' | 'hidden'
created_at          timestamp
```

---

## 7. 香港市場價格 (HK Market Price Database)

### 資料來源規則
- **只有認證商家（Tier 2）** 的上架價格計入 HK Market Price
- 個人賣家價格不計入，但仍在 listing 顯示（標示為👤個人賣家）

### 主頁 / 搜尋顯示區塊
```
┌─────────────────────────────────────┐
│ 🇭🇰 香港市場價格                   │
│                                     │
│ Charizard ex (Obsidian Flames)      │
│                                     │
│ 最低價  HK$ 250  ✅ 旺角卡屋       │ ← 最平認證商家（可點入商家頁）
│ 平均價  HK$ 310                    │
│ 最高價  HK$ 420                    │
│                                     │
│ [價格走勢圖 📈]  過去 30 日         │
│                                     │
│ 共 8 間認證商家有貨                 │
│ [ 查看所有商家 ]                    │
└─────────────────────────────────────┘
```

### Supabase hk_market_prices table
```sql
card_id             uuid (FK → cards)
lowest_price        numeric
average_price       numeric
highest_price       numeric
lowest_price_merchant_id  uuid (FK → merchants)
merchant_count      integer
recorded_at         timestamp         // 每日更新
```

### 收入模式 v02（2026-05-17 update · NO transaction commission）

**重要決策：HKCardColl 完全唔收 transaction commission**（同 Carousell 一致）。

主要收入 4 條：

| 條 | 來源 | 金額 |
|---|---|---|
| 01 | **PRO 訂閱**（消費者）| HK$58 / 月 · HK$398 / 年（年費 ×7 折）|
| 02 | **認證商戶月費**（B2B）| 月 1-3 免費（限首 10 founding）· 月 4+ HK$500 / 月 或 HK$5,000 / 年 |
| 03 | **Affiliate revenue** | TCGplayer 5-7% · eBay Partner 1-4% · Amazon JP 1-3% |
| 04 | **In-app ads**（限業界）| Set drop / grading service / sleeve 商家 · HK$1,500-3,000 / placement |

#### Add-on (將來)
- 搜尋結果置頂：HK$1,000 / 月 / slot（限 5 個 bid 形式）
- 首頁推廣 carousel：HK$500 / 週
- B2B API（賣數據俾進口商 / 媒體 / 保險）— Phase 2

#### Free vs PRO（消費者層）
| 範疇 | Free | PRO |
|---|---|---|
| Portfolio 卡數 | 無限 | 無限 |
| 走勢圖 | 30 日 | 90 / 180 / 365 / 自定義 |
| Scan / 日 | 20 次 | 無限（v1.1）|
| Multi-portfolio | 1 個 | 多個 |
| CSV export | ✗ | ✓ |
| 自定義價格提醒 | ✗ | ✓ |
| Deal history | 90 日 | 永久 |
| PRO badge | ✗ | ✓ |
| Customer support | 3 工作天 | 24 小時 |

詳細 PRO spec 見 `notes/product_pro_features.md`。

#### 商戶 founding 期 v02（由 18 個月 → 3 個月）
原本計劃 founding 商戶免費 18 個月。新規：**3 個月**。
理由：3 個月內見到 traction 嘅商戶自然會 pay HK$500（= 1 張 PSA 10 commission）；冇 traction 嘅自然退。短 founding 期 = 快速驗證 = 唔養 dead weight。

---

## 8. 地區列表（香港18區）

```
香港島：中西區、灣仔、東區、南區
九龍：油尖旺、深水埗、九龍城、黃大仙、觀塘
新界：荃灣、屯門、元朗、北區、大埔、沙田、西貢、離島、葵青
```

---

## 9. 付款方式選項

```
PayMe | FPS（轉數快）| 銀行轉帳 | 現金
```

---

## 10. 重要業務邏輯總結（v02）

1. **商家申請** → 個人賣家自動批核，認證商家需人手審核 BR
2. **Banner 替換** → 只有認證商家批核後才能上傳自訂 Banner
3. **HK 價格 DB** → 只收錄認證商家定價，個人賣家不計入
4. **最低價顯示** → 搜尋及主頁顯示最平認證商家，可點擊進入商家頁
5. **上傳限制** → 個人賣家 10 張，認證商家 100 張
6. **每間商家** → 有獨立商家專頁（/merchant/:id）
7. **NO transaction commission**（v02 新增）— 平台唔收交易抽成。靠 PRO 訂閱 + 認證商戶月費 + affiliate + ads。
8. **Founding 期 3 個月**（v02 改）— 首 10 認證商戶月 1-3 免費，月 4+ HK$500 / 月。
9. **Affiliate 規矩**（v02 新增）— 本地 listing 優先；affiliate（TCGplayer / eBay / Amazon JP）顯示喺「全球參考價」section，唔擋本地 listing。
10. **PRO subscription**（v02 新增）— HK$58 月 / HK$398 年。8 條 PRO feature 詳見 `notes/product_pro_features.md`。

---

*Last updated: 2026-05-17（v02 monetization rewrite）*
*Previous: 2026-05-09*
