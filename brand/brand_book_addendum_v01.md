# HKCardColl · Brand Book Vol.01 Addendum

> 補完 Vol.01 兩條未定義 gap:Functional Colors + Dark Mode。
> Voice: brand/voice.md(precise / local / calm)。
> Last updated: 2026-05-23

---

## 0 · 設計大原則(複述)

Card Orange `#FF6A1F` 係**唯一 hero accent**。每一頁(screen / card / modal)只可以有一個 Card Orange element。
任何功能色都要**避讓** Card Orange,唔可以搶視覺重量。
唔用漸層、陰影、emoji highlight。
功能色 saturate 寧低不高,wash 寧 warm 不 cool。

---

## A · Functional Colors

### A.1 · 角色 mapping

| 功能 | 用途 | Light Hex | Dark Hex | Saturation 邏輯 |
|---|---|---|---|---|
| **Success / Up — Tint** | Chip bg、large display、decorative element ≥14pt | `#5B8C6B` | `#7AB089` | Muted sage tint(3.8:1 不過 AA body)|
| **Success / Up — Strong** | Body text、小字 +N%、helper text、icon | `#4A7558` | `#7AB089` | Sage Strong(5.2:1 AA pass)|
| **Danger / Down / Loss** | 卡價跌、訂閱取消、批核失敗、-8% 等 | `#C2553D` | `#D26F5A` | Terracotta brick — body 同 decorative 共用(5.1:1)|
| **Info** | Tooltip、disclosure、affiliate disclaimer | `#5C7A9A` | `#7A9AB8` | Muted slate — 中性,唔搶 |
| **Mute / Neutral** | Disabled、metadata、secondary text | Ink @ 60% `#1A1814 99` | Paper @ 50% `#F0EBE0 80` | 由 brand 主色降透明度 |
| **Warning** | ⚠ **唔另定** — Card Orange `#FF6A1F` 雙權重處理(見 A.6) | — | — | Tint mode + Outline 區分 CTA |

**Sage 雙 token 規則:** 任何 body / 細字 / icon 必須用 Sage Strong。Tint 只可以做 chip bg、decorative banner、large display(≥14pt regular 或 ≥11pt bold)。設計師如不肯定就用 Strong。

### A.2 · WCAG 對比度檢查(AA target ≥ 4.5)

| Combo | Ratio | Pass |
|---|---|---|
| `#5B8C6B` Sage Tint on `#F6F2EA` | 3.8:1 | ⚠ Decorative only(≥14pt 或 ≥11pt bold)|
| `#4A7558` Sage Strong on `#F6F2EA` | 5.2:1 | ✓ AA body |
| `#C2553D` Brick on `#F6F2EA` | 5.1:1 | ✓ AA body |
| `#5C7A9A` Slate on `#F6F2EA` | 4.7:1 | ✓ AA body |
| `#FF6A1F` Orange on `#FFF1E5` Peach | n/a (outline use) | Border / icon role |
| `#1A1814` Ink on `#FFF1E5` Peach | 13.5:1 | ✓ AAA |
| `#7AB089` Sage on `#0E0C0A` Sumi | 8.2:1 | ✓ AAA body |
| `#D26F5A` Brick on `#0E0C0A` Sumi | 6.4:1 | ✓ AA body |
| `#7A9AB8` Slate on `#0E0C0A` Sumi | 7.1:1 | ✓ AA body |
| `#F0EBE0` Paper on `#2A1F18` Warm-dark | 11.8:1 | ✓ AAA(dark warning bg)|

### A.3 · PSA / BGS Grade Badge — 唔用功能色

**規矩:** 評級 badge **唔配色**(唔用紅色 / 金色 / banner)。
用 typography + 數字本身 + 細邊框講故事。

```
PSA 10 · BGS 10 / Black Label  →  Card Orange `#FF6A1F` 邊框 1px,字 Ink
                                  (premium signal,但係 Orange = one accent moment)
