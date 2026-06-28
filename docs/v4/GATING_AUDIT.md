# /v4 Route Gating Audit

**Worktree:** `.claude/worktrees/v4-surface` (`feat/v4-alpha-surface`)
**Source of truth:** `src/App.tsx`
**Date:** 2026-06-27
**Goal:** ALL in-app pages must require login (redirect unauthenticated users to `/auth`)
**EXCEPT** the external landing (`/welcome`) and the external diagnostic (`/v1/diagnostic` + its `results` / `bridge`).

---

## How gating actually works today (three mechanisms, none is a per-route redirect)

1. **`AuthGate`** (`src/components/AuthGate.tsx`) wraps the *entire* `<Routes>` tree (App.tsx:100).
   It only blocks render while `useAuth().loading === true` (shows a spinner). Once auth resolves it
   renders children **regardless of whether `user` is null**. It is NOT a redirect and does NOT gate access.

2. **`VersionGate`** (`src/components/VersionGate.tsx`) is the `/` element. With `VITE_FORCE_V4=true`
   (set in this worktree) it calls `navigate('/v4', { replace:true })` **with no auth check** — so an
   anonymous visitor hitting `/` is pushed straight into the `/v4` surface.

3. **`Layout`** (`src/components/Layout.tsx:80`) has a built-in inline guard: if
   `!loading && !user && pathname not in {'/auth','/','/diagnostic'}` it renders a "Please sign in" card
   instead of the page. So **every `<Layout>`-wrapped route is effectively gated** for anonymous users —
   but via an inline prompt, NOT a redirect to `/auth`. Routes NOT wrapped in `Layout` have no such guard.

4. **`FeatureGate`** (`src/components/FeatureGate.tsx`) checks a feature flag / deployment phase only —
   **it performs no auth check.** `/v2/coach` renders for anonymous users when the flag is on.

5. **`V4Layout`** (`src/components/v4/V4Layout.tsx`) has **no auth check** — the whole `/v4/*` surface
   renders for anonymous users (data reads then return RLS-empty rather than redirecting).

**Net:** the only thing standing between an anonymous user and an in-app page is `Layout`'s inline prompt.
Anything outside `Layout` (`/v4/*`, `/v2/coach`, `/v2/funnel`, `/v2/diagnostic`, `/v3/diagnostic`,
`/v1/subscribe`, `/beta*`) renders without login.

---

## Route table

Legend — **Gated today?** = is an anonymous user blocked from rendering the page content?
`Layout-prompt` = blocked via the inline "Please sign in" card (not a redirect). `NO` = renders content.

