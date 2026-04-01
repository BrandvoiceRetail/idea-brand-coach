# Beta Test Cost Projection — 200 Users, 4 Weeks

**Status**: Planning
**Date**: 2026-03-27
**Authors**: Matthew Kerns, Claude (AI pair)
**Applies to**: Post-optimization codebase (store: false, gated vector search)

---

## Assumptions

### User Segments

| Segment | Count | Sessions/Week | Messages/Session | Doc Exports | Copy Gen | Competitive Analysis |
|---------|-------|---------------|-----------------|-------------|----------|---------------------|
| **Heavy users** | 50 | 5 | 15 | 2 over 4 weeks | 3 over 4 weeks | 1 over 4 weeks |
| **Regular users** | 100 | 3 | 8 | 1 over 4 weeks | 1 over 4 weeks | 0 |
| **Light users** | 50 | 1 | 4 | 0 | 0 | 0 |

### Derived Message Volumes (4 weeks)

| Segment | Users | Messages/Week | Total Messages (4 wks) |
|---------|-------|---------------|----------------------|
| Heavy | 50 | 75 (5 sessions x 15 msgs) | 15,000 |
| Regular | 100 | 24 (3 sessions x 8 msgs) | 9,600 |
| Light | 50 | 4 (1 session x 4 msgs) | 800 |
| **Total** | **200** | | **25,400** |

### Derived Session Volumes (4 weeks)

| Segment | Users | Sessions/Week | Total Sessions (4 wks) |
|---------|-------|---------------|----------------------|
| Heavy | 50 | 5 | 1,000 |
| Regular | 100 | 3 | 1,200 |
| Light | 50 | 1 | 200 |
| **Total** | **200** | | **2,400** |

---

## Cost Breakdown by Function

### 1. Trevor Conversation (idea-framework-consultant)

The primary cost driver. Every user message triggers one gpt-4.1 API call.

| | Volume | Cost/Call | Subtotal |
|---|---|---|---|
| 25,400 messages | 25,400 | $0.015 (midpoint) | **$381.00** |

### 2. Session Titles (generate-session-title)

One gpt-4o-mini call per new session.

| | Volume | Cost/Call | Subtotal |
|---|---|---|---|
| 2,400 sessions | 2,400 | $0.0001 | **$0.24** |

### 3. Document Generation (generate-brand-strategy-section, V2)

Client-side orchestration: 13 gpt-4o-mini calls per full export.

| Segment | Exports | Sections/Export | Total Calls | Cost/Call | Subtotal |
|---------|---------|----------------|-------------|-----------|----------|
| Heavy | 100 (50 users x 2) | 13 | 1,300 | $0.003 | $3.90 |
| Regular | 100 (100 users x 1) | 13 | 1,300 | $0.003 | $3.90 |
| **Total** | **200** | | **2,600** | | **$7.80** |

### 4. Brand Copy Generator (brand-copy-generator)

Uses gpt-4-turbo-preview — the most expensive model in the stack.

| Segment | Calls | Cost/Call | Subtotal |
|---------|-------|-----------|----------|
| Heavy | 150 (50 users x 3) | $0.05 | $7.50 |
| Regular | 100 (100 users x 1) | $0.05 | $5.00 |
| **Total** | **250** | | **$12.50** |

### 5. Competitive Analysis (competitive-analysis-orchestrator)

| Segment | Calls | Cost/Call | Subtotal |
|---------|-------|-----------|----------|
| Heavy | 50 (50 users x 1) | $0.10 | $5.00 |
| **Total** | **50** | | **$5.00** |

### 6. AI Assistants (field suggestions, insights, diagnostics)

Lightweight gpt-4o-mini calls triggered during brand-building exercises.

| Function | Est. Calls/User (4 wks) | Total Calls | Cost/Call | Subtotal |
|----------|------------------------|-------------|-----------|----------|
| brand-ai-assistant | Heavy: 20, Regular: 5, Light: 1 | 1,550 | $0.001 | $1.55 |
| ai-insight-guidance | Heavy: 10, Regular: 3, Light: 0 | 800 | $0.001 | $0.80 |
| buyer-intent-analyzer | Heavy: 5, Regular: 1, Light: 0 | 350 | $0.003 | $1.05 |
| file-conversation-insights | Heavy: 5, Regular: 1, Light: 0 | 350 | $0.001 | $0.35 |
| **Total** | | **3,050** | | **$3.75** |

