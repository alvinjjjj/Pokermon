# HKCardColl · Domain + Email 啟動 SOP

> 屬於 Growth · Lane 1 Foundation
> 用途：將 hkcardcoll.hk 由「註冊咗但唔 live」變成「可以 receive + send + 可以擺上 App Store」
> 最後更新：2026-05-17

---

## 00 · 現狀

| 項目 | 狀態 | 來源 |
|---|---|---|
| Domain `hkcardcoll.hk` | ✓ 已註冊 2026-05-16 | product.md |
| HKDNR 帳號驗證 | ⏳ 待辦 | product.md |
| `hello@hkcardcoll.hk` | ✗ 未 live | product.md |
| 目前對外 email | `potodesignstudio@gmail.com`（過渡中） | product.md |
| Web hosting | ✗ 未 setup | — |

---

## 01 · End state（呢份 SOP 跑完之後嘅樣）

```
hkcardcoll.hk             → Landing page (Cloudflare Pages / Vercel free tier)
www.hkcardcoll.hk         → 301 → apex
hello@hkcardcoll.hk       → 收到自動 forward Gmail；發出顯示 hello@hkcardcoll.hk
merchants@hkcardcoll.hk   → forward 同上
press@hkcardcoll.hk       → forward 同上
DNS                       → Cloudflare 管理（唔再用 HKDNR DNS UI）
SPF / DKIM / DMARC        → 全部 pass mail-tester.com 10/10
```

---

## 02 · 推薦架構（為什麼咁揀）

### DNS：**Cloudflare**（免費）

HKDNR 嘅 DNS UI 好限制（部分 record type 唔支援）。將 nameserver 改去 Cloudflare 之後可以：
- 任意 record type（SPF / DKIM / DMARC / CAA / SRV）
- Email Routing 服務（免費）
- 同 Cloudflare Pages 整合（landing page 免費 host）
- Analytics + DDoS 保護
- DNS proxy / SSL 自動

Domain registrar 保持喺 HKDNR，**只改 nameserver**。

### Email：**Zoho Mail Free**（5 個 mailbox 免費）+ Cloudflare Email Routing（forwarding）

| 方案 | 月費 | 收 | 發 | DKIM | 推薦時機 |
|---|---|---|---|---|---|
| **Cloudflare Email Routing** | $0 | ✓ forward 去任何 Gmail | ✗ 唔可以 send | 唔涉及 | 純 forwarding 用 |
| **Zoho Mail Free** | $0（5 users） | ✓ | ✓（hkcardcoll.hk 顯示）| ✓ | **推薦 Day 0–Day 90** |
| Google Workspace Business Starter | HK$45/user/月 | ✓ | ✓ | ✓ | Day 90+，有種子資金後升級 |
| Microsoft 365 Business Basic | HK$50/user/月 | ✓ | ✓ | ✓ | 唔建議（Pokemon 卡 community 唔 care）|

**Hybrid 設計**：
- `hello@`、`merchants@`、`press@`、`legal@` 用 Zoho 真實 mailbox（owner Alvin 一個人睇曬，唔分多人）
- 用 Cloudflare Email Routing 將任何 `*@hkcardcoll.hk` catch-all 都 forward 去 Gmail backup（防 typo）

---

## 03 · 執行 SOP（按順序，預計總時間 90 分鐘 + 24 小時 DNS propagate 等）

### Step 1 · HKDNR 帳號驗證（5 min owner time + 等 HKDNR 回覆）

1. 開 HKDNR 註冊時嘅 confirmation email
2. Click 驗證 link
3. 用 BR 80363844 + POTO Creative Tech 名義 binding（呢個係 .hk domain 嘅 admin contact 要求）
4. 確認登入到 HKDNR 控制台，搵到 `hkcardcoll.hk` 嘅 nameserver 修改入口

⚠️ 如果 HKDNR 帳號 binding 卡住，去 https://www.hkdnr.hk → 線上客服。一般 1 工作天回覆。

### Step 2 · Cloudflare 接管 DNS（20 min + 24h propagate）

1. 開 Cloudflare 帳號（用 owner email）→ Add Site → 輸入 `hkcardcoll.hk`
2. 揀 Free plan
3. Cloudflare 給兩個 nameserver，例如：
   ```
   abby.ns.cloudflare.com
   john.ns.cloudflare.com
   ```
