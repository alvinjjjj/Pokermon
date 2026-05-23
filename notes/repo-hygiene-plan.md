# Repo Hygiene Plan · 2026-05-23

> Block 2 output of repo-hygiene-task-blocks.html (Path G).
> Inventory of `/Users/alvin/collectr/` uncommitted state on `feat/theme-system`
> as of 2026-05-23 17:00 HKT. No `git add` / `commit` / `rm` performed.
> Block 3 will execute commits based on this plan (after user/whiteboard review).

## Snapshot

- **Total dirty files**: 162
- **Untracked (`??`)**: 114
- **Modified (`M`)**: 21
- **Deleted (`D`)**: 27
- **Stashes**: 0
- **Commits on `feat/theme-system` ahead of `main`**: 0 (branch is empty shell)
- **Last actual commit on `main`**: `84ba8f5` "Update" (2026-05-07)
- **Gap**: ~16 days of work never committed

## Top-level distribution

| Dir / Root | File count | Nature |
|---|---|---|
| `app/` | 78 | Feature rewrite + route restructuring |
| `assets/` | 69 | Icon set replacement + new brand assets |
| `components/` | 28 | Expo template wipeout + new components |
| `lib/` | 14 | New data layers |
| `scripts/` | 12 | Data scrapers + QA |
| `constants/` | 8 | Domain lookup tables (theme.ts deleted) |
| `hooks/` | 6 | Entire dir wiped (Expo template only) |
| `supabase/` | 2 (dir = many) | 4 edge functions + migrations + seeds |
| `contexts/` | 2 (dir) | React Context layer (matches product.md) |
| `locales/` | 2 (dir) | i18n: zh-HK / zh-CN / en / ja |
| Root config | ~9 | `.gitignore`, `app.json`, `tsconfig.json`, `package*.json` M; `babel.config.js`, `eas.json`, `.env.example` ?? |
| Root docs | ~12 | `product.md`, `APP_STORE_CHECKLIST.md`, brand docs, code reviews |
| Brand / biz dirs | 9 dirs | `notes/`, `brand/`, `decks/`, `journal/`, `growth/`, `ops/`, `build/`, `legal/`, `app-store/` |
| Misc | mixed | `pokemon_box_images/`, `outputs/`, `ov-*.jpg`, deprecated `.pptx` |

## Commit Groups (proposed order)

### Group 1 · `chore: remove unused Expo create-app template stubs`
**Files (14):**
- `components/themed-text.tsx` D
- `components/themed-view.tsx` D
- `components/external-link.tsx` D
- `components/haptic-tab.tsx` D
- `components/hello-wave.tsx` D
- `components/parallax-scroll-view.tsx` D
- `components/ui/collapsible.tsx` D
- `components/ui/icon-symbol.ios.tsx` D
- `components/ui/icon-symbol.tsx` D
- `constants/theme.ts` D
- `hooks/use-color-scheme.ts` D
- `hooks/use-color-scheme.web.ts` D
- `hooks/use-theme-color.ts` D
- `app/modal.tsx` D

**Rationale:** Vestigial scaffolding from `create-expo-app` that production code never referenced. Removing first creates a clean canvas for Group 2-12 additions. `hooks/` dir disappears entirely (no replacement hooks landed yet).

**Action:** `git rm` each path. Single commit.

---

### Group 2 · `feat(i18n): add zh-HK / zh-CN / en / ja localization`
**Files (6):**
- `locales/en.json`
- `locales/ja.json`
- `locales/zh-CN.json`
- `locales/zh-HK.json`
- `lib/i18n.ts`
- `components/LanguagePicker.tsx`

**Rationale:** i18next + react-i18next setup matching `product.md` §02. Detection priority: AsyncStorage → device locale → `zh-HK` fallback. Self-contained layer; nothing else depends on it ordering-wise.

**Action:** `git add locales/ lib/i18n.ts components/LanguagePicker.tsx`. Single commit.

---

### Group 3 · `feat(context): add Currency + Language React contexts`
**Files (2):**
- `contexts/CurrencyContext.tsx`
- `contexts/LanguageContext.tsx`

**Rationale:** React Context layer (`product.md` §02). `CurrencyContext` provides HKD/USD/JPY/CNY conversion (hardcoded rates relative to USD). `LanguageContext` likely wraps i18n state. Depends on Group 2.

**Action:** `git add contexts/`. Single commit.

---