### 7. Embeddings and Storage

| Function | Volume | Cost | Subtotal |
|----------|--------|------|----------|
| sync-diagnostic-to-embeddings (text-embedding-3-small) | ~400 submissions (200 users x ~2 diagnostics) | $0.00002/call | $0.008 |
| extract-fields-from-document (gpt-4o-mini) | ~100 uploads (heavy + some regular) | $0.003/call | $0.30 |
| OpenAI vector store storage | Assuming 0 users with active stores (gated) | $0 | $0 |
| **Total** | | | **$0.31** |

*Note: Assumes migration from ada-002 ($0.10/1M) to text-embedding-3-small ($0.02/1M) — 80% cheaper, drop-in replacement.*

### 8. Semantic Memory (If Implemented Before Beta)

One text-embedding-3-small embedding per message + free pgvector search.

| | Volume | Cost/Call | Subtotal |
|---|---|---|---|
| 25,400 messages | 25,400 | $0.00002 | **$0.51** |

---

## Total Cost Summary

### Baseline (Current Models, No Changes)

| Category | Cost |
|----------|------|
| Trevor conversation (GPT-4.1) | $381.00 |
| Session titles | $0.24 |
| Document generation | $7.80 |
| Brand copy generator | $12.50 |
| Competitive analysis | $5.00 |
| AI assistants | $3.75 |
| Embeddings and storage | $0.31 |
| **Total (4 weeks)** | **$410.60** |
| **Per user average** | **$2.05** |
| **Per week** | **$102.65** |

### With Semantic Memory (Baseline + Embeddings)

| Category | Cost |
|----------|------|
| All of the above | $410.60 |
| Semantic embeddings (text-embedding-3-small) | $0.51 |
| pgvector queries (Supabase) | $0.00 |
| **Total (4 weeks)** | **$411.11** |
| **Per user average** | **$2.06** |
| **Per week** | **$102.78** |

### Recommended: Strategy C (GPT-5 Mini + GPT-5 + Semantic Memory)

| Category | Cost |
|----------|------|
| Trevor conversation (GPT-5 Mini) | $35.56 |
| Document generation (GPT-5) | $33.80 |
| Field extraction (GPT-5, separate) | $9.91 |
| Session titles | $0.24 |
| Brand copy generator (GPT-4o-mini) | $0.63 |
| Competitive analysis | $5.00 |
| AI assistants | $3.75 |
| Embeddings and storage | $0.31 |
| Semantic memory embeddings | $0.51 |
| **Total (4 weeks)** | **$89.71** |
| **Per user average** | **$0.45** |
| **Per week** | **$22.43** |

---

## Cost Distribution

```
Trevor conversation   ████████████████████████████████████████  92.8%
Brand copy generator  ███                                        3.0%
Document generation   ██                                         1.9%
Competitive analysis  █                                          1.2%
AI assistants         █                                          0.9%
Everything else       ░                                          0.2%
```

**Trevor conversation is 93% of total cost.** All other optimizations are rounding errors by comparison.

---

## Sensitivity Analysis

### If Heavy Users Are Heavier

| Scenario | Heavy User Msgs/Week | Total Messages | Total Cost |
|----------|---------------------|---------------|------------|
| **Baseline** | 75 | 25,400 | $411 |
| Heavy +50% | 112 | 32,900 | $530 |
| Heavy +100% | 150 | 40,400 | $643 |

### If Adoption Is Lower

| Scenario | Active Users | Total Messages | Total Cost |
|----------|-------------|---------------|------------|
| **Baseline (all 200)** | 200 | 25,400 | $411 |
| 75% adoption | 150 | 19,050 | $310 |
| 50% adoption | 100 | 12,700 | $207 |

### Model Migration Impact (Incremental)

| Change | Savings | New Total |
|--------|---------|-----------|
| Move `brand-copy-generator` from gpt-4-turbo to gpt-4o-mini | -$11.88 (95%) | $399 |
| Upgrade embeddings to text-embedding-3-small | -$2.03 (80% of embedding costs) | $409 |
| Route simple Trevor messages to gpt-4o-mini | -$152 (40% of main call cost) | $259 |
| All three combined | | **$246** |