4. 返 HKDNR 控制台 → DNS / Nameserver 設定 → 將原本 HKDNR nameserver 改成上面兩個
5. 等 propagate（一般 1–24 小時，可以用 https://dnschecker.org 驗）
6. Cloudflare dashboard 顯示「Active」即完成

### Step 3 · DNS records 一次過 set（10 min）

喺 Cloudflare DNS 加以下 records：

```
# Web hosting（landing page）
Type   Name                Content                                      Proxy
A      hkcardcoll.hk       <Cloudflare Pages 給嘅 IP，或 Vercel IP>      Proxied
CNAME  www                 hkcardcoll.hk                                 Proxied

# Email - MX records（如果用 Zoho 香港 region）
Type   Name                Content                          Priority
MX     hkcardcoll.hk       mx.zoho.com                      10
MX     hkcardcoll.hk       mx2.zoho.com                     20
MX     hkcardcoll.hk       mx3.zoho.com                     50

# SPF - 授權 Zoho + Cloudflare Email Routing 發 mail
Type   Name                Content
TXT    hkcardcoll.hk       v=spf1 include:zoho.com include:_spf.mx.cloudflare.net ~all

# DKIM - Zoho 會喺 Zoho dashboard 自動 generate 一條
Type   Name                Content
TXT    zmail._domainkey    <copy from Zoho dashboard>

# DMARC - 起步用 quarantine，跑兩週確認唔影響 deliverability 再升 reject
Type   Name                Content
TXT    _dmarc              v=DMARC1; p=quarantine; rua=mailto:hello@hkcardcoll.hk; pct=100; aspf=s; adkim=s

# CAA - 限制邊個 CA 可以簽 SSL
Type   Name                Content
CAA    hkcardcoll.hk       0 issue "letsencrypt.org"
CAA    hkcardcoll.hk       0 issue "google.com"
CAA    hkcardcoll.hk       0 issuewild "letsencrypt.org"
```

### Step 4 · Zoho Mail 註冊 + verify domain（20 min）

1. https://www.zoho.com/mail/zohomail-pricing.html → Forever Free Plan
2. Add domain `hkcardcoll.hk`
3. Verify domain（揀 TXT method，Zoho 比一條 verification TXT，加入 Cloudflare DNS）
4. Create 5 個 mailbox（順序：`hello`、`merchants`、`press`、`legal`、`alvin`）
5. Mail Admin Console → Email Configuration → DKIM → Generate → copy DKIM TXT 入 Cloudflare DNS
6. Test：用個人 Gmail send 去 `hello@hkcardcoll.hk` → Zoho inbox 應該收到
7. Zoho 入面寫 test reply → check 去 Gmail 嘅 mail header，From 應該係 `hello@hkcardcoll.hk`

### Step 5 · Cloudflare Email Routing 做 catch-all backup（10 min）

1. Cloudflare dashboard → Email → Email Routing → Get Started
2. Cloudflare 會自動加幾條 MX / TXT — **但呢度衝突 Zoho 嘅 MX**，所以唔好用 Cloudflare 接管所有 mail
3. **正確做法**：只用 Cloudflare 嘅「Catch-all address」功能。設定：
   - Specific routes：disable（畀 Zoho MX handle）
   - Catch-all：`*@hkcardcoll.hk` → forward → `potodesignstudio@gmail.com`
   - ⚠️ 注意：Cloudflare Email Routing 同 Zoho MX **唔可以同時** active，因為 MX 互斥
   - **取捨**：頭兩個月 owner 只係一個人，跳過 Step 5，全部走 Zoho。Zoho 入面有 forwarding rule 可以將所有 mail forward 去 Gmail 做 backup
4. **建議**：先唔好開 Cloudflare Email Routing，避免 MX 衝突；改為喺 Zoho 設定 "auto-forward to Gmail" rule

### Step 6 · Gmail 「Send as」設定（10 min）

如果 owner 想喺 Gmail UI 直接用 `hello@hkcardcoll.hk` 回信：

1. Gmail → Settings → Accounts → Send mail as → Add another email address
2. Email: `hello@hkcardcoll.hk`
3. SMTP server: `smtp.zoho.com`
4. Port: 465 SSL
5. Username: `hello@hkcardcoll.hk`
6. Password: Zoho App Password（喺 Zoho Security → App Password generate）
7. Zoho 寄一條 verification code 去 hello@ → 喺 Gmail 入面 paste
8. Set 為 default reply address

完成後 owner 喺 Gmail 寫信 / 回信，對方收到 from `hello@hkcardcoll.hk`，但 inbox 集中喺 Gmail。