### Group 4 · `feat(data): add price + image data layers`
**Files (6):**
- `lib/artofpkm.ts`
- `lib/boosterPrices.ts`
- `lib/jpImages.ts`
- `lib/lowestPrices.ts`
- `lib/pokeprice.ts`
- `lib/supabase.ts` M (likely env-loaded refactor matching worktree's PR #1 pattern — verify)

**Rationale:** Server-side data fetchers, helpers calling `supabase.functions.invoke()` for ppt-proxy / pc-proxy / artofpkm. Replaces direct upstream API calls in client. **Group 7 depends on this** (the tab rewrites import these).

**Action:** `git add lib/`. Verify `lib/supabase.ts` change is env-load (consistent with worktree PR #1) before commit.

**Flag for review:** Cross-check `lib/supabase.ts` M with worktree's `lib/supabase.ts` change. If two paths converged differently, merge resolution needed before commit.

---

### Group 5 · `feat(constants): add domain lookup tables`
**Files (3):**
- `constants/boosterBoxes.ts`
- `constants/config.ts`
- `constants/pokemonNames.ts`

**Rationale:** Static data — booster box catalog, app config, Pokemon name index. Used by lib/ + app/ groups.

**Action:** `git add constants/boosterBoxes.ts constants/config.ts constants/pokemonNames.ts`. Single commit.

---

### Group 6 · `feat(supabase): edge functions + migrations + seeds`
**Files (dir contents):**
- `supabase/functions/delete-account/`
- `supabase/functions/moderate-post/`
- `supabase/functions/pc-proxy/`
- `supabase/functions/ppt-proxy/`
- `supabase/migrations/` (count TBD — Block 3 inspect)
- `supabase/seeds/` (count TBD)
- `supabase/config.toml` (probably exists; verify)

**Rationale:** Backend infrastructure. 4 functions are deployed in production already (verified today via `supabase functions list`). Migrations + seeds capture DB schema evolution.

**Action:** `git add supabase/`. Single commit — but inspect `supabase/migrations/` first to confirm no sensitive seed data leaks (default seed files sometimes contain test passwords).

**Flag for review:**
- `pc-proxy` is "ghost" feature per today's INC-2 finding (deployed but Supabase secret never set; `lib/boosterPrices.ts` references it → silent fail). Decide: keep / decommission / activate after commit.
- Confirm `supabase/seeds/` has no test users with hardcoded passwords.

---

### Group 7 · `chore(security): land admin RPCs SQL migration`
**Files (1):**
- `20260514_admin_rpcs_and_role_PATCHED.sql` (currently at repo root — misplaced)

**Rationale:** This is `APP_STORE_CHECKLIST.md` §1's "Security Migration". Currently lives at repo root rather than `supabase/migrations/`. Idempotent (PATCHED comment in file).

**Action:**
1. `git mv 20260514_admin_rpcs_and_role_PATCHED.sql supabase/migrations/20260514_admin_rpcs_and_role_PATCHED.sql`
2. Commit.

**Flag for review:** Has this migration been deployed to production? `APP_STORE_CHECKLIST.md` §1 says "still on your computer, never pushed". Verify via `supabase db diff --linked` before committing OR before Block 3 sequencing — Group 6 might already include this file under `supabase/migrations/`.

---

### Group 8 · `feat(app): restructure routes + add merchant / listing / chat flows`
**Files (~32):**

Modified (full rewrite of tabs to use i18n + CurrencyContext + lib/pokeprice):
- `app/(tabs)/_layout.tsx` M
- `app/(tabs)/index.tsx` M (verified: imports `useTranslation`, `useCurrency`, `lib/pokeprice`)
- `app/(tabs)/notifications.tsx` M
- `app/(tabs)/portfolio.tsx` M
- `app/(tabs)/profile.tsx` M
- `app/(tabs)/search.tsx` M
- `app/(tabs)/settings.tsx` M
- `app/(tabs)/shops.tsx` M
- `app/(tabs)/social.tsx` M
- `app/_layout.tsx` M
- `app/login.tsx` M
- `app/new-post.tsx` M
- `app/onboarding.tsx` M
- `app/register.tsx` M

Untracked new routes:
- `app/(tabs)/card/` (dir — likely card detail)
- `app/(tabs)/inbox.tsx`
- `app/admin.tsx`
- `app/card/` (dir)
- `app/chat/` (dir)
- `app/edit-profile.tsx`
- `app/edit-shop.tsx`
- `app/followers.tsx`
- `app/following.tsx`
- `app/listing-upload.tsx`
- `app/listing/` (dir)
- `app/merchant-registration.tsx`

Deleted (old route paths from Group 0 layout):
- `app/app/edit-profile.tsx` D (moved to `app/edit-profile.tsx`)
- `app/app/register.tsx` D (replaced)
- `app/home/index.tsx` D (replaced by `app/(tabs)/index.tsx`)

**Rationale:** Routes restructured into expo-router conventional layout. Adds entire merchant/listing/chat/social feature set. Depends on Groups 2/3/4/5.

**Action:** Land as ONE commit if treating as "rewrite snapshot", OR split:
- 8a · route restructure (modified `app/*` + deletions)
- 8b · merchant feature (`app/edit-shop.tsx`, `app/merchant-registration.tsx`, `app/admin.tsx`)
- 8c · listing feature (`app/listing-upload.tsx`, `app/listing/`)
- 8d · chat / inbox (`app/chat/`, `app/(tabs)/inbox.tsx`)
- 8e · social (`app/followers.tsx`, `app/following.tsx`)
- 8f · card detail (`app/card/`, `app/(tabs)/card/`)

**Flag for review:** This is the largest group and the most risky. Splitting (8a-8f) improves reviewability but takes ~5x longer to execute. Whiteboard call.

---

### Group 9 · `feat(ui): add Loader / Skeleton / Splash / Header primitives`
**Files (4):**
- `components/Loader.tsx`
- `components/SkeletonCard.tsx`
- `components/SplashScreen.tsx`
- `components/Header.tsx` M

**Rationale:** Reusable UI primitives consumed by Group 8 routes. Header.tsx modified (currency selector logic — same UI we saw in worktree).

**Action:** `git add` each. Single commit.

---

### Group 10 · `chore(assets): replace CJK-named icons with English set + brand images`
**Files (~46):**

Deletions (Chinese-named icon set):
- `assets/icons/alart.png` D
- `assets/icons/主頁.png` D
- `assets/icons/作品集.png` D
- `assets/icons/個人.png` D
- `assets/icons/商店.png` D
- `assets/icons/搜尋.png` D
- `assets/icons/社交.png` D
- `assets/images/Onboarding_01.png` D
- `assets/images/Onboarding_02.png` D
- `assets/images/Onboarding_03.png` D

Untracked new icons + images:
- `assets/icons/{Certification,camera,delete,home,location-marker,logout,love,message,notification,password,pen,portfolio,profile,search,shops,social,version}.png`
- `assets/images/{Logo,Onboarding_001,Onboarding_002,Onboarding_003,Roading}.{png,jpg}`
- `assets/lottie/` (new dir — animation files)
- `assets/icons/personal porfolio.png` (filename has space + typo "porfolio")
- `assets/icons/service list.png`

**Rationale:** Icon set migration from Chinese filenames (build-fragile, hard for non-CJK reviewers) to English. Adds onboarding visuals + lottie animations.

**Action:** Land as one commit `chore(assets): icon set + brand asset refresh`.

**Flag for review:**
- `assets/icons/personal porfolio.png` typo → rename `personal-portfolio.png` before commit
- `assets/icons/service list.png` space → rename `service-list.png`
- Confirm Group 8 tabs reference the NEW icon paths (not still pointing to deleted CJK ones — `_layout.tsx` of worktree still imports `'../../assets/icons/主頁.png'` etc.; verify main's version)
- `assets/lottie/` may be large — check for binary weight before commit (LFS candidate?)

---

### Group 11 · `chore(scripts): data scrapers + QA setup helpers`
**Files (6):**
- `scripts/debug-artofpkm.mjs`
- `scripts/import-to-supabase.mjs`
- `scripts/pokemon_box_downloader.py`
- `scripts/qa-fix-normal-user.mjs`
- `scripts/qa-setup.mjs`
- `scripts/scrape-artofpkm.mjs`

**Rationale:** Build-time helpers per `APP_STORE_CHECKLIST.md` §7 "trainer 卡 scraper". Not runtime code.

**Action:** `git add scripts/`. Single commit.

**Flag for review:** `qa-setup.mjs` + `qa-fix-normal-user.mjs` may contain test phone numbers / OTP values — confirm no secrets embedded before commit. Strongly consider gitleaks pass on `scripts/` before staging.

---

### Group 12 · `build: tooling + config sync`
**Files (~9):**

Modified:
- `.gitignore` M
- `app.json` M
- `package.json` M
- `package-lock.json` M
- `tsconfig.json` M

Untracked:
- `babel.config.js`
- `eas.json`
- `.env.example`
- `start-expo.command` (Mac launcher shell script)

**Rationale:** Config drift from `create-expo-app` baseline as new deps + EAS build added. `.env.example` makes setup discoverable for collaborators.

**Action:** `git add` each. Single commit.

**Flag for review:**
- `start-expo.command` — local convenience or shared? If only useful for current dev, gitignore instead.
- Confirm `.env.example` has no real values (template only).
- Confirm `eas.json` has no embedded credentials.

---

### Group 13 · `docs: product specs, code reviews, app-store + legal copy`
**Files (root-level .md):**
- `APP_STORE_CHECKLIST.md`
- `CODE_REVIEW_2026-05-13.md`
- `CODE_REVIEW_2026-05-13_round2.md`
- `DATA_MANAGER_REPORT.md`
- `FIXES_2026-05-14.md`
- `MERCHANT_SPEC.md`
- `START-HERE.md`
- `product.md`

**Dirs:**
- `app-store/` (App Store listing copy)
- `legal/` (privacy + terms)
- `notes/` (chat migration / session logs / **this file**)
- `brand/` (brand book + voice.md)

**Rationale:** Source-of-truth docs the team / Claude sessions reference. Committing them puts everyone on same page.

**Action:** Bulk `git add` listed paths. Single commit (or split by domain if preferred).

**Flag for review:**
- Confirm `legal/privacy-policy.md` + `legal/terms-of-service.md` don't include test PII.
- `app-store/description.md` may contain test demo account credentials (Apple reviewer notes) — fine, but flag.
- `MERCHANT_SPEC.md` — verify no PII of real merchants.

---

### Group 14 · `docs(strategy): business / growth / journal / ops`
**Dirs:**
- `decks/` (5 files: HKCardColl_*.pptx + `_HANDOFF_FOR_DESIGN.md`)
- `journal/` (`2026-05.md`)
- `growth/` (sub-dirs: artifacts/, daily/, landing/, lane1_foundation/, social/)
- `ops/` (`airwallex_ebay_dev_sop.md`)

**Rationale:** Strategy / operations / journal. Distinct from product spec.

**Action:** `git add` each. Single commit.

**Flag for review:**
- `decks/*.pptx` are BINARIES — Git LFS candidates. If keeping in regular git, repo size will balloon. Decision: LFS / separate docs repo / keep inline?
- `ops/airwallex_ebay_dev_sop.md` may contain account numbers / API credentials — gitleaks pass before commit.

---

### Group 15 · `docs(artifacts): Cowork-generated HTML task blocks + brand book + launch readiness`
**Files (root-level .html):**
- `brand-book.html` (~39 KB)
- `launch-readiness.html` (~40 KB)
- `repo-hygiene-task-blocks.html` (~27 KB)
- `theme-task-blocks.html` (~29 KB)

**Rationale:** Self-contained HTML pages generated by Cowork as task-tracking artifacts. Currently file mode `-rw-------` (chmod 600 — user-only).

**Action:** `git add *.html`. Single commit.

**Flag for review:**
- Do these artifacts belong in main repo or `notes/artifacts/`?
- Confirm chmod is intentional (or normalize to 644).
- Will these be regenerated by Cowork periodically? If yes, expect churn on each session → maybe move to `.gitignore` and keep ad-hoc.

---

### Group 16 · `chore(decks): archive deprecated Collectr-era binaries`
**Files (3):**
- `Collectr_Company_Overview_DEPRECATED.pptx`
- `Collectr_Grant_Application.docx`
- `Collectr_Investor_Deck_DEPRECATED.pptx`

**Rationale:** Pre-rebrand artifacts already labeled DEPRECATED.

**Action:** Two options:
- (a) `git mv` into `decks/archive/` then commit
- (b) Delete entirely (not even committed) — they're labeled deprecated, regeneratable from source PPTX history if needed

Recommend (b) unless explicit retention need.

**Flag for review:** Confirm with user before delete-without-commit.

---

## Files NOT to commit

Add to `.gitignore` rather than tracking:

| Path | Reason |
|---|---|
| `pokemon_box_images/` | Scraper output, regeneratable, ~? size |
| `outputs/` (contains `hkcc-action-tracker.html`) | Generated artifact |
| `build/` (contains `Logs`) | Build artifact |
| `.claude/` | Local Claude Code config (worktrees, sessions) |
| `ov-*.jpg`, `ov2-*.jpg` (14 files at root, ~48-60 KB each) | Likely ephemeral screenshots; consider `screenshots/` dir + gitignore |
| `*.bak`, `*.swp`, `.DS_Store` | Standard editor / OS noise (none present today, but proactive add) |
| `start-expo.command` | If local-only dev convenience |

**Action:** Update `.gitignore` (already `M` — append these patterns) as part of Group 12 commit.

---

## Open questions for whiteboard review

| # | Question | Blocks | Recommendation |
|---|---|---|---|
| Q1 | **Split Group 8 into 8a-8f?** Largest group (~32 files, rewrite + 5 feature areas). Single commit easier but harder review; split = 5× time. | Group 8 | Whiteboard call. My lean: single commit "rewrite snapshot" since branch has 0 history — clean baseline matters more than per-feature granularity for this catch-up commit. |
| Q2 | **Decks LFS / separate repo?** `decks/*.pptx` are binaries; each commit balloons repo size. | Group 14 | Set up Git LFS for `*.pptx` `*.docx` `*.pdf` before commit; OR migrate decks to separate `hkcardcoll-docs` repo. |
| Q3 | **Cowork HTML artifacts in git?** `brand-book.html` / `launch-readiness.html` / `*-task-blocks.html` regenerable; cluttery in diff. | Group 15 | Lean: keep in `notes/artifacts/`, gitignore root `.html`. |
| Q4 | **`lib/supabase.ts` diff vs worktree PR #1 diff** — both branches independently moved this file. Conflict risk when merging. | Group 4 | Inspect `git diff` against `main` for main checkout + worktree's commit before staging. Reconcile manually. |
| Q5 | **`20260514_admin_rpcs_and_role_PATCHED.sql` deployment status** — committed to git but maybe not pushed to Supabase, or pushed but file just lying around | Group 7 | Run `supabase db diff --linked` to verify deployed state matches file contents BEFORE deciding to land. |
| Q6 | **CJK-named icon references in code** — `app/(tabs)/_layout.tsx` (worktree) still references `'../../assets/icons/主頁.png'` etc. If main checkout's `_layout.tsx` also references CJK paths but those files deleted → runtime crash. | Groups 8, 10 | Cross-check Group 8 source for icon path references before committing Group 10's deletions. |
| Q7 | **`Collectr_*_DEPRECATED.pptx` — archive or discard?** | Group 16 | Confirm with user. |
| Q8 | **`scripts/qa-*.mjs` secret scan** | Group 11 | gitleaks pass before staging. |
| Q9 | **`.env.example` content correctness** — does it cover all the new env vars introduced by Groups 4/6? | Group 12 | Diff against actual `.env` and confirm key set matches (without copying values). |
| Q10 | **Order of operations: Group 1 (deletions) first vs intermixed?** Deleting Expo template stubs before adding replacements risks broken intermediate state if rolling back. | All | Recommend Group 1 first only if no commit will be rolled back individually. Otherwise interleave Group 1 with Group 8 (single "swap" commit). |

---

## Summary stats for Block 3 planning

- **Total commit groups proposed:** 16
- **Single-commit groups (low risk, just add):** 1, 2, 3, 5, 9, 11, 13, 14
- **Groups needing pre-commit inspection:** 4, 6, 7, 8, 10, 12, 15 (security / cross-cutting / binary weight)
- **Groups flagged for explicit whiteboard decision:** 8 (split y/n), 14 (LFS), 15 (commit vs gitignore), 16 (archive vs delete)
- **Estimated execution time for Block 3:** 90-120 min including spot-checks (inspection findings may force re-grouping)
- **`.gitignore` updates folded into Group 12**

---

## Branch + path-of-execution notes

- `feat/theme-system` is a 0-commit empty shell; can rename if "theme" framing is misleading after seeing actual scope. Suggested rename candidates: `chore/repo-hygiene-2026-05-23`, `feat/foundation-snapshot`, or keep current.
- Worktree (`claude/dazzling-poincare-afe791`) has its own `constants/colors.ts` (PR #1 branch) — independent of this plan. After Block 3 lands on main, merge PR #1 OR cherry-pick `colors.ts` into a fresh `feat/theme-system` based on new main.
- Backup tarball (Block 1, 329 MB) covers rollback if Block 3 execution corrupts state.
