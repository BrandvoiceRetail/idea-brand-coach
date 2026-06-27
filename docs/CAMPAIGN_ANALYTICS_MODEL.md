# Campaign + Analytics + Email-Sequence Data Model & MCP Tool Contracts

**Status:** Proposed (spec only — no code, no migration applied to prod).
**Scope:** Net-new campaign entity + numeric analytics ingestion (CTR/CVR/AOV/spend/revenue) +
email-sequence builder for the brand-coach MCP gateway. Closes the context gap: *"NO campaign
entity, NO numeric analytics ingestion, NO email sequences."* The coach must reason over real
numbers (tie brand work to CTR/CVR/AOV/revenue) and **never fabricate metrics** — honest
`no_data` everywhere.

This spec is written to match the house patterns verbatim. Anchors read from this worktree
(`origin/mcp-oauth` lineage, worktree `mcp-analytics`):

- Tool shape: `src/mcp/tools/ingestEvidence.ts`, `src/mcp/tools/bulkIngest.ts`
- Write gate: `src/mcp/tools/writeAuth.ts` (`gateWrite()`, `actorTag()`)
- RLS client: `src/mcp/supabaseUser.ts` (`getUserSupabase()`, `UnauthenticatedError`, `__setUserSupabaseFactory`)
- Service style + local row types: `src/mcp/service/nativeLedger.ts`
- Brand resolution: `src/mcp/service/avatarOwnership.ts` (`resolveBrandId()`)
- Migration patterns: `supabase/migrations/20260618120000_create_coach_asset_ledger.sql`
- Drift guard (SSOT for the advertised surface): `src/mcp/__tests__/server.test.ts`
- Server assembly + narration: `src/mcp/server.ts`, `src/mcp/config.ts` (`SERVER_INSTRUCTIONS`)
- Logging / telemetry: `src/mcp/logging/redact.ts` (`safeLog`), `src/mcp/posthog.ts` (`captureMcpEvent`)

> **SSOT note.** There is **no** `src/mcp/toolManifest.ts` in this worktree (it lives on a
> different branch lineage). On `mcp-oauth`, the advertised-surface SSOT + drift guard **is the
> sorted tool-name array in `src/mcp/__tests__/server.test.ts`** (`it('advertises exactly …')`).
> Every new tool below MUST be added there in sorted order or that test fails.

---

## 1. Tables (new migration — DO NOT apply to prod)

One additive migration file: `supabase/migrations/20260626000000_campaign_analytics.sql`.
All four tables follow the `coach_assets` template exactly: `user_id uuid not null default
auth.uid() references auth.users(id) on delete cascade`, RLS enabled, owner-scoped
select/insert/update policies (no delete policy), `updated_at` trigger reusing the existing
`public.coach_assets_set_updated_at()` function (it is table-agnostic — `new.updated_at = now()`),
`if not exists` everywhere, table comments. Timezone = UTC (`timestamptz`/`date` defaults).

### 1.1 `campaigns` (brand-level, owner-scoped)

| column | type | notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `user_id` | `uuid not null default auth.uid()` → `auth.users(id)` on delete cascade | RLS key |
| `brand_id` | `uuid not null` → `public.brands(id)` on delete cascade | resolved server-side via `resolveBrandId()`, never caller-supplied |
| `name` | `text not null` | |
| `channel` | `text not null` | CHECK in (`blog`,`social`,`email`,`tiktok`,`amazon`,`paid`,`content`) |
| `status` | `text not null default 'draft'` | CHECK in (`draft`,`active`,`paused`,`completed`) |
| `description` | `text` | nullable |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | trigger-maintained |

Indexes:
`idx_campaigns_user_status_created on (user_id, status, created_at desc)`,
`idx_campaigns_brand on (brand_id)`.
ENUMs are implemented as `text` + `CHECK` constraints (matches the `coach_assets` convention —
inline-comment vocab, not Postgres `enum` types; keeps additive migrations cheap).

### 1.2 `campaign_metrics` (the numeric store-of-record)

