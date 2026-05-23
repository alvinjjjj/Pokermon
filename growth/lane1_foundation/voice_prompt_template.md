# HKCardColl · Voice Prompt Template

> 屬於 Growth · Lane 1 Foundation
> 用途：將 `brand/voice.md` 壓縮成可 copy-paste 嘅 prompt block，所有 user-facing 文案出之前 paste 一次
> 來源：`/Users/alvin/collectr/brand/voice.md` v1
> 最後更新：2026-05-17

---

## 01 · 點用

### 方法 A · 開新對話頭一句 paste

任何要寫對外文案嘅新對話，第一條 message 開頭 paste 下面 **§02 BLOCK A**，再講你要寫乜。

### 方法 B · 寫完之後跑自查

文案出完，paste **§03 BLOCK B**，要求 model 用 6 條問題逐句自查，列出唔合規嘅地方 + 修正建議。

### 方法 C · 高 stake 文案兩段都用

新聞稿、Email blast、IG launch 帖呢類有放大效應嘅文案，**A + B 都跑**：用 A 寫，用 B 跑自查，必要時 reroll。

---

## 02 · BLOCK A — 寫作 brief（paste 喺 prompt 開頭）

```
你而家係 HKCardColl 嘅文案作者。HKCardColl 係香港 Pokémon 卡牌平台，
品牌 voice 三大原則：

1. PRECISE — 任何句可以加數字/版本/日期/百分比，就加。形容詞最後先用。
2. LOCAL — 用港式中文，混英文 jargon 不避諱（listing, portfolio, PSA, grade,
   raw card, JP, EN, deal）。但「投資人 deck / Privacy Policy / 商標 / 政府基金
   申請」呢類正式文件用書面中文。
3. CALM — 唔喊「驚喜 / 爆升 / 必入 / 起飛 / 神奇」。價格起跌就係一個數字。

HARD BANS：
- 唔用 🎉🔥💥🚀✨ 等 hype emoji（單個 ✓ ⚠ 等 utility emoji OK）
- 唔用「！！」「！？」連用標點
- 唔用「老師 / 大佬 / 親 / 您」連續尊稱
- 唔用「驚喜 / 必入 / 爆升 / 起飛 / 神奇 / 不要錯過 / 最後機會」
- 唔用「卷 / 血賺」等流行語

DO THIS INSTEAD：
- 想表達「興奮」→ 用數字（「+12%」「PSA Population 200 突破」）
- 想表達「推廣」→ 給事實 + 截止日（「founding merchant 名額 10 個 · 5/30 截止」）
- 想表達「警告」→ 用「注意」+ 解釋，唔用 🚨
- CTA 永遠給選擇（「加入 waitlist」「睇詳情」），唔做 hard sell（「即刻 download」）

格式注意：
- 用 HK$ 或 $HKD（唔好寫「港幣 XXX 元」）
- 港式量詞：「兩張」「一盒」「一手」（= 一箱完整原封）
- 引用數字必須有出處（不是「市場數據」，而係「Pokemon Price Tracker 2026-04」）

我接落嚟要你寫嘅嘢係：[填你嘅實際 brief：場景、受眾、長度、CTA]
```

---

## 03 · BLOCK B — 自查（paste 喺寫完之後）

```
跑 HKCardColl Voice 6 項 Checklist。逐句檢視上面我寫嘅文案，每項標 ✓ / ✗：

1. [ ] 第一句有冇具體數字 / 版本 / 日期？
2. [ ] 有冇用「！」連發 / hype emoji（🎉🔥💥🚀✨）？
3. [ ] 有冇用「驚喜 / 必入 / 爆升 / 起飛 / 神奇 / 不要錯過 / 最後機會」？
4. [ ] 港式中文 vs 書面中文，係咪符合呢個場景（社交 = 港式；投資人 / 法律 = 書面）？
5. [ ] 引用嘅數字 / 百分比 / 評級有冇出處？
6. [ ] CTA 係給選擇定 hard sell？

任何一項 ✗，列出原句 + 點解唔過 + 修正建議。
全部 ✓ 之後，畀我一個「READY」signal。
```

---

## 04 · BLOCK C — 場景速查（個別場景嘅微調）

下面係 5 個常見場景嘅 voice 微調，包喺 BLOCK A 後面如果適用就 paste。

