# User-Accessible App Assessment — 2026-06-29

Read-only assessment of the user-accessible app across seven dimensions: missing telemetry,
error handling, logging, comments, outdated docs / agent instructions, unnecessary
backwards-compatibility, and the data-protection guardrail (*Supabase data stays protected*).

**Method:** five parallel read-only assessors (frontend obs, backend obs, dead-code,
docs/AGENTS.md, data-protection), then orchestrator verification of every cross-cutting or
surprising claim against the actual code, the deployed Supabase functions, and `tsc`. This
worktree is **`main`** (HEAD = `origin/main`, 0 ahead/behind) with uncommitted v2 design edits.

> **Assessment only — no code was changed.** Findings are a prioritized backlog.

---

## Headline: the repo has drifted from the hardened production deployment

The single most important finding. The **deployed** Supabase edge functions are hardened and
enhanced; the **repo's `supabase/functions/*` is stale** and, in places, contains the *old
vulnerable* code. Verified by reading the live functions via the Supabase API:

| Function | Deployed (prod) | Repo (`main`) | Drift |
|---|---|---|---|
| `document-processor` | v91, `verify_jwt:true`, `auth.getUser()` → 401, **every** query `.eq("user_id", user.id)` (comment: "closes the IDOR") | service-role + `verify_jwt:false`, **no auth**, no ownership filter | **P0 IDOR fixed in prod, still in repo** |
| `send-framework-email` | v73, `verify_jwt:true`, recipient forced to `user.email`, all fields `esc()`-escaped | no auth, caller-supplied recipient, raw HTML interpolation | **open-relay + injection fixed in prod, still in repo** |
| `reveal-signature` | v11, `verify_jwt:true` (platform-gated) + credit metering (`_shared/meter.ts`) + server PostHog (`_shared/posthog.ts`) | older: no metering, no telemetry, "optional" auth | **prod enhanced, repo behind** |

**Implications**
1. **Production data is protected** — the guardrail holds in prod. The deployed functions
   authenticate, scope by `user_id`, escape output, and meter paid LLM calls.
2. **The repo is the risk.** It is the source of truth for redeploys, CI, and code review. A
   redeploy of any drifted function *from `main`* would **regress** prod (re-open the
   `document-processor` IDOR, restore the open email relay, drop credit metering). This is a
   latent **P0 process risk**, not a live data exposure.
3. **Most of the security/backend findings below are repo-only / already-fixed-in-prod.** They
   describe the stale repo code, not live prod behaviour.

**Recommended #1 action:** reconcile the repo *from* the deployed functions (pull deployed
sources into `supabase/functions/*`, commit), then re-audit from a true source of truth. Verified
drift on 3 functions; the same pattern almost certainly applies to **`export-brief`** and
**`diagnostic-interpretation-evidence`** (same "optional auth" shape in the repo) — confirm those
deployed versions before trusting the repo copies.

This matches the project's repeatedly-noted **"deployed ≠ repo"** pattern. It is the root cause of
several findings across telemetry, error handling, logging, and security simultaneously.

---

## Verification corrections to the raw assessor findings

Direct checks overturned four assessor claims — recorded so they are not actioned in error:

- **"No v4 surface in this worktree"** (dead-code agent) — **WRONG.** `src/App.tsx` routes
  `/v4/*` (`V4Layout`, `V4Onboarding`, `V4Diagnose`, …) and `VITE_FORCE_V4` is default-on here.
  v4 is the prod surface. The dead-code analysis was run under a wrong premise (see §7 caveat).
- **"`tsc` fails on `entry_movement_*`"** (frontend agent) — **WRONG.** `npx tsc --noEmit`
  passes clean. No build break. (Note: `npm run build` is esbuild and would not typecheck anyway.)
- **"`get-funnel-piece-metrics` missing from repo"** (backend agent) — **WRONG.** It exists at
  `supabase/functions/get-funnel-piece-metrics/index.ts`.
- **`useApiFetch` is a phantom** (docs agent) — **CONFIRMED.** Zero results in `src/`.

---

## 1. Missing telemetry

- **[P1] `conversation_started` defined, never fired** — `src/hooks/useChatSessions.ts:173`. The
  `auth_completed → first coach engagement` conversion is unmeasurable. Fire it in
  `createSessionMutation.onSuccess`.
- **[P1] Forensic avatar build is dark** — `src/hooks/useForensicAvatarBuild.ts`. The primary v2
  avatar-creation pipeline (~60s, 4 edge stages) emits no `captureAlphaEvent`. Add
  `forensic_build_started/completed/failed`.
- **[P1] v2 Markdown export is dark** — `src/components/export/BrandMarkdownExport.tsx:148/182/188`.
  The `export_*` events fire only from the v1 PDF path (`usePDFGeneration.ts`).
- **[P2] Document upload has failure-only telemetry** — `src/services/DocumentUploadService.ts:67,78`.
  No `document_upload_started`/success → success rate uncomputable.