### Step 7 · Deliverability test（5 min）

1. https://www.mail-tester.com → 比個 test 地址
2. 用 Zoho（唔好用 Gmail send as，因為要測 Zoho 嘅 sending reputation）寄一封 mail 去 test 地址
3. 跑分 → 目標 ≥ 9/10
4. 常見扣分原因：
   - DKIM 未 propagate（等多 12 小時 retry）
   - SPF too permissive（`+all` 改成 `~all`）
   - DMARC missing → 已包喺 Step 3
5. Pass 之後將 DMARC `p=quarantine` 改 `p=reject`（兩週後）

### Step 8 · Landing page hosting（15 min）

Landing page HTML 喺 `/Users/alvin/collectr/growth/landing/index.html`（Task 3 處理）。

選 Cloudflare Pages（同 DNS 同 vendor，最少 friction）：

1. Cloudflare dashboard → Pages → Create a project → Connect to Git
2. 將 landing/ folder push 上 GitHub repo（建議 `hkcardcoll/website`）
3. Build setting：唔需要 framework，static site，root = `growth/landing/`
4. Custom domain: `hkcardcoll.hk` + `www.hkcardcoll.hk`
5. Cloudflare 自動 SSL（Let's Encrypt）+ 自動 redirect www → apex

---

## 04 · 過渡期 Gmail Signature Template

未跑完 Step 1–4 之前，所有 outbound mail（拜訪卡店 cold outreach、media pitch）用呢個 signature。

```
—
Alvin Wong
Founder · HKCardColl
POTO Creative Tech Limited（BR 80363844）

[潛在 / 過渡 email] hello@hkcardcoll.hk（HK domain 啟動中）
[現用] potodesignstudio@gmail.com
[Web] hkcardcoll.hk（即將上線）
```

**Step 4 完成之後**改成：

```
—
Alvin Wong
Founder · HKCardColl
POTO Creative Tech Limited（BR 80363844）

hello@hkcardcoll.hk
hkcardcoll.hk
```

---

## 05 · 完成判斷（Definition of Done）

- [ ] HKDNR 帳號已驗證，可以登入控制台
- [ ] hkcardcoll.hk nameserver 已改成 Cloudflare，Cloudflare dashboard 顯示「Active」
- [ ] DNS 表（A / CNAME / MX × 3 / SPF / DKIM / DMARC / CAA）全部加好
- [ ] Zoho Mail 5 個 mailbox 開好，個人 Gmail 寄入 `hello@hkcardcoll.hk` 收到
- [ ] mail-tester.com 跑分 ≥ 9/10
- [ ] Gmail 已 setup「Send as hello@hkcardcoll.hk」並 verify
- [ ] hkcardcoll.hk 可以 load 到 landing page（Task 3 完成後）
- [ ] product.md · 01 Identity section 更新「官方 email」由「過渡中 → hello@hkcardcoll.hk」改 ✓
- [ ] App Store Connect → Marketing URL 更新做 hkcardcoll.hk（交 Code chat / Claude Code 處理）

---

## 06 · 風險 / 待決

| 風險 | mitigation |
|---|---|
| Zoho Free Plan 可能將來限制更多 / 服務質素降低 | 上線後 3 個月內升 Google Workspace（HK$45/月一個 seat 就夠開頭）|
| HKDNR 帳號 binding 慢，整個 launch timeline 推遲 | 平行做 Task 3（landing HTML）+ Task 4（voice template），DNS 同 email 唔 block 內容創作 |
| DKIM propagate 慢過 24h | 唔好喺 mail-tester 跑分前 launch outreach；先等 deliverability 確認 |
| Cloudflare Pages free tier 可能未來收費 | Vercel / Netlify 同樣 free，3 個都係 vendor-agnostic |

### 待決問題

- [ ] 確認 owner 揀 Zoho 定 Google Workspace（推薦 Zoho 過渡，跑通先升）
- [ ] 是否需要法定 `legal@` 同 `privacy@` 兩個分開？（建議 `legal@` forwarding privacy 一樣，省一個 mailbox）
- [ ] 上線後 cold pitch volume 預期 / 日？如果 > 50 封，要直接用 Google Workspace + transactional email service（Resend / Postmark），唔好谷 Zoho Free quota

---

## 07 · Changelog

| Date | Change |
|---|---|
| 2026-05-17 | 初版建立。推薦 Cloudflare DNS + Zoho Mail Free + Cloudflare Pages hosting |
