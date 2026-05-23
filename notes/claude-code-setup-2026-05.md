# Claude Code Setup Guide

> 完整步驟，留檔自用 / onboard 隊友。
> 最後更新：2026-05-16

---

## 為什麼要裝 Claude Code

Cowork chat 適合**討論、規劃、跨領域決策**。Claude Code 才是**真的動 code** 的工具——直接 grep / 改檔 / 跑 tests / git PR。對 HKCardColl 來說，code 工作至少 80% 應該在 Claude Code。

---

## Step 1 · 安裝（5 min）

打開 Mac Terminal：
```bash
npm install -g @anthropic-ai/claude-code
```

驗證：
```bash
claude --version
```

問題排查：
- `permission denied` → `sudo npm install -g @anthropic-ai/claude-code`
- `npm: command not found` → 先裝 Node：https://nodejs.org 下載 LTS 版

---

## Step 2 · 進入專案

```bash
cd /Users/alvin/collectr
pwd  # 確認在 /Users/alvin/collectr
```

---

## Step 3 · 第一次啟動 + 登入（5 min）

```bash
claude
```

1. 第一次會印 URL 讓你瀏覽器登入
2. 用你的 Anthropic 帳號（potodesignstudio@gmail.com）
3. Authorize → 回到 Terminal
4. 它會問是否 trust this directory → **yes**

---

## Step 4 · 跑 /init 生成 CLAUDE.md

在 `>` prompt 輸入：
```
/init
```

它會：
- Grep 整個 codebase
- 讀 package.json / README / tsconfig / app.json
- 寫 `/Users/alvin/collectr/CLAUDE.md`

**Review CLAUDE.md** 確認：
- ✅ 提到 Expo + RN + Supabase
- ✅ 提到 product.md 路徑
- ✅ 提到 Brand = HKCardColl
- ✅ 提到測試帳號（+852 6100 0001-04）

如果有錯：跟它說「加上 X / 改 Y」。

---

## Step 5 · 第一個試水任務

**推薦**：Rebrand Codebase Grep（Rebrand Checklist 上的項目，安全）

```
讀 product.md 和 /legal/ 內所有檔案，理解 brand rename 的背景。

然後 grep 整個 codebase 找所有 "Collectr"、"collectr"、"COLLECTR"（case-insensitive），分類成：

A) User-facing 文字 — 需要改成 HKCardColl
B) 變數名 / 函數名 — 需要 rename
C) 註解 — 可選改
D) 檔名 — 需要 rename
E) Bundle ID / Slug — 保留不改（com.collectr.app）
F) Database / API URL — 視情況

先輸出分類報告，等我確認再執行。
```

Plan mode 會自動跳出。Review 後 approve 才執行。

---

## 4 個必記指令

| 指令 | 用途 |
|---|---|
| `/help` | 列所有指令 |
| `/init` | 生成 / 更新 CLAUDE.md |
| `/clear` | 清空對話脈絡（context 用完就 clear）|
| `/plan` | 進入 plan mode（大任務必用）|

特殊技：**拖檔案進 Terminal** = 把檔案內容貼進對話。

---

## Cowork vs Claude Code 分工

| 場景 | 用 |
|---|---|
| 寫文案、發 IG、做 deck | Cowork (HKCC · Growth) |
| 跑 expo / 修編譯錯誤 | Claude Code |
| 「我這架構該重構嗎？」**討論** | Cowork (HKCC · Code) |
| **執行**重構 | Claude Code |
| Migration、API 設計 spec | Cowork (HKCC · Code) |
| 寫 Supabase migration、跑 db push | Claude Code |

---

## 進階：CLAUDE.md 該長怎樣

`/init` 寫好初版後，建議加上：

```markdown
## Project Context
See /Users/alvin/collectr/product.md for full product context.
See /Users/alvin/collectr/brand/voice.md for any user-facing text.

## Tech
- Expo SDK 54 + RN 0.81 + React 19 + TypeScript
- Supabase (PostgreSQL + Auth + Edge Functions + Storage)
- expo-router 6 (file-based)
- Phone OTP (Twilio) + Apple Sign In
- i18next (zh-TW / zh-CN / en / ja)

## Test Accounts
- Admin: +852 6100 0001 / 111111
- User 2: +852 6100 0002 / 222222
- User 3: +852 6100 0003 / 333333
- Certified Merchant: +852 6100 0004 / 444444

## Brand
- Brand name: HKCardColl (formerly Collectr — deprecated)
- Operator: POTO Creative Tech Limited (BR 80363844)
- Bundle ID: com.collectr.app (KEEP — do not change)
- Display Name: HKCardColl (in Info.plist + strings.xml)
- Voice rules: see /collectr/brand/voice.md

## Common Commands
- `npm run start` — dev server
- `npm run ios` — iOS simulator
- `npm run android` — Android emulator
- `npm run lint` — lint
- `npx tsc --noEmit` — type check
- `supabase db push` — apply migrations
- `eas build --profile production --platform ios` — production build

## Conventions
- All user-facing text must follow voice.md
- All commits in English
- Bug fixes: prefix branch with `fix/`
- New features: prefix branch with `feat/`
```

---

## 跑完之後的 next tasks（HKCardColl 最該動的事）

按 priority：

1. **Rebrand codebase grep & rename**（rebrand checklist 上的事）
2. **Deploy security migration**（APP_STORE_CHECKLIST P0）
3. **Rotate API keys**（APP_STORE_CHECKLIST P0）
4. **接 Sentry**（APP_STORE_CHECKLIST P1）
5. **EAS production build**（APP_STORE_CHECKLIST P1）
6. **Trainer 卡 scraper 跑完**（APP_STORE_CHECKLIST P1）

每個都直接 prompt Claude Code 對應的 instruction（從 APP_STORE_CHECKLIST.md 抄）即可。
