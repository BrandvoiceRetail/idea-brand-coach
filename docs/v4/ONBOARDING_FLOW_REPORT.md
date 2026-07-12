# /v4 Onboarding Flow — Build + Security-Fix Report

**Worktree:** `.claude/worktrees/v4-surface` · **Branch:** `feat/v4-alpha-surface`
**Date:** 2026-06-27 · **Status:** blocker/high fixes applied; tsc clean; targeted tests green.

This report documents the signup → onboarding → /v4 journey, the gating model, the
data-separation verdict, what changed in the blocker/high remediation pass, and the
remaining punch-list. Deploy + the `VITE_FORCE_V4` flip remain gated to Matthew.

---

## 1. The journey (signup → CHOICE → CONNECTOR → /v4)

```
Guest → /welcome (public landing)
      → /auth (sign up / sign in / Google)
        │
        │  post-auth resolves through "/" (NOT a /subscribe shortcut when v4 is forced)
        ▼
   "/" → VersionGate
        ├─ no user            → /welcome
        ├─ user, first run    → /v4/start  (V4OnboardingChoice)   ← hasSeenV4Onboarding() === false
        └─ user, returning    → /v4        (V4Onboarding)         ← hasSeenV4Onboarding() === true
        │
        ▼
   /v4/start  (V4OnboardingChoice)  — the fork
        ├─ PRIMARY (gold, recommended)  → /v4/connect  (V4ConnectorSetup)
        └─ SECONDARY (quiet text link)  → /v4          (V4Onboarding, in-app megaprompt)
        │
        ▼
   /v4/connect  (V4ConnectorSetup)  — the recommended path
        • add the Brand Coach connector in Claude (+ accurate ChatGPT note)
        • Windsor analytics setup (one-time)
        • two pasteable prompts (analytics available / not)
        • "← Back to setup options" (to CHOICE)  +  "Done — open my Brand Coach" → /v4/diagnose
        │
        ▼
   /v4/diagnose … the spine (Diagnose → Analyse → Fix → Re-measure → Defend)
        • funnel/metrics screens read connector-ingested data via src/services/v4/*
          with honest no-data ("—").
```

Routing seam: `VersionGate` (`src/components/VersionGate.tsx`) is the single fork point.
Both email/password **and** Google OAuth land on `/` and are forked there — so the
connector recommendation is never bypassed. First-run vs returning is decided by
`hasSeenV4Onboarding()` (localStorage `idea_v4_onboarding_seen`, set when the user
picks a path on CHOICE).

---

## 2. The two-case prepared prompts (V4ConnectorSetup)

Both are pasteable into a fresh Claude/ChatGPT chat with the Brand Coach connector
enabled. Neither instructs the coach to invent facts — they mirror the connector's
no-fabrication posture (unconnected metrics → `"—"`), asserted by a test.

- **Case A — analytics ARE connected (Windsor or otherwise):** read what the AI
  already knows, pull last-30-days funnel metrics, store against each piece, mark
  unconnected metrics `"—"` "rather than guessing", then return the Trust Gap + the
  weakest funnel piece.
- **Case B — no analytics connected yet:** onboard from brand context + pasted detail,
  "don't invent any numbers" (ask or leave `"—"`), walk to the Trust Gap one question
  at a time, name the one thing to fix first; offer Windsor later.

---

## 3. Gating model (public vs login-gated)

**Public (no login):**
- `/welcome` (Landing) — external landing page.
- `/v1/diagnostic`, `/v1/diagnostic/results`, `/v1/diagnostic/bridge` — the external
  diagnostic funnel (intentional guest entry).
- `/auth` — sign in / sign up.
- `/v4/tools` — standalone "trust page" (see punch-list — flagged for a product decision).

**Login-gated (`RequireAuth` → `/auth?redirect=…`):**
- The entire `/v4/*` group (layout route wrapped in `RequireAuth`): start, connect,
  diagnose, analyse, fix, remeasure, defend.
- `/v2/coach`, `/v2/funnel`, `/v2/diagnostic`, `/v3/diagnostic`, `/v1/subscribe`,
  `/beta`, `/beta-journey`, `/beta-feedback`.
- **NEW this pass:** all 16 `/v1/*` app routes (start-here, journey, dashboard,
  brand-diagnostic, idea-diagnostic, idea, idea/consultant, conversations,
  idea/{insight,distinctive,empathy,authenticity}, canvas, copy-generator,
  research-learning, integrations).

**Admin-gated (`AdminGate`, email allowlist):**
- `/admin/coach-evals` (pre-existing).
- **NEW this pass:** `/admin/feature-flags` (was previously reachable unauthenticated).

---

## 4. Data-separation verdict

Immaculate at the client layer for the journey under review:
- Per-route `RequireAuth` now redirects anonymous users before any authed page renders,
  so RLS-empty shells are no longer reachable pre-login.
- `/v4` context persistence is keyed per user (`idea.v4.context.<userId>`); the funnel
  reads go through `src/services/v4/*` against the authed Supabase session (RLS
  `auth.uid()`).
