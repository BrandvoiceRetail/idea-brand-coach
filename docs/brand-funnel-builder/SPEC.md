# Brand Funnel Builder — Spec v0

**Status:** Draft for Matthew + Trevor review. Net-new; not on any current sprint. Timing TBD.
**One-liner:** "I refined my avatar — now I have ~25 touchpoints to update and no way to see what's covered, stale, or off-strategy." Upload your assets, the agent maps them across your funnel, audits each against your avatar + Positioning Statement, and shows **current vs. desired** — then tracks lift when you redeploy refined messaging.

## Why it's white-space
Funnel analytics (Mixpanel, Amplitude, Cometly, Improvado, Adobe CJA) measure *behaviour*. DAM tools (Frontify, Brandfolder, Canva) *store + version*. **Neither audits assets against the brand's strategy.** That audit — driven by the avatar + IDEA framework — is the moat.

## The loop (asset → outcome)
`upload assets → map to touchpoint → audit vs avatar+Positioning Statement → coverage visual (current vs desired) → redeploy refined messaging → record lift`

## P0 scope (decided)
- **Folder upload**, agent-guided coverage check. No SP-API / Shopify / Klaviyo / Meta integration in P0.
- Output: a **current-vs-desired funnel visual** + a per-touchpoint status (`covered | stale | missing | misaligned`).
- Measurement is **manual-entry first** (the marketing warehouse is stubbed/dark); automated pulls later.
- North-star candidate: **time-to-first-visual** after signup (constraint is user upload effort, not our processing).

## The spine
[`touchpoint-taxonomy.v0.json`](./touchpoint-taxonomy.v0.json) — 5 stages × ~26 touchpoints, each with `applies_when` tags, `p0`, and `audit_against` field bindings. Everything below hangs off it. It is **versioned config, not code** so Matthew + Trevor can edit the inventory and bindings without a deploy.

### Binding correction vs. the Apr-29 thread
The Apr-29 plan bound touchpoints to `purchase_triggers` / `emotional_signals` / `key_messages` / `retention_strategy` — **none of these exist in the code.** The taxonomy re-binds to the real populated avatar schema (`src/types/avatar.ts`):
`psychographics.{values,fears,desires,triggers}`, `buying_behavior.{intent,decision_factors,shopping_style,price_consciousness}`, `voice_of_customer`, `demographics.*`. The messaging artifact is the coach's **Positioning Statement** (`positioning_statement`). v2 (`src/v2/domain/entities/Avatar.ts`) maps `painPoints↔fears`, `goals↔desires`.

## Data-model delta
Reuse what exists; add the three missing links. RLS on every new table mirrors `performance_metrics` (avatars → brands → `auth.uid()`).

1. **`brand_assets`** (new) — the asset-across-funnel ledger.
   `id, avatar_id (FK avatars), touchpoint_id (taxonomy), stage, applicable bool, source_ref (uploaded file / url), messaging_version_id (FK → Positioning Statement version), status ('covered'|'stale'|'missing'|'misaligned'), audit_result jsonb, created_at, updated_at`.
   Reuses the IV-OS `asset_events` append-only log for history (logged / status_change / assessment).

2. **`performance_metrics`** (extend, don't replace) — today it's a thin KV bag (`avatar_id, metric_type, metric_value, recorded_at`; migration `20260301065636`). Add nullable `funnel_stage TEXT`, `touchpoint_id TEXT`, `asset_id UUID`, `deployed_at TIMESTAMPTZ` so a metric attributes to a touchpoint/asset. **Not** the "channel × deployment_date" shape the thread assumed — this is a real (small) extension.

3. **`brand_tests`** (new) — the lift record; the grown-up form of the existing `design_test` artifact (`mcp_design_test_created`).
   `id, asset_id (FK brand_assets), hypothesis, messaging_version_before, messaging_version_after, metric_type, baseline_value, result_value, deployed_at, measured_at, source ('manual'|'warehouse')`.

## MCP tool surface (brand-coach gateway)
- `list_touchpoints(brand)` → taxonomy filtered by the brand's `applies_when` tags.
- `upsert_brand_asset(avatar_id, touchpoint_id, source_ref, messaging_version_id?)` → create/update a mapped asset.
- `audit_asset(asset_id)` → runs the `audit_against` bindings vs avatar + current Positioning Statement → `status` + `audit_result`.
- `get_funnel_coverage(avatar_id)` → current-vs-desired data for the visual.
- `record_brand_test(asset_id, hypothesis, metric_type, baseline_value)` then `close_brand_test(test_id, result_value)` → manual-first lift.
- `get_asset_roi(avatar_id)` → roll up lift across tested assets.

## Ownership boundary
Per the 2-server split: the **asset/test ledger lives on IV-OS** (it owns assets + tests); brand-coach contributes the **messaging version (Positioning Statement)** + the **assessment/audit**. Keep `brand_assets` / `brand_tests` on the IV-OS side; expose reads/writes through the brand-coach MCP gateway.

## ADR-lite — decisions
| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Taxonomy granularity | Lock 5 stages; ~26 leaves as versioned config | Length isn't the moat; applicability + bindings are. Edit without deploy. |
| 2 | Personal-brand touchpoints | Fold into Awareness/Consideration via `personal_brand` flag | Keeps the journey model clean; filterable for founder-led brands. |
| 3 | B2B / service brands | P0 = DTC-product-only; data-driven taxonomy → B2B pack additive later | Trevor's audience is DTC; avoid scope blow-up. |
| 4 | Measurement | Manual-entry first, automated warehouse pulls later | Warehouse data is dark; don't block the ROI story on it. |
| 5 | Metrics storage | Extend `performance_metrics`, add `brand_tests` | Reuse the existing table + RLS; `design_test` already exists as the hook. |

## Open authority items (need Matthew + Trevor)
1. Does the ~26-touchpoint list match the brands you've worked with — anything missing or oddly granular?
2. Confirm decision #2 (personal brand folded, not its own stage)?
3. Confirm decision #3 (DTC-only P0)?
4. Sign off the `audit_against` bindings — which avatar/Positioning Statement fields *truly* drive each touchpoint's "on-strategy" verdict.
