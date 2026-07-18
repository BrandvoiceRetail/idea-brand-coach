# ADR-APP-VS-MCP-SURFACE — Output consistency across surfaces + exactly one customer surface

- **Status:** Proposed (2026-07-15) — open decisions flagged for Matthew at the end
- **Deciders:** Matthew Kerns (eng), with Trevor Bradford (product) on framing
- **Supersedes / extends:** [`ADR-V4-SURFACE`](../v4/ADR-V4-SURFACE.md) (the "single user-facing surface" intent + the `VITE_FORCE_V4` mechanism this ADR replaces)
- **Relates to:** [`ADR-UNIFIED-COACH-CAPABILITY-LAYER`](../v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md), `ADR-COACH-SURFACE-PARITY` (on `adr-coach-parity`), [`STORE_AND_RESURFACE`](STORE_AND_RESURFACE.md)
- **Grounded in:** a 5-agent read-only investigation of the brief/facts paths, the data model, the routes, and the orchestration layer (2026-07-15). File:line evidence lives in that investigation; key files listed per decision.

---

## Context

Trevor's recurring complaint — *"the app and the Claude connector give me materially different answers for the same ASIN"* (07-10) — is real, but it is **not one bug**. The investigation found **three** surfaces with different orchestration, and multiple independent sources of output divergence.

### The three surfaces (not two)

| # | Surface | Orchestrator | Agency | Data reach | Model | Skills/persona |
|---|---|---|---|---|---|---|
| A | **MCP connector coach** | claude.ai **host model** (ours only registers tools + ships `SERVER_INSTRUCTIONS`) | Fully agentic, unbounded loop, asks clarifying questions | ~87 IDEA tools **+ any co-attached connector** (Windsor, Titan, Inventory Hero, Higgsfield) | User-selected host model (Opus/Sonnet) | Full Tier-1 App Skills + coaching persona on every call |
| B1 | **In-app chat coach** (`idea-framework-consultant-claude`) | Our edge fn, **bounded** loop (`MAX_ITERATIONS=4`, 60s) | Agentic **only when triple-gated on** (env flag + PostHog `coach-mcp-tool-loop` + auth) | ≤21 tools (~16 live), **no external connectors** | `claude-sonnet-4-6` @ **0.7** | Own BP1 persona (distinct prompt asset) |
| B2 | **In-app diagnostic pipeline** (`src/services/v4/*`, `/v5` paste-to-brief) | **Fixed TypeScript sequence**, no model chooses steps | None — returns typed `needs_input`, never asks a model | **Walled to its own scraped `user_products`/`user_product_reviews`** | Edge fns pinned Sonnet (0.3–0.5), Haiku for `diagnostic-interpretation` | None at the orchestration level; each edge fn has its own single-purpose prompt |

### The holistic output-determinants map — everything that makes outputs differ for the same ASIN

Grouped by layer. Each is an independent cause; they compound.

**Input substrate**
1. **Scraper strength** — the app import historically used a weaker `/dp/`-only path (~8 reviews); `main` now has a shared `chooseReviews()` seam, but it picks whichever extraction found *more*, so the review **set changes run-to-run**.
2. **Corpus freshness** — after a 7-day window the listing is re-scraped; a different review set → different scores → different `primary_gap` → different trigger → different brief angle.
3. **Corpus is snapshot-replaced** each scrape (`user_product_reviews` delete+insert); nothing is pinned as the canonical read.

**Facts & claims**
4. **No canonical facts store** — approved product facts/claims/ingredient concentrations are not persisted per product. The nearest store, `business_facts`, is owner-confirmed + versioned but **user-scoped by slot-id, not product/brand**, and slot #6 (product claims) is wired to the *scraped listing*, not to `business_facts`.
5. **`/v5` passes `confirmed_claims: []` and runs no claim gate** — the app brief path hands the stateless `export-brief` engine an empty allowlist and never runs `scanBrief`; the MCP path resolves a claims allowlist and runs the deterministic gate. **Same engine, different payloads, only one gated.**
6. **`/v5` claim confirmations are never persisted** — `handleConfirmClaim` only flips React state.

**Positioning root**
7. **Degradation ladder** — `resolvePositioning` walks canvas → prior decision-trigger → positioning statement → avatar-profile depending on what happens to exist, so the brief's root drifts between runs.

