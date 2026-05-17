# CLAUDE.md

> 給 Claude Code / 任何 AI agent 嘅 onboarding。任何 session 開頭先讀呢份。
> 最後更新：2026-05-17

---

## 0 · 一句話

HKCardColl 嘅 Expo / React Native app。前身叫 Collectr，2026-05-16 已 rebrand。呢個 repo 係 mobile client，後端用 Supabase。

---

## 1 · Brand & Operator

| Field | Value |
|---|---|
| Brand | **HKCardColl**（中文標語：香港藏家的索引）|
| 前身 | Collectr.（已 deprecated 2026-05-16）|
| 法人 | POTO Creative Tech Limited · 寶圖創意科技有限公司 |
| BR No. | 80363844 |
| 註冊地 | Hong Kong |
| Domain | hkcardcoll.hk（已註冊，HKDNR 帳號待驗證）|
| 聯絡 email | hello@hkcardcoll.hk（過渡期：potodesignstudio@gmail.com）|
| App Store name | HKCardColl |
| **Bundle ID** | `com.collectr.app` — **保留不換**（避免 TestFlight 用戶遺失）|
| Scheme | `collectr://`（現用）→ 計劃改 `hkcardcoll://` |
| EAS Project ID | `eab0d040-923e-4705-bff8-1b77c06118a9` |

⚠ rebrand 未完。`app.json` 仲係 `"name": "collectr"`、`"scheme": "collectr"`、未設 `ios.bundleIdentifier`。改 display name → `HKCardColl`、設 bundle ID → `com.collectr.app` 係 release 前必做。

---

## 2 · Tech Stack（現狀 vs 目標）

### 已落地（呢個 branch 真係 import 到）
| 類別 | 用咩 |
|---|---|
| Framework | Expo SDK ~54 + React Native 0.81 + React 19 |
| Language | TypeScript 5.9（`tsconfig.json` strict 開）|
| Routing | `expo-router` 6（file-based，路由喺 `app/`）|
| Auth UI | Supabase email/password + Google OAuth via `expo-web-browser` |
| Storage | `@react-native-async-storage/async-storage`（session persistence）|
| Charts | `react-native-svg`（手寫 SVG path，未用 charting lib）|
| Icons | `@expo/vector-icons` + 自家 PNG（`assets/icons/`，繁中檔名）|
| Image | `expo-image` + `expo-image-picker` |
| Secrets | `.env`（git-ignored）→ `EXPO_PUBLIC_SUPABASE_*` inline 落 bundle；server-only key 喺 Supabase edge function 內讀 `Deno.env.get(...)` |
| Edge functions | `supabase/functions/pokemontcg-proxy/` proxies api.pokemontcg.io；client 透過 `supabase.functions.invoke('pokemontcg-proxy', ...)`（helper：[lib/pokemontcg.ts](lib/pokemontcg.ts)）|
| Linting | `expo lint`（flat config，extends `eslint-config-expo/flat`）|
| Build | Expo prebuild flow，**未有 `eas.json`** |

### `product.md` 講有、但呢個 branch **未落地**（避免假設）
- Phone OTP（Twilio）— `signInWithOtp` 未 import；現有 login 走 email/password
- Apple Sign In — UI button 係 placeholder，未接 `signInWithIdToken`
- i18n（zh-TW / zh-CN / en / ja）— 冇 `locales/`、冇 `i18next`
- React Context state 層 — 冇 `contexts/`
- Supabase migrations / Edge Functions — 冇 `supabase/` 目錄
- `react-native-gifted-charts` / `react-native-reanimated` 4 / Lottie — 冇 install
- `pokemontcgsdk` 寫咗喺 `package.json` 但冇 file 真正 import
- Sentry / analytics — 冇

→ 寫新 feature 前先確認屬「已落地」定「目標」。如果係目標 stack，要顯式 install 同 wire up，唔好假設已存在。

---

## 3 · Repo Layout

```
.
├── app/                       # expo-router 路由
│   ├── _layout.tsx            # root stack；管 session redirect
│   ├── index.tsx              # → redirect /onboarding
│   ├── onboarding.tsx
│   ├── login.tsx              # email/password + Google OAuth
│   ├── register.tsx
│   ├── new-post.tsx
│   └── (tabs)/                # 6 個底部 tab
│       ├── _layout.tsx        # 底部 tab 設定（橙 #FF6900）
│       ├── index.tsx          # 主頁（市場 + creators）
│       ├── search.tsx
│       ├── shops.tsx
│       ├── social.tsx
│       ├── portfolio.tsx      # 作品集
│       ├── profile.tsx        # 個人
│       ├── notifications.tsx  # hidden（href: null）
│       └── settings.tsx       # hidden
├── components/                # 共用 UI（目前只剩 Header.tsx；其餘 Expo template 檔案已刪）
├── constants/theme.ts         # Colors + Fonts（template default；未對齊 brand book）
├── hooks/                     # use-color-scheme.* + use-theme-color.ts
├── lib/
│   ├── supabase.ts            # Supabase client；讀 EXPO_PUBLIC_SUPABASE_* env
│   └── pokemontcg.ts          # searchCards / getCard helpers（call pokemontcg-proxy edge fn）
├── supabase/
│   ├── config.toml            # supabase CLI 設定（project_id + verify_jwt）
│   └── functions/
│       ├── _shared/cors.ts
│       └── pokemontcg-proxy/index.ts  # 代理 api.pokemontcg.io，secret 喺 Deno.env
├── scripts/reset-project.js   # Expo template 嘅 reset 腳本，可刪
├── assets/                    # icons（繁中檔名）+ images
├── app.json                   # Expo config（仲係 collectr scheme/name；rebrand TODO）
├── .env                       # git-ignored；本地 EXPO_PUBLIC_SUPABASE_* 值
├── .env.example               # commit；空 template
└── package.json
```

