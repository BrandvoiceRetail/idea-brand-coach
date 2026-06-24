# IDEA Brand Coach — Beta Tiers, Pricing, Data Architecture & 4-Week Rollout

> **Date:** 2026-06-18 · **Branch:** `feat/competitor-agents` · **Status:** planning artifact (decision-ready)
> **Provenance:** Grounded by a 7-agent research workflow over the repo (40+ edge fns, 33 migrations, MCP tool surface, `docs/costs/`, `docs/v2/architecture/cost-analysis/`, `docs/pricing/`, `docs/planning/`, the funnel/competitor build, the open PRD) and reconciled against the 2026-06 live-state memory. Where 2025-era docs disagree with the live system, the live state wins and is flagged.

---

## 0. TL;DR — the decision summary

**Tier ladder (USD):** `Free (Diagnostic)` → `Starter $29` → `Pro $79` ⭐ → `Studio $199 (founding)`.

**The honest verdict on "10 active *paying* users in 1 month":**
- **NO-GO as literally stated.** Three things block it: (1) the **monetization layer is 100% unbuilt** — no Stripe, no `user_subscriptions` table, no enforcement (pricing is UI-clickthrough only); (2) a **35% activate→pay** rate for a no-reputation indie tool is ~3–5× market reality (10–15% is realistic, ~2–8% is typical cold-to-paid); (3) the **guardrails, security verification, and legal docs land *after* the paywall** in the naïve plan — the exact condition that caused the 2026-03 cost incident, now on a paying account.
- **GO-WITH-FIXES if the target is redefined:** **10 *activated* free testers in 4 weeks, instrumented**, with **Studio cut to a waitlist** and **paid deferred behind a verified-guardrails gate** (likely W4–W5+). This matches the committed Beta scope and lets us *price from evidence* instead of asserting conversion.

**The 3 highest-leverage changes:**
1. **Decouple "10 active" from "10 paying."** Run a free capped (<100) beta for the 4 weeks; defer paid to its own gate. Measure real activation/conversion instead of asserting 60%/35%.
2. **Cut Studio from launch.** Its differentiating value (competitor/funnel agents) is *vapor on this branch* — funnel base absent, agents undeployed, 4/7 modalities stubbed, Brand Defense a stub. Replace with "Studio coming — join the waitlist." Removes the entire HALT chain and the biggest credibility/margin-variance risk from the critical path.
3. **Make guardrails a hard, verified precondition** (per-user message rate-limit + OpenAI usage alerts $3/day·$50/mo + **server-side** quota enforcement), not parallel roadmap items. No paid switch and no uncapped-message access until all three are live-verified.

**Stack reconciliation (resolves a flagged contradiction):** the live **coach runs on Claude (Sonnet 4.6 + Haiku 4.5)**, code-measured at **~$0.11 (light) / ~$0.33 (heavy) per user/mo** (2026-06). The `docs/v2/.../cost-analysis/` figures (~$0.45–$2.06, gpt-4.1) and `docs/costs/` (~$15) are **pre-migration / stale**. A few peripheral edge fns may still be OpenAI (copy-gen `gpt-4-turbo`, the deprecated competitor monolith `gpt-4o`) — those are migration candidates. **Net: cost-to-serve is lower than every doc claims → margins are *better* than modeled below, not worse.**

---

## 1. Feature & offering inventory (status-tagged)

Status: **LIVE** (deployed/operational) · **NEAR** (one flag-flip/deploy away) · **BUILD** (code on a branch, needs merge+harden) · **EXP** (spec/stub). Complexity = AI/data consumption.

> **Currency caveat:** the dated `P0_FEATURES.md` / `CURRENT_PROJECT_STATUS.md` describe a superseded Nov-2025 GPT-4 product. The accurate "what runs today" signal is the **live MCP tool surface + deployed edge fns + the V2 multi-avatar app**.

### A. Diagnostics & Onboarding
- **Free Brand Diagnostic (Trust Gap scorecard)** — 6-question IDEA self-assessment; shows where trust leaks. **LIVE** · MED
- **Evidence-grounded diagnostic** — grounds scores in the user's own KB. **LIVE** · MED
- **Public diagnostic interpretation (no-auth funnel front door)** — rate-limited + body-capped. **LIVE** · LOW
- **Journey Bridge / Start Here onboarding** — guided next-step path. **LIVE** · LOW
- **Diagnostic results PDF export**. **LIVE** · LOW