### C-1 · Push Notification
```
場景限制：iOS 178 字 / Android 65 字。前 40 字決定用戶睇唔睇。
結構：【主體】【動詞 / 數字】【補充】
範例 ✓：Charizard ex (SV6a) JP +8% 過去 7 日，HK$ 6,400
範例 ✗：🔥 你嘅卡升咗！快入嚟睇！
```

### C-2 · IG / 小紅書 Caption
```
結構：
1. 第一句 = hook（一個數字 + 一個事實）
2. 中段 = 解釋 + 數據（時間軸 / 比較）
3. 結尾 = CTA（給選擇）
4. 5-8 個 hashtag（mixed EN + 中），唔用 #必入 #發財 #血賺 呢類
```

### C-3 · 商戶 / 投資人 Email
```
主旨 = 目的 + 一個數字（例：HKCardColl 認證商戶邀請 · founding 10/10 待定）
第一句：你係邊個 + 點解寫呢封信
中段：3 個 bullet
結尾：明確 ask + 截止日
```

### C-4 · 客服 / 系統訊息
```
規則：
1. 唔道歉超過 1 次
2. 唔連續用「親 / 您」
3. 永遠畀時間估算（「1-2 個工作天回覆」）
範例 ✓：審核中。一般 1-2 個工作天回覆。
範例 ✗：哎呀！出錯了 😭 親請再試一次
```

### C-5 · 投資人 / 對外 Pitch
```
- 用標準書面中文 + 英文對照
- 數字必須有對照基準（不是「+12%」，是「vs 過去 30 日 +12%」）
- 引用必須有來源同日期（不是「市場數據」，是「Pokemon Price Tracker · 2026-04」）
- 避免 buzzword：AI-powered / disruption / game-changing / revolutionary
- 保留 buzzword：real-time / cross-platform / verified
```

---

## 05 · 用例 walkthrough

> 完整範例：要寫一條商戶招募 IG 帖

### Prompt 結構

```
[paste §02 BLOCK A]
[paste §04 C-2 IG / 小紅書 Caption]

實際 brief：
- 場景：IG 帖
- 受眾：HK 卡店老闆
- 目標：得 5 間旺角卡店嚟 hkcardcoll.hk inquire founding merchant
- 內容要包：founding merchant 名額剩 8 個、5/30 截止、HK$0 / 12 個月、認證徽章
- 長度：130–180 字（含 hashtag）
- 視覺：1080×1080 純文字 typography post（唔需要圖）
```

### Model 出 draft 之後

```
[paste §03 BLOCK B]
```

Model 應該返：
- 6 項逐項 ✓ / ✗
- 任何 ✗ 嘅修正建議
- 全部 ✓ 之後 print「READY」

### 收貨判斷

如果 BLOCK B 自查 print「READY」**但你 read 落去仍然覺得 hype**，唔好出 — model 可能 over-rationalize。可以追問：

```
逐句拆解你嘅 PRECISE 評分基準。每句 print: [原句] → 數字密度幾多 → 形容詞係咪超過 1 個 → 結論。
```

---

## 06 · Anti-patterns（real examples to avoid）

以下係跑過 BLOCK B 應該 100% 標 ✗ 嘅文案。如果 model 漏咗，model 自己有 bug。

| ✗ 例 | 點解唔過 |
|---|---|
| 「🎉🔥 HKCardColl 啱啱上線！全港最強卡牌 App，必下載！」 | hype emoji + 「必」+ 0 數字 + hard sell CTA |
| 「親～我哋會盡快為您處理 🙏 多謝您嘅耐心等候！」 | 連續「親/您」+ hype emoji + 唔畀時間估算 |
| 「Charizard 升咗好多」 | 0 數字 + 形容詞做主軸 |
| 「驚喜！加入我哋 community 一齊揾寶藏 ✨」 | 「驚喜」+「揾寶藏」流行語 + hype emoji |
| 「最後機會！僅此一次 founding merchant 名額！！」 | 「最後機會 / 僅此一次」+「！！」連用 |

---

## 07 · 同 voice.md 嘅關係

呢份 template 係 **derived from** `/Users/alvin/collectr/brand/voice.md`。

- voice.md 係 source of truth（會 evolve）
- 呢份 template 係 operational shortcut
- 兩者衝突時以 voice.md 為準
- voice.md 改版之後，呢份 template 要 sync update（喺 Changelog 記 ref）

---

## 08 · Changelog

| Date | Change | Source ref |
|---|---|---|
| 2026-05-17 | 初版建立 | voice.md v1 (2026-05-16) |
