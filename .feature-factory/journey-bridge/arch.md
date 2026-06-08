# Journey Bridge — Architecture (F-059)

Stitch the alpha into one continuous journey:
diagnostic → Trust Gap™ scorecard → **"Let's go deeper"** → bridge → Layer 1 chat
(`/v2/coach`, with reviews-paste) → **Reveal Signature** → 3–4 options → pick.

Scope: **wiring only** (Gen 3 locked, Trevor Decision 2). No new features, no
framework change, no coach rewrite.

## The gap being closed

`TrustGapScorecard` CTA routed to a **static, frozen** IDEA pillar page
(`/v1/idea/{insight|distinctive|empathy|authenticity}`). The Signature flow lives
separately in `/v2/coach` (`BrandCoachV2` → `SignatureReveal`). A tester never
reached the Signature from the diagnostic. We re-point the CTA into `/v2/coach`.

## Decisions

### D1 — Gap context is carried as a URL query param `?gap=<dimension>`
`<dimension>` ∈ `insight | distinctive | empathetic | authentic` (the
`trustGap.ts` primary-gap keys). Chosen over React Router `location.state`
because a query param is **guest-safe, survives reload, is shareable, and is
trivially unit-testable**. `location.state` is lost on refresh and on the
`/auth` round-trip, which this journey requires.

### D2 — A bridge screen (F-059) sits between scorecard and coach
New route `/v1/diagnostic/bridge?gap=<dimension>` (bare/guest-accessible, mirrors
`/v1/diagnostic/results`). Copy: "here's your <Pillar> gap → now let's build the
Signature that closes it." It is the narrative hand-off, not a dead "here's your
score" screen.

### D3 — The bridge is the intentional sign-up gate (per Trevor, this sprint)
`/v2/coach` is auth-by-design (`useBrandCoachV2State` redirects guests to `/auth`;
chat runs on DB-backed sessions + field persistence). We do **NOT** build a
guest-ephemeral coach this sprint (RF-04 extracts that hook in Sprint +2 — do not
pre-empt). Instead:
- **Authed** user at the bridge → `/v2/coach?gap=<dimension>`.
- **Guest** at the bridge → `/auth?redirect=<encoded /v2/coach?gap=...>` framed as
  "create your free account to build your Signature". After sign-up (live project
  needs email confirmation; confirm via SQL for QA) they return to the coach with
  the gap intact. This is an intentional gate, not the abrupt `/auth` bounce — so
  no dead end.

### D4 — Minimal coach-gate edit only
`useBrandCoachV2State.ts:382` currently `navigate('/auth')`, dropping context.
Minimal change: preserve the destination →
`navigate('/auth?redirect=' + encodeURIComponent(pathname + search))`, so a guest
who lands on `/v2/coach?gap=X` directly still round-trips back with the gap. This
is the *only* edit to that hook — no rebuild (RF-04 owns extraction Sprint +2).

### D5 — Coach "opens on the weakest pillar" via additive entry UI
`ChatInputBar` has no prefill prop. Rather than modify shared chat internals, the
**owned** `BrandCoachV2` reads `?gap=` and renders a small context banner naming
the gap plus a one-click suggested opener that sends a gap-focused first message
via the already-exposed `handleSendMessage`. No `useBrandCoachV2State` logic
change, no auto-send race.

### D6 — Do not touch `trustGap.ts`
The CTA builds its destination from `gap.key` (in `TrustGapScorecard`, owned), not
from `trustGap.ts`'s `route` metadata field. The frozen `route` field is left as
is. Routing helpers live in a new `src/lib/journeyBridge.ts` (imports trustGap
types/meta read-only).

## Routing chain

```
/v1/diagnostic
  → /v1/diagnostic/results            (TrustGapScorecard)
    → "Let's go deeper on <Pillar>"   → /v1/diagnostic/bridge?gap=<dim>
      → bridge CTA
         ├─ authed → /v2/coach?gap=<dim>
         └─ guest  → /auth?redirect=%2Fv2%2Fcoach%3Fgap%3D<dim> → (signup) → /v2/coach?gap=<dim>
            (safety net: direct guest hit on /v2/coach also round-trips, D4)
        → coach: gap banner + opener → chat → reviews-paste → Reveal Signature → pick
```

## Files (ownership respected)
OWN: `TrustGapScorecard` CTA, new `JourneyBridge` screen, `App.tsx` routes,
`BrandCoachV2` entry, new `src/lib/journeyBridge.ts` (+ tests), the minimal
`useBrandCoachV2State:382` gate edit.
DO NOT TOUCH: `SignatureReveal.tsx` internals, feedback modal / `feedback_events`,
`trustGap.ts` scoring.

## Tooling note
`mango-tools` MCP not connected this session; standards pulled from the local
best-practices guide + `src/components/v2/signature/AGENTS.md`. Implemented as
focused TDD wiring (artifacts here) rather than spawning the orchestrator skills.
Both edge fns confirmed deployed/ACTIVE on the live project (`reveal-signature`,
`diagnostic-interpretation`).
