# Brand-Coach MCP — Planning (Surface Map · Dependencies · Build Sequence)

_Companion to OVERVIEW.md and STATUS.xlsx. Mirrors the IV-OS sibling package. CANONICAL IV-OS = `/Users/matthewkerns/workspace/ecommerce/ecommerce-brand-business-os` (never the stale `ecommerce-tools/brand-systems/` clone). Brand-coach paths relative to this repo root._

## 1. MCP Surface Map — TWO SECTIONS

Ownership split = **DOING vs RECORDING**. §1a = NET-NEW tools brand-coach OWNS (the doing front). §1b = tools CONSUMED from IV-OS (the recording ledger + knowledge). Status reflects the **MCP tool/component**, not the engine/data behind it. Critical? = Y only if it directly PRODUCES or TESTS a marketing asset.

### §1a — NET-NEW tools brand-coach OWNS

#### Infra / substrate

| Tool | Mode | Inputs | Outputs | Data backing | Critical? |
|---|---|---|---|---|---|
| `mcp_host_gateway` | R/W | MCP client requests (streamable-HTTP), Supabase JWT (owner identity) | tool registry, `SERVER_INSTRUCTIONS`, per-request RLS-bound session, 5-section Markdown responses | **NET-NEW** (zero MCP code; only `@playwright/mcp` test dep). Reuses IH three-layer FastMCP pattern (skills 040/041) but in **TS** (official MCP SDK, streamable-HTTP) so parity-critical TS (`trustGap.ts`, `FieldPersistenceService` lock gate) is called IN-PROCESS — no duplicate gate, no extra edge-fn hop. `AsyncLocalStorage` identity reset-in-`finally` = TS analog of IH's Python `ContextVar`. | **Y** (substrate) |
| `ivos_consumption_client` | R/W | capability calls (write-produced-asset, record-test, read-canon, read-product, read-funnel) | adapter responses; binds writes when D5 lands | **NET-NEW** thin server-to-server MCP CLIENT into canonical IV-OS (Python FastMCP). Binds `list_assets`/`get_asset` NOW (STABLE). References `log_asset`/`update_asset_status`/`record_test`/`get_test_result` (built, in Testing) + all knowledge reads BY CAPABILITY (do NOT pin signatures — ADR 0001 made `update_asset_status` drive a ContentReview **approval** lifecycle, not generation status). **D5**: Supabase-JWT ↔ no-auth single-tenant IV-OS-FastMCP — service-account vs token-passthrough (brand-coach-side). | **Y** (substrate) |

#### Diagnostic (convenience)

| Tool | Mode | Inputs | Outputs | Data backing | Critical? |
|---|---|---|---|---|---|
| `run_trust_gap` | R | `diagnostic_id` OR `scores` | 4-pillar IDEA scores, bands, gap | wraps `src/lib/trustGap.ts:buildTrustGap()` VERBATIM in-process (pure, tested) — Calculation Parity | N |
| `run_diagnostic` | W | answers (6-question IDEA) | scores + Trevor-voice interpretation, persisted submission | wraps `SupabaseDiagnosticService` (`calculateScores`+`saveDiagnostic`) + `diagnostic-interpretation` edge fn. **C1**: edge fn is `verify_jwt=false`/public — gateway MUST bind caller identity BEFORE the interpretation leg | N |
| `generate_signature` | R | `avatar_id` (+ `conversation[]` OR synthesized context-bundle — gated by **D2**) | 3-4 distinct Signature options | pass-through to `reveal-signature` edge fn (frozen no-parroting prompt; accepts `conversation[]` OR `fields` OR `reviews`, declines gracefully if all empty — does NOT strictly require conversation). Persist-chosen-Signature is MISSING (no signatures table/column, verified absent) — save routes through IV-OS `log_asset`, NOT a brand-coach store | N |
| `build_avatar` | R/W | `avatar_id`, fields, `is_locked` | avatar profile, field values, lock state | wraps `SupabaseAvatarService` + `FieldPersistenceService`. **SUBSUMES** the prior packet's `get_avatar`/`update_avatar_field`/`toggle_field_lock` (the manual-edit-lock control, `FieldPersistenceService.ts:193`). `field_source` is **server-set, never trusted from MCP args** (confused-deputy vector). PARITY HAZARD: lock gate is TS-only (**MF-2**, no DB trigger) — call in-process via TS gateway and ship the DB trigger with this first write tool | N |
| `search_user_kb` | R | `query` (+ caller identity) | semantic chunks (pgvector ada-1536) | wraps `match_document_chunks` RPC. **MF-1**: RPC is SECURITY DEFINER, trusts `match_user_id` with NO caller check (confused deputy) — gateway/function must verify caller authorized (owns id OR active `va_grants` row) before exposing | N |

