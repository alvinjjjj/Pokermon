# HKCardColl · UI Audit & 改善 Opportunities · v01

> **目的:** 將現有 codebase 嘅 UI 狀態做盤點,俾另一個 Claude design chat 提改善建議。
> **重要:** 呢份文唔係 UI rewrite spec。Design chat **絕對唔可以**從零重畫 — 只可以針對現有檔案、現有 component、現有 layout 改 colors / spacing / voice / pattern。
> **Audit date:** 2026-05-23
> **Brand reference:** `brand/brand_book_addendum_v01.md`(v01.1)、`brand/voice.md`、`MERCHANT_SPEC.md`

---

## 0 · How to use this document

1. **設計師先讀 brand_book_addendum_v01.md** — 知道 brand book 嘅顏色 token、voice rule、warning pattern 規矩。
2. **再讀 Section 3 Screen Inventory** — 知道每一個 screen 現時做緊乜、用緊咩 colors。
3. **Section 5 Top 10 Quick Wins** — 30 分鐘 - 4 小時可以做完嘅 改色 + token migration。
4. **Section 6 Larger Refactors** — 要新 component 或者多 file 改動嘅 work。
5. **絕對唔做:** 重畫 screen layout、加新 page、改 navigation 結構、換 framework。

---

## 1 · Tech Stack & Architecture

| 項 | 狀態 |
|---|---|
| Framework | React Native + Expo Router(file-based routing)|
| Language | TypeScript(`.tsx`)|
| Styling | React Native `StyleSheet`(inline hex,**冇 design tokens 檔案**)|
| i18n | `react-i18next`,4 lang(zh-HK / zh-CN / en / ja)|
| Currency | HKD / USD / JPY / CNY(via CurrencyContext)|
| Theme | **Light only — 冇 dark mode 實作**(brand book B 章未上 code)|

**架構痛點:**
- 冇 centralised token system(`theme/tokens.ts` 失蹤)
- Colors 散喺 35 個 screen + 5 個 component,全部 hardcoded hex
- 冇 named constant(冇 `const ORANGE = '#FF6A1F'`,直接 `'#FF6900'`)
- Per-file `StyleSheet.create()`,無 reuse
- 冇 design system 或 component library

---

## 2 · Color Palette 現時實際 in use

| Hex | Count | 用途 | Brand match? |
|---|---|---|---|
| `#FF6900` | 97+ | Primary CTA、active tab、badge、accent | ⚠ 接近但**唔等於** spec `#FF6A1F` |
| `#FFF3E8` | 15+ | Warning bg、preview box、seller entry | ⚠ 應該係 `#FFF1E5`(差 1 hex digit)|
| `#fff` / `#ffffff` | 40+ | Card bg、modal | ✓ |
| `#F9FAFB` | 25+ | Grid bg、section divider | ~ 中性灰可接受 |
| `#101828` | 30+ | Primary text | ⚠ 接近但唔等於 brand Ink `#1A1814` |
| `#6B7280` | 20+ | Secondary text、placeholder | ✓ |
| `#9CA3AF` | 20+ | Tertiary text、disabled | ✓ |
| `#E5E7EB` | 15+ | Border、divider | ✓ |
| `#00A63E` | 8 | Success state、Up %、LIVE badge | ✗ **唔喺 palette**(brand 用 Sage Strong `#4A7558`)|
| `#E7000B` | 5 | Danger / Down % | ✗ **唔喺 palette**(brand 用 Brick `#C2553D`)|
| `#F3F4F6` | 8 | Placeholder bg | ✓ |
| `#3B82F6` | 3 | Rarity tag、PSA 9 condition tag | ✗ iOS blue,**唔喺 palette** |
| `#F59E0B` | 3 | PSA 10 condition tag | ✗ Tailwind amber,**唔喺 palette** |
| `#FFF3EB` | 1 | Header dropdown active item | ⚠ 差 1 hex(Header.tsx)|
| `#000000` | 2 | Splash bg、overlay | ✓ |
| `rgba(0,0,0,0.x)` | 10+ | Video / overlay badge | ✓ |

**Brand 對齊度:**
- ✓ Card Orange consistent 用做 primary accent
- ✗ 完全冇用 brand functional colors(Sage Strong、Brick、Slate)
- ✗ 3 個唔喺 palette 嘅顏色:`#3B82F6`、`#F59E0B`、`#00A63E`、`#E7000B`
- ✗ Card Orange 本身有 1 hex digit drift(`#FF6900` vs `#FF6A1F`)
- ✗ Ink 有 drift(`#101828` vs `#1A1814`)