### Model Swap Strategy: Cheap Conversation, Premium Generation

*Model pricing verified March 2026. Sources: [PE Collective](https://pecollective.com/tools/openai-api-pricing/), [OpenAI GPT-5.4 announcement](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/).*

**Why conversation is 93% of cost**: It's not the per-message price ($0.015) — it's the volume. 25,400 messages over 4 weeks turns a small unit cost into $381. No other function comes close to that call volume.

**Core principle**: Use a cheap model for high-volume ephemeral conversation, reserve a premium model for low-volume permanent deliverables (documents, field extraction).

#### Available Models (March 2026)

| Model | Input ($/1M) | Output ($/1M) | Cached Input | Context | Class |
|---|---|---|---|---|---|
| GPT-4.1 Nano | $0.10 | $0.40 | $0.025 | 1M | Cheapest available |
| GPT-4o-mini | $0.15 | $0.60 | $0.075 | 128K | Current candidate |
| GPT-5.4 Nano | $0.20 | $1.25 | — | 400K | GPT-5 class, API-only |
| GPT-5 Mini | $0.25 | $2.00 | $0.025 | 128K | GPT-5 class, strong |
| GPT-4.1 Mini | $0.40 | $1.60 | $0.10 | 1M | Mid-tier |
| GPT-5.4 Mini | $0.75 | $4.50 | — | 400K | GPT-5 + tools |
| GPT-5 | $1.25 | $10.00 | $0.125 | 128K | Flagship |
| **GPT-4.1** | **$2.00** | **$8.00** | $0.50 | 1M | **Current Trevor model** |

#### Strategy Options Compared

| Strategy | Conversation | Doc Gen | Field Extraction | Beta Total | vs Current |
|---|---|---|---|---|---|
| **Current** | GPT-4.1 ($2/$8) | GPT-4o-mini ($0.15/$0.60) | Bundled | **$411** | baseline |
| **A: GPT-4.1 Nano + GPT-5** | GPT-4.1 Nano ($0.10/$0.40) | GPT-5 ($1.25/$10) | GPT-5 (separate) | **$47** | **-89%** |
| **B: GPT-5.4 Nano + GPT-5** | GPT-5.4 Nano ($0.20/$1.25) | GPT-5 ($1.25/$10) | GPT-5 (separate) | **$63** | **-85%** |
| **C: GPT-5 Mini + GPT-5** (recommended) | GPT-5 Mini ($0.25/$2.00) | GPT-5 ($1.25/$10) | GPT-5 (separate) | **$80** | **-81%** |
| **D: GPT-5 for everything** | GPT-5 ($1.25/$10) | GPT-5 ($1.25/$10) | Bundled | **$196** | **-52%** |
| **E: GPT-4o-mini + GPT-4.1** | GPT-4o-mini ($0.15/$0.60) | GPT-4.1 ($2/$8) | GPT-4.1 (separate) | **$154** | **-63%** |

#### Recommended: Strategy C (GPT-5 Mini conversation, GPT-5 documents)

| Component | Current Model | Current Cost | Proposed Model | Proposed Cost | Delta |
|---|---|---|---|---|---|
| **Conversation** (25,400 msgs) | GPT-4.1 | $381.00 | GPT-5 Mini | $35.56 | **-$345.44** |
| **Document generation** (200 exports x 13 sections) | GPT-4o-mini | $7.80 | GPT-5 | $33.80 | +$26.00 |
| **Field extraction** (~30% of msgs) | GPT-4.1 (bundled) | $0 | GPT-5 (separate) | $9.91 | +$9.91 |
| Brand copy generator | gpt-4-turbo | $12.50 | GPT-4o-mini | $0.63 | -$11.87 |
| Everything else | mixed | $9.33 | unchanged | $9.33 | $0 |
| **Total (4 weeks)** | | **$410.63** | | **$89.23** | **-$321.40 (78%)** |

#### Why Strategy C

- **GPT-5 Mini is GPT-5 class** — newer architecture than GPT-4o-mini, likely better at coaching dialogue despite lower price
- **$0.25/$2.00 is cheap enough** that conversation cost drops from $381 to $36, making it no longer the dominant cost
- **GPT-5 for documents** produces higher quality permanent deliverables than GPT-4o-mini at a modest cost ($34 for the entire beta)
- **GPT-5 for field extraction** provides strong instruction-following for structured data extraction
- **Strategy A** is cheaper ($47) but GPT-4.1 Nano may sacrifice too much quality — worth A/B testing

#### Per-User and Weekly Breakdown

| Metric | Current | Strategy C | Strategy A (cheapest) |
|---|---|---|---|
| Total (4 weeks) | $411 | $89 | $47 |
| Per week | $103 | $22 | $12 |
| Per day | $15 | $3.20 | $1.70 |
| Per user (avg) | $2.05 | $0.45 | $0.24 |
| Heavy user (avg) | $4.10 | $0.89 | $0.47 |

#### Field Extraction Architecture Note

Currently, field extraction is bundled into the conversation call — GPT-4.1 handles both the response and the tool call for `save_extracted_fields` in a single request. With conversation on a cheaper model, field extraction has two options:

1. **Keep bundled** (simpler): Cheaper model handles both conversation and extraction. Risk: lower extraction accuracy on nuanced fields.
2. **Split extraction to separate call** (recommended): Cheap model generates the conversational response; a second GPT-5 call runs extraction only on messages where the conversation model signals extractable content. Cost: ~$10 for the beta (only ~30% of messages contain extractable fields).

Option 2 is modelled in the cost table above.

#### Quality Risk Assessment

| Concern | Risk | Mitigation |
|---|---|---|
| GPT-5 Mini conversation quality | Low | GPT-5 class architecture; Trevor's system prompt is detailed |
| GPT-4.1 Nano conversation quality | Low-Medium | Cheapest model; may need testing for coaching depth |
| Field extraction accuracy | Medium if bundled | Split extraction to GPT-5 (recommended) |
| Chapter guidance quality | Low | Chapter content is injected verbatim from local files |
| User perception of "dumber" coach | Low | GPT-5 Mini is newer than GPT-4.1; unlikely to feel like a downgrade |
| Long-session coherence | Medium | Semantic memory (ADR) mitigates this regardless of model |

---

## Key Takeaways

1. **$411 baseline for 4 weeks is manageable, but $89 is better.** Switching to GPT-5 Mini for conversation and GPT-5 for documents cuts cost by 78%.

2. **93% of baseline cost is Trevor conversation** because of volume (25,400 messages), not per-message price. The model swap makes conversation only ~40% of the optimised total.

3. **GPT-5 class models are now cheaper than GPT-4.1 on input.** GPT-5 at $1.25 input is 37% cheaper than GPT-4.1 at $2.00. GPT-5 Mini at $0.25 is 88% cheaper. This changes the cost calculus entirely.

4. **Semantic memory adds ~$0.51 (using text-embedding-3-small) for dramatically better context quality.** A no-brainer investment.

5. **The brand-copy-generator on gpt-4-turbo-preview is the worst cost-per-value ratio.** Migrating it to gpt-4o-mini saves $12 with minimal quality impact.

6. **Worst-case scenario** (heavy users at 2x, full adoption, Strategy C) is ~$142. With Strategy A (GPT-4.1 Nano), worst-case is ~$75.

---

## Recommendations for Beta Launch

| Priority | Action | Impact | Complexity |
|----------|--------|--------|------------|
| 1 | Switch conversation to GPT-5 Mini | **-$345/beta (84% of conversation cost)** | Low |
| 2 | Upgrade document generation to GPT-5 | Better deliverable quality, +$26 | Low |
| 3 | Split field extraction to separate GPT-5 call | Precision on extraction, +$10 | Medium |
| 4 | Implement semantic memory (ADR accepted) | Better UX, +$0.51 | Medium |
| 5 | Migrate brand-copy-generator to gpt-4o-mini | -$12/beta | Low |
| 6 | Upgrade embeddings from ada-002 to text-embedding-3-small | 80% cheaper embeddings | Low |
| 7 | Set up OpenAI usage alerts at $3/day and $50/month | Risk mitigation | Trivial |
| 8 | A/B test GPT-4.1 Nano vs GPT-5 Mini for conversation quality | Validate cheapest option | Low |

**Net impact of priorities 1-6 combined: ~$89 total beta cost (down from $411).**

---

**Last Updated**: 2026-03-27