### B. Strategy / Signature / Foundations
- **Signature Reveal engine** — distinctive positioning/voice essence as a reveal moment. **LIVE** · HIGH
- **Brand Canvas** — visual brand-strategy builder. **LIVE** · MED
- **Brand Strategy Document (Lite)** — senior-strategist-tone doc; PDF + Markdown. **LIVE** · HIGH
- **Brand Strategy Document — Full mode** (11 sections). **BETA-PLANNED** · HIGH
- **IDEA framework deep-dive modules** (Insight live; D/E/A registered). **PARTIALLY-BUILT** · MED
- **Audit → IDEA Map** — maps inputs onto IDEA with evidence. **LIVE** · MED
- **Decision Trigger™ identification** — DT v2.2 spec, awaiting product decision. **EXP** · HIGH

### C. Avatars & Customer Research (V2 core)
- **Multi-Avatar management** — create/compare avatars; switch whole app to an avatar. **LIVE** (flag `v2-multi-avatar`) · MED
- **Book-guided chat avatar build** — stage-by-stage per the book chapters. **LIVE** · HIGH
- **Smart field editing/extraction** (manual-edit priority, ghost-text). **LIVE** · MED
- **Avatar PDF export**. **LIVE** · LOW
- **Buyer-intent / emotional-trigger analysis**. **LIVE** · MED
- **Customer Review Analyzer / Survey Builder**. **PARTIALLY-BUILT** (P1 research hub) · MED/LOW
- **Multi-avatar thread-anchored two-tier KB** (TOCTOU-safe switch). **BETA-PLANNED** · MED

### D. Asset Generation & Copy
- **Brand Copy Generator** (currently `gpt-4-turbo` — costly, migration candidate). **LIVE** · MED
- **Draft Asset / Generate Concepts / Generate Brief**. **LIVE** · MED
- **Publish-filter check** — pre-publish brand-canon gate. **LIVE** · LOW
- **Marketing Audit** — audits marketing vs avatar/strategy. **LIVE** · MED
- **Funnel rewrite** — on-brand countermeasure rewrite. **LIVE/BUILD** · MED

### E. Brand Funnel Tracker (built on `worktree-customer-journey-tracking`, NOT main, NOT on this branch)
- **Funnel Tracker (4-tab map)** — track every asset across the funnel, audit vs avatar/strategy, current-vs-desired. **BUILD** · HIGH
- **Per-asset IDEA audit + Needs-Work view** (grounding/confidence badge, apply-rewrite → re-audit). **BUILD** · HIGH
- **Asset upload library / Signature-change drift sweep**. **BUILD** · LOW/MED
- **Bulk/folder upload + vision auto-touchpoint detection** (original P0 vision, deferred). **EXP** · HIGH

### F. Competitor & Brand-Defense Intelligence (`feat/competitor-agents` — code-complete, NOT deployed)
- **Per-touchpoint competitor agents (IDEA Trust-Gap scored)** — how rivals handle each touchpoint + where to win, grounded in fetched evidence. **BUILD (HALT-gated)** · HIGH
- **Competitor discovery + review scraping** (Google CSE, Firecrawl, DataForSEO). **LIVE plumbing** · MED
- **Voice-of-Customer mine** (Haiku, substring-grounded). **BUILD** · MED
- **Countermeasure → A/B lift loop** (`competitor_insight_applied` flag → lift). **BUILD** · MED
- **Brand Defense monitoring** (Titan `get_alerts` adapter is a **STUB**, coverage unverified). **EXP** · HIGH
- **Longitudinal Trust-Gap drift + push alerts / Scheduled monitoring at scale**. **EXP** · HIGH
- **Deprecated brand-level Competitive Analysis monolith** (gpt-4o, contract-broken, P2-hidden — do not extend). **LIVE-BUT-BROKEN**