#### Conversation / coach (convenience)

| Tool | Mode | Inputs | Outputs | Data backing | Critical? |
|---|---|---|---|---|---|
| `run_conversation` / `continue_conversation` | W | message, session/avatar context | one assembled Trevor reply + extracted fields | wraps `idea-framework-consultant-claude` via `callConsultant` (client-side TS method) VERBATIM — the literal Trevor-coaching core, chat-primary surface backend. Caveats: (a) MCP is request/response → buffer streamed `text_delta`/`extracted_fields` and emit one assembled reply (Q5 ack, not a voice change); (b) history is threaded server-side (no `previous_response_id`). Extracted fields still persist through `FieldPersistenceService` (the lock gate). A coaching turn can be the headless transcript that feeds `generate_signature` (D2 resolution (a)) | N |

#### Strategy export (convenience)

| Tool | Mode | Inputs | Outputs | Data backing | Critical? |
|---|---|---|---|---|---|
| `export_strategy_doc` | R/W | avatar/brand context, section/format | strategy doc / section / PDF | wraps `generate-brand-strategy-document` / `-section` / `-pdf` edge fns VERBATIM (Calculation Parity; LLM-gen, idempotent per snapshot). Decide whether the produced doc also routes through IV-OS `log_asset` (it is an asset) or stays a brand-coach read — consistent with the Signature-via-`log_asset` stance | N |

#### Concept → publish-filter → draft → test-design (the OWNED critical-path chain)

| Tool | Mode | Inputs | Outputs | Data backing | Critical? |
|---|---|---|---|---|---|
| `generate_concepts` | W | `avatar_id`, `channel`, `brief` | concept candidates | **NET-NEW** (no standalone concept-gen engine, grep=0). Composes `callConsultant` (`idea-framework-consultant-claude`); READS IV-OS canon (`get_brand_voice`/`get_positioning`/`get_messaging_pillars`) + product truth; terminal WRITE to IV-OS `log_asset`. **FIRST chain link**; can DRAFT-to-local WITHOUT IV-OS write | **Y** |
| `publish_filter_check` | R | `content`, `avatar_id` | verdict, violations | **NET-NEW** (grep=0; `brand-copy-generator` is the INVERSE — generates `{copy}`, no compliance/reject/allowlist logic). Compliance gate: validates claims against IV-OS `get_safe_claims` (NOT a local allowlist) + canon. **D6**: align to IV-OS 150-point listing-assessment vs build net-new scoring (Trevor-voiced verdict → R-015); ties to Review Lab **F-054/F-055/F-063**, NON-GOAL **F-056** (image-gen). Then `update_asset_status` on IV-OS | **Y** |
| `draft_asset` | W | `concept_id`, `format`, `avatar_id` | copy + alternates | wraps `brand-copy-generator` edge fn VERBATIM; READS IV-OS canon/product so the IV-asset path uses canonical IV voice (NOT the user-supplied profile voice the edge fn defaults to); terminal WRITE to IV-OS `log_asset`. **THIRD chain link**, produces the copy asset | **Y** |
| `design_test` | W | `hypothesis`, `asset_ids[]`, `variants` | `test_id`, variants | **NET-NEW** (grep=0). Composes drafted alternates into A/B variants; terminal WRITE to IV-OS `record_test` (`asset_ids` link to `log_asset` request_ids). Brand-coach OWNS test DESIGN; IV-OS OWNS the durable test STORE (`ab_tests`/`ab_test_variants` **now shipped** — the prior "no durable store" blocker is RESOLVED). **FINAL chain link** | **Y** |

### §1b — CONSUMED from IV-OS

Reference PROVISIONAL tools BY CAPABILITY; do NOT hardcode final signatures. **Re-flag note:** the task preamble flagged the four write tools as PROVISIONAL pending an ADR — canonical IV-OS shows them **BUILT + in Testing (56/56)** per ADR 0001 (DONE). They are re-flagged **STABLE-IN-TESTING**: same maturity as the reads, with residual caveats = pre-merge/pre-deploy (not on `main`/deployed) + the brand-coach-side **D5** transport/auth gate. The genuinely-Not-Started PROVISIONAL surfaces are the **knowledge reads** (canon/product/funnel).

