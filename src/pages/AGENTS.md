# src/pages — AGENTS.md

Root `AGENTS.md` applies; this adds only what's specific here.

Route components (one default-exported page per file). Subdirs: `v2/` (`BrandCoachV2`), `admin/` (`FeatureFlagAdmin`), `__tests__/` (page tests).

## Routing

Routes are defined centrally in `src/App.tsx` (`react-router-dom`), **statically imported** — no `React.lazy`/code-splitting at the route level. There is **no `ProtectedRoute`**. Access is gated by three wrapper components:

- `AuthGate` wraps the entire `<Routes>` tree — it blocks render until auth state is initialized (avoids flash of unauthenticated content); it is not a per-route redirect.
- `VersionGate` resolves `/` to the right version's landing/journey.
- `FeatureGate feature="..."` gates flagged routes (e.g. `/v2/coach`).
- Most authed pages are wrapped in `<Layout>`. Legacy paths live under `/v1/*`; bare paths `<Navigate>` to their `/v1` equivalent.

## Primary routes

| Path | Page | Notes |
|------|------|-------|
| `/` | `VersionGate` | resolves to versioned landing/journey |
| `/auth` | `Auth` | sign in / sign up |
| `/beta` | `BetaWelcome` | beta front door |
| `/v1/diagnostic` | `FreeDiagnostic` | guest diagnostic flow |
| `/v1/diagnostic/results` | `DiagnosticResults` | Trust Gap scorecard |
| `/v2/coach` | `BrandCoachV2` | behind `FeatureGate BRAND_COACH_V2` |

(Not exhaustive — see `src/App.tsx` for the full table, including `/v1/*` legacy routes.)

## Conventions

- Pages are **thin wiring shells**: compose components, read route/auth context, wire callbacks. Business logic belongs in `services/` and `hooks/`.
- **Resurface stored input on mount.** A page that captures a user field (ASIN, listing, answers) must load that field's store on mount and prefill the input — a returning user never sees a blank field for data they already gave. `ProblemSolverDiagnostic` loads `productDataService.getProducts()` to prefill the ASIN; `DiagnosticResults` does the same. If a screen's copy implies persistence ("upload once; every future session builds on it"), the code must deliver it. See [`docs/architecture/STORE_AND_RESURFACE.md`](../../docs/architecture/STORE_AND_RESURFACE.md).
- New authed/flagged routes go through `Layout` + the appropriate gate (`AuthGate` is already global; add `FeatureGate` for flagged features) — do not invent a `ProtectedRoute`.
- Add the route to `src/App.tsx`; prefer `ROUTES`/`V1_ROUTES` constants from `src/config/routes`.
- Tests live in `src/pages/__tests__/`.

QA for authed routes (e.g. `/v2/coach`) uses the shared test account — see `docs/TEST_ACCOUNT.md`.