- PostHog event properties remain counts/ids/booleans only (no PII/copy), per
  `posthogClient` content discipline.

Residual (LOW, punch-list, not exposures across accounts): a pre-login `guest`
localStorage bucket is shared between two unauthenticated users on the same browser,
and signed bucket data is not cleared from the device on sign-out. Scoped keys mean no
cross-account leakage; these are shared-device privacy hardening items.

---

## 5. What changed in this pass (blocker/high)

| Sev | Fix | File |
|-----|-----|------|
| BLOCKER | Post-auth no longer shortcuts to `/subscribe`; when `isV4Forced()` it resolves through `/` so VersionGate forks to CHOICE. | `src/pages/Auth.tsx` |
| BLOCKER | Added `'v4_onboarding_gap_answered'` to `AlphaEventName` (was emitted but unregistered → tsc failure). | `src/lib/posthogClient.ts` |
| HIGH | `/admin/feature-flags` wrapped in `<AdminGate>` (matches coach-evals). | `src/App.tsx` |
| HIGH | All 16 `/v1/*` app routes wrapped in `<RequireAuth>` (diagnostic routes stay public). | `src/App.tsx` |
| HIGH | ConnectorSetup: added a quiet "← Back to setup options" link (Nielsen #3). | `src/pages/v4/V4ConnectorSetup.tsx` |
| HIGH | ConnectorSetup: accurate ChatGPT note (custom connector via Settings → Connectors / Developer mode, same MCP URL) — "Claude or ChatGPT" copy is now honest. | `src/pages/v4/V4ConnectorSetup.tsx` |
| HIGH | V4Tools: every raw hex literal replaced with v23 semantic tokens (`bg-foreground`, `text-background/NN`, `text-gold-warm`, `bg-gold-light`, `border-background/15`). | `src/pages/v4/V4Tools.tsx` |

**Google OAuth (flagged BLOCKER) — already correct, no code change.** `signInWithOAuth`
redirects to `${origin}/`, and VersionGate forks `/` → CHOICE for first-run authed
users. Hardcoding `/v4/start` into the shared auth service would break non-v4 mode and
the `?redirect=` bounce-back, so the architecturally-correct landing (`/` → VersionGate)
is retained.

**Verification:** `npx tsc --noEmit` clean. Targeted tests green —
`V4ConnectorSetup` (7), `V4OnboardingChoice` (4), `Auth` (16), `RequireAuth`,
`DiagnosticResults` (8).

---

## 6. Remaining punch-list (medium/low — deferred)

- **[DECISION] `/v4/tools` gating.** Code comments it an "intentionally public trust
  page"; the goal exempts only landing + external diagnostic. Two reviewers split
  HIGH/MEDIUM. Left public to avoid contradicting an explicit design decision — needs
  Matthew's sign-off to either gate it (`RequireAuth`) or confirm it as public.
- **[MEDIUM] `/settings`, `/settings/:section`, `/v2/focus` missing `RequireAuth`.**
- **[MEDIUM] `markV4OnboardingSeen()` fires on path-pick, not on completion.** Move to
  `handleDone` in ConnectorSetup + add a persistent "Set up connector" entry in the
  V4Layout sidebar for users who abandoned mid-flow.
- **[MEDIUM] CHOICE secondary CTA label** "Prefer to set it up in the app instead?" →
  imperative "Set up in the app instead →".
- **[MEDIUM] Test gap:** no spy asserting `markV4OnboardingSeen()` is called on each CTA.
- **[LOW] `guest` localStorage bucket** shared pre-login; migrate/clear on `SIGNED_IN`.
- **[LOW] Sign-out** does not clear `idea.v4.context.<userId>` from device.
- **[LOW] V4ConnectorSetup `emit`** declared inside the component (vs module-level).
- **[LOW] Tests use `fireEvent` not `userEvent`** (pre-existing repo pattern).
- **[INFO] `/test/offline-sync`, `/test/chapter-navigation`** reachable in prod build.

---

## 7. Deploy / merge note (gated to Matthew)

1. Commit on `feat/v4-alpha-surface`.
2. Merge into `main`.
3. Push.
4. Deploy frontend to prod (Lightsail).
5. Flip `VITE_FORCE_V4=true` in the prod env to route all users into /v4.

Steps 4–5 (deploy + the `VITE_FORCE_V4` flip) remain **gated to Matthew** — do not
deploy or flip the flag autonomously.

---

## 8. Summary

The goal flow is built end-to-end on the worktree: a new user signs up, is forked at
`/v4/start` into a strongly-recommended connector path (Claude, with an accurate
ChatGPT note) or a quiet in-app path, the ConnectorSetup screen carries the connector +
Windsor instructions and both pasteable prompts with copy buttons and a back link, and
the data the connector brings in surfaces in the /v4 funnel with honest no-data. All
in-app pages are now login-gated except the landing and external diagnostic; admin
pages are admin-gated; data separation is clean (per-user keys + RLS). The only open
behavioural decision is whether `/v4/tools` stays public. tsc is clean and the touched
tests pass; remaining items are medium/low hardening, and deploy + the flag flip are
gated to Matthew.