| column | type | notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `user_id` | `uuid not null default auth.uid()` → `auth.users(id)` cascade | RLS key |
| `campaign_id` | `uuid not null` → `public.campaigns(id)` on delete cascade | |
| `channel` | `text not null` | same 7-value vocab as `campaigns.channel` |
| `metric_name` | `text not null` | CHECK in (`impressions`,`sessions`,`clicks`,`opens`,`ctr`,`cvr`,`aov`,`spend`,`orders`,`revenue`,`engagement`,`calls_booked`,`views`) |
| `metric_value` | `numeric not null` | rate metrics (`ctr`,`cvr`) stored as fractions 0–1 (see §3.4) |
| `funnel_stage` | `text` | nullable; vocab `visibility`/`clicks`/`orders`/`revenue`/`profitability` (funnel-tracker stages) |
| `measured_date` | `date not null` | |
| `granularity` | `text not null default 'daily'` | CHECK in (`daily`,`hourly`,`snapshot`) |
| `source` | `text not null default 'manual'` | CHECK in (`manual`,`spreadsheet`,`warehouse`) |
| `created_at` | `timestamptz not null default now()` | (no `updated_at`: metrics are append-only facts) |

Indexes:
`idx_campaign_metrics_campaign_date on (campaign_id, measured_date desc)`,
`idx_campaign_metrics_channel_date on (channel, measured_date desc)`,
`idx_campaign_metrics_user on (user_id, created_at desc)`.

**Idempotency (re-upload safety, mirrors `uq_coach_assets_user_external`):**
`uq_campaign_metrics_natural` unique on
`(campaign_id, metric_name, measured_date, granularity, coalesce(funnel_stage,''))`.
Ingestion uses `upsert(rows, { onConflict: '<that key>' })` so re-uploading a workbook reconciles
rather than duplicating. (Postgres requires a non-null expression in the constraint;
`coalesce(funnel_stage,'')` handles the nullable column — implement as a unique index on the
coalesced expression.)

### 1.3 `email_sequences` (brand-level)

| column | type | notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `user_id` | `uuid not null default auth.uid()` → cascade | RLS key |
| `brand_id` | `uuid not null` → `public.brands(id)` cascade | server-resolved |
| `campaign_id` | `uuid` → `public.campaigns(id)` on delete set null | nullable link |
| `sequence_type` | `text not null` | CHECK in (`welcome`,`nurture`,`newsletter`,`upsell`,`downsell`,`abandoned_cart`) |
| `name` | `text not null` | |
| `status` | `text not null default 'draft'` | CHECK in (`draft`,`active`,`paused`) |
| `created_at` / `updated_at` | `timestamptz not null default now()` | trigger-maintained |

Index: `idx_email_sequences_user_brand on (user_id, brand_id)`.

### 1.4 `email_steps` (child of sequence)

| column | type | notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `user_id` | `uuid not null default auth.uid()` → cascade | RLS key (denormalised so steps are directly RLS-scoped, same as `coach_asset_events.user_id`) |
| `sequence_id` | `uuid not null` → `public.email_sequences(id)` on delete cascade | |
| `step_number` | `integer not null` | 1-based ordinal |
| `subject` | `text not null` | |
| `body` | `text not null` | |
| `delay_hours` | `integer not null default 0` | offset from prior step / trigger |
| `email_type` | `text` | freeform tag (e.g. `value`,`offer`) |
| `trigger_event` | `text` | e.g. `signup`,`cart_abandoned` |
| `created_at` | `timestamptz not null default now()` | |

Indexes: `uq_email_steps_seq_number unique on (sequence_id, step_number)`,
`idx_email_steps_sequence on (sequence_id, step_number)`.

**RLS for all four:** `enable row level security`; policies `*_select_own (using user_id =
auth.uid())`, `*_insert_own (with check user_id = auth.uid())`, `*_update_own` on the three
mutable tables (campaigns, email_sequences, email_steps). `campaign_metrics` gets select+insert
only (append-only). No delete policies.