| Tool | Group | Stability | Brand-coach use |
|---|---|---|---|
| `list_assets` | ledger-read | **STABLE** | After the chain produces an asset, list prior assets to dedupe + populate a recently-produced picker before `design_test`. Built, in Testing (56/56). Safe to bind NOW. NOTE: live `content_agents.db` is empty → returns ledger-empty until writes populate it. |
| `get_asset` | ledger-read | **STABLE** | Fetch full prompt/content/perf-metrics/review-status so `design_test` attaches the real asset body to a variant and a redraft references the prior version. Built, in Testing. Safe to bind NOW. |
| `log_asset` | ledger-write | **STABLE-IN-TESTING** _(pre-merge/pre-deploy; gated by brand-coach D5, not IV-OS readiness)_ | CRITICAL PATH. Terminal write of `generate_concepts` + `draft_asset`: every produced asset recorded INTO the IV-OS ledger; brand-coach must NOT build its own asset store. Reference by capability behind the adapter; bind once D5 lands. |
| `update_asset_status` | ledger-write | **STABLE-IN-TESTING** _(same gate)_ | CRITICAL PATH lifecycle. After `publish_filter_check`, drive the asset's **approval** lifecycle (ADR 0001: ContentReview draft/in_review/approved/rejected — NOT generation status). Reference by capability. |
| `record_test` | ledger-write | **STABLE-IN-TESTING** _(same gate; durable store RESOLVED)_ | CRITICAL PATH. Terminal write of `design_test`: A/B test over drafted assets recorded into the durable `ab_tests`/`ab_test_variants` store, `asset_ids` linking to `log_asset` request_ids. The prior "no durable test store" blocker no longer applies. |
| `get_test_result` | ledger-write | **STABLE-IN-TESTING** _(same gate)_ | Read back variants/metrics/two-proportion-z significance/winner so proven winners feed the next `generate_concepts` cycle. Convenience read-back, not a chain terminus. |
| `get_brand_voice` | brand-canon | **PROVISIONAL** _(IV-OS Not Started)_ | Feed canonical IV voice/tone/do-not lists into `draft_asset` (and `reveal-signature`) INSTEAD of hardcoded Trevor voice-rules in `reveal-signature/index.ts` (~L64-97). The Trevor IDEA-COACH persona is brand-coach IP; the voice rules an ASSET must obey are IV canon. Backing `brand-voice-guide.md` exists. |
| `get_positioning` | brand-canon | **PROVISIONAL** _(Not Started)_ | Pull IV archetypes (Hero+Magician)/essence/tagline so `generate_concepts` + `publish_filter_check` judge against real positioning. Backing `brand-strategy.md` exists. |
| `get_messaging_pillars` | brand-canon | **PROVISIONAL** _(Not Started)_ | Constrain `generate_concepts` + `publish_filter_check` to approved content pillars + per-channel rules. Backing `content-strategy.md` + `BRAND_COPY_GUIDELINES.md` exist. |
| `get_visual_identity` | brand-canon | **PROVISIONAL** _(Not Started)_ | Supply logo/type/color/do-not rules to `publish_filter_check` for any visual-asset draft. Backing PDF needs extraction. |
| `get_product_catalog` | product-truth | **PROVISIONAL** _(Not Started + data in conflict)_ | Resolve which SKU/ASIN a concept is about before drafting so brand-coach never invents product facts. Must reconcile Convex seeds vs `productCatalog.ts` vs live scrape vs Drive workbooks first. |
| `get_product_by_asin` | product-truth | **PROVISIONAL** _(Not Started + conflict)_ | Pull full specs/features/per-avatar benefits for the targeted ASIN to ground `draft_asset`. Returns `sourceConflicts` until reconciled. |
| `get_safe_claims` | product-truth | **PROVISIONAL** _(Not Started)_ | CRITICAL compliance input for `publish_filter_check`: only approved claim strings survive into a draft (validate against this, NOT a local allowlist). Today claims are free-text in `productCatalog.ts` benefit arrays. |
| `get_product_compatibility` | product-truth | **PROVISIONAL** _(Not Started + underbacked)_ | Verify `fitsCardTypes`/sleeves/capacity/toploader claims before a draft asserts them. Free-text bullets only; needs a curation pass. |
| `get_funnel_metrics` | funnel | **PROVISIONAL** _(Not Started + fragmented)_ | Inform concept prioritization (which funnel stage needs assets). Convenience only, NOT critical path. PostHog 441902 live-but-unwired vs stale content-engine ETL — source-of-truth decision required. |
| `get_lead_stage` | funnel | **PROVISIONAL** _(Not Started)_ | Optional context for avatar/Trust-Gap diagnostics (which lead stage the owner targets). Convenience. Backed by `google-sheets-storage` `lead.status`, fragmented. |
| `get_cart_recovery_state` | funnel | **PROVISIONAL** _(Not Started)_ | Optional input for cart-recovery concept ideas. Convenience only. Backed by content-engine `abandoned_cart` SQLite migration 003, fragmented. |
| _(system-KB / IDEA-canon read)_ | brand-canon | **PROVISIONAL** _(prefer fold into IV-OS canon)_ | Prior packet tool 10 (FLAG-7/R-017) — Trevor's book / IDEA canon. `SystemKBContext` is an always-true no-op today. Under the consumer reframe, fold IDEA-canon retrieval into IV-OS brand-canon reads rather than building a brand-coach system-KB store; resolves FLAG-7 by deferring to IV-OS. |