### G. Coach Chat & MCP Surface
- **Brand Coach (RAG chat)** — consultant grounded in diagnostic/avatar/strategy. **LIVE** (`idea-framework-consultant-claude` v14, **Sonnet 4.6**) · HIGH
- **Coach ↔ MCP tool loop** — chat is an MCP client running brand tools agentically. **LIVE** (flag `coach-mcp-tool-loop` 100% + `CONSULTANT_TOOL_LOOP_ENABLED`) · HIGH
- **Cross-session intelligent memory** (`user_memories`, kill switch `MEMORY_TOOL_ENABLED`). **LIVE** · MED
- **Chat session management** (AI auto-titles, copy/download). **LIVE** · LOW
- **Per-avatar coach-conversation reads (MCP)** · **IV-OS asset/test ledger (MCP)**. **LIVE** · LOW
- **Contextual help / AI insight guidance / Brand AI Assistant**. **LIVE** · MED
- **MCP Apps panels (Claude Desktop)** — branded onboard panel renders. **LIVE** · MED

### H. Knowledge Base & Integrations
- **Per-user Knowledge Base (RAG)** — Supabase **pgvector** (not OpenAI VS). **LIVE** · MED
- **Document upload + processing** (full RAG integration). **LIVE infra / BETA-PLANNED** · MED
- **Product data import**. **LIVE** · MED
- **Figma integration** (backend in prod, UI gated `FIGMA_INTEGRATION` off). **NEAR** · MED
- **Canva integration** (OAuth+PKCE, code-complete, undeployed). **BUILD** · MED
- **Logo / image processing**. **PARTIALLY-BUILT** · MED
- **Framework email send**. **LIVE** · LOW

### I. Exports & Gold Workbooks
- **Gold Workbook export (A & B)** — reproduces the two Trevor-approved workbooks (the product output bar). **LIVE** · HIGH
- **Markdown / PDF strategy export**. **LIVE** · LOW
- **PowerPoint slides export**. **EXP** · MED
- **Competitor positioning column in Workbook A/B**. **BETA-PLANNED** · MED

### J. Account, Monetization & Beta Program
- **Auth (email + Google OAuth)**. **LIVE** · LOW
- **Subscription / pricing page** — UI clickthrough only; **no Stripe, no DB, no gating**. **PARTIALLY-BUILT** · LOW
- **Stripe + subscription mgmt + tier gating + usage limits**. **BETA-PLANNED** · MED
- **Feature gating** (phase P0/P1/P2 + runtime flags + admin UI). **LIVE** · LOW
- **Beta tester program** (capture live; **structured feedback suite built but DEAD / 0 rows**). **PARTIALLY-BUILT** · LOW
- **Analytics / instrumentation** (PostHog, project 203641). **LIVE (internal)** · LOW
- **Team Collaboration / Dashboard / Brand Analytics**. **BETA-PLANNED** · varies

### Half-built / contract-broken / not-where-the-docs-say (load-bearing flags)
1. **Deprecated `competitive-analysis-orchestrator` is deployed-but-BROKEN** (contract mismatch, retired gpt-4o, P2-hidden). New competitor work does **not** extend it.
2. **Funnel Tracker base does not exist on `feat/competitor-agents`** — taxonomy, `audit-asset`, `brand_assets`/`brand_tests`, `FunnelTracker.tsx`, `IBrandFunnelService` all absent; they live on `worktree-customer-journey-tracking` and were never merged. Mounting the competitor panel **requires merging the funnel base first** (HALT).
3. **Competitor agents + Brand Defense code-complete but NOT in prod** — deploy is fully HALT-gated. Titan `get_alerts` is a stub with unverified coverage.
4. **4 of 7 competitor modalities are stubs** (visual, email, social, program → return `needs_input`).
5. **Beta feedback suite is built but DEAD (0 rows)**; corrective signal captured nowhere; only `feedback_events` has the PostHog join key.
6. **Subscription/pricing is UI-only** — no Stripe, no `user_subscriptions`, no enforcement.
7. **Figma backend live but UI-gated off; Canva code-complete but undeployed.**
8. **Email-confirmation contradiction** — live prod *requires* confirmation (manual SQL confirm); the setup guide says toggle OFF. Unresolved → silently kills activation.
9. **`types.ts` drift** — competitor-insights/performance tables not in generated types (cast at boundary; regen is a post-deploy HALT).

---

## 2. Data architecture & cost-to-serve — *why higher tiers cost more*

