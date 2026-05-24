# PR #1 Reconciliation Matrix · 2026-05-24

> Block 4 Step 1 output. Read-only diagnose of worktree `claude/dazzling-poincare-afe791`
> (PR #1 on GitHub) vs main checkout's `chore/repo-hygiene-2026-05-23` branch.
> No reconciliation action executed yet — this matrix is the input for Block 4 Step 2.

## Branches

| Branch | Working dir | HEAD | Commits ahead of main |
|---|---|---|---|
| `chore/repo-hygiene-2026-05-23` | `/Users/alvin/collectr` (main checkout) | `662b859` | 16 |
| `claude/dazzling-poincare-afe791` | `/Users/alvin/collectr/.claude/worktrees/dazzling-poincare-afe791` | `9c98a5b` | 3 |
| `main` | (not actively checked out) | `84ba8f5` | 0 (baseline) |
| `origin/main` | remote | `84ba8f5` | up-to-date |
| `origin/chore/repo-hygiene-2026-05-23` | remote | `662b859` ✓ pushed | — |
| `origin/claude/dazzling-poincare-afe791` | remote | `9c98a5b` ✓ pushed | — |

Both feature branches diverged from common base `84ba8f5 Update` (2026-05-08).

## Worktree unique commits (3)

| SHA | Message | Date | Lines |
|---|---|---|---|
| `b598fd5` | Move secrets to env; add pokemontcg-proxy edge function | 2026-05-17 | +437 / -45 (14 files) |
| `59bcb3b` | Document pokemontcg.io key auth finding in CLAUDE.md | 2026-05-17 | +10 / -3 (1 file) |
| `9c98a5b` | Add .gitleaksignore for triaged INC-3 findings | 2026-05-17 | +21 (1 file) |

All landed via PR #1 (https://github.com/alvinjjjj/Pokermon/pull/1).

## Overlap matrix (15 files)

### OVERLAP — both branches modified (7 files)

| File | Worktree intent | Main intent | Verdict | Rationale |
|---|---|---|---|---|
| `.env.example` | Basic Supabase URL+anon template | Comprehensive multi-key template (159a29c) | **KEEP MAIN** | Main's is superset; covers PPT/PC/SERVICE_ROLE entries |
| `.gitignore` | `.env*.local` → `.env` + `.env.*` + `!.env.example` | Same + adds `pokemon_box_images/` + `outputs/` + `build/` + `.claude/` + `ov-*.jpg` + `*.bak` + `.DS_Store` + `supabase/.temp/` + `/*.html` + `Finance invoice and receive/` | **KEEP MAIN** | Main's is comprehensive evolution |
| `app/(tabs)/index.tsx` | Removed hardcoded `API_KEY = 'b58e91e7-...'`, refactored 2 fetches via `lib/pokemontcg.ts` helper | Full rewrite (1f5b273 feat(app)): +1067 lines — i18n via useTranslation, useCurrency context, lib/pokeprice data layer integration, expo-image, FlatList, etc. | **KEEP MAIN** | Main is production rewrite; worktree was small refactor of pre-rewrite version |
| `app/(tabs)/portfolio.tsx` | Same as index.tsx pattern | Full rewrite (1f5b273): +778 lines | **KEEP MAIN** | Same logic |
| `app/(tabs)/search.tsx` | Same as index.tsx pattern + rename local `searchCards` → `runSearch` | Full rewrite (1f5b273): +1794 lines — most-changed tab | **KEEP MAIN** | Same logic |
| `lib/supabase.ts` | **Strict throw** if env missing | **Silent `?? ''`** fallback (5a18925) | ⭐ **CHERRY-PICK WORKTREE** | Fail-fast at startup is correct security/UX choice. Main's silent fallback would let app run with empty Supabase URL → cryptic runtime errors later. Documented as Block 4 backlog. |
| `tsconfig.json` | Add `exclude: ["supabase/functions/**"]` (single entry) | Add `exclude: ["node_modules", "supabase/functions", "ios", "build"]` (4 entries, includes worktree's) | **KEEP MAIN** | Main's is broader; covers worktree's intent as a subset |

### WORKTREE-ONLY — only on worktree (8 files)

| File | What it is | Verdict | Rationale |
|---|---|---|---|
| `.gitleaksignore` | Audit-trail for 5 INC-3 findings (Supabase anon JWT, pokemontcg.io key in history) | ⭐ **CHERRY-PICK** | Useful for future gitleaks runs on main checkout history; main hasn't done its own scan yet — same findings exist there |
| `CLAUDE.md` | 211-line AI-agent onboarding doc | ⭐ **CHERRY-PICK** | Main checkout has no CLAUDE.md — future Claude sessions on main lack onboarding |
| `README.md` | "Welcome to your Expo app" template → "HKCardColl mobile app" + Setup section (npm install / env / edge function deploy) | ⭐ **CHERRY-PICK** | Main still has default Expo template; worktree's Setup section is collaborator-useful |
| `lib/pokemontcg.ts` | `searchCards()` + `getCard()` helpers calling pokemontcg-proxy edge function | ⭐ **CHERRY-PICK** | Required if pokemontcg-proxy comes; complements main's existing `lib/pokeprice.ts` (different upstream) |
| `supabase/.gitignore` | `.branches/` + `.temp/` patterns | **ABANDON** | Redundant — main uses root `.gitignore` pattern `supabase/.temp/` (committed in 5931c2b + b1a5ce7 lineage). Two .gitignores conflict in spirit. |
| `supabase/config.toml` | `project_id = "vudqydqzrlgetcdegfvc"` + `[functions.pokemontcg-proxy] verify_jwt = true` | ⭐ **CHERRY-PICK** | Canonical Supabase CLI config; main checkout has the project linked via `.temp/linked-project.json` but no committed config.toml. Best practice to commit config.toml. |
| `supabase/functions/_shared/cors.ts` | Shared CORS headers helper | ⭐ **CHERRY-PICK** | Useful pattern; main's 4 existing functions inline CORS each (DRY violation). Once shared helper exists, future refactor can dedupe. |
| `supabase/functions/pokemontcg-proxy/index.ts` | Deno edge function proxying api.pokemontcg.io | ⭐ **CHERRY-PICK** | **Critical**: function is ALREADY DEPLOYED to production Supabase (v1, 2026-05-17 07:24 UTC) but main checkout has NO source code — orphan deployment. Bringing source closes the gap. |

## Verdict counts

- **KEEP MAIN**: 6 files (5 overlap + 1 from tsconfig revision)
- **CHERRY-PICK WORKTREE**: 8 files (1 overlap [lib/supabase.ts] + 7 worktree-only)
- **ABANDON**: 1 file (supabase/.gitignore)
- **Total**: 15 ✓

## Recommendation

**CHERRY-PICK approach (single new commit on `chore/repo-hygiene-2026-05-23`)** + delete worktree.

### Rationale
- 8 of 15 files have unique worktree value (66% — too many to abandon)
- 6 files: main's evolution is strictly better (keep as-is)
- 1 file: clearly redundant (abandon)
- 3 worktree commits don't preserve meaningful history (intermediate exploration; the *output files* matter, not the commit-by-commit narrative)
- Single cherry-pick commit cleaner than 3-way rebase + conflict resolution

### Execute steps (for Block 4 Step 2 prompt)

1. **From `chore/repo-hygiene-2026-05-23`** (main checkout), apply 8 worktree files:
   - Modify: `lib/supabase.ts` (strict throw pattern from worktree)
   - Add: `CLAUDE.md`, `lib/pokemontcg.ts`, `supabase/config.toml`,
     `supabase/functions/_shared/cors.ts`, `supabase/functions/pokemontcg-proxy/index.ts`,
     `.gitleaksignore`
   - Modify: `README.md` (Setup section from worktree)
2. **Commit** as single atomic: `feat: cherry-pick worktree PR #1 unique contributions`
3. **Push** the new commit
4. **Close PR #1** on GitHub (no merge — superseded by cherry-pick commit)
5. **Delete worktree branch**:
   - `git push origin --delete claude/dazzling-poincare-afe791`
   - `git worktree remove /Users/alvin/collectr/.claude/worktrees/dazzling-poincare-afe791`
   - `git branch -D claude/dazzling-poincare-afe791`
6. **Verify**: `git branch -a` shows only main + chore/repo-hygiene-2026-05-23
7. **Open new PR** from `chore/repo-hygiene-2026-05-23` → `main` if not already (replaces PR #1)

## Worktree-only artifacts (potential orphans if we ABANDON instead)

If user reverses recommendation and chooses ABANDON, these would be lost:
- `CLAUDE.md` — AI onboarding doc
- `.gitleaksignore` — audit trail
- `lib/pokemontcg.ts` — helper for pokemontcg-proxy
- `supabase/functions/pokemontcg-proxy/index.ts` — orphan production function
- `supabase/functions/_shared/cors.ts` — CORS helper
- `supabase/config.toml` — Supabase CLI canonical config
- `README.md` Setup section
- `lib/supabase.ts` strict-throw pattern

All listed in §"WORKTREE-ONLY" above with CHERRY-PICK verdict. Loss would be material.

## Open questions for whiteboard

| # | Question | Default |
|---|---|---|
| Q1 | Confirm CHERRY-PICK approach (vs ABANDON / REBASE / SPLIT) | CHERRY-PICK |
| Q2 | Bundle all 8 cherry-picks into ONE commit, or split (e.g., docs separately, infra separately)? | ONE commit — small change set, atomic is clearer |
| Q3 | Close PR #1 with manual comment ("superseded by cherry-pick in <new-sha>") or auto-close via branch delete? | Manual comment + close (preserves audit trail) |
| Q4 | Delete worktree directory + branch immediately after cherry-pick succeeds, or hold for 1 day in case of regression? | Immediate (we have Block 1 tarball + git LFS as backup) |
| Q5 | Should `lib/supabase.ts` strict-throw change be its own commit (since it's behaviorally different)? | Fold into single commit — change is small + obvious |

## Files NOT in this analysis (out of scope)

- `decks/`, `notes/`, `brand/`, `journal/`, `growth/`, etc. — main-checkout-only, not on worktree
- `app/(tabs)/_layout.tsx`, `app/(tabs)/notifications.tsx`, etc. — main-only changes; worktree didn't touch
- `.env` — gitignored on both, not relevant
- `Finance invoice and receive/` — gitignored on main, doesn't exist on worktree

---

**Status**: Matrix complete. Awaiting whiteboard review + Block 4 Step 2 execution prompt.