- **[Backend] `_shared/posthog.ts` under-wired in the repo** — imported by only ~2 repo functions,
  but the **deployed** `reveal-signature` already uses it (another drift signal). The live coach /
  diagnostic / forensic paths appear dark in PostHog per the repo; confirm against deployed before
  building new instrumentation. MCP `mcp_tool_latency` coverage is complete and good.

## 2. Error handling

- **[P1] Single root `ErrorBoundary`** — `src/App.tsx:86` is the only mount. A render crash in the
  coach, diagnostic, signature, or field-review subtree tears down the whole app. `src/components/AGENTS.md`
  itself says "wrap risky subtrees." Add per-route boundaries around `BrandCoachV2`,
  `ProblemSolverDiagnostic`, `ForensicAvatarBuilder`, `SignatureReveal`.
- **[P1] `sessionsError` silently discarded** — `src/hooks/v2/useBrandCoachV2State.ts:283` does not
  destructure the React Query `error`; a sessions-load failure shows an empty sidebar with no toast,
  no recovery, no event.
- **[P1] Hardcoded anon-key fallback in the bundle** — `src/services/chat/ChatEdgeFunctionService.ts:200`
  hardcodes the Supabase anon JWT as a `?? '…'` fallback. Anon-role (no privilege), but it defeats key
  rotation and is committed. Throw a config error if the env var is absent instead.
- **[Backend, repo] Auth resolved outside try/catch** — repo `identify-decision-trigger` /
  `run-forensic-analysis` resolve `auth.getUser()` before the handler `try`; a transient network
  error becomes an unhandled rejection. (Verify against deployed — likely drift.)
- **[Backend, repo] Missing `AbortSignal` timeouts** on Anthropic/Firecrawl fetches in `export-brief`,
  `diagnostic-interpretation-evidence`, `review-scraper` → a hung upstream runs to the 55s platform
  wall with no structured error. (Verify against deployed.)

## 3. Logging (MF-5)

Frontend logs ship in the bundle and are **not** subject to the deployed-vs-repo escape — these are live:

- **[P0] Raw forensic response logged** — `src/components/v2/problem-solver/AnalyseScreen.tsx:86`
  `console.error('… unexpected response shape:', data)` logs the full forensic payload, which can
  carry **review content**. Log only the structural shape (keys/types), never values.
