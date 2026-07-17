---
name: alpha-nightly-walkthrough
description: "Nightly manual QA walkthrough of the LIVE customer-facing alpha surface (v5 at ideabrandcoach.com). Drive the whole customer journey as a real user, log every issue to a dated punch list with screenshots, optionally dispatch fix agents overnight (each fix PR'd + verified), then draft a Slack update to Trevor. This skill is the GATE: never ask Trevor (or any stakeholder) to test a flow that hasn't passed this walkthrough first. Trigger when the user says: run the nightly walkthrough, QA the alpha, walk the app before I message Trevor, do the overnight test-and-fix loop, or is about to send Trevor a 'please test' request."
---

# Alpha Nightly Walkthrough

Individual bug reports from Trevor are expensive: he hits a dead end, loses trust in the build, and
we find out a day later in Slack. The app is the customer's first impression, and Trevor is our
proxy for a paying tester — so **we should hit every issue before he does.** This skill walks the
live customer surface the way a customer would, every night, and turns "hope it works" into
"verified it works, here's the evidence."

## The gate (hard rule — this is the point of the skill)

**No "please test X" comms to Trevor — Slack, email, anything — until this walkthrough has run
against the LIVE surface and the flow either passes or the remaining issues are documented and
disclosed.** This operationalizes the root `AGENTS.md` "Never Do": *never ask Trevor to test,
verify, or re-walk a flow you have not first verified end-to-end yourself.* If you're about to draft
a test request to Trevor and this walkthrough hasn't run today, run it first.

## What to walk — the ONE customer surface

The only customer-facing surface is **v5 at `https://ideabrandcoach.com`** (enforced by
`src/config/surface.ts` `CURRENT_SURFACE` — everything else redirects). Do **not** QA `/v4`, `/v1`,
`/admin`, `/test` — those are internal/legacy and not what a customer sees. If a legacy page is
reachable as a customer, that itself is a blocker (the route manifest should prevent it).

## Process

### 1. Confirm what's actually deployed
Fetch `https://ideabrandcoach.com/index.html` and confirm the served bundle hash matches the intended
`main` tip (per `docs/DEPLOYMENT.md`) — you're testing the *live* build, not a stale one, and not a
worktree. Note the commit/bundle you're walking.

### 2. Drive the full customer journey (browser automation)
Use `playwright` or `claude-in-chrome`. Walk it as **(a) a fresh anonymous visitor** and **(b) a
returning signed-in user** (the shared QA account — `docs/TEST_ACCOUNT.md`; never real customer data):

- **Landing** (`ideabrandcoach.com`) — CTAs resolve, **Log In** is present and works, no links into legacy pages.
- **Run diagnostic** — paste a known ASIN → Avatar 2.0 build theatre → Trust Gap score (4 pillars) →
  Decision Trigger (+ evidence) → design brief (title / bullets / image brief / PPC). Watch for:
  dead-ends, stalls, spinners that never resolve, greyed-out/blank screens that read as errors,
  claim-gate honesty (no unverified claims), and **fact correctness** (brand name filled, trademarked
  ingredients verbatim, review count sane — the AnaGain-class regressions).
- **Save / sign up / sign in** — guest work carries across, no "forgot everything," lands on the
  **dashboard** (must not be a dead end), returning-user home shows their listings.
- **Route/nav check** — hit a few legacy URLs (`/v1/dashboard`, `/dashboard`, `/v4`) and confirm they
  redirect to `/v5`; confirm internal routes bounce a customer to the surface.
- **Feedback widget** — fires and actually lands (submissions have silently dropped before).

### 3. Log every issue to a dated punch list
Write to `_bmad-output/planning-artifacts/{{date}}-alpha-walkthrough-punchlist.md`. For each issue:
the exact screen/URL, a **screenshot**, what a customer would think, and a severity —
**blocker** (breaks the journey) / **rough-edge** (confusing but passable) / **polish**. Diff against
the prior night's punch list so the report is what *changed*, not a re-discovery. Feed recurring
themes to `trevor-concerns-tracker`.

### 4. (Optional, overnight) Auto-fix — verified, PR'd, never reckless
For issues that are **clear, low-risk, and well-understood** (a broken link, a leaked route, a copy
string, a null-guard), dispatch fix agents in **isolated worktrees**. Every fix MUST:
- be **verified by re-driving the affected flow** in the browser (not just tests),
- pass `npx tsc --noEmit` + the touched tests,
- ship as its **own PR** (`branch → commit → gh pr create → gh pr merge`), merged **only after**
  verification — never an unverified commit straight to `main`.
Anything ambiguous, cross-cutting, or a **product/strategy judgment call** (copy tone, framing,
methodology, "should this screen exist") is **NOT auto-fixed** — route it to Matthew, and **never**
to Trevor.

### 5. Deploy + re-verify
If fixes shipped, deploy per `docs/DEPLOYMENT.md` (frontend rsync from latest `main`; ask-first on
edge-fn/schema), then re-confirm the live bundle hash and **re-walk the fixed flow** to prove it.
Beware the known gotchas: Supabase free-tier auto-pause, and a billing blip on the AI engine can look
like a bug (a failed run may be infra, not a defect) — see `docs/DEPLOYMENT.md` / memory.

### 6. Draft the Slack update to Trevor (only now)
Once the walkthrough passes (or issues are documented), draft — don't auto-send unless told — a
concise update to Trevor: what was walked, what was **fixed + verified** (with the proof), what's
**ready for him to look at**, and any **known issues we're disclosing up front**. State only what was
personally exercised end-to-end. `#brand-coach-user-feedback` or the Trevor DM is the usual channel.

## Cadence / automation

Nightly. Schedule with `/loop` (interval) or the `schedule` skill (cron routine) with this skill as
the payload. For the full unattended mode, chain: **walk → punch list → auto-fix (verified, PR'd) →
deploy → re-verify → draft Trevor update**, and fire a `PushNotification` (and the Slack draft) when
it completes, at whatever hour it finishes. Keep each night's run scoped and time-boxed.

## Guardrails
- **LIVE customer surface only** (v5). QA account only — never real customer data.
- **Verify-before-Trevor is absolute** — the whole reason this skill exists.
- Fixes are **PR'd + verified before merge**; no unverified commits to `main`; product-judgment issues go to Matthew, not Trevor and not the auto-fixer.
- **Screenshot evidence** for every logged issue.
- A failed step may be **infra** (Supabase pause / billing), not a bug — check before logging it as a defect or "fixing" it.

## Related
- `verify` skill (verifies one specific change end-to-end — this walks the *whole* surface).
- `trevor-concerns-tracker` (recurring themes from Trevor's feedback — this skill exists so he has fewer to raise).
- `docs/TEST_ACCOUNT.md` (QA account + browser-QA setup), `docs/DEPLOYMENT.md` (deploy + verify), `src/config/surface.ts` (the single-surface enforcement this walkthrough audits).