PSA 9 / BGS 9.5 及以下           →  Ink `#1A1814` 邊框 1px,字 Ink
未評級 Raw                       →  Mute `#1A1814 99` 邊框,字 Mute
```

唔用「金色 PSA 10」、「閃光描邊」、「rare star」icon。Voice 唔做 hype。

### A.4 · 升 / 跌 數字呈現

```
+12.4%   ← #5B8C6B,字重 Medium
-8.1%    ← #C2553D,字重 Medium
± 0%     ← Mute,字重 Regular
```

唔加 ↑↓ icon 重複表達(字色已經夠)— 除咗 weekly poster 入面 Card Orange 嘅 ↑ 係視覺 hook。
唔用紅綠燈 emoji 🔴🟢,唔用三角箭咀 ▲▼。

### A.5 · 表單錯誤提示

```
Field 錯誤            Border:  #C2553D
                     Helper:  #C2553D,12pt,Space Grotesk Medium
                     Copy:    voice.md 範本 D(短句、無「!」、無「請」連發)
                     
範例:  「BR 號碼格式唔啱(8 位數字)」
       ✗ 唔寫:「⚠️ 錯誤!請輸入正確嘅 BR 號碼!」
```

### A.6 · Warning Pattern — Card Orange 雙權重(強制 design rule)

**Risk:** 同一 screen 上面如果出現 Orange CTA button **同** Orange warning banner,兩個 element 同色,attention 撞車,用戶要讀字至分得到。

**解法:** 同色,不同 fill mode。CTA = solid block,Warning = outlined panel。視覺一眼分得到,brand 維持 unified。

| 用途 | Background | Border | Icon | Text |
|---|---|---|---|---|
| **Primary CTA** | Orange fill `#FF6A1F` | none | Paper(如有) | Paper `#F6F2EA` |
| **Warning Banner — Light** | Peach tint `#FFF1E5` | Orange `#FF6A1F` 1px | Orange | Ink `#1A1814` |
| **Warning Banner — Dark** | Warm-dark `#2A1F18` | Orange `#FF6A1F` 1px | Orange | Paper `#F0EBE0` |
| **Inline Warning Chip** | transparent | Orange 1px | Orange(細)| Orange 字 |

**Hierarchy rule:** 同一 screen 出現 Warning banner 時,Primary CTA 嘅 visual priority 自動降:
- 如果 warning 阻塞操作(e.g. 「BR 文件未補交」),CTA disabled,直到 warning resolved。
- 如果 warning 純提示(e.g. 「PRO 試用期剩 3 日」),CTA 維持 enabled,但 warning 排上面,讀完先做嘢。

呢條 rule **明文寫死**(brand book + design system Storybook),設計師唔可以自己定。

---

### A.7 · DO / DON'T

| ✓ DO | ✗ DON'T |
|---|---|
| 一頁一個 Card Orange solid element(CTA / hero accent)| 用 Card Orange 做 success 色 |
| Warning 用 Peach tint + Orange outline(非 solid)| Warning 用 solid Orange fill(撞 CTA)|
| Body 細字升幅用 Sage Strong `#4A7558` | Body 細字用 Sage Tint `#5B8C6B`(contrast 不過 AA)|
| 升跌數字用字色 + 字重講 | 升跌用 emoji / 大三角 icon |
| PSA 10 用 Orange 1px border(已是 hero moment)| PSA 10 用金色背景 / 漸層 |
| Toast / banner 純色 fill | Toast 用陰影 + glassmorphism |
| Warning state 用 Card Orange 雙權重 pattern | 另起一個 amber/yellow warning 色 |

---

## B · Dark Mode 美學

### B.1 · Direction:「Lacquer / 墨」非 Inverted