- **[P0/P1] User KB content logged** — `src/lib/knowledge-base/supabase-sync-service.ts:106,155` log
  `user_knowledge_base` rows whose `content` is the user's brand strategy. Log `{ id, fieldIdentifier,
  version }` only.
- **[P2] No structured logger; ~448 `console.*` across 121 files** — incl. ~29 per KB-sync cycle,
  per-field-save logs, per-stream-completion logs, auth-lifecycle logs. Heavy debug cruft in prod; no
  severity/filtering. Introduce a thin logger with levels and strip debug traces.
- **[Backend, repo] PII in logs** — `save-beta-tester` (email/name), `contextual-help` (full user
  prompt/context). **`send-framework-email`'s PII log is already fixed in the deployed version** —
  another drift case; verify the others against deployed.

## 4. Comments

- **[P2] Stale "GPT-4"** — `src/config/features.ts:169` `BRAND_COACH_CHAT.fullDescription` says
  "powered by GPT-4 and RAG"; the backend is Claude Sonnet 4.6. (Same file: `BRAND_COACH_V2.route` is
  `/coach-v2` but the route is `/v2/coach`.)
- **[P2] `useSimpleFieldSync` header says "single avatar per account"** — `src/hooks/useSimpleFieldSync.ts:3`
  but it takes `avatarId` and is used in the multi-avatar coach. Misleads on capability.
- **[P2] Illustrative scores look live** — `src/components/v2/problem-solver/InClaudeScreen.tsx:19`
  hardcoded `DIMS` render identically to the live Trust Gap bars; no in-UI "illustrative" label.
- **[P2] Stale dependency-graph comment** — `src/hooks/v2/useChatOrchestration.ts:6` describes a
  composition that `useBrandCoachV2State` no longer uses.

## 5. Outdated docs / agent instructions

**[P0 — misleading: an agent would act wrongly]**
- **`src/mcp/AGENTS.md`** still frames the gateway as an **IV-OS consumer** ("call IV-OS", lists
  `IVOS_MCP_URL/TOKEN`) — but `server.ts` uses `NativeLedgerClient` (the native-ledger migration).
  The tool-surface list is also ~6 of 40+ tools. Rewrite the IV-OS section; link `server.ts` as the
  tool source of truth; add the OAuth 2.1 layer (it's unmentioned).
- **Root `AGENTS.md`** — three wrong facts: the LangChain row (it's raw `fetch` to the Anthropic API
  in `idea-framework-consultant-claude`, not LangChain, and the fn name is wrong); the phantom
  `useApiFetch` hook (zero results in src); wrong `mango-tools` tool names (`get_best_practice` /
  `read_guide` → current `guide_read` / `guide_checklist` / `guide_list`).
- **`supabase/functions/AGENTS.md`** lists a non-existent `review-scraper-deep` and omits ~16 real
  functions. Generate the table from `ls` rather than hand-maintaining.

**[P1 — stale on live areas]**
- `docs/README.md` (Updated 2026-02-28) calls v2 "New" and v1 "Current Production"; `docs/v2/README.md`
  says v2 is "Pre-Implementation (Week 0)" though v2/v4 shipped; `docs/CURRENT_PROJECT_STATUS.md`
  (Nov 2025) presents stale financials as current — its name is actively misleading, move to
  `docs/deprecated/`.
- `src/pages/AGENTS.md` route table omits v4 (v4 is the prod surface). Root `AGENTS.md` QA path cites
  `/v2/coach`; prod is v4.
- `src/components/integrations/AGENTS.md` is Figma-only though Canva exists.

**[Missing]** `docs/TELEMETRY.md` (PostHog project 203641, the three dashboards, the event vocabulary,
the `instrument.ts` seam), an MCP-OAuth section, and a v4-surface AGENTS.md.

## 6. Unnecessary backwards-compatibility / dead code

Pre-revenue (≈no users), so compat shims are removable. **Safe now (zero importers — verified):**
- `src/v2/` three-panel prototype (~24 files) + `src/pages/V2Interface.tsx` — self-contained island,
  not routed.
- `src/components/V2Introduction.tsx`, `src/examples/feature-gating-examples.tsx` — zero importers.
- `src/pages/AvatarBuilder.tsx` — both `/avatar` routes redirect away; orphaned.
- `src/utils/diagnosticDataMigration.ts` (`migrateDiagnosticData`, runs every boot) — migrates an old
  localStorage shape that no user has.

**Flag-off feature stacks (remove after confirming the build flag is unset in prod):**
- Figma (~8 files), Canva (~7 files), Onboarding tour + `react-joyride` dep (targets exist only on v1
  pages → already effectively dead on v4).

**Needs careful re-scoping (see caveat):** the v1 page set (~21 files) and the version-switch
machinery (`VersionGate`/`VersionSwitcher`/`VersionContext`).

> **§7 caveat — correct the dead-code premise before deleting.** The dead-code pass assumed "v2 coach
> is the keeper, v1 is legacy." Reality: **v4 is the prod surface** (`VITE_FORCE_V4` on), reached
> *through* `VersionGate`. So `VersionGate` is **load-bearing for the v4 flip**, not pure v1/v2 compat —
> do **not** delete it without re-deriving the v4 routing. And **keep** `/v2/diagnostic`+`/v3/diagnostic`
> problem-solver (actively edited in this branch) and `src/components/Layout.tsx` (shared by
> settings/admin). The zero-importer orphans above are safe regardless of the v2/v4 question; the
> surface-level deletions need a fresh reachability pass with the correct v4 premise.

## 7. Data-protection guardrail — VERDICT

**Production Supabase data is protected.** Verified sound:
- Frontend bundles **only the anon key** (no `service_role` in any `VITE_*`); RLS-scoped client.
- MCP gateway: `runWithIdentity` + `AsyncLocalStorage` (no cross-request bleed), `claude.ai`-only CORS,
  `gateWrite` + `requireOwnedAvatar` ownership checks, `safeLog`/`redact.ts` strips sensitive keys.
- Deployed `document-processor`, `send-framework-email`, `reveal-signature` are hardened (verified).
  `run-forensic-analysis`, `identify-decision-trigger`, Figma/Canva functions, and the public
  `diagnostic-interpretation` (clamped numeric inputs, per-IP rate limit) are sound per the security pass.

**The risks to that protection (in priority order):**
1. **[P0 latent] Repo↔prod drift** (the headline). A redeploy from `main` regresses hardened functions.
   *Reconcile the repo from the deployed source.*
2. **[P0 live] Frontend MF-5 log leaks** — §3 (`AnalyseScreen.tsx:86`, `supabase-sync-service.ts`):
   user review/strategy content in the browser console, shipped in the bundle.
3. **[P1/P2] Repo-only edge defects already fixed in prod** (`save-beta-feedback` body-trusted
   `userId`, cost-abuse "optional auth", PII logs) — close them in the repo as part of #1.
4. **[P2] `src/config/admin.ts`** bakes personal admin emails into the bundle (no data access; manage via
   `VITE_ADMIN_EMAILS`); **`review-scraper`** lacks a Firecrawl URL allowlist (auth-bounded).

**No recommendation in this assessment weakens RLS or data protection.** The guardrail is respected.

---

## Suggested sequencing

1. **Reconcile repo ← deployed** for all edge functions (§Headline). Single highest-value action; it
   neutralizes the latent P0 and makes the repo trustworthy for every other fix.
2. **Fix the live frontend MF-5 log leaks** (§3 P0) — small, ships in the bundle, real data exposure.
3. **Add per-route ErrorBoundaries + the missing telemetry on live v4/v2 flows** (§1, §2).
4. **Correct the P0 misleading AGENTS.md files** (§5) — cheap, high leverage (they misdirect agents).
5. **Delete the verified zero-importer orphans** (§6), then do a fresh reachability pass for the
   surface-level legacy with the correct v4 premise.
6. **Stale-doc hygiene** (§5 P1): archive `CURRENT_PROJECT_STATUS.md` etc. to `docs/deprecated/`.