**Model & params**
8. **Model tier** — connector reasons on a user-selected, more capable host model; app edge fns are pinned (and `diagnostic-interpretation` runs on **Haiku** — a different quality tier for "the same" score).
9. **Temperature** — app diagnostic 0.3–0.5 (deterministic by design), chat coach 0.7, connector host its own default.

**Orchestration & tool access** *(the largest divergence)*
10. **Agency** — connector picks tools, iterates, and **asks for missing data**; the app pipeline runs a fixed chain and can only use the pasted ASIN.
11. **External data reach** — the connector is *designed* to pull Windsor analytics, execute via Higgsfield, and use any co-attached connector (Titan/Inventory Hero). The app cannot reach any of it. **This is the root of Trevor's "the MCP is superior" observation** — it's pulling data the app structurally can't see.
12. **Feature-gating** — the in-app chat coach's tool loop is triple-gated; two "in-app" users can get structurally different behaviour purely from a PostHog flag.

**Skills / grounding**
13. **Skill layer** — the connector always carries Tier-1 App Skills + per-tool skill citations + the full coaching persona; the app diagnostic carries none of it.

**Surface exposure** *(a different axis — see Decision 5)*
14. **~30 deprecated legacy pages remain customer-reachable by direct URL** (4 with no auth gate), and a live leak (`Landing.tsx:31`) sends signed-in users into the legacy `/v1/dashboard`. `VITE_FORCE_V4` only changed the default landing; it sealed nothing.

### The reframe that makes this tractable

Not all of this *should* be made identical. Divergence splits cleanly into two kinds:

- **Consistency failures (must fix)** — the two surfaces asserting *contradictory facts* about the same product: a different title, "AnaGain™ absent" when it's on the label, 8 vs 36 reviews, claiming a signal is missing when it's present. This is a bug and it destroys trust.
- **Capability divergence (intentional — keep, but frame)** — the connector does *more*: it's agentic, pulls external data, asks clarifying questions. That is its value; Trevor called it "superior" for exactly this reason. Forcing the app to match it would throw away the app's value (the deterministic onboarding "theatre," zero setup, one focused pass).

**So the goal is not "make them identical." It is: the same *facts* everywhere, and the *capability* difference made legible to the user** ("same coach — the connector is the always-on, deeper version").

---

## Decision

### D1 — Facts consistency is mandatory; capability divergence is intentional and must be framed, not eliminated
The binding rule: **no two surfaces may assert different facts about the same product.** Capability/depth differences between the connector and the app are allowed and expected, and are addressed by framing (D6), not by making the app agentic.

### Root cause confirmed (2026-07-15) — the AnaGain failure needs D3, not D2
Reproduced from the serum's stored run (ASIN `B0D42C2H3T`, `user_products.last_run`): the scrape **did** capture "4% AnaGain™" (and brand "Guyology Labs") into `user_products.title`; the app run passed **`confirmed_claims: []`** and ran no claim gate; the generated title was `"[Brand Name] Hair Growth Serum, DHT Blocking Formula with Rosemary, Pea Sprout and Saw Palmetto…"`. Denied the confirmed trademark, the model downgraded AnaGain™ to its generic botanical source ("Pea Sprout") and left the brand as an unfilled `[Brand Name]` placeholder. **The fact was present in the scrape; the app path discarded it.** ⇒ The fix is **D3 (unify the app brief contract + gate)**, not D2 — the facts already exist in `user_products`. `canonical_facts` (D2) remains useful for *owner-confirmed / forbidden* claims (facts not in the listing) but is **not on the critical path** for this class of bug.

### D2 — A `canonical_facts` store is the single source of product truth both surfaces read (deferred — not needed for the AnaGain-class fix)
New table `canonical_facts`: small, human-approved, versioned. Keyed `user_id` (+ `product_id → user_products`, optional `brand_id → brands`), `is_current`/`version` pattern (mirrors `business_facts`). Holds approved facts, **approved AND forbidden claims**, SKUs, verified ingredient names/concentrations. Both the app edge fns and the MCP resolve slot #6 (and the brief allowlist) from this store first. Must be registered in `gdprData.ts` `USER_ID_TABLES` (before `user_products`) and the `gdpr-export`/`gdpr-delete-account` fns redeployed in the same change.

### D3 — Unify the brief request contract + run the same claim gate on the app path
`fixService.generateBrief` (and the `/v5` path) must send the same `{canvas, positioning statement, confirmed_claims}` payload the MCP sends and run the same deterministic `scanBrief` gate on the output. Close the two persistence gaps: (a) point slot #6 at `canonical_facts`/`business_facts` instead of `[]`/scraped bullets; (b) persist `/v5` claim confirmations. Net: the *set of assertable facts* is identical across surfaces, and neither can ship an ungated product-truth claim.

