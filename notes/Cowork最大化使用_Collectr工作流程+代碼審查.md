# Cowork 最大化使用 × Collectr 工作流程 + 代碼審查

## 核心決策

- **公司架構**：Collectr 是一人公司，用 Claude Projects 模擬 11 個部門（Product、Data、Coding、Business Development、Funds & Flows、UI Design、UX Professional、Security、Finance、Marketing、Research）
- **跨 Project 記憶解決方案**：建立 `company_brain.md` 中央文件存放於 `/Users/alvin/collectr/`，每次新對話開始時讀取，避免上下文遺失
- **Projects 精簡建議**：把 11 個部門合併成 3 個 Claude Projects：
  - **Build** — Product + Coding + UI/UX
  - **Grow** — Marketing + BD + Research
  - **Ops** — Finance + Funds + Security + Data
- **虛擬董事會**：在單一對話裡讓 Claude 扮演多部門角色分析問題，目前用手動方式（免費），未來用 Anthropic API 自動化
- **Anthropic API Key**：用戶正在申請（Apple 登入以外的方式），申請後可建立真正的多 agent 自動化腳本
- **MVP 優先功能**：Portfolio 估值 MVP — 讓用戶加入卡牌並看到 HKD 總值（3 步完成、設計要好看到值得截圖分享）

---

## 待解問題

- Anthropic API Key 申請中，完成後需要建立多 agent 腳本
- `company_brain.md` 尚未正式建立和填寫內容
- Coding Project 的 tech stack 細節未確認（後端用什麼？開發進度到哪？）
- Venus Figma Kit 的具體 Figma 連結未提供（UI/UX Project 需要）
- 各 Project 的 System Prompt / Instructions 尚未全部寫好

---

## 有用的事實 / 數據

**Collectr 一句話定義：**
香港首個 Pokemon TCG 卡牌收藏管理 × 買賣市場 × 社群平台

**三類核心用戶：**
- 收藏者 — 知道自己的卡值多少、追蹤升跌
- 散賣者 — 安全、方便地賣閒置卡
- 認證商戶 — 有公信力的數碼店面接觸更多買家

**四大核心功能：**
1. Portfolio 估值（記錄收藏，實時 HKD 總值）
2. 市場定價（JP + EN，自動換算 HKD，歷史圖表）
3. 買賣市場（認證商戶 + 個人賣家，BR 核驗）
4. 社群動態（分享收藏、跟隨玩家）

**Tech Stack（已確認）：**
- Framework: Expo React Native（expo-router）
- Backend: Supabase
- 語言支援: 繁中、簡中、英、日（i18n 已做）
- 外部 API: pokemontcg.io、artofpkm（JP 圖片）
- 圖表: react-native-gifted-charts
- 主色: `#FF6900`（橙）、`#101828`（深黑）

**重要文件路徑：**
- App 根目錄: `/Users/alvin/collectr/`
- 主題設定: `/Users/alvin/collectr/constants/theme.ts`
- Tab 導覽: `/Users/alvin/collectr/app/(tabs)/_layout.tsx`
- Portfolio 頁: `/Users/alvin/collectr/app/(tabs)/portfolio.tsx`
- Supabase client: `/Users/alvin/collectr/lib/supabase.ts`
- i18n: `/Users/alvin/collectr/locales/`（zh-HK, zh-CN, en, ja）

**API Key 申請：** console.anthropic.com

---

## 行動項目

- [ ] 完成 Anthropic API Key 申請
- [ ] 建立 `company_brain.md` 並填入 Collectr 核心資訊
- [ ] 為 Coding Project 寫好 System Prompt（已有草稿，需補充 tech stack）
- [ ] 提供 Venus Figma Kit 連結，讓 UI/UX Project 可以讀取並 review
- [ ] 為 UI/UX Project 寫好 System Prompt（已有草稿）
- [ ] 修復 `theme.ts`：把 `#FF6900`、`#101828` 等實際用色加入 design token
- [ ] 重構 `portfolio.tsx`：拆分成小組件（數據邏輯、圖片解析、Modal 各自獨立）
- [ ] 優化 Portfolio fetchCards 性能：加入 cache 避免每次 focus 都重新打 API

---

## 代碼審查發現的問題

**🔴 緊急**
1. **性能**：`portfolio.tsx` 每次 tab focus 都重新呼叫 3 個外部 API（JP images、pokemontcg by ID、pokemontcg by name），用戶有 50 張卡時體驗會很慢
2. **Design System 脫節**：`theme.ts` 仍是 Expo 預設藍色（`#0a7ea4`），但 app 實際用橙色系，完全沒有統一的 design token

**🟡 中等**
3. **Inline styles 過多**：每個 screen 有幾百行 hardcode 顏色，改 primary color 要改幾十個地方
4. **`portfolio.tsx` 過大**：1000+ 行，數據邏輯、3 個 Modal、圖片解析全部混在一起

**🟢 做得好的地方**
- i18n 完整（4 語言）
- Supabase 整合乾淨
- 樂觀更新（optimistic update）邏輯正確

---

## 廢棄資訊

- ~~用多個 Claude Project 模擬部門讓各部門「自動交談」~~ — 不可行，Claude Projects 之間無法程式化互通，需要 API Key 才能實現
- ~~Claude 可以直接讀取其他 Project 的對話~~ — 不可行，每個 Project 完全獨立
- ~~11 個平行部門各自維護~~ — 建議精簡成 3 個 Projects

---

## 相關檔案

- `/Users/alvin/collectr/app/(tabs)/portfolio.tsx` — 已審查，1000+ 行，需重構
- `/Users/alvin/collectr/app/(tabs)/_layout.tsx` — Tab 導覽，5 個主 tab
- `/Users/alvin/collectr/constants/theme.ts` — Design token，需更新實際用色
- `/Users/alvin/collectr/lib/supabase.ts` — Supabase client
- `/Users/alvin/collectr/package.json` — 依賴清單
- `/Users/alvin/collectr/notes/Cowork最大化使用_Collectr工作流程+代碼審查.md` — 本文件