| Path | Component | Public-intended? | Gated today? | Gap |
|------|-----------|------------------|--------------|-----|
| `/` | `VersionGate` → `/v4` (forceV4) | No (router) | **NO** — pushes anon → `/v4` | **GAP**: redirect anon to `/welcome` or `/auth`, not `/v4` |
| `/welcome` | `Landing` | **Yes** | NO (correct) | none — keep public |
| `/auth` | `Auth` | Yes (auth) | NO (correct) | none |
| `/v2/coach` | `FeatureGate` → `BrandCoachV2` | No | **NO** (flag only) | **GAP** — renders for anon |
| `/v2/funnel` | `FunnelTracker` | No | **NO** | **GAP** — renders for anon |
| `/v2/diagnostic` | `ProblemSolverDiagnostic` | Partial (free→authed forensic) | **NO** | **GAP (ambiguous)** — see note |
| `/v3/diagnostic` | `ProblemSolverDiagnostic showRecognition` | Partial | **NO** | **GAP (ambiguous)** — see note |
| `/v4` (index) | `V4Layout` → `V4Onboarding` | No | **NO** | **GAP — primary** |
| `/v4/diagnose` | `V4Layout` → `V4Stage` | No | **NO** | **GAP** |
| `/v4/analyse` | `V4Layout` → `V4Analyse` | No | **NO** | **GAP** |
| `/v4/fix` | `V4Layout` → `V4Fix` | No | **NO** | **GAP** |
| `/v4/remeasure` | `V4Layout` → `V4Remeasure` | No | **NO** | **GAP** |
| `/v4/defend` | `V4Layout` → `V4Defend` | No | **NO** | **GAP** |
| `/v4/tools` | `V4Tools` | **Yes** (public trust page, per code comment) | NO | none — keep public |
| `/v1/diagnostic` | `FreeDiagnostic` | **Yes** (external diagnostic) | NO (correct) | none — keep public |
| `/v1/diagnostic/results` | `DiagnosticResults` | **Yes** | NO (correct) | none — keep public |
| `/v1/diagnostic/bridge` | `JourneyBridge` | **Yes** | NO (correct) | none — keep public |
| `/v1/subscribe` | `PricingPaywall` | Maybe (post-diagnostic) | **NO** | minor — gate unless intentionally public |
| `/beta` | `BetaWelcome` | No (legacy) | **NO** | minor GAP — legacy beta pages |
| `/beta-journey` | `BetaJourney` | No | **NO** | minor GAP |
| `/beta-feedback` | `BetaFeedback` | No | **NO** | minor GAP |
| `/integrations/figma/callback` | `FigmaCallback` | Yes (OAuth handler) | NO | none — must render during redirect |
| `/test/offline-sync` | `Layout` → `TestOfflineSync` | No | Layout-prompt | upgrade to redirect (uniformity) |
| `/test/chapter-navigation` | `Layout` → `TestChapterNavigation` | No | Layout-prompt | upgrade to redirect |
| `/admin/feature-flags` | `Layout` → `FeatureFlagAdmin` | No | Layout-prompt | upgrade to redirect |
| `/admin/coach-evals` | `AdminGate` + `Layout` → `CoachEvalsAdmin` | No | Layout-prompt + AdminGate | OK (AdminGate adds allowlist) |
| `/v2/focus` | `Layout` → `FocusSurface` | No | Layout-prompt | upgrade to redirect |
| `/settings`, `/settings/:section` | `Layout` → `SettingsPage` | No | Layout-prompt | upgrade to redirect |
| `/v1/start-here` | `Layout` → `StartHere` | No | Layout-prompt | upgrade to redirect |
| `/v1/journey` | `Layout` → `Index` | No | Layout-prompt | upgrade |
| `/v1/dashboard` | `Layout` → `Dashboard` | No | Layout-prompt | upgrade |
| `/v1/brand-diagnostic` | `Layout` → `BrandDiagnostic` | No | Layout-prompt | upgrade |
| `/v1/idea-diagnostic` | `Layout` → `IdeaDiagnostic` | No | Layout-prompt | upgrade |
| `/v1/idea` | `Layout` → `IdeaFramework` | No | Layout-prompt | upgrade |
| `/v1/idea/consultant` | `Layout` → `IdeaFrameworkConsultant` | No | Layout-prompt | upgrade |
| `/v1/conversations` | `Layout` → `ConversationHistory` | No | Layout-prompt | upgrade |
| `/v1/idea/insight` | `Layout` → `IdeaInsight` | No | Layout-prompt | upgrade |
| `/v1/idea/distinctive` | `Layout` → `IdeaDistinctive` | No | Layout-prompt | upgrade |
| `/v1/idea/empathy` | `Layout` → `IdeaEmpathy` | No | Layout-prompt | upgrade |
| `/v1/idea/authenticity` | `Layout` → `IdeaAuthenticity` | No | Layout-prompt | upgrade |
| `/v1/canvas` | `Layout` → `BrandCanvas` | No | Layout-prompt | upgrade |
| `/v1/copy-generator` | `Layout` → `BrandCopyGenerator` | No | Layout-prompt | upgrade |
| `/v1/research-learning` | `Layout` → `ResearchLearning` | No | Layout-prompt | upgrade |
| `/v1/integrations` | `Layout` → `Integrations` | No | Layout-prompt | upgrade |
| `/start-here`, `/journey`, `/diagnostic`, `/subscribe`, `/dashboard`, `/brand-diagnostic`, `/idea-diagnostic`, `/idea*`, `/avatar`, `/canvas`, `/copy-generator`, `/research-learning`, `/conversations`, `/value-lens`, `/app`, `/brand-coach` | `<Navigate replace>` | n/a | n/a — forwards to target | inherits target's gate |
| `*` | `NotFound` | Yes | NO | none |

