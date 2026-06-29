# Store-and-Resurface: every user input persists and comes back

**Principle.** Anything a user can enter into IDEA Brand Coach must be (1) **stored**
durably the moment they give it, and (2) **resurfaced** to them at the points where it is
useful — the right step of an MCP tool workflow, the in-app UI, and the MCP-app custom UI
panels. A field that is captured but never read back is a bug, even when nothing throws.

This is not a nicety. The whole product promise is "never ask twice" — the coach earns trust
by remembering. The day we ask a user for their ASIN, their reviews, or their positioning a
second time, we have broken the thing we sell.

## The two halves (both are required)

| Half | Means | Enforced by |
|---|---|---|
| **Store** | the input lands in a durable, RLS-scoped table the instant it is given — not transient React state, not a chat turn that scrolls away | the service/edge-fn that handles the input writes to a table; never "hold it in component state and hope" |
| **Resurface** | every store has at least one read path that brings the value back at the moment it is useful | the MCP context resolver (`src/mcp/service/contextResolver.ts`), app load-on-mount, and the MCP-app panels |

A store with no resurface path is dead data. A resurface path that reads a different store
than the one the input was written to is the **ASIN bug** (see case study).

## How it is enforced architecturally

### MCP / connector side — the 18-slot manifest is the contract
`src/mcp/contracts/slots.ts` defines the **18 master context slots** (id, trust class,
`residesIn`). `residesIn` is the ordered list of stores the resolver walks for that slot,
ending in `ask`. **The invariant: every user-enterable field maps to a slot whose `residesIn`
names a real store before `ask`.** If a slot's only entry is `['ask']`, the field is
write-only — captured somewhere but never resolved — which is the bug class this doc exists to
prevent. `src/mcp/service/contextResolver.ts` walks those stores KB-first and returns
`{value, source, status}`; tools (`assess_idea_dimensions`, `generate_*`, `get_context_status`)
read through it so they see everything the user has ever given, across every surface.

Two resolver rules that keep resurface honest:
- **Cross-store reads.** A slot may resolve from any store that holds the field. Listing copy
  (#3) resolves from `evidence_snapshots` *and* the app's scraped `user_products`; reviews (#1)
  from `user_product_reviews` *and* `evidence_snapshots`. The app and the connector write to
  different tables, so the resolver must read both or one surface goes blind to the other's data.
- **Brand-level fallback.** Avatar-scoped reads fall back to brand-level (`avatar_id IS NULL`)
  rows. Evidence ingested before an avatar was chosen (the onboarding case) must still resolve
  for an avatar-scoped read — otherwise freshly-stored data reads back as "missing".
- **A `conflict` status still carries a real value — read it.** When two stores hold the same
  field and disagree, `reconcile()` keeps the highest-priority store's value and flags
  `conflict` so the disagreement can surface for the owner. A consumer that *reads evidence to
  analyse* (assess, diagnostic, decision-trigger, audit) must treat `conflict` (and `stale`,
  which is "real but old") as a usable fill — dropping it reports "no evidence" when the data is
  on file, which is the exact store-and-resurface failure. The one exception is the
  **fabrication gate** in `generate_brief`: there `conflict` must stay excluded, because a
  disagreement is not a *confirmation* and unconfirmed claims may never enter generated copy.

### App side — load-on-mount
A screen that lets the user enter a field must load that field's store on mount and prefill,
so a returning user is never shown a blank input for data they already gave. Example:
`ProblemSolverDiagnostic` loads `productDataService.getProducts()` and prefills the ASIN;
`DiagnosticResults` does the same for the imported-products panel. The rule: **if the screen's
copy implies persistence ("upload once; every future session builds on it"), the code must
deliver it.**

### MCP-app custom UI side
Interactive panels (`src/mcp/service/onboard.ts` and peers) should reflect what the system
already knows — a returning user's panel is not the same blank panel a first-timer sees.

## The data register (seed — extend as fields are added)

| User input | Stored in | Resurfaced by |
|---|---|---|
| ASIN + scraped listing (title/bullets/desc/images) | `user_products` | MCP slot #3/#5/#6 via resolver; app `getProducts()` on mount; `import-product-data` edge fn writes it |
| Own product reviews (verbatim) | `user_product_reviews` (app scrape) · `evidence_snapshots.reviews` (connector ingest) | MCP slot #1 |
| Own listing copy (explicit paste) | `evidence_snapshots.listing` | MCP slot #3 |
| Positioning intent / voice / target beliefs | `avatar_field_values` · `user_knowledge_base` | MCP slots #12/#13/#14; app avatar editor |
| Business facts (revenue, margins, channels, inventory) | `business_facts` | MCP slots #7–#11/#16 |
| Intake answers | `diagnostic_submissions` | MCP slot #15 |
| Funnel/campaign metrics (Windsor) | `campaign_metrics` | `get_funnel_piece_metrics` edge fn; MCP read-backs |
| v4 onboarding context | `user_knowledge_base` (`v4_onboarding_context`) | app `useV4ContextAutofill` |

## Case study — the ASIN that "wasn't remembered" (2026-06-29)

A user reported the onboarding flow kept asking for their ASIN even though they had imported it
several times, "and the app doesn't seem to remember it either." Investigation:

- The ASIN **was** stored — `user_products` had their row (ASIN, 144-review count, listing, 8
  verbatim reviews). Storage was never the problem.
- **App gap:** `ProblemSolverDiagnostic` held the ASIN only in transient React state and never
  loaded `user_products` on mount, so the upload screen was blank on every revisit.
- **Connector gap:** the context resolver read the listing slot only from `evidence_snapshots`
  (the connector's own store, empty for this user) and never from the app's `user_products`, so
  the coach could not see the already-scraped listing and asked again / re-scraped.
- **Read-after-write gap:** evidence ingested at brand-level was invisible to an avatar-scoped
  `assess` (binary `avatar_id` filter, no fallback), which the coach misread as "async lag".

All three were resurface failures, not storage failures. The fixes — load-on-mount in the app,
`user_products` added to slots #3/#6, and the brand-level fallback — are the canonical shape of
honouring this principle.

## Checklist when adding any new user-entered field

1. **Store:** write it to a durable RLS-scoped table on entry (a service or edge fn, not
   component state). One natural-key upsert so re-entry reconciles, no duplicates.
2. **Slot:** if the coach should ever use it, map it to a context slot with the store in
   `residesIn` before `ask` (or add slot 19+). Never leave a real field `['ask']`-only.
3. **Resurface — app:** the screen that captures it loads its store on mount and prefills.
4. **Resurface — connector:** confirm `get_context_status` / the onboarding playbook reflect it,
   and that the store the input is written to is one the resolver reads.
5. **Cross-surface:** if the app and the connector write the field to different tables, the
   resolver must read both.
6. **Test:** a resolver test that the field resolves from its store; an app test that a returning
   user sees it prefilled.