---

## 3 · Screen Inventory(per screen audit)

### app/(tabs)/index.tsx — Home / Portfolio
**目的:** 用戶 portfolio 總值 + 30 日 chart + 熱門卡(JP/EN)+ 認證商戶 grid。

**Key UI elements:**
- Portfolio value display + change indicator
- Period selector(1D / 7D / 1M / 3M / 6M / MAX)
- 互動 SVG price chart + hover tooltip
- 3 個熱卡 section(hot JP / hot EN / collectibles)
- 認證商戶 horizontal scroll grid
- PSA grade modal(add to portfolio)
- 2-col card grid

**Colors used:** `#FF6900` `#FFF3E8` `#fff` `#101828` `#6B7280` `#9CA3AF` `#F9FAFB` `#00A63E`(+%) `#E7000B`(-%) `#3B82F6`(rarity tag) `rgba(0,0,0,0.08)`(chart grid)

**Brand deviations:**
1. **3 accent colors 喺一頁:** `#FF6900` CTA + `#00A63E` success + `#E7000B` danger,違反 one-orange-per-screen rule
2. Success 應該係 Sage Strong `#4A7558`,而家用 `#00A63E`(brighter,non-brand)
3. Down/loss 應該係 Brick `#C2553D`,而家用 `#E7000B`(non-brand red)
4. Peach `#FFF3E8` 應該係 `#FFF1E5`(1 hex drift)
5. Rarity tag `#3B82F6` iOS blue 唔應該出現
6. Chart grid line `rgba(0,0,0,0.08)` — voice.md 冇規,可保留

**Voice:** ✓ Compliant(冇 emoji / hype term;copy 全部 i18n driven)

**改善建議(NOT rewrite):**
- 全部 `#FF6900` → `#FF6A1F`
- 全部 `#00A63E` → `#4A7558`
- 全部 `#E7000B` → `#C2553D`
- 全部 `#FFF3E8` → `#FFF1E5`
- Rarity tag `#3B82F6` → neutral `#9CA3AF` 或 Slate `#5C7A9A`
- Period selector「active state」唔用 orange fill,改 `#F9FAFB` bg + Card Orange 底部 1px underline,避免雙 orange

---

### app/(tabs)/search.tsx — Search & Discover
**目的:** 搜 Pokemon 卡(name / set / 卡號),filter category / grade / language,加 portfolio。

**Key elements:** Search input + filters(category EX/GX/V、grade Raw/9/10、language EN/JP)、hot cards carousel、2-col results grid、card add modal(PSA grade + custom price)、box search tab、lowest-price merchant badge

**Colors:** 同 home + `#3B82F6`(PSA 9 tag)、`#F59E0B`(PSA 10 tag)

**Brand deviations:**
- 同 home(success / danger / peach drift)
- **PSA grade tag 用 `#3B82F6` 同 `#F59E0B` — 嚴重違反 brand book A.3**
  - A.3 規矩:PSA 10 / BGS 10 / Black Label → Card Orange 1px **outline only**,字 Ink
  - PSA 9 及以下 → Ink 1px outline,字 Ink
  - Raw → Mute outline,字 Mute
  - **絕對唔可以 colored bg fill**

**Voice:** ✓ Compliant

**改善建議:**
- PSA tag 完全重做 styling:colored bg → border-only outline + 字 Ink
- Rarity tag 同 home 處理

---

### app/(tabs)/profile.tsx — User Profile & Social Feed
**目的:** Profile card、follower/following 數、own posts gallery、feed tabs。

**Key elements:** Avatar(orange border)、stats(posts/followers/following)、edit + new post button、sub-tab(posts/following/feed)、3-col post grid、single-col feed list

**Colors:** `#FF6900`(avatar border、active tab、new post)、`#FFF3E8`(feed banner bg)、`#fff`、`#101828`、`#F3F4F6`(edit btn)、`rgba(0,0,0,0.45)`(image overlay)

**Brand deviations:**
- Peach drift(`#FFF3E8` → `#FFF1E5`)
- ✓ 單 orange accent(avatar border + active tab + new post 屬於同一視覺 group),compliant
- 冇 functional colors,冇 conflict

**Voice:** ✓ Compliant

**改善建議:** 只係 hex 微調

---

### app/(tabs)/settings.tsx — Account & Settings
**目的:** Profile、email、seller status、language、logout、delete account。

**Key elements:** Profile card、seller status section、language picker modal、Privacy/Terms/Contact links、app version、Logout + Delete button