Three cost drivers set tier pricing: **(1) LLM tokens** — dominant variable cost, scaled by model tier (Sonnet ≈ 5–10× Haiku) × number of sequential calls; **(2) external metered APIs** — DataForSEO / Keepa / Firecrawl, billed per fetch; **(3) storage/compute** — pgvector + Postgres rows, effectively fixed/negligible. **Caching** (within-conversation prompt cache; cross-tenant ASIN cache) is the primary throttle on (1) and (2).

| Capability | Data stores | Edge fns / engine | External APIs | Embeddings | Cost-to-serve | Why |
|---|---|---|---|---|---|---|
| **Diagnostics** | `diagnostic_submissions`, `user_diagnostic_results`, `idea_framework_submissions`, `feedback_events` | `diagnostic-interpretation`(+`-evidence`), `marketing-audit` | none (public path: IP rate-limit + body cap) | async into `user_knowledge_chunks` | **LOW–MED** | Deterministic scoring + one interpretation call; runs anonymously, no per-user storage on free path. |
| **RAG knowledge base** | `user_knowledge_chunks` (`vector(1536)`, IVFFlat), `uploaded_documents`, `chat_messages.embedding` | `sync-diagnostic-to-embeddings`, `document-processor`; `match_*` RPCs | OpenAI `ada-002` (embeddings only) | **core** | **LOW** | Embeddings negligible; pgvector search is in-Postgres (no VS hosting fee). |
| **Signature / Strategy** | `avatar_field_values`, `avatars`, `brands`, `user_products` | `reveal-signature`, `generate-brand-strategy-*` | none | RAG retrieval per section | **HIGH** | Multi-call Sonnet "engine" (~8 Sonnet calls); heaviest fixed-output generation. |
| **Asset drafting** | `brand_assets`, IV-OS ledger | `brand-copy-generator`, `funnel-rewrite`, `draft_asset`/`generate_concepts` | none | RAG context | **MED** | Per-draft Sonnet; bounded per request, invoked repeatedly. Copy-gen still on costly `gpt-4-turbo`. |
| **Competitor / Funnel agents** | `brand_asset_competitive_insights`, `competitor_assets`, `competitor_reviews`, **`competitor_asin_cache`** (cross-tenant), `brand_tests`, `trust_gap_snapshots`, `brand_defense_alerts` | `competitor-analysis-asset`, `competitor-discovery`, `review-scraper`, `brand-defense-monitor`, `audit-asset` | **DataForSEO**, **Firecrawl**, future **Keepa**, **SP-API** per-tenant | grounding gate | **HIGH (variable)** | **Only capability with per-request external metered cost** stacked on Sonnet scoring (~36 calls/user/mo). Cache hit-rate (40–60%) is the lever. |
| **Coach chat + MCP loop** | `chat_sessions`, `chat_messages`(+`embedding`), `user_memories` | `idea-framework-consultant-claude` (tool loop) | none | hybrid semantic retrieval/msg | **MED–HIGH** | Largest absolute LLM spend; volume open-ended → meter by message. Prompt-cache cuts per-msg to ~$0.002–0.006. |
| **Workbook export** | reads existing artifacts | `export_workbook` → `assembleWorkbookA/B.ts` | none | none | **LOW** | Deterministic assembly, no new LLM. |
| **Multi-avatar** | `brands`→`avatars`→`avatar_field_values`, thread-anchored `chat_sessions.avatar_id` | scoping layer | none | per-avatar KB partitions | **LOW structurally / MULTIPLIER** | Zero marginal compute itself — it's a **fan-out multiplier** on the expensive capabilities. Price avatar *count* as a quota, not the feature. |