**Why `brand_id` is `not null` here but `campaign_id` stays `text` on `coach_assets`:**
`coach_assets.campaign_id` is pre-existing free-text with live rows — we do **NOT** retrofit a FK
onto it (would break existing data and is out of surgical scope). The new `campaign_metrics`/
`email_sequences` FK columns are `uuid` because they are net-new. This is an intentional,
documented seam, not an inconsistency.

---

## 2. New-table row types WITHOUT editing generated `types.ts`

Generated `src/integrations/supabase/types.ts` is never hand-edited and the MCP services already
treat it as stale: `nativeLedger.ts` uses **untyped `from(...)` chains + local row interfaces**
(`AssetRow`, `EventRow`). We follow that pattern exactly.

**The contract SSOT is one shared file — `src/mcp/service/campaignTypes.ts` (already authored
in this worktree).** It is Layer 0 for all four tables and is the single place enums are defined:
each `*_VALUES` const array **mirrors the SQL `CHECK` constraint verbatim**, the `z.enum(...)`
schemas are *derived from* those arrays, and the TS unions are `z.infer`-red from the same arrays —
so the migration, the Zod input validation, and the service row types **cannot drift**. (It lives in
`service/` not `contracts/` because `contracts/` is the closed output-engine `ArtifactKind`
registry; these are DB row/param shapes, like `nativeLedger.ts`'s local `AssetRow`.) It exports:

- **Vocab arrays:** `CAMPAIGN_CHANNEL_VALUES` (7), `CAMPAIGN_STATUS_VALUES` (4), `METRIC_NAME_VALUES`
  (13), `FUNNEL_STAGE_VALUES` (5), `METRIC_GRANULARITY_VALUES`, `METRIC_SOURCE_VALUES`,
  `SEQUENCE_TYPE_VALUES` (6), `SEQUENCE_STATUS_VALUES` (3).
- **Derived Zod schemas:** `campaignChannelSchema`, `campaignStatusSchema`, `metricNameSchema`,
  `funnelStageSchema`, `metricGranularitySchema`, `metricSourceSchema`, `sequenceTypeSchema`,
  `sequenceStatusSchema`, plus `isoDateSchema` (the `YYYY-MM-DD` regex).
- **Row interfaces:** `CampaignRow`, `CampaignMetricRow`, `EmailSequenceRow`, `EmailStepRow`.
- **Insert / param shapes:** `CampaignInsert`, `MetricInput` (the canonical row the parsers
  normalise every workbook into), `CampaignMetricInsert`, `EmailSequenceInsert`, `EmailStepInsert`.
- **`CAMPAIGN_METRICS_CONFLICT_TARGET`** — the `upsert(..., { onConflict })` string for the natural
  key, kept here so the ingest service and any drift test reference one constant.

The three service files add only their **result-envelope / query / rollup** types on top of these
(e.g. `analyticsIngest.ts` → `IngestResult`, `MetricsQuery`, `MetricsRollup`; `emailSequences.ts`
→ `SequenceTemplate`, `SequencePerformance`) and import the row/insert shapes from `campaignTypes.ts`.

Each service uses the `LedgerResult<T>`-style never-throw envelope (`ok` / `unavailable` / `fail`
helpers copied from `nativeLedger.ts`, incl. `UnauthenticatedError` handling) and
`getUserSupabase()` for RLS. `supabase.from('campaigns')` is called with the string table name
(untyped chain), so no `types.ts` regeneration is required to compile. If/when prod regenerates
types, these interfaces remain the service's source of truth (defensive coercion already in place).

---

## 3. Tool contracts (Zod input + structured output)

House conventions enforced for every tool below:
- File `src/mcp/tools/<name>.ts` exports `register<Name>Tool(server: McpServer): void`
  (services that need the edge client take it as a 2nd arg; **none of these do** — pure Supabase).
- `inputSchema` is an **object literal of Zod fields** (not `z.object(...)`), each `.describe(...)`d —
  exactly like `ingestEvidence.ts`'s `inputSchema`.
- **Enum fields reuse the derived schemas from `campaignTypes.ts`** (`channel: campaignChannelSchema.describe(...)`,
  `metric_name: metricNameSchema.describe(...)`, dates `isoDateSchema`, etc.) — do **not** re-literal
  `z.enum([...])` inline. The `z.enum([...])` literals shown in the snippets below are illustrative of
  the *vocab*; the actual code imports the single-source schema so it can never drift from the SQL CHECK.
- WRITE tools: `const { identity, denied } = gateWrite(); if (denied) return denied;` first line of
  the handler. No avatar gate — campaigns/sequences are **brand-level**; `brand_id` comes from
  `resolveBrandId()` server-side (never from the caller). READ tools that touch user data are
  identity-gated the same way (anon → `{ ok:false, note:'unauthenticated' }`, matches
  `get_funnel_assets`).
- Return shape: `{ content: [{ type:'text', text: <summary> }], structuredContent: { ok, ... } }`;
  failures add `isError: true` and `structuredContent.ok=false` with a non-PII `note`.
- `safeLog({ event:'tool.<name>', caller: userTag(identity), ... })` (counts/flags only, MF-5).
- `captureMcpEvent(userId, 'mcp_<event>', { ...counts })` on success.
- **No fabrication:** read tools that find nothing return `ok:true, no_data:true` with empty
  arrays and a plain-language note — never a synthesised number.

### 3.1 Campaign CRUD — service `CampaignService` (`service/campaigns.ts`)

**`create_campaign`** (WRITE)
```
inputSchema = {
  name: z.string().min(1).max(200).describe('Campaign name.'),
  channel: z.enum(['blog','social','email','tiktok','amazon','paid','content']).describe('Primary channel.'),
  description: z.string().max(2000).optional().describe('What this campaign is for.'),
  status: z.enum(['draft','active','paused','completed']).optional().describe('Initial status (default draft).'),
}
```
Handler: `gateWrite` → `resolveBrandId()` → insert `{ name, channel, description, status:status??'draft' }`
(`user_id`/`brand_id` from auth/resolver) → `.select('id').single()`.
Output: `structuredContent: { ok:true, campaign_id, name, channel, status }`.

**`get_campaign`** (READ) — `{ campaign_id: z.string().uuid() }` → one row (`maybeSingle`); missing →
`{ ok:true, no_data:true, note:'no such campaign for this caller' }`.

**`list_campaigns`** (READ)
```
{ status: z.enum([...]).optional(), channel: z.enum([...]).optional(),
  limit: z.number().int().min(1).max(200).optional() }
```
→ filtered, `order('created_at', { ascending:false })`, `limit(min(limit??50,200))`.
Output `{ ok:true, campaigns: CampaignSummary[], count }`.

**`update_campaign_status`** (WRITE) — `{ campaign_id: z.string().uuid(),
status: z.enum(['draft','active','paused','completed']) }`. Reads current status, updates, returns
`{ ok:true, campaign_id, from, to }` (mirrors `updateAssetStatus`'s from→to report). Missing row →
`{ ok:false, note:'no such campaign for this caller' }`.

### 3.2 Analytics ingestion — service `AnalyticsIngestService` (`service/analyticsIngest.ts`)

All three accept a `campaign_id` (validated owned-campaign) and **upsert** rows into
`campaign_metrics` via the natural-key `onConflict` (idempotent re-upload). Each parses a
different real-workbook shape into the **canonical `MetricInput`** row:
`{ channel, metric_name, metric_value, measured_date, funnel_stage?, granularity?, source }`.
Validation: any row with a non-finite/negative-where-impossible value, an out-of-vocab
`metric_name`, or an unparseable date is **dropped and reported in `skipped[]`** — never coerced
to a fabricated value (mirrors `ingestEvidence`'s "skipped" / notes discipline).

**`ingest_campaign_analytics`** (WRITE) — the generic/manual path.
```
{ campaign_id: z.string().uuid(),
  rows: z.array(z.object({
    channel: z.enum([...7...]),
    metric_name: z.enum([...13...]),
    metric_value: z.number().finite(),
    measured_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    funnel_stage: z.enum(['visibility','clicks','orders','revenue','profitability']).optional(),
    granularity: z.enum(['daily','hourly','snapshot']).optional(),
  })).min(1).max(5000),
  source: z.enum(['manual','spreadsheet','warehouse']).optional() }
```
Output: `{ ok:true, ingested, skipped: [{row_index, reason}], metric_names:[...] }`.

**`ingest_funnel_analytics`** (WRITE) — parses the **funnel-tracker shape** (§4 below).
```
{ campaign_id: z.string().uuid(),
  stages: z.array(z.object({                 // per-stage snapshot
    stage: z.enum(['visibility','clicks','orders','revenue','profitability']),
    impressions: z.number().optional(), ctr: z.number().optional(),
    cvr: z.number().optional(), aov: z.number().optional(),
    orders: z.number().optional(), revenue: z.number().optional(),
  })).optional(),
  monthly: z.array(z.object({                // Monthly Tracker rows
    month: z.string(),                        // 'YYYY-MM' → measured_date = month + '-01'
    impressions: z.number().optional(), sessions: z.number().optional(),
    ctr: z.number().optional(), orders: z.number().optional(), cvr: z.number().optional(),
    gross_revenue: z.number().optional(), net_revenue: z.number().optional(),
    aov: z.number().optional(), ppc_spend: z.number().optional(),
  })).optional(),
  channel: z.enum([...]).optional()           // default 'amazon' for funnel data
}
```
Parse rule: each non-null field on each stage/month becomes one `MetricInput`
(`metric_name` = the field, `metric_value` = the number, `funnel_stage` = the stage, `source` =
`'spreadsheet'`, `granularity` = `'snapshot'` for stages / `'daily'` for monthly with
`measured_date = '<month>-01'`). `net_revenue`/`gross_revenue` map to `metric_name:'revenue'`
disambiguated by an appended note in `structuredContent` (or store gross under `revenue` and skip
net — see Risks). Output identical envelope to above.

**`ingest_content_performance`** (WRITE) — parses the **content_tracker shape** (§4).
```
{ campaign_id: z.string().uuid(),
  pieces: z.array(z.object({                  // Content Pipeline rows
    publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    views: z.number().optional(), calls_booked: z.number().optional(),
    engagement: z.number().optional(), revenue: z.number().optional(),
  })).optional(),
  channels: z.array(z.object({                // per-channel Performance rows
    channel: z.enum([...]),
    total_views: z.number().optional(), engagement: z.number().optional(),
    calls_booked: z.number().optional(), revenue: z.number().optional(),
  })).optional() }
```
Maps `views`→`views`, `engagement`→`engagement`, `calls_booked`→`calls_booked`,
`revenue`→`revenue`; `channel` defaults to `'content'` for pipeline pieces, explicit per row for
the channel breakdown; `source:'spreadsheet'`.

**`get_campaign_metrics`** (READ)
```
{ campaign_id: z.string().uuid(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  breakdown: z.enum(['by_channel','by_date']).optional() }
```
Reads `campaign_metrics` (RLS-scoped, date-window filtered), aggregates **deterministically
host-side** (sum for additive metrics; for `ctr`/`cvr`/`aov` it does NOT average raw rates —
instead recomputes derived rates from underlying counts when available, else returns the stored
values per bucket). Empty → `{ ok:true, no_data:true, note:'No metrics yet for this campaign — ingest some first.' }`.
Output: `{ ok:true, breakdown, buckets: [{ key, metrics: {metric_name: value} }], totals }`.
**Never invents** a missing metric — absent = absent.

### 3.3 Email sequences — service `EmailSequenceService` (`service/emailSequences.ts`)

**`create_email_sequence`** (WRITE)
```
{ sequence_type: z.enum(['welcome','nurture','newsletter','upsell','downsell','abandoned_cart']),
  name: z.string().min(1).max(200),
  campaign_id: z.string().uuid().optional(),   // validated owned if supplied
  status: z.enum(['draft','active','paused']).optional() }
```
→ `resolveBrandId()` → insert. Output `{ ok:true, sequence_id, sequence_type, name }`.

**`add_email_step`** (WRITE)
```
{ sequence_id: z.string().uuid(),
  step_number: z.number().int().min(1).optional(),  // auto = max(existing)+1 when omitted
  subject: z.string().min(1).max(300), body: z.string().min(1).max(20000),
  delay_hours: z.number().int().min(0).optional(),
  email_type: z.string().max(60).optional(), trigger_event: z.string().max(120).optional() }
```
Validates sequence ownership (RLS read), computes `step_number`, inserts. Output
`{ ok:true, step_id, sequence_id, step_number }`.

**`get_sequence_template`** (READ, **no DB / no auth gate needed** — pure static library)
```
{ sequence_type: z.enum(['welcome','nurture','abandoned_cart']) }
```
Returns a prebuilt step template from a const library in the service:
`welcome` = 5 steps, `nurture` = 7 steps, `abandoned_cart` = 3 steps. Each step
`{ step_number, subject, body, delay_hours, email_type, trigger_event }`. Copy follows Trevor TOV
(direct, evidence-based, warm-not-soft, UK English) and the 3-tier terminology rule (no Tier-C
internals). Output `{ ok:true, sequence_type, steps: SequenceTemplate[] }`. This is the one tool
that returns useful data to an anonymous caller (no user data touched).

**`list_sequences`** (READ) — `{ campaign_id: z.string().uuid().optional(), status: z.enum([...]).optional() }`
→ RLS list, `{ ok:true, sequences: SequenceSummary[], count }`.

**`get_sequence_performance`** (READ) — `{ sequence_id: z.string().uuid() }`.
Joins the sequence's `campaign_id` (if set) to `campaign_metrics` for email-relevant metrics
(`opens`, `clicks`, `ctr`, `revenue`, `orders`) and the step count. **Honest no_data:** if the
sequence has no linked campaign or no metrics, returns
`{ ok:true, no_data:true, steps_count, note:'No performance data — link a campaign and ingest opens/clicks first.' }`.
Never fabricates open/click rates.

### 3.4 Cross-cutting numeric conventions
- **Rates** (`ctr`,`cvr`,`engagement` when a %): stored as fractions in [0,1]. Workbook values like
  `4.2%` or `4.2` are normalised at parse time (`>1 ⇒ /100`) and the chosen interpretation is noted
  in `skipped`/notes if ambiguous. Document this so the coach reads them consistently.
- **Money** (`aov`,`spend`,`revenue`): stored as the workbook's native currency number (no FX);
  currency is the brand's, surfaced as-is. No symbol parsing beyond stripping `£`/`$`/`,`.
- **Coach reasoning:** `get_campaign_metrics` / `get_sequence_performance` give the coach the real
  numbers so it can connect brand fixes to CTR/CVR/AOV/revenue. The coach must cite the
  `measured_date` window and say "no data" when `no_data:true` — reinforced in SERVER_INSTRUCTIONS.

---

## 4. The three real workbook shapes → `campaign_metrics`

| Workbook | Sheet/region | Field → `metric_name` (+ `funnel_stage`) | tool |
|---|---|---|---|
| **infinity_vault_funnel.xlsx** | Stage band VISIBILITY/CLICKS/ORDERS/REVENUE/PROFITABILITY | Organic+PPC Impressions→`impressions`(visibility), CTR%→`ctr`(clicks), CVR%→`cvr`(orders), AOV→`aov`(revenue), orders→`orders`, revenue→`revenue`(revenue) | `ingest_funnel_analytics.stages` |
| | Monthly Tracker (per month) | Impressions→`impressions`, Sessions→`sessions`, CTR%→`ctr`, Orders→`orders`, CVR%→`cvr`, Gross/Net Revenue→`revenue`, AOV→`aov`, PPC Spend→`spend`; `measured_date='<YYYY-MM>-01'`, `granularity:'daily'` | `ingest_funnel_analytics.monthly` |
| **Amazon conversion-path report** | rows | Sales→`revenue`, Purchases→`orders`, display frequencies→`impressions`; `measured_date`=Start Date, `channel:'amazon'`, `funnel_stage:'orders'` | `ingest_campaign_analytics.rows` (generic — caller maps columns) |
| **content_tracker_v2.xlsx** | Content Pipeline | Views(7d)→`views`, Calls Booked→`calls_booked`, (Revenue if present)→`revenue`; `publish_date`→`measured_date`, `channel:'content'` | `ingest_content_performance.pieces` |
| | per-channel Performance | Total Views→`views`, Engagement→`engagement`, Calls Booked→`calls_booked`, Revenue→`revenue`; `channel`=row's channel | `ingest_content_performance.channels` |

**Parsing happens in the edge/host caller, not the DB.** The MCP tool receives already-tabular JSON
(the connecting agent or a future spreadsheet-parser edge fn extracts cells); the tool's job is
validate → normalise → upsert. This keeps the tool deterministic and testable with a mocked
Supabase client (Layer 3 discipline). TAcOS/ACoS/BSR/CM3/return-rate from the funnel sheet are
**deferred** (not in the metric vocab) — see Risks.

---

## 5. Service classes (Layer 3, pure, never-throw)

```
service/campaigns.ts        → class CampaignService implements …    (create/get/list/updateStatus)
service/analyticsIngest.ts  → class AnalyticsIngestService          (ingestGeneric/ingestFunnel/ingestContent/getMetrics)
service/emailSequences.ts   → class EmailSequenceService            (createSequence/addStep/getTemplate/list/getPerformance)
```
Each: copies the `ok()`/`unavailable()`/`fail()` helpers + `UnauthenticatedError` handling from
`nativeLedger.ts`; uses `getUserSupabase()`; declares local row interfaces (§2); returns
`LedgerResult<T>`-shaped envelopes. The template library for `get_sequence_template` is a plain
`const SEQUENCE_TEMPLATES: Record<SequenceType, SequenceTemplate[]>` — no DB, no auth.

---

## 6. Server wiring + drift guard + narration

1. **`server.ts`:** add `import { register…Tool } from './tools/…js'` for all 13 tools and call
   each in the assembly block (grouped under a `// Campaign + analytics + email sequences` comment),
   before `return { server, ivos, edgeFn: edge }`. WRITE tools follow the gateWrite-then-resolve
   pattern; none need `edge` or `ivos`.
2. **Drift guard (`__tests__/server.test.ts`):** insert all 13 new names into the sorted
   `expect(names).toEqual([...])` array — in alphabetical position:
   `add_email_step`, `create_campaign`, `create_email_sequence`, `get_campaign`,
   `get_campaign_metrics`, `get_sequence_performance`, `get_sequence_template`,
   `ingest_campaign_analytics`, `ingest_content_performance`, `ingest_funnel_analytics`,
   `list_campaigns`, `list_sequences`, `update_campaign_status` (13 total). This is the SSOT update.
3. **Narration (`config.ts` `SERVER_INSTRUCTIONS`):** append a sentence block: the coach
   announces each tool it runs and why ("Running your funnel numbers now…", "Pulling this
   campaign's CTR/CVR…"), reasons over real metrics, and **states "no data" rather than
   guessing** when a metrics read returns `no_data:true`. Keep the existing two-surface
   conformance check green (extend it to assert the metrics/no-fabrication line is present, and
   that no Tier-C terminology leaked — `terminologyGuard` already covers leak detection).

---

## 7. Test plan (Vitest, mocked Supabase — `__setUserSupabaseFactory`)

Mock seam is `__setUserSupabaseFactory(() => stubSupabase(rows))` + drive handlers under
`runWithIdentity({ userId, token, authenticated:true }, …)` — copied verbatim from
`server.test.ts`. Anonymous-caller cases call the tool with no `runWithIdentity` wrapper.

New test files (target ≥85% on new code):
- `__tests__/campaignTools.test.ts` — create/get/list/update_status: authed happy path (assert
  `brand_id` is **resolver-supplied, never from args**), anon denial (`gateWrite` → `isError`),
  status from→to transition, missing-row `no_data`.
- `__tests__/analyticsIngest.test.ts` — unit-test the three **pure parsers**
  (funnel/content/generic → `MetricInput[]`) with fixtures from the three real workbook shapes
  (assert field→metric_name mapping, `funnel_stage` assignment, rate-normalisation `4.2%→0.042`,
  bad rows land in `skipped[]` and are **not** fabricated); then tool-level upsert idempotency
  (same rows twice → one set) and `get_campaign_metrics` aggregation + empty→`no_data`.
- `__tests__/emailSequences.test.ts` — create sequence + auto `step_number`; `get_sequence_template`
  returns 5/7/3 steps for welcome/nurture/abandoned_cart **with no auth** and no Tier-C terms;
  `get_sequence_performance` honest `no_data` when no linked campaign/metrics.
- **Extend `__tests__/server.test.ts`** — the advertised-surface assertion now lists 59 tools
  (46 + 13); add the metrics narration assertion.
- **Extend `__tests__/terminologyGuard.test.ts`** (or its conformance harness) — template copy +
  narration pass the Tier-C leak check.

Fixtures: add `__tests__/fixtures/funnel_sample.json`, `content_tracker_sample.json`,
`amazon_conversion_path_sample.json` (small, redacted, real-shaped).

---

## 8. Deferred past Alpha (flag explicitly)

1. **Advanced funnel metrics** — TACoS, ACoS, BSR, CM3, COGS, fees, return-rate from
   infinity_vault_funnel.xlsx are **not** in the metric vocab. Adding them = vocab/CHECK churn +
   profitability math the coach doesn't yet reason over. Defer; revisit when "Defend/Profitability"
   loop is built.
2. **gross vs net revenue disambiguation** — currently both fold to `metric_name:'revenue'`.
   Decide a `metric_qualifier` column (or `gross_revenue`/`net_revenue` vocab) in Beta; for Alpha,
   store **net** and note gross in `skipped`/notes, or store gross — pick one and document. (Risk.)
3. **Spreadsheet upload/parse edge fn** — Alpha tools accept pre-parsed JSON. A real `.xlsx`-upload
   → cell-extraction edge fn (like `review-scraper` for evidence) is a separate build; defer.
4. **Warehouse/auto-sync ingestion** (`source:'warehouse'`) — the column exists but no connector;
   manual + spreadsheet only in Alpha.
5. **Email send/delivery** — `email_sequences`/`email_steps` are **content + structure only**. No
   ESP integration, no actual sending, no real open/click capture (so `get_sequence_performance`
   only reflects whatever `campaign_metrics` the user ingests). Sending is post-Alpha.
6. **Currency/FX normalisation** — single-currency assumption; multi-currency deferred.
7. **`coach_assets.campaign_id` → FK backfill** — intentionally left as free-text; do not migrate
   in Alpha (breaks live rows, out of scope).

---

## 9. Entities summary (for the build agent)

- **campaigns**(id, user_id, brand_id, name, channel⟨7⟩, status⟨draft|active|paused|completed⟩, description, created_at, updated_at) — RLS owner; idx (user_id,status,created_at desc)
- **campaign_metrics**(id, user_id, campaign_id→campaigns, channel, metric_name⟨13⟩, metric_value numeric, funnel_stage?, measured_date, granularity⟨daily|hourly|snapshot⟩, source⟨manual|spreadsheet|warehouse⟩, created_at) — append-only; idx (campaign_id,measured_date desc),(channel,measured_date desc); uq natural key
- **email_sequences**(id, user_id, brand_id, campaign_id?→campaigns, sequence_type⟨6⟩, name, status⟨draft|active|paused⟩, created_at, updated_at)
- **email_steps**(id, user_id, sequence_id→email_sequences, step_number, subject, body, delay_hours, email_type?, trigger_event?, created_at) — uq (sequence_id,step_number)
- **Tools (13):** create_campaign, get_campaign, list_campaigns, update_campaign_status,
  ingest_campaign_analytics, ingest_funnel_analytics, ingest_content_performance,
  get_campaign_metrics, create_email_sequence, add_email_step, get_sequence_template,
  list_sequences, get_sequence_performance — registered in `server.ts` + the `server.test.ts`
  drift-guard array.
- **Services (3):** CampaignService, AnalyticsIngestService, EmailSequenceService.