呢個 branch 處於「砌返六個 tab + auth flow」階段（見 commit `1753c24`）。仲未有 contexts / locales / supabase 目錄。

---

## 4 · Common Commands

```bash
# Dev
npm install
npm run start         # expo start（QR / dev menu）
npm run ios           # expo start --ios（要 Xcode + Simulator）
npm run android       # expo start --android
npm run web           # expo start --web

# Quality
npm run lint          # expo lint（ESLint flat config）
npx tsc --noEmit      # type-check（**冇 npm script**，要直接行）

# Reset（一次性，慎用）
npm run reset-project # 將 app/ components/ hooks/ ... 搬去 app-example/
```

### 目標 commands（環境未 set up，**未用住**）
```bash
# Supabase CLI — 要先 brew install supabase/tap/supabase + supabase init
supabase db push
supabase functions deploy <name>

# EAS — 要先建 eas.json + eas login
eas build --profile production --platform ios
eas submit --platform ios
```

→ 第一次行呢類 command 之前要 set up 對應 toolchain，唔係 plug-and-play。

---

## 5 · Auth & 測試帳號

### 現實
- `lib/supabase.ts` 用 hardcoded URL + anon key
- `app/_layout.tsx` 用 `supabase.auth.getSession()` + `onAuthStateChange` 做 redirect gating（冇 session → `/onboarding`；有 session → `/(tabs)`）
- `app/login.tsx` 行 `signInWithPassword`（email/password）同 `signInWithOAuth('google')`
- Apple button 係 dead UI，未 wire `signInWithIdToken`

### 目標測試帳號（**Phone OTP 未實作，呢啲帳號喺呢個 branch 暫時用唔到**）
| Role | Phone | OTP |
|---|---|---|
| Admin | +852 6100 0001 | 111111 |
| User 2 | +852 6100 0002 | 222222 |
| User 3 | +852 6100 0003 | 333333 |
| Certified Merchant | +852 6100 0004 | 444444 |

→ Apple reviewer notes（見 `/Users/alvin/collectr/app-store/description.md`）會引用呢組帳號。提交 App Store 前必須將 login 改為 phone OTP 並喺 Supabase 設定 Twilio test credentials。

---

## 6 · Brand Voice（所有 user-facing 文字必須遵守）

任何寫入 UI、push、email、社群 caption 嘅文字，**先讀** `/Users/alvin/collectr/brand/voice.md` 再寫。

三大原則：
1. **Precise 精準** — 可以加數字 / 版本 / 日期就加。「PSA 10 +12% 過去 30 日」優於「升咗好多」。
2. **Local 本地** — 港式中文 + 英文 jargon 混雜（listing、portfolio、grade、JP、EN）。日常 user-facing 用港式；正式文件（Privacy、Terms、investor deck）用書面中文。
3. **Calm 克制** — 唔用「驚喜 / 爆升 / 必入 / 起飛」；唔用 🎉🔥💥🚀✨；utility emoji（✓ ⚠）OK。

寫完任何 user-facing 文字，逐項自查 voice.md §04 嘅 checklist。

---

## 7 · 外部 reference（呢個 repo 外面，但任何 task 都可能要睇）

呢啲文件**唔喺 git tracking 內**，住喺 `/Users/alvin/collectr/`（即係呢個 worktree 嘅 parent）：

| Path | 用途 |
|---|---|
| `/Users/alvin/collectr/product.md` | **事實基準**。Identity / 四大支柱 / target users / 進度。新 task 開頭先讀。 |
| `/Users/alvin/collectr/brand/voice.md` | Brand Voice 完整規範（§6 講過）|
| `/Users/alvin/collectr/legal/privacy-policy.md` | HK PDPO 隱私政策 v1.1（待 hkcardcoll.hk host）|
| `/Users/alvin/collectr/legal/terms-of-service.md` | 服務條款 v1.1 |
| `/Users/alvin/collectr/app-store/description.md` | App Store listing 文案（中英）+ reviewer notes |
| `/Users/alvin/collectr/notes/_README.md` | 對話精華區索引 |
| `/Users/alvin/collectr/notes/chat-migration-sop.md` | Cowork chat 遷移 SOP |
| `/Users/alvin/collectr/notes/HKCARDCOLL-UI-Code-Review.md` | UI code review |
| `/Users/alvin/collectr/notes/security-review-and-auth-overhaul.md` | Auth 安全審查 |
| `/Users/alvin/collectr/notes/Bug修復-Production-Readiness提升.md` | Production readiness |
| `/Users/alvin/collectr/notes/PM代碼審查-App Store提交準備.md` | App Store 提交前 PM 審查 |
| `/Users/alvin/collectr/notes/claude-code-setup-2026-05.md` | Claude Code workflow 設定 |
| `/Users/alvin/collectr/notes/公司註冊-基金申請-Apple開發者.md` | 公司 / Apple Dev / 基金申請 |
| `/Users/alvin/collectr/notes/Collectr-Data-Manager-審查紀錄.md` | 資料層審查 |
| `/Users/alvin/collectr/notes/Collectr_市場策略與業務發展.md` | 市場 + BD |
| `/Users/alvin/collectr/notes/BD分析與優化回顧_2026-05.md` | BD review |
| `/Users/alvin/collectr/notes/Cowork最大化使用_Collectr工作流程+代碼審查.md` | Workflow |
| `/Users/alvin/collectr/notes/Pokemon卡盒價格表-與-Collectr-App-Code-Review.md` | 卡盒價格 + code review |

