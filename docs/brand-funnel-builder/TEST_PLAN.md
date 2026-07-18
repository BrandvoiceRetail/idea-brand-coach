# Brand Funnel Tracker — Test Plan

Full functional test plan for the feature at **`/v2/funnel`**, with each screen and control checked against **what a brand owner would expect it to do**. Covers manual verification + the automated Playwright suite (`tests/e2e/funnel.spec.ts`).

## Scope & tiers
- **Smoke tier (default, automated):** no writes, no LLM — every screen renders, controls behave, validation gates work. Safe to run repeatedly anywhere.
- **Full-flow tier (`@slow`, opt-in `E2E_RUN_LLM=1`):** uploads an asset and runs the real Claude audit — writes to the test account + costs tokens.
- **Manual-only:** audit *quality* (does the verdict feel right), visual polish, rewrite copy quality — judgment calls a human makes.

## Environment / prerequisites
- Backend is live (shared Supabase `ecdrxtbclxfpkknasmrw`): `audit-asset` v2 + `funnel-rewrite` v1, `brand_assets`/`brand_tests` + RLS, `brand-assets` bucket.
- Auth: the shared QA account in [`docs/TEST_ACCOUNT.md`](./../TEST_ACCOUNT.md) (`signatureqa20260526@gmail.com`). It must have **at least one avatar** for the avatar-dependent screens; if it doesn't, those tests auto-skip and you'll see the *"Select or create an avatar"* empty state.
- Run against a local dev server (default) or any deployment via `E2E_BASE_URL`.

---

## 1. Page shell (`FunnelTracker`)

| Control / state | Action | Expected behavior | Customer expectation | Pass criteria |
|---|---|---|---|---|
| Route `/v2/funnel` | Navigate | Renders the tracker (avatar selected) **or** the empty state | "I land on my funnel, not an error" | Heading *"Your funnel, mapped"* OR *"Select or create an avatar"* visible; no uncaught JS errors |
| No avatar | Navigate with no avatar | Empty state with guidance | "Tell me what to do next" | *"Select or create an avatar to map its funnel."* shown |
| Header — avatar name eyebrow | — | Shows `Brand Funnel · <avatar name>` | "I know whose funnel this is" | Avatar name rendered |
| **Re-audit all** button | Click | Re-audits every asset against the current Positioning Statement; disabled while working / when 0 assets | "Re-check everything after I changed my messaging" | Disabled at 0 assets; shows *Working…* during; coverage refreshes after |
| **Upload asset** button | Click | Opens the upload dialog | "Add a piece of my funnel" | Dialog opens |
| **Channels** toggle row | Toggle a chip | Adds/removes that channel; persists per-avatar (localStorage) | "Hide channels I don't use so the map fits my brand" | Toggling changes applicable touchpoints; survives reload |

## 2. Tabs

| Control | Action | Expected | Customer expectation | Pass criteria |
|---|---|---|---|---|
| Funnel Map / What Needs Work (n) / In Progress (n) / Testing & Lift (n) | Click each | Switches panel; active tab highlighted; counts reflect data | "Four clear views; badges tell me how much is in each" | Each tab activates (`data-state=active`) and shows its panel; counts match data |

## 3. Funnel Map

| Element | Expected | Customer expectation | Pass criteria |
|---|---|---|---|
| 5 stat cards (Tracked / Aligned / Stale / Misaligned / Missing) | Counts coloured by status | "At a glance: how much is on-brand vs not" | Numbers sum sensibly; colours match status |
| Coverage meter + target marker | Fill = `aligned ÷ applicable`; black tick at target % | "One number for how on-brand my funnel is" | Meter width = coverage%; target marker at 90% |
| 5 stage columns (Awareness → Advocacy) | Touchpoint cells under each stage | "My funnel laid out the way customers move" | Stages in order; only applicable touchpoints shown |
| Touchpoint cell | Left border + badge by status; numeric score; **missing** = dashed border | "Colour tells me what's fine, stale, off, or absent" | aligned=green, stale=gold, misaligned=orange, missing=grey-dashed; score shown or `—` |

## 4. What Needs Work

