# 公司註冊、基金申請、Apple 開發者帳號

## 核心決策

### 公司
- 公司名稱：**POTO CREATIVE TECH LIMITED / 寶圖創意科技有限公司**
- 公司編號：80363844
- BR 號碼：80363844-000-05-26-0
- 成立日期：2026年5月11日
- 登記地址：Flat E, 6/F, Block 7, Harmony Garden, Siu Sai Wan, Hong Kong
- 業務性質：Software development, mobile application publishing and digital design services
- 董事：Kuo Tsz Lung（聯絡電話：+852 6218 3666）

### 公司結構策略
- 一間公司旗下多個 App（不為每個 App 另開公司）
- 原因：開多公司成本高（每間約 HK$15,000/年），基金審核人員會 flag 同一人的多個申請

### 薪酬
- 以「董事酬金（Director's Fee）」形式每月付自己薪酬
- 設計工作以 Sweat Equity 方式記錄投入時間（市場時薪 HK$800–1,500/小時）
- 保留所有支出單據（Supabase、Adobe、開發費用）作日後扣稅用

### 銀行帳戶策略
- 主帳戶：Airwallex（收 App Store USD + 付技術費用，無手續費）
- 個人卡：Mox Bank（個人 1% Cashback，向公司報銷）
- 之後：恒生 / HSBC 傳統銀行（申請基金時加分，6–12 個月後）

### 信用卡策略
- 現在用個人 Mox 卡付公司支出，每月向公司報銷
- 6 個月後申請 AMEX 商業金卡（個人擔保，Membership Rewards 積分）

---

## 待解問題

- Apple Developer Program（公司帳號）：等 D-U-N-S 號碼（3–5 個工作天）
- 公司秘書（Company Secretary）：尚未委任，需盡快安排（約 HK$1,500–3,000/年）
- Airwallex 商業帳戶：尚未開立
- YBHK 申請：尚未開始，需準備面試 Pitch

---

## 有用的事實 / 數據

### 政府基金一覽

| 基金 | 金額 | 類型 | 截止 / 狀態 |
|------|------|------|------------|
| CCMF（Cyberport） | HK$100,000 | 全額資助，不佔股 | 下次：2026年8月3日 |
| Easy BUD Fund | HK$150,000 | 50% 資助，全年接受 | App 上線後約6週可申請 |
| YBHK 青年商業香港 | HK$180,000（AI項目 HK$200,000） | 免息貸款 | 隨時，需面試 |
| Cyberport Incubation (CIP) | HK$500,000 + HK$200K辦公室 | 資助 | App 上線後 |
| HKSTP Incu-Tech | HK$1,290,000 | 資助 | 1年後 |
| CreateSmart Initiative | HK$2,000,000 | 資助 | 有運營紀錄後 |
| BUD Fund（大灣區） | 最高 HK$7,000,000 累計 | 50% 資助 | 擴展大灣區時 |
| TVP 科技券 | — | ❌ 已於2024年12月關閉 | 不適用 |

**潛在最大總資助（近期）：HK$430,000**
- YBHK HK$180K + CCMF HK$100K + Easy BUD HK$150K

### CCMF 評分標準
- 管理團隊能力：30%
- 商業模式 + 上市時間：30%
- 創意和創新：30%
- 社會責任：10%

### YBHK 資格
- Kuo Tsz Lung，32歲，符合 18–35 歲要求
- 仍有 3 年申請窗口
- 加入 AI 功能可申請 HK$200,000

### D-U-N-S 申請狀態
- 追蹤編號：#10327472
- 個案編號：10392527
- 提交日期：2026年5月11日
- 狀態：審核中，預計 3–5 個工作天收到號碼
- D&B 已回覆要求核實，已回覆以下資料：
  - Company Name: POTO CREATIVE TECH LIMITED
  - Address: Flat E, 6/F, Block 7, Harmony Garden, Siu Sai Wan, Hong Kong
  - Employees: 1
  - Contact: Kuo Tsz Lung, Director & Founder, +852 6218 3666

### 重要 URL
- CCMF 申請：https://www.cyberport.hk/en/entrepreneurship/cyberport_creative_micro_fund/
- Cyberport 登入系統：https://entrepreneur.cyberport.hk
- Apple D-U-N-S 申請：https://developer.apple.com/enroll/duns-lookup
- YBHK 官網：https://sic.hkfyg.org.hk/en/ybhk/
- Easy BUD 申請指南：https://mainland.bud.hkpc.org/sites/default/files/download/EComEasy-Guide-to-Application-EN_202511.pdf
- Airwallex：https://www.airwallex.com/hk

### App Store 重要事項
- Seller Name（App Store 顯示）可以跟公司法律名稱不同，獨立設定
- 公司帳號需要 D-U-N-S Number（已申請）
- Apple Sign In 已加入 login.tsx（App Store 強制要求）

