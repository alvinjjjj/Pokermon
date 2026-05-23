# Growth · Lane 1 Foundation（HKCardColl）

> 對話日期：2026-05-17｜對話角色：HKCC · Growth（Marketing + BD + Research）
> Sprint 範圍：4 條 Growth lanes 嘅第 1 條——Foundation。鎖死對外 identity，後續 lane 先唔會 rework。

---

## 核心決策

### Growth 4 條 lane 嘅優先級
1. **Lane 1 · Foundation**（呢輪做完）— handle / domain / email / landing 雛形 / voice template
2. **Lane 2 · 商戶 outreach kit** — cold pitch / demo / A5 / FAQ / SOP（D2–D14 主力）
3. **Lane 3 · Waitlist 增長** — landing 完整文案 / FB 群組帖 / IG reel / email sequence（D5–D14 並行）
4. **Lane 4 · 競品 audit + 媒體** — 比較表 / 新聞稿 / KOL（D7–D14）

依據：GTM 策略「先搶商戶，用商戶帶用戶」（見 `Collectr_市場策略與業務發展.md`），所以 Lane 2 > Lane 3。

### 對外 social handle
- **Primary：`@hkcardcoll`**（IG / 小紅書 / FB / TikTok / X / YouTube / LinkedIn / GitHub 統一）
- Fallback 1：`@hkcardcollapp` · Fallback 2：`@hkcardcoll_hk`
- **未鎖死前唔印 A5 卡、唔出新聞稿**
- 詳見 `/Users/alvin/collectr/growth/lane1_foundation/handle.md`

### Email / Domain 架構（recommended）
- DNS：將 nameserver 由 HKDNR 改去 **Cloudflare**（免費，完整 record type）
- Email：**Zoho Mail Free**（5 mailbox 免費，sends as `hkcardcoll.hk`，有 DKIM）
- Hosting：**Cloudflare Pages**（同 vendor，免費）
- 配 Gmail「Send as」flow 集中 inbox
- 詳見 `/Users/alvin/collectr/growth/lane1_foundation/email_domain_sop.md`

### Landing 雛形已建
- 單頁 HTML，apply Brand Book Vol.01 視覺（Card Orange #FF6A1F 只用一次喺 CTA button）
- Sections：Hero + Waitlist form + 4 Pillars + Why + Merchant pitch + 7-q FAQ + Footer
- Form action 留 `REPLACE_FORMSPREE_ID` placeholder
- 文案跑完 voice.md 6 項 Checklist（見下方待決）
- 路徑：`/Users/alvin/collectr/growth/landing/index.html`

### Voice Prompt Template 已壓縮
- 將 voice.md 三大原則 + 6 項 Checklist 包成可 paste BLOCK A（寫之前）+ BLOCK B（寫之後自查）+ BLOCK C（5 個場景速查）
- 路徑：`/Users/alvin/collectr/growth/lane1_foundation/voice_prompt_template.md`
- **任何新 Growth 對話建議第一句 paste BLOCK A**

---

## 待解問題

### 必須 owner 決定（block 後續 lane）
- [ ] `@hkcardcoll` 三大平台（IG / 小紅書 / TikTok）availability 未實際 reserve
- [ ] 小紅書帳號註冊需要 HK 手機 + 大陸 IP，邊個 owner？
- [ ] FB Group public vs private（建議 public + 入群審核）
- [ ] Founding merchant deadline：2026-05-30（14 日）vs 2026-06-15（30 日）—— landing copy 用咗 5/30
- [ ] Formspree free（50/月）vs Google Form embed（unlimited）vs Cloudflare Worker self-host
- [ ] Privacy Policy + Terms 由邊度 host（Notion 過渡 vs hkcardcoll.hk/privacy）

### 跨對話依賴
- [ ] HKDNR 帳號驗證進度（owner 親自做，唔涉 Claude）
- [ ] `fx_rates` 表接真匯率 API 進度（Code chat / Claude Code）— 否則 landing「自動換算 HKD」係 over-promise
- [ ] Sightengine 環境變數確認 set（Code chat）— 否則 UGC 自動審核通過
- [ ] App Store Marketing URL 改成 hkcardcoll.hk（Code chat）

---

## 有用的事實 / 數據

### Lane 1 deliverables summary
| 檔案 | 行數 | 用途 |
|---|---|---|
| `growth/lane1_foundation/handle.md` | ~180 | Handle 推薦 + 11 平台 reservation checklist + bio template + profile 規格 |
| `growth/lane1_foundation/email_domain_sop.md` | ~250 | HKDNR → Cloudflare → Zoho 8-step SOP + Gmail signature 過渡 template |
| `growth/landing/index.html` | ~370 | Waitlist landing 雛形（single file, Brand Book 視覺一致）|
| `growth/lane1_foundation/voice_prompt_template.md` | ~200 | 3 個 paste block（BLOCK A 寫 + B 自查 + C 場景速查）|