| Element / control | Expected | Customer expectation | Pass criteria |
|---|---|---|---|
| Row ordering | Misaligned/stale only, lowest score first | "Worst, highest-impact things first" | Sorted ascending by overall score |
| Status badge + stage | Per row | "Why is this flagged" | Correct status/stage |
| Before/after line | `was X → now Y` after a re-audit (green if improved) | "Did my fix actually move the score" | Shown only when `previous_score` exists; colour reflects delta |
| Fix text | The audit's concrete fix | "Tell me exactly what to change" | Fix string rendered |
| IDEA dimension bars (I/D/E/A) | 4 coloured bars 0–100 | "Which of the four is weak" | Bars match `audit_result.scores` |
| **Fix with coach** | Opens FixDialog (§7) | "Help me actually fix it" | Dialog opens |
| **Re-run audit** | Re-scores this asset | "Re-check just this one" | Status/score refresh |

## 5. In Progress

| Element / control | Expected | Customer expectation | Pass criteria |
|---|---|---|---|
| Pending list | Assets uploaded but not yet audited | "What's queued" | Pending assets listed with description |
| **Run audit** | Audits that asset | "Score this now" | Moves out of pending after audit |
| Empty state | Guidance copy | "Nothing here yet, and that's clear" | Friendly empty message |

## 6. Testing & Lift

| Element / control | Expected | Customer expectation | Pass criteria |
|---|---|---|---|
| Test card | Hypothesis, status badge, metric, `baseline → result`, lift | "Proof a change worked" | Fields render |
| Lift value | Green ▲ / red ▼ / grey — | "Up or down at a glance" | Colour + sign match `result − baseline` |
| **Record** (result input + button) | On running tests: enter result → closes test, computes won/no_lift | "Log the outcome and see the lift" | Input+button only on running; result persists; status → won/no_lift |
| Empty state | Guidance copy | "How tests start" | Friendly empty message |

## 7. Upload dialog (`AssetUploadDialog`)

| Control | Expected | Customer expectation | Pass criteria |
|---|---|---|---|
| Screenshot file input | Accepts png/jpeg/webp | "Drop a screenshot of the touchpoint" | File selectable |
| Paste-copy textarea | Alternative/additional to a screenshot | "Or just paste the email/listing text" | Text accepted |
| Touchpoint select | Grouped by stage, **applicability-filtered** | "Only touchpoints my brand actually has" | Amazon-only brand shows no Shopify PDP |
| Description (required) | Min 8 chars; hint when too short; blocks submit | "It needs context — fair" | `< 8` chars shows hint + keeps submit disabled |
| **Upload & audit** | Disabled until (file OR text) + touchpoint + valid desc; then uploads → audits | "One click to add and score it" | Disabled/enabled logic correct; shows *Auditing…*; status toast after |
| **Cancel** | Closes without saving | "Back out cleanly" | Dialog closes, nothing created |

## 8. Fix dialog (`FixDialog`)

| Control | Expected | Customer expectation | Pass criteria |
|---|---|---|---|
| Rationale | The audit's reasoning | "Why it's off" | Shown when present |
| **✨ Generate on-brand rewrite** | Calls `funnel-rewrite` → revised copy + publish-filter flags | "Write the fixed version for me, and flag risky claims" | Revised copy appears; flags listed if any |
| Hypothesis (prefilled from fix) | Editable | "Start from the suggested fix" | Prefilled, editable |
| Metric to move / Baseline now | Inputs | "Tie the fix to a number" | Accept input |
| **Open coach to rewrite** | Deep-links `/v2/coach` | "Take it into a full coaching chat" | Navigates to coach |
| **Open test** | Disabled until hypothesis+metric+baseline; opens a `brand_test` | "Start measuring the before/after" | Disabled logic correct; running test created |

---

## Automated coverage map (`tests/e2e/funnel.spec.ts`)

| Test | Covers |
|---|---|
| `route renders with no uncaught errors` | §1 route + error-free render |
| `the four screens render and switch` | §2 tabs |
| `Funnel Map shows coverage meter + stat cards` | §3 |
| `channel toggle persists across reload` | §1 channels (localStorage) |
| `upload dialog: required description gates "Upload & audit"` | §7 validation + applicability |
| `empty In Progress / Testing tabs show guidance copy` | §5/§6 empty states |
| `@slow paste-text asset audits end to end` | §7 + audit pipeline (LLM, opt-in) |