### 公司年度固定支出估算
- 公司秘書：HK$2,000–3,000/年
- BR 續期：HK$2,350/年
- 核數師：HK$8,000–15,000/年
- 合計：約 HK$15,000/年

---

## 行動項目

### 本週（優先）
- [ ] 收到 D-U-N-S 號碼後，申請 Apple Developer Program（公司帳號，USD $99/年）
- [ ] 開立 Airwallex 商業帳戶（需：BR + 成立法團證明書 + HKID）
- [ ] 委任公司秘書（Company Secretary）
- [ ] App 上線前：確認 ML Kit OCR 在 App Store build 重新 enable

### App 上線前
- [ ] Privacy Policy 頁面內容完整
- [ ] Terms of Service 頁面內容完整
- [ ] Admin 頁面確認有適當 role check 保護
- [ ] 確認 `app/(tabs)/card/[id].tsx` 和 `app/card/[id].tsx` 兩個 route 是否都需要
- [ ] PSA10_MIN_USD = 385 確認是否需要定期更新機制
- [ ] App Store Connect 帳號設定（App 名稱、描述、Screenshots、App Icon 1024x1024）

### App 上線後 6 週
- [ ] 申請 Easy BUD Fund（需有初步業務紀錄）
- [ ] 開始記錄創辦人每週投入時間（以 UIUX 市場時薪計算 Sweat Equity）

### 2026年8月3日前
- [ ] 提交 CCMF 申請（Oct 2026 Intake）
- [ ] 準備 Pitch Deck（可一份 Deck 用於 CCMF + Easy BUD + YBHK）

### 之後
- [ ] 申請 YBHK 免息貸款（準備商業計劃 + 面試）
- [ ] 考慮加入 AI 功能（卡況鑑定 / 定價建議）以申請 HK$200,000（而非 HK$180,000）
- [ ] App 上線有用戶後申請 Cyberport Incubation Programme
- [ ] 6 個月後申請 AMEX 商業金卡

---

## 廢棄資訊

- ~~每個 App 開一間公司~~：被否決，成本高且基金機構會 flag
- ~~TVP 科技券~~：已於 2024年12月關閉，無法申請
- ~~公司名 HKCARDCOLL LIMITED~~：改為 POTO CREATIVE TECH LIMITED（品牌一致 + 更廣業務範圍）
- ~~公司名 POTO DESIGN STUDIO LIMITED~~：改為 POTO CREATIVE TECH LIMITED（加科技感）

---

## 相關檔案

### 公司文件（已上傳至此對話）
- `/Users/alvin/Library/.../uploads/paymentReceipt.html` — 公司註冊付款收據（HK$3,895）
- `/Users/alvin/Library/.../uploads/150146979.pdf` — 成立法團證明書（Certificate of Incorporation）
- `/Users/alvin/Library/.../uploads/BRC_150146979.pdf` — 商業登記證（BR）

### App 程式碼（主要檔案）
- `/Users/alvin/collectr/app/(tabs)/index.tsx` — 主頁（1137 行）
- `/Users/alvin/collectr/app/(tabs)/search.tsx` — 搜尋（1659 行，含 ML Kit OCR）
- `/Users/alvin/collectr/app/(tabs)/social.tsx` — 社交動態（577 行）
- `/Users/alvin/collectr/app/(tabs)/portfolio.tsx` — 收藏集（1041 行）
- `/Users/alvin/collectr/app/(tabs)/settings.tsx` — 設定（含語言切換）
- `/Users/alvin/collectr/app/login.tsx` — 登入（Phone OTP + Google + Apple）
- `/Users/alvin/collectr/app/_layout.tsx` — Root Layout（Auth 狀態 + Splash）
- `/Users/alvin/collectr/app/listing-upload.tsx` — 上架表單（795 行）
- `/Users/alvin/collectr/app/new-post.tsx` — 發帖（含 ToS 雙層快取）
- `/Users/alvin/collectr/app/merchant-registration.tsx` — 商家申請（731 行）
- `/Users/alvin/collectr/lib/pokeprice.ts` — PPT API（三層快取）
- `/Users/alvin/collectr/lib/lowestPrices.ts` — HK 最低價查詢
- `/Users/alvin/collectr/lib/artofpkm.ts` — JP 卡圖片解析（含負快取）
- `/Users/alvin/collectr/lib/jpImages.ts` — JP 圖片雙重解析（artofpkm → TCGdex）
- `/Users/alvin/collectr/lib/i18n.ts` — 國際化（zh-HK / en / ja / zh-CN）
- `/Users/alvin/collectr/MERCHANT_SPEC.md` — 完整商家系統規格文件
