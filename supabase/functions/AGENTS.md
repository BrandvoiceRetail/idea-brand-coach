# supabase/functions — Agent Guide

Root `AGENTS.md` applies; this adds only what's specific here. Deno edge
functions. `_shared/` holds reused modules (`cors.ts`, `chunking.ts`,
`embeddings.ts`, `edge-auth.ts`, `figma.ts`, `figma-extract.ts`) imported by
others — not a deployable function.

## Functions

| Function | Purpose |
| --- | --- |
| ai-insight-guidance | Reads Avatar 2.0 data from user_knowledge_base for in-app guidance |
| audit-idea-map | Workbook A sheet 7 — "Audit × IDEA" map |
| avatar-jobmap | Avatar 2.0 Stage 2 — functional vs emotional job map |
| avatar-objections | Avatar 2.0 Stage 4 — hesitations & objections |
| avatar-triggers | Avatar 2.0 Stage 3 — the decision trigger |
| avatar-vocabulary | Avatar 2.0 Stage 1 — vocabulary forensics |
| brand-ai-assistant | KB-context field suggestions (Claude); CORS/JWT/caching template others clone |
| brand-canvas | Workbook A sheet 5 — Brand Canvas |
| brand-copy-generator | Generates brand copy |
| buyer-intent-analyzer | Analyzes buyer intent |
| competitive-analysis-orchestrator | Orchestrates competitive analysis run |
| competitor-discovery | Finds competitors via Google Custom Search |
| contextual-help | In-context help responses |
| diagnostic-interpretation | Trust Gap™ diagnostic interpretation |
| diagnostic-interpretation-evidence | Workbook A sheet 3 — Trust Gap™ diagnostic (evidence-tiered) |
| document-processor | Chunks/embeds uploaded documents |
| figma-oauth-start | Begins Figma OAuth — stores CSRF state, returns the authorize URL (authed) |
| figma-oauth-exchange | Completes Figma OAuth — exchanges code for tokens, stores encrypted connection (authed) |
| figma-status | Returns the user's Figma connection status + recent imports (no tokens) (authed) |
| figma-sync | Imports a Figma file → palette/typography/components → figma_imports + coach visual_identity KB (authed) |
| figma-disconnect | Deletes the user's Figma connection/tokens; keeps imported design data (authed) |
| export-brief | Workbook A sheet 6 — Export Brief |
| generate-brand-strategy-document | Builds full brand strategy doc via semantic retrieval |
| generate-brand-strategy-pdf | Renders strategy PDF |
| generate-brand-strategy-section | Generates a single strategy section |
| generate-competitor-analysis-pdf | Renders competitor analysis PDF |
| generate-session-title | Chat session titles (Claude Haiku) |
| idea-framework-consultant-claude | Main RAG consultant — Claude Messages API, streaming, tools, prompt caching |
| marketing-audit | Workbook B — Investment Matrix + Recommended Phasing |
| reveal-signature | Synthesizes 3-4 Signature options (Claude Sonnet) |
| review-scraper | Scrapes review URLs via Firecrawl |
| run-forensic-analysis | Signed-in forensic Trust Gap (Claude Sonnet, evidence-grounded) |
| identify-decision-trigger | Derives the named Decision Trigger |
| diagnostic-interpretation-evidence | Evidence-grounded Trust Gap interpretation + derive |
| export-brief | Compiles the listing/image/PPC Export Brief |
| submit-diagnostic-lead | Lead-magnet capture (anonymous) |
| get-funnel-piece-metrics | Reads campaign_metrics per funnel piece (RLS-scoped) |
| save-beta-comment | Persists beta comments |
| save-beta-feedback | Persists beta/widget feedback |
| save-beta-tester | Registers beta tester (email send disabled in P0) |
| save-feedback-event | Alpha Moment-1 feedback → feedback_events; requires posthogDistinctId join key |
| send-framework-email | Sends framework email via Resend |
| sync-diagnostic-to-embeddings | Syncs diagnostic into pgvector embeddings |

## Deploy

`npx supabase functions deploy <name>`. Most deploy with `--no-verify-jwt`
(e.g. `brand-ai-assistant`); `save-feedback-event` keeps verify_jwt=true (anon
key is a valid JWT so anon submits pass; user_id derived from the verified
token). Per-function flags live in `../config.toml`.

## Operational gotchas

- Project is on the free tier and AUTO-PAUSES. NXDOMAIN, read timeouts, or
  INACTIVE deploy errors mean restore it in the dashboard first.
- HTTP 200 can wrap a billing/quota error inside the SSE stream body — inspect
  the raw stream; don't trust status codes alone when debugging streams.

## Rules

- Secrets via Supabase function env (`Deno.env.get`), never committed.
- Changing auth flows or RLS-affecting behavior requires asking first (root Boundaries).
- **A function that captures user input must write it where a resolver/reader can resurface it**
  (store-and-resurface, [`docs/architecture/STORE_AND_RESURFACE.md`](../../docs/architecture/STORE_AND_RESURFACE.md)).
  `import-product-data` writes `user_products`/`user_product_reviews`, which the MCP context resolver
  reads for slots #1/#3/#5/#6 — so a listing imported in the app surfaces in the connector coach.
  When you add a function that stores a new user field, confirm a read path exists (a resolver slot
  store, or an app/edge read) before considering it done; a write with no read is dead data.