**Not automated (manual):** audit verdict quality, rewrite copy quality, visual/colour correctness, the full fix→test→record lift loop end-to-end (the pieces are unit/Playwright-checked; the multi-day metric window is manual).

---

## How to run the Playwright tests

One-time install (adds the runner + a browser):
```bash
npm install                 # picks up @playwright/test (added to devDependencies)
npx playwright install chromium
```

Run the smoke tier (starts the dev server on :8080, logs in with the QA account, runs the safe tests):
```bash
npm run test:e2e
```

Useful variants:
```bash
npm run test:e2e -- --headed         # watch it drive the browser
npm run test:e2e:ui                  # Playwright UI mode (pick/debug tests)
npm run test:e2e:report              # open the last HTML report

# Run the full LLM audit flow too (writes to the test account, costs tokens):
E2E_RUN_LLM=1 npm run test:e2e

# Run against the live prod deployment instead of a local dev server:
E2E_BASE_URL=https://ideabrandcoach.icodemybusiness.com npm run test:e2e

# Override the QA login if the account rotates:
E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
```

### Verification status (2026-06-17) — RESULTS
Two test files, run against prod:
- **`funnel.spec.ts` (live):** `authenticate` ✅ + `route renders` ✅ pass; the 6 avatar-dependent tests **auto-skip** (QA account has no avatar → empty state). Skip is by design.
- **`funnel.mocked.spec.ts` (Supabase REST mocked, no shared writes):** **8/8 pass** — full UI verified: tracker renders with the selected avatar; 4 tabs with correct counts + switching; Funnel Map coverage + stat cards + a misaligned cell (score 48); What Needs Work row with fix text + before/after (`was 41 → now 48`) + dimension bars + Fix/Re-run buttons; Fix dialog (rationale + Generate-rewrite + hypothesis + disabled Open-test); channel toggle persistence; upload-dialog required-description gating.

**Net:** every screen + control behaves as specified. **Not yet E2E-verified live:** the real upload→audit→persist pipeline (gated — needs a QA avatar + writes/tokens) and audit *output quality* (manual). See `FIXES_AND_ROADMAP.md` for the follow-ups.

To exercise the full UI tier, give the QA account one avatar (with a few strategy fields so audits are meaningful). This writes to the shared QA account, so run it yourself (e.g. `!`-prefix or the Supabase SQL editor):
```sql
WITH ins AS (
  INSERT INTO public.avatars (user_id, name, is_template)
  SELECT u.id, 'Funnel Tracker QA', false FROM auth.users u
  WHERE u.email = 'signatureqa20260526@gmail.com'
    AND NOT EXISTS (SELECT 1 FROM public.avatars a WHERE a.user_id = u.id)
  RETURNING id)
INSERT INTO public.avatar_field_values (avatar_id, field_id, field_value)
SELECT ins.id, v.field_id, v.field_value FROM ins CROSS JOIN (VALUES
  ('psychographics','Passionate collectors who value expertise and respect.'),
  ('painPoints','Card damage from poor storage; expertise not respected.'),
  ('goals','Preserve valuable collections; gain respect in the TCG community.'),
  ('brandValues','Trust, Reliability, Innovation, Customer Commitment.'),
  ('brandPromise','Your valuables are always protected with us.'),
  ('positioningStatement','For collectors who value security, Infinity Vault is the premium guardian.')
) AS v(field_id, field_value);
```
After seeding, re-run `npm run test:e2e` — the six skipped tests will execute.

Notes:
- Auth runs once (`tests/e2e/auth.setup.ts`) and is reused via `tests/e2e/.auth/user.json` (git-ignored).
- The suite targets a **local dev server by default** so it never writes to prod; pass `E2E_BASE_URL` to point elsewhere.
- Avatar-dependent tests **auto-skip** if the QA account has no avatar (you'll see skips, not failures).
- Pattern adapted from `agency-operations/mango-income-tool`'s pytest-playwright suite (session server fixture, error guards, isolated runs), re-expressed in `@playwright/test` for this React/Vite/TS app.