**Colors:** `#FF6900`(CTA)、`#E7000B`(destructive)、`#9CA3AF`(secondary)、`#fff`(modal)

**Brand deviations:**
- Danger `#E7000B` → Brick `#C2553D`
- **冇 Dark mode toggle**(brand book B 章未上 code)

**Voice:** ✓ Compliant

**改善建議:**
- Replace destructive color
- **Add Dark mode toggle row**(label「淺色 / 深色 / 跟系統」)— 即使 dark mode 未 implement,先放 toggle UI 做 placeholder,之後 unlock

---

### app/(tabs)/shops.tsx — Marketplace & Certified Merchants
**目的:** Browse 認證商戶 + individual listing,sort/filter by price/condition/district。

**Key elements:** Tab switcher(Marketplace / Certified Merchants)、sort dropdown、filter chips(condition / district / payment)、2-col listing cards(with seller-type badge)、1-col merchant grid、empty state

**Colors:** `#FF6900` + `#FFF3E8` + condition tags(`#3B82F6` PSA 9 / `#F59E0B` PSA 10 / `#6B7280` Raw)

**Brand deviations:**
- 同 search:PSA condition tag styling 嚴重 violate A.3
- Peach drift

**Voice:** ✓

**改善建議:**
- 拎出 condition color 入 shared constant
- PSA badge 用 outline-only styling

---

### app/merchant/[id].tsx — Merchant Profile Page
**目的:** Merchant shop page、listing grid、contact info、verified badge。

**Key elements:** Banner image、Logo + name + verified badge + district + contact、Info tab(hours/payment/desc)、Listings tab grid、Message + Listings button

**Colors:** `#FF6900` verified badge、condition tags(`#3B82F6` `#F59E0B` `#6B7280`)、grays + whites

**Brand deviations:** 同 shops

**改善建議:** 同 shops

---

### app/listing-upload.tsx — Listing Upload Form
**目的:** Multi-step form 上傳卡 / box listing。

**Key elements:** Step indicator、card search + autocomplete、condition selector(Raw / PSA 9 / PSA 10 with color)、photo upload(max 4)、price + negotiable + quantity、language checkboxes、notes textarea、submit

**Colors:** `#FF6900` submit、condition selector colors(`#3B82F6` `#F59E0B` `#6B7280`)、`#E5E7EB` input border、`#F9FAFB` section bg

**Brand deviations:** Condition colors hardcoded(同 shops / search)

**Voice deviation check:** 表單錯誤提示用咩 style? — Audit 需要 read 多次驗證,但建議用 brand book A.5 嘅 Brick `#C2553D` border + 12pt Space Grotesk Medium helper text

**改善建議:**
- Extract condition colors
- 確認 error styling 用 brand A.5 規格

---

### app/login.tsx — Passwordless Login
**目的:** Phone OTP login + Google OAuth + Apple Sign In。

**Key elements:** Logo + title + subtitle、Phone option button(orange filled primary)、Google + Apple buttons(white secondary)、divider + "or login with"、phone input(step 2)、back button

**Colors:** `#FF6900`(primary phone button)、`#fff`、`#9CA3AF`、`#101828`

**Brand deviations:** ✓ Single accent,compliant

**Voice:** ✓

**改善建議:** Hex 對齊 `#FF6A1F`

---

### app/(tabs)/card/[id].tsx — Card Detail Page
**目的:** JP card price history、grading/population data、market movers、similar cards。

**Key elements:** Card image + language badge(JP/US)、price(PSA 10 estimated vs real)、market change 30d、price history chart、population chart(PSA distribution)、grading picker(Raw / 9 / 10)、market data(eBay、CardMarket)、Add to portfolio

**Colors:** `#FF6900`(add button、chart line)、grays + whites

**Brand deviations:** ✓ Compliant

**改善建議:** Hex 對齊。如果 chart 有 up/down 顏色 emphasis,記得用 Sage Strong / Brick。

---

### Components

#### Header.tsx
**Purpose:** Top app bar(logo + currency + notifications + inbox + settings icon)

**Colors:** `#FF6900` badge bg、`#fff` logo + badge border、`#101828` currency text、`#E5E7EB` button border、`#FFF3EB` dropdown active item bg

**Deviations:** `#FFF3EB` → `#FFF1E5`(差 1 hex)

---

#### Loader.tsx
Pokeball Lottie animation。Brand 中性。冇 issue。

