# Chat Migration SOP

> 把 sidebar 過多的舊對話**有秩序地**收進 5 個 HKCC 主力 chat。
> 最後更新：2026-05-16

---

## 為什麼要做這件事

| 現狀 | 問題 |
|---|---|
| Sidebar 有 15+ chat | 找不到誰在做什麼 |
| 對話互相不通 | UX 決策 code 不知道、marketing 想到的 UI 不知道 |
| 每個 chat 各自累積上下文 | 換 chat = 從零開始講 |

**目標**：5 個主力 HKCC · chat，每個都讀 `product.md` 和 `/notes/`，腦同步。

---

## 🗂 目標架構：5 個 HKCC 主力 chat

| Chat | 負責 | 整合的領域 |
|---|---|---|
| **HKCC · Command** | 跨領域決策、整體規劃 | 此 chat（這個就是）、Review app workspace organization |
| **HKCC · Product** | 產品設計（UX + UI + 功能）| UX professional、UI Design、Product |
| **HKCC · Growth** | 對外（行銷 + BD + research）| Marketing、Business development、Research、Secretary |
| **HKCC · Code** | 工程實作 | code、Security |
| **HKCC · Numbers** | 財務 / 估值 / 投資 | Data、Finance、Funds & loans |

> Venus / Venus Secretary 暫時保留——看你有沒有另一個 project 叫 Venus。如果是，跟 HKCardColl 無關，獨立放著。

---

## 🧭 5 步驟流程（每個舊 chat 走一遍）

### Step 1 · 打開要遷移的舊 chat

從 sidebar 點進去那個 chat。

### Step 2 · 貼通用提取 prompt

```
總結這個對話的所有有用內容。輸出為 markdown，存到
/Users/alvin/collectr/notes/[領域]_[主題]_2026-05.md
（領域 = growth / product / code / numbers / ops，主題自選）。

結構：

# [對話主題]

## 核心決策
我們達成的所有共識 / 已選的方向

## 待解問題
還沒答覆 / 還沒決定的事

## 有用的事實 / 數據
數字、聯絡人、URL、檔案路徑

## 行動項目
還沒做的 to-do

## 廢棄資訊
已被推翻的想法、舊版本決策

## 相關檔案
這個對話用過 / 產出過的檔案路徑

存好之後告訴我可以放心刪除這個 chat 了。
```

### Step 3 · 驗證 .md 存好

在 Finder 或 VS Code 打開 `/Users/alvin/collectr/notes/`，確認剛剛那份 .md 內容對。**沒存好就先別刪 chat**。

### Step 4 · 刪除舊 chat

Sidebar → 該 chat → `⋯` 選單 → Delete。

### Step 5 · 在 Chat Migration Tracker artifact 打勾

讓進度可見、避免漏掉。

---

## 🎯 例外情況

| 情況 | 做法 |
|---|---|
| 點開發現 chat 內容很少 / 沒價值 | **直接刪**，不用提取 |
| 點開發現是私人 / 試用 chat | 直接刪 |
| 不確定 chat 在做什麼 | 提取一份再說，省得後悔 |
| Venus / Venus Secretary | **先不動**——這可能是另一個 project |

---

## 📝 5 個 HKCC 主力 chat 的「啟動 prompt」

合併完成後，**第一個 chat 訊息**貼以下對應的範本。各 chat 只貼一次，之後就有完整脈絡。

### HKCC · Command 啟動 prompt
```
從今天起，這個對話是 HKCardColl 的「總控中心」。

先讀：
- /Users/alvin/collectr/product.md（事實基準）
- /Users/alvin/collectr/brand/voice.md（品牌口吻）
- /Users/alvin/collectr/notes/（所有舊對話的精華）

我會在這裡跟你跨領域協調：哪個 feature 該優先、哪個 marketing 角度切入、code 該不該重構。你的角色是站在 product owner / chief of staff 的視角給建議。

語氣按 voice.md 的「對內溝通」: 精準、可操作。回覆儘量先給結論再給理由。
```