**Bottom line:**
- **Expensive / variable (meter these):** Competitor/Funnel agents (#1 — external APIs + Sonnet), Coach chat (largest absolute spend), Signature/Strategy generation (multi-Sonnet engine), Asset drafting.
- **Cheap / effectively fixed (bundle into base):** RAG KB, Workbook export, Diagnostics, Multi-avatar (a multiplier, not a cost center).
- **Tiering implication:** higher tiers cost more because they unlock the **multi-Sonnet-call + external-API capabilities** and raise the **fan-out multiplier (avatars × touchpoints × analyses)** — *not* because storage/RAG/export scale.

---

## 3. Tier model + feature-to-tier matrix

| Tier | Target user | Price | Cost-to-serve / active user | Value headline |
|---|---|---|---|---|
| **Free — Diagnostic** | Anonymous prospect / lead | **$0** | ~$0.01–0.05 | "Get an AI read on where your brand leaks trust — free, in 2 min." |
| **Starter** | Solo founder / indie DTC validating one brand | **$29/mo** (no setup fee) | **~$0.15–0.50** (Claude-corrected) | "Your always-on AI brand coach, grounded in your own diagnostic." |
| **Pro** ⭐ | Operator wanting strategy artifacts + multi-avatar | **$79/mo** | **~$0.75–2** (Claude-corrected) | "Turn the coach into deliverables — Signature, Canvas, strategy docs, exports." |
| **Studio** | Agency / multi-brand / competitive-pressure brand | **$199/mo** (founding) | **~$4–12** (Claude-corrected) | "Full competitive + funnel intelligence: see how rivals win each touchpoint, and defend your brand." |

> **$100 setup fee — dropped** for self-serve (the paywall design's fee kills self-serve conversion; competitors charge none). Open decision §9.
> Cost-to-serve ranges above are **Claude-corrected downward** from the strategy agent's OpenAI-based figures (see §0 reconciliation). Margins are accordingly *higher*.

**Cost→tier mapping (explicit):** the four cheap/fixed capabilities form the Starter/Pro base. Expensive/variable capabilities gate upward — **coach-chat volume** metered across all paid tiers (50 → 200 → unlimited); **Signature/Strategy multi-Sonnet** starts at Pro; **Competitor/Funnel agents + Brand Defense** (the only stacked external-API + Sonnet cost) are **Studio-only and metered** (monthly analysis cap).

**Feature-to-tier matrix.** Legend: ✅ included · ⚠️ limited (quota) · ➖ not included · **[m]** = variable-cost, must be quota-capped. STATUS as §1.

| Feature | Status | Free | Starter $29 | Pro $79 | Studio $199 |
|---|---|---|---|---|---|
| Free Brand Diagnostic (Trust Gap) | LIVE | ✅ | ✅ | ✅ | ✅ |
| Public diagnostic interpretation | LIVE | ✅ | ✅ | ✅ | ✅ |
| Evidence-grounded diagnostic | LIVE | ➖ | ✅ | ✅ | ✅ |
| Journey Bridge / Start Here | LIVE | ✅ | ✅ | ✅ | ✅ |
| Diagnostic PDF export | LIVE | ⚠️ 1 | ✅ | ✅ | ✅ |
| **Brand Coach RAG chat [m]** | LIVE | ⚠️ 3 trial | ⚠️ 50/mo | ⚠️ 200/mo | ✅ unlimited (fair-use) |
| Coach ↔ MCP tool loop | LIVE | ➖ | ✅ | ✅ | ✅ |
| Cross-session memory | LIVE | ➖ | ✅ | ✅ | ✅ |
| Chat history retention | LIVE | ➖ | 30-day | 1-yr | Unlimited |
| Per-user Knowledge Base (RAG) | LIVE | ➖ | ✅ | ✅ | ✅ |
| Multi-avatar management | LIVE | ➖ | ⚠️ 1 | ⚠️ 3 | ✅ unlimited |
| Book-guided avatar build [m] | LIVE | ➖ | ✅ | ✅ | ✅ |
| Smart field editing/extraction | LIVE | ➖ | ✅ | ✅ | ✅ |
| Avatar PDF export | LIVE | ➖ | ✅ | ✅ | ✅ |
| Buyer-intent / emotional-trigger | LIVE | ➖ | ⚠️ | ✅ | ✅ |
| Document upload + RAG | LIVE/NEAR | ➖ | ➖ | ⚠️ 5 docs | ✅ unlimited |
| **Signature Reveal engine [m]** | LIVE | ➖ | ➖ | ✅ | ✅ |
| **Brand Canvas [m]** | LIVE | ➖ | ⚠️ view-only | ✅ edit | ✅ |
| **Brand Strategy Doc (Lite) [m]** | LIVE | ➖ | ➖ | ⚠️ 2/mo | ✅ unlimited |
| Audit → IDEA Map | LIVE | ➖ | ➖ | ✅ | ✅ |
| Brand Copy Generator [m, costly model] | LIVE | ➖ | ➖ | ⚠️ 20/mo | ✅ |
| Draft asset / concepts / brief | LIVE | ➖ | ➖ | ✅ | ✅ |
| Publish-filter check | LIVE | ➖ | ➖ | ✅ | ✅ |
| Marketing Audit | LIVE | ➖ | ➖ | ✅ | ✅ |
| Gold Workbook export (A/B) | LIVE | ➖ | ➖ | ⚠️ A only | ✅ A+B |
| Markdown/PDF strategy export | LIVE | ➖ | ➖ | ✅ | ✅ |
| Product data import | LIVE | ➖ | ➖ | ✅ | ✅ |
| **Funnel Tracker (4-tab)** | BUILD (other worktree) | ➖ | ➖ | ➖ | ✅ ※ |
| Per-asset IDEA audit + Needs-Work | BUILD | ➖ | ➖ | ➖ | ✅ ※ |
| **Per-touchpoint competitor agents [m, ext API]** | BUILD (HALT) | ➖ | ➖ | ➖ | ⚠️ N/mo ※ |
| Competitor discovery + review scrape [m] | LIVE plumbing | ➖ | ➖ | ➖ | ⚠️ ※ |
| Countermeasure → lift loop | BUILD | ➖ | ➖ | ➖ | ✅ ※ |
| Brand Defense monitoring [m] | EXP (stub) | ➖ | ➖ | ➖ | ⚠️ add-on later |
| Figma / Canva import | NEAR / BUILD | ➖ | ➖ | ✅ ※ | ✅ ※ |
| Team collaboration | BETA-PLANNED | ➖ | ➖ | ➖ | ✅ (Q2) |
| Dashboard / trends / benchmarks | BETA-PLANNED | ➖ | ➖ | ⚠️ | ✅ |

> **※ = not yet sellable as live.** Everything marked LIVE on Free/Starter/Pro is sellable now (modulo the Figma/Canva and doc-RAG asterisks). **Studio's headline (competitor/funnel) is BUILD/HALT-gated and absent from this branch** — sell only as *founding early-access waitlist*, not GA, until the §6 HALT chain clears.

---

## 4. Cost-to-serve per tier + margins

Per the Claude-corrected model: coach msg ≈ **$0.002–0.006** (prompt-cached) to ~$0.015 (cold); strategy export ≈ multi-Sonnet "engine"; competitor analysis ≈ Sonnet scoring + $0.01–0.05 DataForSEO/analysis.

| Tier | Price | Modeled cost/mo (active user) | Gross margin | Variable-cost risk |
|---|---|---|---|---|
| **Free** | $0 | ~$0.01–0.05 | n/a (lead cost) | Abuse on public endpoint — **already mitigated** (rate-limit + body-cap v9). Keep it. |
| **Starter** | $29 | ~$0.15–0.50 | **~98%** | Low. Only risk = uncapped msgs → enforce 50 hard cap **server-side**. |
| **Pro** | $79 | ~$0.75–2 | **~97%** | Copy-gen on `gpt-4-turbo` (~50× alternatives) → migrate model or keep 20/mo cap. Strategy export spiky → cap 2/mo. |
| **Studio** | $199 | ~$4–12 | **~94%** | **The real exposure.** Stack DataForSEO + Keepa burst + Sonnet scoring. Mandatory before sell: per-tenant **analysis cap**, **`competitor_asin_cache`** (40–60% hit ≈ halves data cost), fair-use msg cap. |

**The 2026-03 incident is the governing lesson.** A dev sprint of **~65 messages → 35× spend spike** ($0.39 → $5+) because messages fired 3–5 calls and a quota error was hidden in an HTTP-200 SSE stream. **No paid rollout until:** (1) per-user message rate-limiting live (currently PENDING); (2) OpenAI usage alerts at $3/day / $50/mo set (PENDING); (3) Studio analysis cap + ASIN cache enforced. *Margins above are only real with these guardrails — without them one abusive user erases a month of tier margin.*

**Also missing from raw margins** (survivable per-user, but thins blended economics at 10 users): Stripe fees (~2.9%+$0.30 ≈ 5% of a $29 charge), the dropped $100 setup fee, Supabase **Free→Pro $25/mo cliff** (triggered by backups + real paying users), and OpenAI vector-store $0.10/GB/day if doc-upload ships before the pgvector path is the only store.

---

## 5. Time-to-first-value

**The one live end-to-end value path:** anonymous 6-question Diagnostic → "here's where your brand leaks trust" AI read → account → **Brand Coach chat pre-seeded with that diagnostic (RAG)**. This is the entire committed Beta scope and is corroborated live (`/v2/coach`, MCP tool-loop deployed).

**Day-1 first-value sequence (target <15 min from invite):**
1. Public diagnostic (no auth) → free interpretation. **Value moment 1, ~minute 2.**
2. "Save your results + ask the coach" → account creation *(the diagnostic→auth handoff is the one known seam — verify solid)*.
3. Coach chat **pre-seeded with their diagnostic** → "what's my biggest trust gap and how do I fix it?" → grounded answer. **Value moment 2, ~minute 10.**
4. (Pro tease) "Generate your Brand Canvas / Signature from this" → one-click artifact = upgrade hook.

**Must ship first to make it clean:** (a) diagnostic→auth→coach verified end-to-end on the live build; (b) per-user message rate-limit so a tester can't trigger the incident; (c) handle the email-confirmation gotcha (live prod requires confirmation → auto-confirm invitees via SQL or pre-provision accounts).

---

## 6. Prioritized Beta roadmap

Ordered: first-value + paid-readiness before net-new. Effort **S** (≤1d) / **M** (2–4d) / **L** (1–2wk).

1. **Verify diagnostic→auth→coach happy path on live build** — **S** — *first-value works* (highest-risk seam).
2. **Per-user message rate-limiting** — **M** — *paid-readiness #1*. Hard server-side cap (50/200) + per-day ceiling.
3. **OpenAI/Anthropic usage alerts ($3/day, $50/mo)** — **S** — *cost blast-radius*. Pure config, PENDING since the incident.
4. **Stripe + `user_subscriptions` table + tier entitlement gating** — **L** — *can actually charge*. Make `COMPETITOR_AGENTS` an entitlement, not a global flag.
5. **Server-side quota enforcement** (msgs, strategy docs/mo, copy-gen/mo, avatars) — **M** — *margin protection*. Quotas in DB, not UI.
6. **Backups / Supabase Pro ($25/mo) + error boundaries** — **S** — *data-loss + paid-production audit blocker*.
7. **Migrate copy-gen off `gpt-4-turbo`; split field-extraction to its own cheap call** — **M** — *Pro-tier margin*.
8. **Re-verify/close audit blockers** (JWT verification, secrets-in-git, route auth) against live state — **S–M** — *paid-production security*. Several reportedly fixed; verify, don't assume.
9. **Studio enablement (HALT chain):** merge funnel base from `customer-journey-tracking` → deploy `audit-asset` + `competitor-analysis-asset` → DataForSEO secrets + `competitor_asin_cache` → regen types → flip `COMPETITOR_AGENTS` — **L** — *Studio becomes real*.
10. **Beta feedback capture revival** (suite built but DEAD; wire corrective signal) — **S** — *can measure activation/learning*.
11. **Privacy policy / ToS** (audit open dependency; Trevor owes the privacy statement) — **S (legal-gated)** — *can take payment + make privacy claims legally*.

**Defer:** Brand Defense monitoring (Titan stub), the 4 stub competitor modalities, Full strategy doc, team collaboration, dashboard.

---

## 7. 4-week rollout

### 7a. As literally requested — to 10 *paying* users (for the record; see verdict)

**Funnel assumptions (asserted):** invite→activate = 60%, activate→pay = 35%. ⇒ ~10 / (0.60×0.35) ≈ **48 invites**, front-loaded. Pricing live from W2.

| Week | Released / hardened | Invited (cum) | Activated (cum) | New paying | Cum paying |
|---|---|---|---|---|---|
| **W1** | #1–3 (first-value verified, rate-limit, alerts). **Free beta.** | 12 | ~7 | 0 | **0** |
| **W2** | #4–6 (Stripe + entitlements + quotas + backups). Turn on **Starter/Pro**. | 26 | ~16 | 3 | **3** |
| **W3** | #7–8 (copy-gen migration, audit-blocker close). Push Pro. | 38 | ~23 | 4 | **7** |
| **W4** | #9 if HALT clears → **Studio founding** (2–3 brands); else deepen Pro. | 48 | ~29 | 3 | **~10** |

### 7b. The credible version — to 10 *activated* free testers, paid behind a gate (RECOMMENDED)

> **Why:** the §7a conversion rates are asserted, not earned. 35% activate→pay for a no-reputation tool is ~3–5× market reality; billing is an **L**-effort build that can't reliably ship + be tested + convert 3 users **inside W2**; and §7a opens paid access *before* all incident-class guardrails are enforced. **10 activated free testers in 4 weeks is plausible; 10 paying is not.**

| Week | Goal | Released / hardened | Invited (cum) | Activated (cum) |
|---|---|---|---|---|
| **W1** | First-value works for real | #1–3 + #10 (feedback capture revived) + email-confirm fix | 8 | ~5 |
| **W2** | Instrument the funnel | Watch activation telemetry; tune onboarding; #6, #8 | 16 | ~10 |
| **W3** | Earn conversion signal | Hand-sell Pro value; collect ROI testimonials; #7 | 26 | ~16 |
| **W4** | Gate the paywall | #4, #5, #11 land + **verified**; *then* (W4–W5) flip Starter/Pro to warm cohort | 36 | ~22 |

Result: **~10+ activated, instrumented testers** by W4, real conversion data in hand, paywall flipped on a *verified-guardrails* gate to a warm cohort in W4–W5. Studio = waitlist throughout.

**The number's single biggest risk either way:** charging before guardrails. If Stripe goes live before per-user rate-limiting + usage alerts + server-side quotas are enforced, one heavy/abusive user reproduces the 35× incident on a *paying* account — margin hit *and* trust hit with the first 10 customers. **Sequence guardrails strictly before any paywall.**

---

## 8. CFO / adversarial review — verdict

- **Rollout math:** arithmetic is internally consistent; the **inputs are fiction**. No activation telemetry from a single real tester justifies 60%; 35% activate→pay is ~3–5× market reality; billing (L) can't land+test+convert inside W2; cohort decay is hand-waved (invites get colder but conversion held flat).
- **Margins:** no tier is underwater *on average* — Starter/Pro are >95%, Studio ~90%+ *with* guardrails. The exposure is **variance, not average** (the 2026-03 incident). The naïve plan opens paid access (W2) before quotas (W2 best-case) and copy-gen migration (W3) — violating its own rule.
- **Shippability:** Starter/Pro are honestly sellable on LIVE features. **Studio markets a tier that does not run** on this branch — funnel base absent, agents undeployed, 4/7 modalities stubbed. "Founding early-access" is a fig leaf over taking $199 for a branch + HALT chain.
- **Gates:** monetization 100% unbuilt; production-readiness audit 45/100 ("NOT PRODUCTION READY"); no backups/PITR; **no privacy policy/ToS** behind the page's privacy promises; beta-signup INSERT path an unresolved security decision; email-confirm contradiction kills activation silently. Audit's own production gate = **4–6 weeks** for readiness *alone*.

**VERDICT:** **NO-GO** on 4-weeks-to-10-*paying*. **GO-WITH-FIXES** if redefined to 10-*activated* free testers with instrumentation, Studio cut to a waitlist, and paid deferred behind a verified-guardrails gate (§7b).

---

## 9. Open decisions for Matthew

1. **Target:** 10 *paying* (§7a, NO-GO risk) vs **10 *activated* free + paid behind a gate** (§7b, recommended)?
2. **Studio at launch:** cut to waitlist (recommended) vs hold "founding early-access" and race the HALT chain?
3. **$100 setup fee:** keep (paywall-design revenue) vs drop (self-serve conversion — recommended)?
4. **Guardrail gate:** confirm per-user rate-limit + usage alerts + server-side quotas are the *hard* precondition for any paywall (recommended)?
5. **Trevor alignment:** he prefers subscription (not one-time) and still owes the privacy statement + an answer on Pro price — does $29/$79/$199 land, and is the privacy doc in motion?

---

*Companion artifact: `MARKETING_PRICING_PAGE.md` (launch-ready pricing-page copy, status-tagged).*