### D4 — Reduce nondeterminism where it is not wanted
Pin the canonical corpus read (don't let `chooseReviews` silently change the review set under a cached run), and treat factual fields (title, claims, ingredients) as canonical-facts-driven rather than re-improvised per call. Copy-level wording drift from temperature is acceptable; **fact drift is not.**

### D5 — Exactly one customer-facing surface, enforced (replaces `VITE_FORCE_V4`)
Replace the version-named flag with a durable enforcement mechanism:
1. **One source of truth:** `CURRENT_SURFACE` constant; default landing, home, and redirect target all derive from it.
2. **Default-deny routing:** an allowlist of `current + infra + internal(auth/role/flag-gated)` routes render; **everything else funnels through one `LegacyRedirect → CURRENT_SURFACE` wrapper.** A legacy page cannot leak because "not on the allowlist" means "redirect."
3. **CI route-manifest test:** fails the build if any `<Route>` is unclassified (`current | infra | internal | legacy-redirect`). New surfaces can't leak; old ones can't linger silently.
4. **Post-deploy smoke check:** asserts deprecated paths 3xx to `CURRENT_SURFACE` and `/` lands on current, run against the **actual deployed env** (catches the staging-vs-main `/v1/start-here` drift found in the investigation).

Immediate leaks to close: `ROUTES.HOME_PAGE` (`/v1/start-here` → `CURRENT_SURFACE`), `Landing.tsx:31` (signed-in → `/v5`, not `/dashboard`), and the ~30 legacy destination pages (redirect, or move behind the `internal` tier for `/v4/*`, `/admin/*`, `/test/*`).

### D6 — Positioning: "same coach, the connector is the always-on, deeper version"
Adopt the already-drafted connector copy ("Chat with the Brand Coach, 24/7") everywhere the connector is introduced, so the capability difference reads as *depth of the same coach*, not *a different, contradictory tool*. This is the product-framing half of D1.

---

## Consequences

**Positive**
- The trust-killing failure (contradictory facts) is removed at the root; both surfaces draw assertable facts from one approved store and gate identically.
- The surface leak becomes structurally impossible to reintroduce (CI + default-deny), not a manual redirect that rots.
- "App vs MCP" stops being a bug report and becomes a legible product story (depth, not contradiction).

**Negative / cost**
- D2/D3 touch shared schema + edge functions + the MCP resolver + GDPR fns — a real, multi-part change requiring a migration, backfill consideration, and redeploys (ask-first territory per root `AGENTS.md`).
- D5 default-deny risks over-sealing internally-needed routes (`/v4/*`, admin, test) → requires the explicit `internal` tier, not a flat current-vs-legacy split.

**Risks**
- Copy-level (non-factual) drift from temperature will remain; if Trevor reads *any* wording difference as inconsistency, D6 framing must carry that — verify the framing lands with him.
- Staging-vs-main drift means "fixed on main" ≠ "fixed where Trevor tested." Reconcile environments before claiming any route fix is done (verify-before-Trevor).

---

## Enforcement & discoverability
- The "exactly one customer surface" rule is enforced by the CI route-manifest test (D5.3), not convention.
- This ADR must be referenced from the `AGENTS.md` files at every relevant level: root `AGENTS.md`, `src/mcp/AGENTS.md`, `supabase/functions/AGENTS.md`, and the current-surface component area — so the next surface follows it by default.

---

## Open decisions for Matthew (needed before build)
1. **Canonical-facts scope for v1** — full approved+forbidden-claims + ingredient concentrations, or start with just the product-claims allowlist that D3 needs and grow it? (Smaller = ships faster and still fixes the fact-contradiction.)
2. **`internal` tier for legacy routes** — hard-redirect *all* legacy to `CURRENT_SURFACE`, or keep `/v4/*` + `/admin/*` + `/test/*` reachable behind an auth/role/flag gate for your own use?
3. **Nondeterminism appetite (D4)** — pin/cache the canonical corpus read for consistency, or accept run-to-run score movement as "the market moved"? (Affects how hard we lean on caching vs re-scrape.)
4. **Build order** — do D5 (surface enforcement, self-contained frontend + CI) first as the quick, safe win, then D2/D3 (the deeper facts change)? Recommended.
