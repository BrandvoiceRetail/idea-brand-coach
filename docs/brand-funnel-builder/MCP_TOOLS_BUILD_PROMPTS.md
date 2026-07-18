# Build prompts — Funnel MCP tools

Two ready-to-use prompts for building the Brand Funnel Tracker tools into the brand-coach MCP gateway: a **`/goal` prompt** (sets the success contract) and a **`/loop` prompt** (drives the build iteration-by-iteration to green). Decision context (2026-06-17): build against **brand-coach's own data**, decoupled from D5; brand-coach is system of record.

---

## 1) `/goal` prompt

> Paste after `/goal` (or use as the goal arg). Seven sections: goal+done-when · tooling · gap · planned work · file ownership · guardrails · done gate.

```
GOAL: Add Brand Funnel Tracker tools to the brand-coach MCP gateway so an agent (Claude in chat/Desktop) can SEE and AUDIT a brand's funnel assets directly — using brand-coach's own Supabase data (decoupled from the D5 cross-server write-auth decision; brand-coach is system of record).

DONE WHEN:
- The gateway exposes three new tools — get_funnel_assets (read), audit_asset (identity-gated write), get_funnel_coverage (read) — registered in src/mcp/server.ts and advertised by the InMemoryTransport server test.
- audit_asset, given a brand_assets id, re-scores that asset via the live audit-asset edge function and returns the persisted verdict; every read/write is RLS-scoped to the caller via getUserSupabase.
- npm run typecheck:mcp clean · npm run lint clean · npm test -- src/mcp green (incl. new cases asserting the three tools are advertised + a happy path over InMemoryTransport).
- No regression to existing tools/health; MF-5 holds (no PII/prompts/tokens/tool-args in logs).

TOOLING:
- Before coding, pull standards from the mango-tools MCP: get_best_practice (service/error-handling), get_checklist (tests), read_guide as needed.
- Host architecture + acceptance bar: src/mcp/AGENTS.md. Per-request caller identity flows via runWithIdentity (AsyncLocalStorage) — never thread identity by hand.

GAP (current state):
- Funnel feature is LIVE: app at /v2/funnel; edge fns audit-asset (v3), funnel-rewrite, classify-touchpoint; tables brand_assets / brand_tests with RLS scoped via avatars.user_id. There is NO MCP surface for it — an agent in chat cannot see or audit the funnel.
- The gateway already registers "owned" tools (generateConcepts, publishFilterCheck, draftAsset, designTest, runTrustGap), so adding funnel tools is consistent with the current host.

PLANNED WORK:
1. src/mcp/tools/getFunnelAssets.ts — input { avatar_id }. Via getUserSupabase() read brand_assets (superseded_by IS NULL) → return id, touchpoint_id, stage, status, overall_score, audit_result.grounding. Mirror listAssets.ts (text + structuredContent + safeLog).
2. src/mcp/tools/auditAsset.ts — input { asset_id }. gateWrite() identity gate; via the JWT-bound client invoke the audit-asset edge fn ({ assetId }); re-read the row; return the verdict. auditAgainst may be omitted (the edge fn always includes CORE_FIELDS). Capture an MCP event.
3. src/mcp/tools/getFunnelCoverage.ts — input { avatar_id, channel_tags? }. Compute counts + coverage% from brand_assets using a small SELF-CONTAINED stage/touchpoint list (see guardrails); return structured counts.
4. Register all three in src/mcp/server.ts (registerGetFunnelAssetsTool, registerAuditAssetTool, registerGetFunnelCoverageTool).
5. Extend src/mcp/__tests__/server.test.ts: assert the three tools are advertised and a happy-path call works over InMemoryTransport (mock the supabase + edge-fn calls).

FILE OWNERSHIP (touch only these):
- NEW: src/mcp/tools/getFunnelAssets.ts, src/mcp/tools/auditAsset.ts, src/mcp/tools/getFunnelCoverage.ts
- NEW (if needed): src/mcp/service/funnelTaxonomy.ts — a pure copy of the stage/touchpoint list (do NOT import src/config/touchpointTaxonomy.ts; see guardrails)
- EDIT: src/mcp/server.ts (registration only), src/mcp/__tests__/server.test.ts (add cases)

GUARDRAILS:
- The MCP bundles separately (scripts/build-mcp.mjs, tsconfig.mcp). Do NOT import app/React/Vite code (@/… , anything pulling in browser deps) into MCP modules — keep MCP code pure/self-contained. If the tools need the taxonomy, add a small pure module under src/mcp/service/.
- All data access goes through getUserSupabase() (RLS, caller-scoped). NEVER use the service-role key in a tool.
- Reuse, don't duplicate: audit_asset must call the existing audit-asset edge fn (calculation parity) — do not re-implement scoring.
- Log only via safeLog (logging/redact). No PII/prompts/tokens/tool args.
- Do NOT deploy or restart the live MCP host as part of this task — land code + green tests only; deploying is a separate, explicitly-gated step.

DONE GATE:
- typecheck:mcp + lint + `npm test -- src/mcp` all green; server.test.ts shows the three funnel tools advertised. Manual smoke: `npm run mcp:dev` boots, GET /healthz → 200, and a POST /mcp tools/list includes get_funnel_assets, audit_asset, get_funnel_coverage. Report the diff + test output; do not deploy.
```

---

## 2) `/loop` prompt

> Self-paced loop. Each pass advances ONE step and must be green before the next. Paste after `/loop` (no interval = let the model self-pace).

```
Build the funnel MCP tools per docs/brand-funnel-builder/MCP_TOOLS_BUILD_PROMPTS.md (the /goal prompt above). Work ONE step per iteration, in this order, and do not advance until the current step is green:

  1. src/mcp/tools/getFunnelAssets.ts   (mirror src/mcp/tools/listAssets.ts — read via getUserSupabase)
  2. src/mcp/tools/auditAsset.ts         (mirror persistPositioningStatement.ts — gateWrite + getUserSupabase; invoke the audit-asset edge fn)
  3. src/mcp/tools/getFunnelCoverage.ts  (self-contained taxonomy; counts + coverage%)
  4. register all three in src/mcp/server.ts
  5. add cases to src/mcp/__tests__/server.test.ts (advertised + happy path over InMemoryTransport)

Each iteration: implement the step → run `npm run typecheck:mcp` and `npm test -- src/mcp` → fix any failure before moving on → report what you built, the test result, and the next step.

STOP the loop when: all three tools are advertised in server.test.ts AND typecheck:mcp + lint + `npm test -- src/mcp` are all green. Then post a one-paragraph summary + the final diff.

Hard rules: never import app/React code (@/…) into MCP modules; all data access via getUserSupabase (RLS, never service-role); audit_asset calls the existing audit-asset edge fn (no re-scoring); log only via safeLog. Do NOT deploy/restart the live MCP host. If you hit a real blocker (e.g., a taxonomy import drags in browser deps, or InMemoryTransport mocking the edge fn is unclear), STOP and surface it instead of guessing.
```

---

### Notes
- Reference tools to copy: `src/mcp/tools/listAssets.ts` (read shape), `src/mcp/tools/persistPositioningStatement.ts` (write + `gateWrite` + `getUserSupabase`), `src/mcp/tools/designTest.ts` (owned write). Registration list: `src/mcp/server.ts`. Identity: `src/mcp/context/identity.ts`.
- After green, the deploy is a separate gated step (the live MCP host) — run it deliberately, not inside the loop.
- Optional follow-on tools once the core trio lands: `list_touchpoints`, `record_brand_test` / `close_brand_test`, `apply_rewrite` (calls funnel-rewrite + applyRewrite parity).