→ 因為呢啲檔案唔係 git tracked，唔同 branch / 唔同 worktree 都會見到相同內容（係 working tree 入面）。

---

## 8 · 已知問題（rebrand 同 release 前要清）

⚠ **Secrets / deploy 狀態**
- `pokemontcg-proxy` edge function **已 deploy**（v1，2026-05-17 07:24 UTC）。`POKEMONTCG_API_KEY` secret 設咗喺 Supabase。Dashboard：https://supabase.com/dashboard/project/vudqydqzrlgetcdegfvc/functions
- EAS production build 要喺 expo.dev project secrets 設 `EXPO_PUBLIC_SUPABASE_URL` 同 `EXPO_PUBLIC_SUPABASE_ANON_KEY`（本地 `.env` 唔會 build 入 EAS image）。

ℹ️ **pokemontcg.io API key — 重要 finding（2026-05-17）**
- 舊 leaked key `b58e91e7-d37e-48af-a472-09f364116acd` 寫死過喺 client，仍然喺 git history。
- 但 `api.pokemontcg.io/v2` **唔做 key authentication**：empty header / garbage key / 有效 key 全部返 200 + JSON。實測 4 個 case 全 pass。
- 即係：**leaked key 嘅實際曝光值近乎零**（攻擊者根本唔需要 key 就攞到 data）；revoke 操作對呢個 API **structurally impossible**。
- Edge function proxy 仍然保留有價值（key 唔入 bundle、集中加 cache / rate limit 嘅 hook、將來升 paid tier 嗰陣安全持 secret），但**唔好誤導性咁標榜為「access control」**。
- 未來如果要做真嘅 access control（譬如限 quota 唔俾 abuse），要喺 edge function 入面加 per-user rate limit，唔好靠 upstream API。

⚠ **Rebrand 未完成**（`product.md` §04）
- `app.json` 嘅 `name` / `slug` / `scheme` 仲係 `collectr`。Display name 要改 `HKCardColl`；scheme 要改 `hkcardcoll://`；ios.bundleIdentifier 要明確設 `com.collectr.app`。
- `lib/supabase.ts` OAuth redirect 同 `app/login.tsx` 嘅 `WebBrowser.openAuthSessionAsync` 仲用 `collectr://`，改 scheme 時要一齊改。
- Brand 主色：voice / brand book 講 `#FF6A1F`，code 用緊 `#FF6900`（`app/(tabs)/_layout.tsx`、Header、login）。對齊邊個係正典之後 unify。

⚠ **產品/法務**
- Privacy Policy + Terms 要 host 到公網 URL（過渡期 Notion / GitHub Pages）
- Phone OTP（Twilio test credentials）未接，但 App Store reviewer notes 已假設可用

詳細 release checklist 見 `/Users/alvin/collectr/APP_STORE_CHECKLIST.md`（如有）。

---

## 9 · 寫 code 嘅 ground rules

- **唔好假設 stack 已存在** — 寫 import 前用 Grep / Read 確認個 lib 真係 install 同有 file 用緊。
- **改 user-facing 文字一定套 voice.md** — 唔知就 ask，唔好擅自加 emoji / hype。
- **資料源命名** — JP / EN 永遠講明邊個（產品差異化核心係 JP+EN 同步定價）；HKD 係預設展示幣，但 raw price 要保留原幣。
- **App Store reviewer 路徑** — 任何影響 login flow 嘅 PR 要記得 update reviewer test account（見 §5）。
- **Bundle ID 凍結** — `com.collectr.app` 任何情況唔改。改咗 TestFlight 用戶會走晒。
- **commit message 風格** — 睇返 `git log`；目前用短英文（例 `Add search, portfolio, auth, notifications, settings`）。

---

## 10 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | 初版建立。基於 worktree 現狀 + `/Users/alvin/collectr/product.md` 整合 |
| 2026-05-17 | 加 §2 / §3 / §8 之 edge function + .env 落地紀錄。Finding：pokemontcg.io API 唔做 key auth → revoke 操作 unsolvable，§8 reflect。 |