## 2. Dependency Graph

```
                  ┌──────────────────────────────────┐
                  │   Brand-Coach MCP Host / Gateway   │ ◀── copy pattern from Inventory Hero MCP
                  │   (TS streamable-HTTP, in-process) │     (skills 040/041); TS analog of IH ContextVar
                  └──────────────────┬─────────────────┘     = AsyncLocalStorage reset-in-finally
                                     │ (every owned tool + the adapter depend on the host)
        ┌────────────────────────────┼───────────────────────────────┐
        ▼                            ▼                                 ▼
  ┌───────────────────────────────────────────┐   [Diagnostics N]    [Conversation N]   [Export N]
  │  OWNED CRITICAL-PATH CHAIN (the doing slice)│    run_trust_gap      run/continue_      export_
  │                                             │    run_diagnostic     conversation       strategy_doc
  │  generate_concepts ──▶ publish_filter_check │    generate_signature
  │        │ (concept)        │ (compliance)    │    build_avatar
  │        ▼                  ▼                  │    search_user_kb
  │   draft_asset ─────▶ design_test            │
  │   (produces copy)   (final link)            │
  └──────┬───────────┬──────────┬───────────────┘
         │ READ       │ WRITE    │ WRITE
         ▼            ▼          ▼
  ╔═══════════════════ IV-OS Consumption Client (server-to-server MCP client) ═══════════════════╗
  ║  cross-server ──▶ IV-OS list_assets / get_asset        [STABLE — bind NOW]                    ║
  ║  cross-server ──▶ IV-OS log_asset / update_asset_status [STABLE-IN-TESTING — bind on D5]      ║
  ║  cross-server ──▶ IV-OS record_test / get_test_result   [STABLE-IN-TESTING — bind on D5]      ║
  ║  cross-server ··▶ IV-OS canon / product / funnel reads  [PROVISIONAL — IV-OS Not Started]     ║
  ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
```

Key implications:
- **The host is the root.** Nothing ships without it; build it first (folded into the first slice with the STABLE-reads adapter).
- **The owned chain ships independent of IV-OS writes.** `generate_concepts`/`draft_asset` return content locally; the terminal `log_asset`/`record_test` writes bind once the brand-coach-side **D5** decision lands (the IV-OS tools themselves are already built).
- **`publish_filter_check` is decision-blocked on D6** (net-new scorer vs consumed IV-OS 150-point read) and consumes `get_safe_claims` (PROVISIONAL).
- **Diagnostics/conversation/export are parallelizable convenience** — not on the critical path; ship the MF-2 trigger with `build_avatar` and MF-1 hardening with `search_user_kb`.

## 3. Build Sequence (one initiative at a time)

