# AI Cost Analysis — IDEA Brand Coach

**Status**: Living Document
**Date**: 2026-03-27
**Authors**: Matthew Kerns, Claude (AI pair)

---

## Executive Summary

Every user message to Trevor (the Brand Coach) triggers 1-2 OpenAI API calls depending on context. Total spend jumped from ~$0.39 over the prior 2-3 months to $5+ in days during March 2026 due to redundant calls, server-side storage fees, and a tool output submission that doubled per-message cost. Optimizations applied on 2026-03-27 reduced per-message cost by ~40-50%. Further reductions are available via model migration — GPT-5 Mini ($0.25/$2.00) and GPT-4.1 Nano ($0.10/$0.40) are now available and offer 85-95% savings on conversation cost versus the current GPT-4.1 ($2.00/$8.00). See the [Beta Cost Projection](./BETA-COST-PROJECTION.md) for detailed model swap analysis.

---

## Model Pricing Reference

*Prices verified March 2026 via [openai.com/api/pricing](https://openai.com/api/pricing). Sources: [PE Collective](https://pecollective.com/tools/openai-api-pricing/), [OpenAI GPT-5.4 announcement](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/).*

### GPT-5 Series (New — March 2026)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Cached Input | Context | Notes |
|-------|---------------------|----------------------|-------------|---------|-------|
| **GPT-5.4 Nano** | $0.20 | $1.25 | — | 400K | API-only, cheapest GPT-5 class |
| **GPT-5 Mini** | $0.25 | $2.00 | $0.025 | 128K | Strong conversation candidate |
| **GPT-5.4 Mini** | $0.75 | $4.50 | — | 400K | Tools, function calling, 400K context |
| **GPT-5** | $1.25 | $10.00 | $0.125 | 128K | Flagship — cheaper input than GPT-4.1 |

### GPT-4 Series (Current Stack)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Cached Input | Context | Use Case |
|-------|---------------------|----------------------|-------------|---------|----------|
| **GPT-4.1 Nano** | $0.10 | $0.40 | $0.025 | 1M | Cheapest available model |
| **GPT-4o-mini** | $0.15 | $0.60 | $0.075 | 128K | Title gen, vector search, field suggestions |
| **GPT-4.1 Mini** | $0.40 | $1.60 | $0.10 | 1M | Mid-tier with 1M context |
| **GPT-4.1** | $2.00 | $8.00 | $0.50 | 1M | **Current**: Trevor conversation + field extraction |
| GPT-4o | $2.50 | $10.00 | $1.25 | 128K | Brand strategy document generation (V1) |
| gpt-4-turbo-preview | $10.00 | $30.00 | N/A | 128K | Brand copy generator **(legacy — migrate)** |

### Reasoning Models

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Cached Input | Context |
|-------|---------------------|----------------------|-------------|---------|
| o4-mini | $1.10 | $4.40 | $0.275 | 200K |
| o3-mini | $1.10 | $4.40 | $0.55 | 200K |
| o3 | $2.00 | $8.00 | $0.50 | 200K |
| o1 | $15.00 | $60.00 | $7.50 | 200K |

### Embedding Models

| Model | $/1M tokens | Notes |
|-------|------------|-------|
| **text-embedding-3-small** | $0.02 | **Recommended** — 5x cheaper than ada-002, drop-in replacement |
| text-embedding-ada-002 | $0.10 | **Current** — should migrate |
| text-embedding-3-large | $0.13 | Higher quality, higher cost |

### Storage

| Service | Cost | Notes |
|---------|------|-------|
| OpenAI vector store storage | $0.10/GB/day | **Migration candidate** — Supabase pgvector is free |

---

## Per-Message Cost Breakdown (Trevor Conversation)

### Current State (After March 2026 Optimizations)

Each message to Trevor now triggers **1-2 API calls**:

| # | Call | Model | Input Tokens | Output Tokens | Cost (est.) | Condition |
|---|------|-------|-------------|---------------|-------------|-----------|
| 1 | **Main conversation** | gpt-4.1 | ~2,000-3,000 | ~800-1,500 | $0.01-0.02 | Every message |
| 2 | Vector store search | gpt-4o-mini | ~500 | ~500 | $0.0004 | Only if user has uploaded documents |
| | **Total per message** | | | | **$0.01-0.02** | |

### Previous State (Before Optimizations)

Each message triggered **3-5 API calls**:

| # | Call | Model | Cost (est.) | Status |
|---|------|-------|-------------|--------|
| 1 | Main conversation | gpt-4.1 | $0.01-0.02 | Kept |
| 2 | Tool output submission | gpt-4.1 | $0.01-0.03 | **Removed** (store: false) |
| 3 | Semantic embedding search | ada-002 | $0.0001 | **Removed** (empty table) |
| 4 | Vector store search | gpt-4o-mini | $0.001 | **Gated** (only when docs exist) |
| 5 | Server-side storage fee | — | $0.50/1M stored | **Removed** (store: false) |
| | **Total per message** | | **$0.03-0.08** | |

### Planned State (After Semantic Memory — ADR)

| # | Call | Model | Cost (est.) | Notes |
|---|------|-------|-------------|-------|
| 1 | Embed current message | ada-002 | $0.0001 | New — for semantic retrieval |
| 2 | pgvector similarity search | N/A | $0 | Free — Supabase included |
| 3 | Main conversation | gpt-4.1 | $0.01-0.02 | Fewer input tokens (hybrid context) |
| 4 | Vector store search | gpt-4o-mini | $0.0004 | Only if user has uploaded docs |
| | **Total per message** | | **$0.01-0.02** | Same cost, better context |

---

## All Edge Functions — Complete API Call Inventory

### Per-Message Functions

| Function | Model | Trigger | Est. Cost/Call | Monthly (100 msgs/day) |
|----------|-------|---------|---------------|----------------------|
| **idea-framework-consultant** | gpt-4.1 | Every user message | $0.01-0.02 | $30-60 |
| **generate-session-title** | gpt-4o-mini | Once per new session | $0.0001 | $0.15 |
| **ensure-user-kb** | API only | Once per new user | ~$0 | Negligible |

### On-Demand Functions

| Function | Model | Trigger | Est. Cost/Call | Notes |
|----------|-------|---------|---------------|-------|
| **generate-brand-strategy-document** | gpt-4o | Export full strategy | ~$0.15 | 8,000 max output tokens |
| **generate-brand-strategy-section** | gpt-4o-mini | Per section (13 total) | ~$0.003 | 1,500 max output tokens |
| **generate-brand-strategy-document-v2** | gpt-4o-mini | Alt section gen | ~$0.003 | 1,500 max output tokens |
| **brand-copy-generator** | gpt-4-turbo-preview | Copy generation | ~$0.05 | **Most expensive model — consider migration** |
| **competitive-analysis-orchestrator** | gpt-4o | Market analysis | ~$0.10 | 4,000 max output tokens |
| **buyer-intent-analyzer** | gpt-4o-mini | Intent analysis | ~$0.003 | JSON response format |
| **ai-insight-guidance** | gpt-4o-mini | Diagnostic guidance | ~$0.001 | 800 max output tokens |
| **brand-ai-assistant** | gpt-4o-mini | Field suggestions | ~$0.001 | 500 max output tokens |
| **file-conversation-insights** | gpt-4o-mini | Conversation analysis | ~$0.001 | JSON response format |

### Embedding & Storage Functions

| Function | Model/Service | Trigger | Est. Cost/Call | Notes |
|----------|--------------|---------|---------------|-------|
| **sync-diagnostic-to-embeddings** | ada-002 | Per diagnostic submission | ~$0.0001 | Chunks at 500 chars |
| **extract-fields-from-document** | gpt-4o-mini + file_search | Per uploaded document | ~$0.003 | 5-field batch processing |
| **Vector store storage** | OpenAI storage | Per user (5 stores) | ~$0.10/day/user | **Ongoing cost — migration candidate** |

---

## Cost Projections at Scale

### Per-User Monthly Cost

Assumes: 20 messages/day, 5 days/month active usage = 100 messages/month

| Component | Before Optimization | After Optimization | With Semantic Memory |
|-----------|--------------------|--------------------|---------------------|
| Trevor conversation | $2.00 | $1.50 | $1.50 |
| Tool output submissions | $2.00 | $0 | $0 |
| Embeddings (dead call) | $0.01 | $0 | $0.01 (useful now) |
| Vector store search | $0.10 | $0.04 | $0.04 |
| OpenAI storage fees | $0.50 | $0 | $0 |
| Session titles | $0.01 | $0.01 | $0.01 |
| **Total/user/month** | **$4.62** | **$1.55** | **$1.56** |

### At User Scale

| Users | Before | After | With Semantic Memory |
|-------|--------|-------|---------------------|
| 10 | $46/mo | $16/mo | $16/mo |
| 100 | $462/mo | $155/mo | $156/mo |
| 1,000 | $4,620/mo | $1,550/mo | $1,560/mo |
| 10,000 | $46,200/mo | $15,500/mo | $15,600/mo |

### Vector Store Storage (Ongoing, If Not Migrated)

| Users | Stores | Daily Cost | Monthly Cost |
|-------|--------|-----------|-------------|
| 10 | 50 | $0.50 | $15 |
| 100 | 500 | $5.00 | $150 |
| 1,000 | 5,000 | $50.00 | $1,500 |

**Recommendation**: Migrate document storage from OpenAI vector stores to Supabase pgvector (see migration candidates below).

---

## Optimization Roadmap

### Completed (2026-03-27)

| Optimization | Savings | Complexity |
|-------------|---------|-----------|
| Remove dead semantic search call | ~$0.0001/msg | Trivial |
| Gate vector store search behind doc check | ~$0.001/msg (most messages) | Trivial |
| Switch to `store: false` | ~$0.01-0.03/msg + storage fees | Low |
| Remove tool output submission | ~$0.01-0.03/msg | Low |
| Handle OpenAI stream errors properly | N/A (reliability fix) | Low |

### Near-Term Opportunities

| Optimization | Est. Savings | Complexity | Notes |
|-------------|-------------|-----------|-------|
| **Switch conversation to GPT-5 Mini or GPT-4.1 Nano** | **85-95% of conversation cost** | Low | GPT-5 Mini ($0.25/$2.00) or GPT-4.1 Nano ($0.10/$0.40) vs current GPT-4.1 ($2.00/$8.00). See [Beta Cost Projection](./BETA-COST-PROJECTION.md) |
| **Upgrade document generation to GPT-5** | Better quality deliverables | Low | GPT-5 ($1.25/$10.00) is more capable; low volume makes cost increase negligible |
| Implement semantic memory (ADR) | $0/msg (quality improvement) | Medium | Same cost, much better context |
| Upgrade to `text-embedding-3-small` | 80% cheaper embeddings ($0.02 vs $0.10/1M) | Low | Drop-in replacement, 1536 dims available |
| Migrate `brand-copy-generator` from gpt-4-turbo to gpt-4o-mini | ~$0.04/call savings | Low | gpt-4-turbo is 50x more expensive |
| Bundle IDEA Framework content as local files | Eliminate per-message vector store search for framework (not user) content | Medium | Already have `getChapterGuidance()` |

### Medium-Term Opportunities

| Optimization | Est. Savings | Complexity | Notes |
|-------------|-------------|-----------|-------|
| Split field extraction to separate GPT-4.1/GPT-5 call | Precision on extraction when conversation uses cheaper model | Medium | Only ~30% of messages trigger extraction |
| Migrate from OpenAI vector stores to Supabase pgvector | $0.10/day/user ongoing storage | High | Requires changing document upload pipeline |
| Switch to Claude API (Sonnet 4.6) with prompt caching | 90% off cached system prompt tokens | High | Model-agnostic architecture makes this viable |
| Conversation summarization for 50+ message sessions | Reduce input tokens by ~50% for long sessions | Medium | Combine with semantic memory |

### Long-Term Architecture

| Optimization | Est. Savings | Complexity | Notes |
|-------------|-------------|-----------|-------|
| Intelligent model routing (cheap model for simple, expensive for complex) | 40-60% of main call cost | High | Requires classifier or heuristic |
| Cross-session semantic memory | N/A (feature, not cost saving) | Medium | Trevor remembers across sessions |
| Self-hosted embedding model | Eliminate embedding costs entirely | Very High | Only at significant scale |

---

## Cost Monitoring

### Key Metrics to Track

| Metric | Where to Find | Alert Threshold |
|--------|--------------|----------------|
| Daily OpenAI spend | OpenAI dashboard → Usage | > $2/day |
| API calls per user per session | Edge function logs | > 50 calls/session |
| Average tokens per request | OpenAI usage export | Input > 5,000 tokens/call |
| Vector store count | `user_vector_stores` table | Growing without bounds |
| Embedding table size | `chat_message_embeddings` (future) | > 1M rows |

### OpenAI Dashboard

- Billing: https://platform.openai.com/settings/organization/billing
- Usage: https://platform.openai.com/usage
- API Keys: https://platform.openai.com/api-keys (current key ends in `CPkA`)

---

## Appendix: Token Estimation Reference

| Content Type | Approximate Tokens |
|-------------|-------------------|
| Trevor system prompt (conversational) | ~1,500 |
| Trevor system prompt (comprehensive) | ~2,500 |
| Field extraction tool definition (35 fields) | ~800 |
| Chapter guidance injection | ~200 |
| Average user message | ~100-200 |
| Average assistant response | ~300-800 |
| Chat history (5 messages) | ~1,000 |
| Chat history (10 messages) | ~2,000 |
| Vector store context (when present) | ~500-1,000 |
| Knowledge base context | ~200-500 |

**Rule of thumb**: 1 token ~ 0.75 English words. A typical Trevor request uses ~3,000-4,000 input tokens and generates ~800-1,500 output tokens.

---

**Last Updated**: 2026-03-27 (model pricing updated with GPT-5 series)