#### SplashScreen.tsx
Black bg + Pokeball Lottie。Brand 黑色 OK。

#### SkeletonCard.tsx
Gray shimmer。Brand 中性。冇 issue。

#### LanguagePicker.tsx
Active language 用 `#FF6900` text + checkmark。✓ Compliant。

---

## 4 · Cross-Cutting Findings

### A. Design Token System 失蹤(最高優先)
**狀態:** ✗ 冇 `theme/tokens.ts`
**Impact:** 將 `#FF6900` 改成 `#FF6A1F` 要 97+ find-replace
**建議:** 起 `theme/tokens.ts`:

```typescript
export const COLORS = {
  // Brand
  orange:        '#FF6A1F',
  orangeHover:   '#E5601C',
  orangeDimmed:  'rgba(255, 106, 31, 0.3)',
  peach:         '#FFF1E5',  // warning bg light
  warmDark:      '#2A1F18',  // warning bg dark
  // Text
  ink:           '#1A1814',
  paper:         '#F6F2EA',
  // Functional
  sage:          '#4A7558',  // success / up — Strong, body-safe
  sageTint:      '#5B8C6B',  // decorative ≥14pt only
  brick:         '#C2553D',  // danger / down
  slate:         '#5C7A9A',  // info
  mute:          'rgba(26, 24, 20, 0.6)',
  // Grays(可用)
  gray900: '#101828',
  gray700: '#6B7280',
  gray500: '#9CA3AF',
  gray300: '#E5E7EB',
  gray200: '#F3F4F6',
  gray100: '#F9FAFB',
} as const;
```

### B. Dark Mode 未實作
- Brand book B 章已 spec(Lacquer / Sumi `#0E0C0A`)
- 冇 `useColorScheme()` / 冇 dark token / 冇 toggle UI
- 建議:settings 頁面先 stub 「淺色 / 深色 / 跟系統」row,讓設計師可見 UI affordance,實際 code 後上

### C. i18n 覆蓋
- ✓ 4 lang 全覆蓋,所有 UI copy 用 `t('...')` key
- ✓ 冇 hardcoded 英文 copy
- ⚠ Voice 合規責任轉去 translation JSON(冇 grep 到 banned term,但要 audit translation files)

### D. Voice Consistency
- ✓ Grep `🎉🔥✨🎁⚠️` / `立即|限時|驚喜|爆升` / 結果 = 0
- ✓ Code 層 voice clean
- ⚠ 但 Alert.alert() native dialog 嘅 button label 用咩字?要 audit i18n keys

### E. Warning Pattern(A.6 Dual-Weight)
- ✗ 未實作
- `#FFF3E8` 用嚟做 preview box 多過 warning
- **冇 WarningBanner component**,error 全部用 native Alert.alert()(OS-styled)
- 建議:新起 `components/WarningBanner.tsx`,Peach bg + Orange 1px border + Orange icon + Ink text

### F. PSA Badge 嚴重 Violate A.3
- 現時:`#3B82F6` blue bg(PSA 9)+ `#F59E0B` amber bg(PSA 10)
- Brand spec:outline-only,**唔可以 colored bg**
- 建議:`components/PSAGradeBadge.tsx` 統一處理

---

## 5 · Top 10 Quick Wins(由快到慢)

| # | Fix | Time | Files affected |
|---|---|---|---|
| 1 | `#FF6900` → `#FF6A1F`(97 occurrences) | 5 min | 35 files |
| 2 | `#00A63E` → `#4A7558`(success / up) | 5 min | 4-6 files |
| 3 | `#E7000B` → `#C2553D`(danger / down) | 5 min | 3-5 files |
| 4 | `#FFF3E8` → `#FFF1E5`(peach warning) | 5 min | 8-10 files |
| 5 | `#101828` → `#1A1814`(ink correction) | 5 min | 15+ files |
| 6 | Remove `#3B82F6` rarity tag — replace neutral | 10 min | 3 files |
| 7 | Build `theme/tokens.ts`,migrate top 10 hex | 30 min | 1 new file |
| 8 | Extract condition colors to shared constant | 15 min | 5 files |
| 9 | Settings → 加 Dark mode toggle UI stub | 10 min | 1 file |
| 10 | Audit `Alert.alert()` i18n keys for voice compliance | 10 min | translation JSON |

**全部做齊大約 1.5-2 小時。**

---

## 6 · Larger Refactor 建議