### Brand Voice apply summary
- 全部 landing 文案跑過 voice.md 6 項 Checklist
- 3 處 inline 修正：「大多數」→「不少」（出處）、Pillar 02 加付費 disclaimer、FAQ Q6「資深」改具體事實
- 3 處 flag 待 owner / 後端決定（merchant deadline、fx_rates、FAQ Q2 trim）

### 風險 / over-promise 點
- `fx_rates` hardcoded（HKD 7.8、JPY 155）— landing 寫「自動換算 HKD」嚴格嚟講未對齊。Code chat 接真 API 後 OK
- 「全港首個 JP + EN 同步定價平台」係 strong claim — 未做正式競品 audit（Lane 4 任務）

---

## 行動項目

### Lane 2 起步前必須完成（owner-side）
- [ ] handle.md §03 嘅 reservation checklist 跑完，至少 IG / 小紅書 / FB / TikTok 鎖死
- [ ] email_domain_sop.md Step 1–4 完成（Zoho mailbox + DNS）
- [ ] HKDNR 帳號驗證
- [ ] product.md · 01 Identity section 補返 social handle URL

### 開 Lane 2 時直接用嘅資產
- A5 介紹卡 QR 指向：landing page 嘅 `#merchants` anchor（已預留）
- Cold pitch email：用 Gmail signature template（過渡版 → 完成版）
- Demo 流程：5 分鐘 in-person，從 landing → app onboarding 三屏

### 開 Lane 3 / Lane 4 預備
- [ ] Lane 3：landing 文案已就緒，FB 群組「搵意見」帖、IG reel 腳本未做
- [ ] Lane 4：競品 audit 表未做（會 inform「全港首個」claim 強化或修正）

---

## 相關檔案

### 本 lane 產出（新建）
```
/Users/alvin/collectr/growth/
├── lane1_foundation/
│   ├── handle.md
│   ├── email_domain_sop.md
│   └── voice_prompt_template.md
├── landing/
│   └── index.html
└── artifacts/
    └── command-center.html   # registered as Cowork artifact: hkcc-growth-command
```

### Live Cowork artifacts（Growth 對話相關）
- **hkcc-growth-command** — Growth 專用作戰中心（KPI / Lane 進度 / 商戶 Kanban / 內容曆 / 每日 log / Quick Actions）
- **hkcardcoll-project-hub** — 跨領域中央首頁（已存在，由其他對話建）

---

## Lane 1.5 · App Store Copy v02（2026-05-17 補做）

### 起源
User 喺對話中段問「App Store 文案套裝做咗冇」，發現 collectr/ 入面已有 2 個 conflict 嘅版本：
- `brand/app_store_copy_v01.md`（4 語言齊，較新）
- `app-store/description.md`（2 語言，但有 screenshot / reviewer / privacy / pre-flight）

### Merge 成果
`brand/app_store_copy_v02.md` = primary version going forward。
舊兩個檔案頂部已加 `⛔ DEPRECATED` banner，留歷史 reference。

### Lock 嘅 5 條決定（轉告 Command chat）
| 項目 | 決定 | 影響 |
|---|---|---|
| Subtitle (zh-HK) | `香港藏家的索引 · JP+EN 即時定價` | 4 語言全部對齊 brand-tagline-first |
| Primary Category | Lifestyle | App Store discoverability |
| Secondary Category | Shopping | — |
| Age Rating | 12+（Mild/Infrequent Simulated Gambling）| Apple Review 唔會推回 |
| Founding Merchant Deadline | 2026-05-30 | 同 landing + promo text 一致；今日 +13 日 |
| Description 結尾 | Manifesto 4 句 + Nintendo IP disclaimer（兩個 both）| Legal CYA + brand voice |

### v02 vs v01 / description.md 嘅 net additions
- Subtitle 4 語言全部更新做 tagline-first 風格
- 6 張 screenshot hero copy × 4 語言 = 24 條（v01 標 P0 未寫 → 補齊）
- 4 個 description 結尾全部加 Nintendo IP disclaimer（描述.md 只有英版有）
- Reviewer Notes / Privacy Questionnaire / Pre-Flight Checklist 全部搬入 v02
- Decision Log 明確標出每個 locked 決定嘅日期 + 出處

### 建議 Command chat / Numbers chat update 嘅地方
- **product.md · 01 Identity** 補：App Store Category Primary/Secondary、Age Rating
- **product.md · 06 Current State** 補：App Store copy v02 ✓ 2026-05-17
- **product.md · 09 對話分工**：增加「App Store metadata 由 HKCC · Growth 主導，content 由 Code chat 同步入 `app.json`」
- **PROD 同 Numbers chat**：認證商戶 0 commission 截止 2026-05-30，後續續用 14 日 founding window