**Ambiguous note (`/v2/diagnostic`, `/v3/diagnostic`):** these begin with a free/guest diagnostic step
then move to an auth-gated forensic run (per the code comments). The *goal* names the external diagnostic
as `/v1/diagnostic` only. Recommendation: gate `/v2` and `/v3` diagnostic behind login (they are in-app
review/demo flows); the guest entry point is already served publicly by `/v1/diagnostic`. Confirm with
Matthew if `/v2/diagnostic` is meant to be a public funnel entry.

---

## Recommended fix (smallest correct change)

### 1. Add one `RequireAuth` wrapper (new file, ~15 lines)

```tsx
// src/components/RequireAuth.tsx
import { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/** Per-route login gate. AuthGate (global) already blocked render until auth
 *  resolved, so `loading` is false here. Redirects anon users to /auth,
 *  preserving the attempted path for post-login return. */
export function RequireAuth({ children }: { children?: ReactNode }): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <></>; // AuthGate normally covers this
  if (!user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}
```

(`Auth.tsx` already honours a `redirect` query param — line 51 — so post-login return works for free.)

### 2. Wrap the in-app route groups in `App.tsx`

- **`/v4` group (primary gap):** wrap the `V4Layout` element so the whole nested group is gated:
  `<Route path={V4_ROUTES.ROOT} element={<RequireAuth><V4Layout/></RequireAuth>}>`.
  Leave `/v4/tools` (separate route, outside `V4Layout`) **public**.
- **`/v2/coach`, `/v2/funnel`, `/v2/diagnostic`, `/v3/diagnostic`:** wrap each element in `<RequireAuth>`
  (for `/v2/coach`, nest inside the existing `FeatureGate`).
- **`/beta`, `/beta-journey`, `/beta-feedback`, `/v1/subscribe`:** wrap in `<RequireAuth>` (or confirm public).
- **`Layout`-wrapped routes:** these are already effectively gated by `Layout`'s inline prompt. For full
  goal compliance (redirect to `/auth`, not an inline card) either (a) wrap them in `RequireAuth` too, or
  (b) change `Layout.tsx:80` to `return <Navigate to="/auth" replace/>` instead of the inline card.
  Option (b) is the single smallest edit that converts *all* Layout routes at once.

### 3. Fix `VersionGate`'s anon path

In `VersionGate.tsx` the `forceV4` branch (line 29) should not push anonymous users into `/v4`:
```tsx
if (forceV4) {
  navigate(user ? V4_ROUTES.ROOT : '/welcome', { replace: true });
  return;
}
```
(Without this, anon `/` → `/v4` → `RequireAuth` → `/auth` works but double-bounces; the direct check
sends guests to the public landing instead.)

### Leave public (do not wrap)
`/welcome`, `/auth`, `/v1/diagnostic`, `/v1/diagnostic/results`, `/v1/diagnostic/bridge`, `/v4/tools`,
`/integrations/figma/callback`, `*` (NotFound).

### Smallest-possible variant
If you want the absolute minimum diff that closes the *real data-exposure* gaps: only steps **2 (/v4 group
+ /v2/coach + /v2/funnel)** and **3**. That gates the new surface and the V2 coach/funnel — the only
non-Layout pages that read user data — while leaving the Layout inline-prompt behaviour for everything else.