### A. PSA Grade Badge Component(2 hr)
**File:** `components/PSAGradeBadge.tsx`
**Props:** `grade: 'Raw' | 'PSA 9' | 'PSA 10' | 'BGS 10' | 'BGS 9.5' | ...`
**Output per brand A.3:**
- PSA 10 / BGS 10 / Black Label → `border: 1px solid #FF6A1F`,字 Ink,**冇 bg fill**
- PSA 9 / BGS 9.5 及以下 → `border: 1px solid #1A1814`,字 Ink
- Raw / 未評級 → `border: 1px solid rgba(26,24,20,0.6)`,字 mute

Migration:replace 10+ inline badge 喺 search / home / card detail / listing。

### B. Warning Banner Component(2 hr)
**File:** `components/WarningBanner.tsx`
**Props:** `severity: 'warn' | 'block' | 'info'`,`title`,`body`,`action?`
**Brand A.6 spec:**
- Light: bg `#FFF1E5` + border `#FF6A1F` 1px + icon orange + text ink
- Dark(將來): bg `#2A1F18` + border `#FF6A1F` + text paper

Replace native `Alert.alert()` with in-app banner where appropriate(畀更多 voice control)。

### C. Condition Color Constants(1 hr)
**File:** `constants/conditions.ts`
```typescript
export const CONDITIONS = [
  { key: 'Raw',    label: '未評級', tier: 'mute' },
  { key: 'PSA 9',  label: 'PSA 9',  tier: 'standard' },
  { key: 'PSA 10', label: 'PSA 10', tier: 'hero' },
  { key: 'BGS 10', label: 'BGS 10 Black Label', tier: 'hero' },
] as const;
```
配合 PSAGradeBadge component。

### D. Dark Mode Implementation(4-6 hr,future)
- Add dark token layer 入 `theme/tokens.ts`
- Wrap app in `<ThemeProvider>` + `useColorScheme()` 監系統
- Settings toggle 連到 user override
- Audit 35 files migrate to theme-aware colors

### E. Documentation(1 hr)
- README 入面 add Colors section
- Link 去 brand book + addendum
- 寫「Use `COLORS.orange` not `'#FF6A1F'`」rule

---

## 7 · Summary Table

| Screen | Light only | Multi accent | Non-brand colors | Warning styled | Voice |
|---|:-:|:-:|:-:|:-:|:-:|
| Home | ✓ | ✗ 3 accents | ✗ | ~ Alert | ✓ |
| Search | ✓ | ✗ rarity | ✗ PSA tag | ~ | ✓ |
| Profile | ✓ | ✓ | ⚠ peach drift | n/a | ✓ |
| Settings | ✓ | ✗ red+orange | ✗ E7000B | ~ | ✓ |
| Shops | ✓ | ✗ tags | ✗ PSA tag | n/a | ✓ |
| Merchant | ✓ | ~ | ✗ tags | n/a | ✓ |
| Listing Upload | ✓ | ~ | ✗ tags | ~ | ✓ |
| Card Detail | ✓ | ✓ | ✓ | ✓ | ✓ |
| Login | ✓ | ✓ | ✓ | ~ | ✓ |
| Components | ✓ | ✓ | ⚠ peach drift | ~ | ✓ |

✓ pass / ~ partial / ✗ fail

---

## 8 · 結論 + 對 design chat 嘅 ask

**現狀:** Functional 健康,Card Orange 大致 consistent,**冇 hype emoji / banned voice term**(code 層)。問題集中喺 4 條:
1. Card Orange hex drift `#FF6900` vs `#FF6A1F`
2. 引入咗 brand 以外嘅 functional colors(`#00A63E` `#E7000B` `#3B82F6` `#F59E0B`)
3. PSA badge styling 嚴重 violate A.3(colored bg 而非 outline)
4. 冇 design token 檔案 → 改動成本高

**Design chat 嘅工作建議:**
1. **唔好** 重畫 layout / 改 navigation / 換 framework
2. **可以** 提具體 hex value swap suggestion(per file or per token)
3. **可以** 提 PSA badge / Warning banner component 嘅 visual spec
4. **可以** 提 Dark mode component-level styling
5. **可以** 提細節 polish(spacing scale / typography weight / icon sizing)

**最高 leverage 嘅 1 個 change:** 建立 `theme/tokens.ts`,migrate top 30 hardcoded hex。一改全改。

---

*Audit:Claude(HKCC · Product chat)*
*Scope:35 screens + 5 components + 100+ color references*
*References:`brand/brand_book_addendum_v01.md` v01.1、`brand/voice.md`、`MERCHANT_SPEC.md`*
*Last updated:2026-05-23*