唔做傳統 dark mode(純黑 #000 反 paper)。
做**和式 lacquer(漆器)/ 中式墨硯**感覺:warm-black,深邃,有質感,Card Orange 喺上面像漆盒上嘅朱印。

### B.2 · Surface Token

| Token | Hex | 用途 |
|---|---|---|
| `bg-sumi` | `#0E0C0A` | App 底層 background(warm-black,唔係 pure black)|
| `surface-1` | `#1A1714` | Card、list row、bottom sheet |
| `surface-2` | `#25211C` | Modal、elevated dialog、tooltip |
| `surface-3` | `#33302A` | Hover / pressed state |
| `border` | `#2E2924` | 細分隔線、card 邊 |
| `text-paper` | `#F0EBE0` | 主文字(echo light mode 嘅 Paper)|
| `text-paper-soft` | `#A89E8C` | Secondary text、metadata |
| `text-mute` | `#7A7060` | Disabled、placeholder |

### B.3 · Accent Behavior

| 元素 | Light Mode | Dark Mode | 差異 |
|---|---|---|---|
| Card Orange | `#FF6A1F` | **`#FF6A1F`(unchanged)** | 喺 sumi 上面 contrast 8.1:1,完美 |
| Card Orange hover | `#E5601C` | `#FF7A35`(微 brighter)| Dark 環境 hover 要明顯啲 |
| Card Orange disabled | `#FF6A1F @ 30%` | `#FF6A1F @ 40%` | Dark 度數要高啲先見到 |

**唔轉**(常見錯誤):Card Orange 唔係 light 用一個 orange、dark 用另一個 orange。腦袋認得到就係品牌。

### B.4 · Functional Colors @ Dark(已列喺 A.1 表)

整體邏輯:luminance 升,saturation 不變。Dark mode 同 light mode 應該感覺**色相一致**,只係環境光不同。

### B.5 · 圖像同 Asset

- 卡牌官圖 / 實物相:**全部唔處理**,維持原色(收藏家最重視原汁顏色)。
- App icon / logo:用 Paper 版(light)或 Ink 版(dark)切換。
- 圖表(走勢圖):
  - Light:背景 Paper,線 Ink,Up 用 Sage,Down 用 Brick。
  - Dark:背景 Sumi,線 Paper-soft,Up 用 brighter Sage,Down 用 brighter Brick。
  - Grid line:Light `#1A1814 @ 8%`,Dark `#F0EBE0 @ 8%`。

### B.6 · Auto-Switch 規則

| 觸發 | 行為 |
|---|---|
| 系統 dark mode | App 跟系統(default)|
| 用戶手動 override | Settings → 外觀 → Light / Dark / Auto |
| 啟動 splash | 跟系統,**唔閃白底**(dark 環境用 sumi splash)|

### B.7 · DO / DON'T

| ✓ DO | ✗ DON'T |
|---|---|
| Sumi 底色(warm-black)| Pure black `#000` |
| Card Orange 唔變 hex | Dark mode 換另一個 orange |
| Paper-tinted off-white 做文字 | 純白 `#FFF` 文字 |
| Surface 1/2/3 用 luminance 階梯 | 用透明 layer 疊出階梯(會有 banding)|
| 圖表 grid 用 8% opacity | 圖表 grid 用 fixed gray |

---

## C · Implementation Note(送 HKCC · Code)

Token 命名建議(SwiftUI / TypeScript 同步):

```
brand.orange          → #FF6A1F (both modes)
brand.orange.peach    → #FFF1E5 (light warning bg only)
brand.orange.warmdark → #2A1F18 (dark warning bg only)
brand.ink             → #1A1814 (light) / #F0EBE0 (dark)
brand.paper           → #F6F2EA (light) / #0E0C0A (dark)

surface.1 / 2 / 3     → 階梯 surface
border.subtle         → 分隔線

text.primary          → ink / paper 對應
text.secondary        → mute 60%
text.tertiary         → mute 40%

state.up.tint         → #5B8C6B / #7AB089   (decorative, ≥14pt)
state.up.text         → #4A7558 / #7AB089   (body, AA pass)
state.down            → #C2553D / #D26F5A
state.info            → #5C7A9A / #7A9AB8
state.warn            → brand.orange(雙權重,見 A.6 pattern)
```

**Warning component shape(必須 token-driven):**
```
<WarningBanner>
  bg     = brand.orange.peach (light) / brand.orange.warmdark (dark)
  border = brand.orange (1px solid)
  icon   = brand.orange
  text   = text.primary
</WarningBanner>
```

唔好 hard-code hex 喺 component,全部走 token。一改全改。

---

## D · Changelog

| Date | Change |
|---|---|
| 2026-05-23 | v01.0 初版。Functional Colors + Dark Mode。|
| 2026-05-23 | v01.1 Review pass。Sage 分 Tint(3.8:1 decorative)+ Strong(5.2:1 body)兩 token。新增 A.6 Warning Pattern — Card Orange 雙權重(Peach tint + outline vs Solid CTA fill)。新增 Peach `#FFF1E5` 同 Warm-dark `#2A1F18` warning bg token。|
