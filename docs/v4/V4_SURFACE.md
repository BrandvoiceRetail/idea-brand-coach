# V4_SURFACE.md — architecture of the `/v4` surface

The `/v4` surface is the new **"one and only"** user-facing experience for IDEA Brand
Coach: a single, opinionated spine that walks a brand owner from problem to proof.
It mounts alongside the legacy `/v1`–`/v3` routes — nothing is deleted — and becomes
the front door only when an explicit env flag is flipped (see [Force-gate](#force-gate)).

This doc is the map. Each loop's screen-level rules, no-data behaviour, PostHog events,
and test recipe live in the **feature-local `AGENTS.md`** next to the components
(linked per loop below). Read this for the whole-surface picture; read the folder
`AGENTS.md` before touching a loop.

---

## The spine

One canonical journey, defined **once** in `src/config/v4.ts` as `V4_SPINE` and
rendered by three surfaces (sticky `SpineStepper`, desktop `V4Sidebar`, mobile
`V4BottomNav`) so the navigation can never drift:

```
Diagnose → Analyse → Fix → Re-measure → Defend
(idea-e)  (idea-i)  (idea-a)  (gold-warm)  (idea-d)
```

| Stage | Blurb | Route | Loop |
|-------|-------|-------|------|
| Diagnose | Find your Trust Gap | `/v4/diagnose` | (placeholder — `V4Stage`) |
| Analyse | Avatar + Decision Trigger | `/v4/analyse` | Loop 2 |
| Fix | Positioning + design brief | `/v4/fix` | Loop 3 |
| Re-measure | Lift on the numbers | `/v4/remeasure` | Loop 4 |
| Defend | Hold the gains | `/v4/defend` | Loop 5 |

`V4_ROUTES` (same file) is the route-string SSOT; `activeStageFor(pathname)` resolves
the live stage for the stepper. Each stage carries a `tone` mapping to a v23 IDEA
CSS var — the only place stage colour is decided.

The **onboarding** step (Loop 1) is the `/v4` index route, feeding the spine before
Diagnose; the Diagnose stage itself is still a `V4Stage` placeholder.

---

## The shell

`src/components/v4/`:

- **`V4Layout.tsx`** — outlet wrapper mounted on the `/v4` parent route (`src/App.tsx`);
  composes sidebar (desktop) + bottom-nav (mobile) + sticky stepper around the routed page.
- **`V4Sidebar.tsx`** / **`V4BottomNav.tsx`** — the two responsive nav surfaces, both
  reading `V4_SPINE`.
- **`SpineStepper.tsx`** — sticky progress stepper across the spine.
- **`ContextCard.tsx`** + **`CompletenessRing.tsx`** — render the never-ask-twice context
  state (what's known about the brand, how complete it is).
- **`PhasePlaceholder.tsx`** — honest "this stage isn't built here yet" placeholder
  (used by `V4Stage` for Diagnose).

Pages live in `src/pages/v4/` (`V4Onboarding`, `V4Analyse`, `V4Fix`, `V4Remeasure`,
`V4Defend`, `V4Stage`, `V4Tools`). Each page is a **thin integrator**: it owns no
fetching; it calls a per-loop hook and passes data + handlers to presentational
screens. `/v4/tools` is intentionally outside `V4Layout` (own dark theme, reads as a
public trust page).

---

## The five loops

Each loop = page (integrator) → hook (orchestration/fetching) → service seam → screens
(presentational). The hooks are in `src/hooks/`, the service seams in
`src/services/v4/`, the screens in `src/components/v4/<loop>/`.

| Loop | Page | Hook | Service seam | Screens dir | AGENTS.md |
|------|------|------|--------------|-------------|-----------|
| 1 · Onboarding | `V4Onboarding` | `useOnboardingReflectionRun` | `OnboardingReflectionService` | `v4/onboarding/` | — |
| 2 · Analyse | `V4Analyse` | `useAnalyseRun` | `v4/analyseService` | `v4/analyse/` | [`analyse/AGENTS.md`](../../src/components/v4/analyse/AGENTS.md) |
| 3 · Fix | `V4Fix` | `useFixRun` | `v4/fixService` | `v4/fix/` | [`fix/AGENTS.md`](../../src/components/v4/fix/AGENTS.md) |
| 4 · Re-measure | `V4Remeasure` | `useRemeasureRun` | `v4/remeasureService` | `v4/remeasure/` | [`remeasure/AGENTS.md`](../../src/components/v4/remeasure/AGENTS.md) |
| 5 · Defend | `V4Defend` | `useDefendRun` | `v4/defendService` | `v4/defend/` | [`defend/AGENTS.md`](../../src/components/v4/defend/AGENTS.md) |

**Loop 1 — Onboarding.** Megaprompt paste → read-it-back "theatre" → confirmed Context
Card. Seeds the `V4ContextStore`. Screens: `RecognitionBanner`, `OnboardingReflectionRun`,
`AvatarPortraitCard`.

**Loop 2 — Analyse.** Auto-runs on entry when the confirmed context has a customer + a
problem (else an honest gate links back to onboarding): avatar restatement → Trust Gap +
named Decision Trigger → scored positioning moves → 7-slot brief with a claim-fabrication
gate. Spine CTA "Continue to Fix" unlocks once a move is chosen.

**Loop 3 — Fix.** Five-stage funnel map → impact-ranked "what needs work" → per-asset
content + IDEA audit verdict → Positioning Statement drift banner (self-hides at zero). Scoped to the
active avatar.

**Loop 4 — Re-measure.** Trust Gap before→after via the **deterministic** `computeLift`
(a 1:1 mirror of the live `compute_trust_gap_lift` MCP tool, run on two real
`diagnostic_results` rows) + a business-metrics card (CTR/CVR/AOV/revenue) reading
`campaign_metrics`.

**Loop 5 — Defend.** Drift watch (real Loop-3 `getDrift`) → "are my gains safe?" checklist
(deterministic from real signals) → competitor teaser (deferred in Alpha, always "coming")
→ one-tap full-loop `export_workbook`. Terminal stage; offers a loop-restart.

---

## The context store

`src/contexts/V4ContextStore.tsx` is the **client store-of-record** for the surface and
the front-end half of the "I won't ask twice" loop. It mirrors the MCP
`get_context_status` / `provide_context` seam: a catalogue of slots (`V4_SLOTS` —
brand_name, product, customer, problem, channel, goal), each resolving to a
`V4SlotStatus`. Anything not owner-stated / evidence-backed is `missing` and queues for
the coach to ask; once answered it flips to `filled-stated` and is never re-asked. Backed
by `localStorage`, scoped per authenticated user (or a guest bucket). The MCP tools remain
the canonical **server-side** resolver — this is the FE projection of that truth.

---

## Force-gate

`/v4` is opt-in and **fail-safe**. `isV4Forced()` (`src/config/v4.ts`) reads
`VITE_FORCE_V4` and defaults **OFF** (`undefined`/`''`/anything but `true`/`1` → false),
so merging to `main` can never silently repoint prod. The all-users flip is an explicit
`VITE_FORCE_V4=true` in the target env (this worktree sets it in its gitignored `.env`).
When on, `VersionGate` routes every authed/guest user into `/v4`; old `/v1`–`/v3` routes
stay mounted, only the entry point moves.

---

## Backend wiring reality

The FE reaches engines through existing Supabase **edge functions** + **direct RLS reads**
(modelled on `OnboardingReflectionService` and the `v4/*Service.ts` seams). Critically:

- **Live engines** the surface uses today: `compute_trust_gap_lift` (mirrored
  deterministically in `remeasureService`), `export_workbook`, `run_marketing_audit`,
  the diagnostic + canvas/brief/audit engines.
- **Unapplied tables**: `campaigns` / `campaign_metrics` ship as an **unapplied migration**
  (`20260626000000_campaign_analytics.sql`). Direct reads return **empty** until that
  migration is deployed.
- **The hard rule everywhere**: when an engine hasn't run or a table is empty, render an
  **honest no-data / loading / error+retry** state. **Never fabricate** a score, trigger,
  move, claim, lift, count, or competitor feed. This is the production bar and is asserted
  in each loop's tests (alongside a Tier-C terminology leak check — no Safety-brain / S1–S4 /
  CAPTURE / raw buyer-state names ever reach the DOM).

Observability: every meaningful step/action emits a PostHog funnel event via the canonical
client (`@/lib/posthogClient` `captureAlphaEvent`), with v4 event names cast to
`AlphaEventName` at the single call site (the shared union stays untouched). Event names
per loop are documented in the loop `AGENTS.md`.

---

## Gated deploy

The whole `/v4` program is **built + green but NOT deployed**. Do not flip
`VITE_FORCE_V4`, do not apply the campaign/analytics migration to prod, and never
hand-edit `src/integrations/supabase/types.ts`. The full status, verification evidence,
worktree layout, and the deploy gate live in **[`PHASE1_REPORT.md`](./PHASE1_REPORT.md)**
(see also [`ADR-V4-SURFACE.md`](./ADR-V4-SURFACE.md), [`BUILD_BACKLOG.md`](./BUILD_BACKLOG.md),
and [`MANUAL_FLOW_CHECKLIST.md`](./MANUAL_FLOW_CHECKLIST.md)).