1. **★ `mcp_host_gateway` + `ivos_consumption_client` (STABLE reads only)** — TS streamable-HTTP, IH three-layer pattern (skills 040/041); `AsyncLocalStorage` identity reset-in-`finally`; `SERVER_INSTRUCTIONS`; 5-section formatter; health tool; bind `list_assets`/`get_asset`; MF-5 log-redaction contract test. **Dependency ROOT, lowest-effort critical-path slice. THIS INITIATIVE.**
2. **`generate_concepts`** (first owned chain link) — composes `callConsultant` + reads IV-OS canon; DRAFTs to local return WITHOUT IV-OS write; terminal `log_asset` deferred behind a capability flag.
3. **`draft_asset`** (wraps `brand-copy-generator` verbatim) — second producing link; same independence (produces copy now, records later); reads canonical IV voice not user profile.
4. **`publish_filter_check`** (net-new; **D6** decides scoring source) — compliance gate between concept and draft; consumes IV-OS `get_safe_claims` + canon (PROVISIONAL → reference by capability).
5. **Decide D5 + bind IV-OS writes** → bind `log_asset`/`update_asset_status`; CLOSE the produce-AND-record loop (the IV-OS tools are already built — no IV-OS work needed, only the brand-coach-side auth decision).
6. **`design_test`** (net-new) + bind `record_test` → closes the test side of the critical path (IV-OS durable test store already shipped; gated only by D5).
7. **Convenience diagnostics** (`run_trust_gap`, `run_diagnostic`, `generate_signature`, `build_avatar`, `search_user_kb`) — wrap engines verbatim; ship MF-2 DB trigger with `build_avatar`, MF-1 hardening with `search_user_kb`. Parallelizable, N.
8. **Convenience conversation + export** (`run_conversation`/`continue_conversation`, `export_strategy_doc`) — wrap verbatim; buffer streamed deltas into one reply. N.
9. **Convenience IV-OS knowledge reads** (canon, product-truth, funnel) — bind as each IV-OS PROVISIONAL tool ships; reference by capability until then. Fold system-KB/IDEA-canon (FLAG-7) into IV-OS canon.
10. **VA / cross-owner access model (D1)** — only if VA confirmed real; gates convenience reads, NOT the critical path; ~40% net-new.

## 4. Reuse vs build (explicit)

- **Reuse the pattern:** Inventory Hero's three-layer structure (service fn → tool file/`register()` → server registration), Markdown 5-section response formatter, MCP annotations, telemetry-by-wrapping, fail-closed config, `SERVER_INSTRUCTIONS` guard — via skills `040-add-mcp-endpoint` / `041-author-mcp-resource`. **Clone the STRUCTURE, not the language:** brand-coach uses a **TS gateway** (official MCP SDK, streamable-HTTP) with `AsyncLocalStorage` identity reset-in-`finally` as the TS analog of IH's Python `ContextVar`, so parity-critical TS runs in-process. Mirror the IV-OS sibling package format (OVERVIEW + PLANNING surface-map + STATUS per-component) so the two are siblings. _(Caveat: skills 040/041 are Inventory-Hero-project-local; verify reachable to the builder or attach the pattern doc.)_
- **Reuse the data (wrap VERBATIM — Calculation Parity):** `trustGap.ts:buildTrustGap`, `SupabaseDiagnosticService`, `diagnostic-interpretation`, `reveal-signature`, `SupabaseAvatarService`+`FieldPersistenceService`, `match_document_chunks` RPC, `idea-framework-consultant-claude` (via `callConsultant`), `brand-copy-generator`, `generate-brand-strategy-document/-section/-pdf`.
- **Consume from IV-OS (never duplicate):** the asset/test ledger (`list_assets`/`get_asset` STABLE; `log_asset`/`update_asset_status`/`record_test`/`get_test_result` STABLE-IN-TESTING — built, gated only by brand-coach D5) + knowledge reads (canon, product-truth incl. `get_safe_claims`, funnel — PROVISIONAL).
- **Build new:** the TS MCP host/gateway; the thin IV-OS-client adapter (server-to-server); the 4 net-new asset-chain engines/tools (`generate_concepts`, `publish_filter_check`, `draft_asset`, `design_test`); the MF-2 lock DB trigger; the MF-1 RPC hardening.
- **Do NOT rebuild:** the IV-OS asset/test ledger (call `log_asset`/`record_test`); brand canon / product truth / funnel knowledge (call IV-OS reads); a brand-coach signatures/asset/test store (route persistence through IV-OS `log_asset`/`record_test`); the frozen Trevor edge fns (wrap, don't fork); the Inventory Hero server (copy the pattern only). Do NOT design asset-storage, test-storage, or brand-canon tools in this repo.