### HKCC · Product 啟動 prompt
```
這個對話專責 HKCardColl 的「產品設計」(UX + UI + Feature)。

先讀：
- /Users/alvin/collectr/product.md
- /Users/alvin/collectr/brand/voice.md
- /Users/alvin/collectr/notes/product_*.md
- /Users/alvin/collectr/MERCHANT_SPEC.md

任務範圍：用戶旅程、wireframe 討論、Figma 連結評論、UI 文案、互動行為、可用性問題、accessibility。

語氣：用 voice.md 規則。不寫程式碼——技術實作丟去 HKCC · Code。
```

### HKCC · Growth 啟動 prompt
```
這個對話專責 HKCardColl 的「Growth」(Marketing + BD + Research)。

先讀：
- /Users/alvin/collectr/product.md
- /Users/alvin/collectr/brand/voice.md
- /Users/alvin/collectr/notes/growth_*.md

任務範圍：waitlist 增長、商戶招募、社群內容（IG / 小紅書 / FB）、競品分析、新聞稿、合作夥伴。

語氣：所有 user-facing 文案必須通過 voice.md 的 6 項 Checklist。
```

### HKCC · Code 啟動 prompt
```
這個對話專責 HKCardColl 的「Engineering」。

先讀：
- /Users/alvin/collectr/product.md（特別注意 §04 技術棧 + §07 測試帳號）
- /Users/alvin/collectr/APP_STORE_CHECKLIST.md
- /Users/alvin/collectr/MERCHANT_SPEC.md
- /Users/alvin/collectr/CODE_REVIEW_*.md
- /Users/alvin/collectr/notes/code_*.md

任務範圍：架構問題、API 設計、Supabase migrations、debugging、performance、security。

⚠️ 真的要動 code 改檔案，請改用 Claude Code（CLI）—— 它能直接 grep / 改檔 / 跑 tests。
這個對話比較適合：規劃、debug、code review、討論方案。
```

### HKCC · Numbers 啟動 prompt
```
這個對話專責 HKCardColl 的「財務 / 投資 / 估值」。

先讀：
- /Users/alvin/collectr/product.md
- /Users/alvin/collectr/notes/numbers_*.md
- /Users/alvin/collectr/Collectr_Grant_Application.docx (舊版，內容仍有效)

任務範圍：BR / 公司會計、seed funding 規劃、估值模型、cap table、unit economics、商戶分成、訂閱定價、政府資助 (Cyberport / HKSTP / TVP)。

語氣：所有對外文件用 voice.md 的「投資人 / 對外 Pitch」規則：標準書面中文、數字有對照基準、引用標來源。
```

---

## 完成後的 sidebar 應該長這樣

```
Pinned (5-6 個)
   ★ HKCardColl · Project Hub  (artifact — 唯一首頁)
   📋 HKCardColl Rebrand Checklist
   🚀 HKCardColl Command Center (rename from Collectr)
   📚 HKCardColl Starter Checklist
   🗂 Chat Migration Tracker

Recents (Pinned 後 5 個主力 chat)
   HKCC · Command (此 chat)
   HKCC · Product
   HKCC · Growth
   HKCC · Code
   HKCC · Numbers

(其他 14 個舊 chat 全部已刪 / 已合併)
```

---

## 預估時間

| 階段 | 時間 |
|---|---|
| 提取 + 驗證 + 刪 1 個 chat | 3-5 分鐘 |
| 14 個 chat 全部處理完 | 約 60-90 分鐘 |
| 新建 5 個 HKCC 主力 chat 並貼啟動 prompt | 約 15 分鐘 |
| **總時間** | **2-2.5 小時**（可分 2-3 天做）|

---

## 詳細進度追蹤

→ 打開 Cowork sidebar 的 **Chat Migration Tracker** artifact，逐個 chat 打勾。