### v02 剩 6 條 open question（已寫入 v02 §10）
- Privacy Policy 內容 + host URL（Command chat）
- Terms of Service 內容 + host URL（Command chat）
- `hello@hkcardcoll.hk` 啟用時間（Lane 1 SOP）
- App icon 最終版（Product / Design chat）
- 6 張 screenshot 實際 app 內容版本（Product chat）
- Twilio production test phones（Code chat）

---

## Lane 1.6 · Business Deck v03 / Merchant Pitch v02（2026-05-17 補做）

### 起源
User 講 "把更新予的 business presentation, deck 中文 英文，我讓 Design 做"。

### Deliverables（4 個新 pptx + 1 hand-off note）
| File | Slides | Audience |
|---|---|---|
| `decks/HKCardColl_Company_Overview_v03_zh.pptx` | 10 | 商戶 / 媒體 / 投資人（zh-HK）|
| `decks/HKCardColl_Company_Overview_v03_en.pptx` | 10 | 同上，英文 |
| `decks/HKCardColl_Merchant_Pitch_v02_zh.pptx` | 8 | HK 卡店老闆（zh-HK），Lane 2 用 |
| `decks/HKCardColl_Merchant_Pitch_v02_en.pptx` | 8 | 同上，英文 |
| `decks/_HANDOFF_FOR_DESIGN.md` | — | Design brief，覆蓋範圍、brand hard requirements、可重塑嘅嘢、source of truth |

### Deck 內容對齊
- Apply v02 鎖嘅 subtitle / Category / Age / Founding deadline 2026-05-30
- 結尾用 Manifesto 4 句（取代舊 Collectr 嘅 "More than a hobby" tagline）
- 加 Traction & Roadmap slide（Company Overview v03 新增）
- 加 ROI · Year 1 calculation slide（Merchant Pitch v02 新增）
- HK$ 大數字 dynamic font sizer 防止 overflow
- 全部 voice.md 6 項 Checklist pass，zh ↔ en 數據對齊

### 4 個舊 deck 處理（rename 加 _DEPRECATED 後綴，唔 delete）
```
/Users/alvin/collectr/Collectr_Investor_Deck_DEPRECATED.pptx
/Users/alvin/collectr/Collectr_Company_Overview_DEPRECATED.pptx
/Users/alvin/collectr/decks/HKCardColl_Company_Overview_Vol02_DEPRECATED.pptx
/Users/alvin/collectr/decks/HKCardColl_Merchant_Pitch_DEPRECATED.pptx
```

### 視覺 QA
跑 36 張 slide 兩輪 subagent 檢查。最終：0 個 overflow / 0 個 overlap / 0 個 CJK 字 fallback / 0 個 zh-en mismatch。

### Cross-chat 後續
- Design chat（未 spawn）：拎 4 個 active pptx + `_HANDOFF_FOR_DESIGN.md` 重做視覺；保留 copy / brand color / Manifesto 不變
- Numbers chat：deck 入面 ROI 假設（每月 20 張 × HK$500 × 5%）係 Growth 寫，可能要 Numbers chat verify 用商戶實際數據

### 未做
- Investor Pitch Deck v01（重寫舊 Collectr_Investor_Deck）— **唔喺今次 scope**，等 fundraising 時序 align Numbers chat 再做

### 引用嘅 source of truth
- `/Users/alvin/collectr/product.md` — 整個 project 事實基準（v1，2026-05-16）
- `/Users/alvin/collectr/brand/voice.md` — Voice 規範（v1，2026-05-16）

### Cross-chat dependency
- **Claude Code / HKCC · Code**：i18n 文案 commit、edit-profile、API key、Sentry、EAS、Marketing URL、`fx_rates` 接真 API、Sightengine env 確認
- **HKCC · Command**：IG handle 最終決定、認證商戶定價 lock、商標申請、Privacy Policy hosting
- **HKCC · Numbers**：Pitch deck 收入模型、合約條款
- **HKCC · Product**：Onboarding 三屏文案 i18n key、App 內 Settings → About handle 更新

---

## 廢棄資訊

（本 lane 冇任何 deprecation。但記低之前 note 嘅幾條 stale 資料，供 cross-chat 對齊）

- ~~舊 tagline「收藏不只是興趣——它是文化，是社群，也是資產。」~~ → 已棄用，現用 product.md「香港藏家的索引」
- ~~舊 IG handle 建議 `@collectrhk`~~ → 已棄用（rebrand），現推 `@hkcardcoll`
- ~~舊商戶定價 HK$299–499/月~~ → 已棄用，現 product.md 鎖 HK$3,000/年 + founding 0 fee

---

*最後更新：2026-05-17*
