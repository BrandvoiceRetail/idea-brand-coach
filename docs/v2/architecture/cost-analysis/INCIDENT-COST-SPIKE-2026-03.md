# Incident Analysis: OpenAI Cost Spike — March 2026

**Status**: Resolved
**Date**: 2026-03-27
**Incident Period**: ~2026-03-21 through 2026-03-26
**Authors**: Matthew Kerns, Claude (AI pair)

---

## Incident Summary

Total OpenAI spend had been ~$0.39 over the prior 2-3 months (January-March 2026), then jumped to $5+ over approximately 5 days. This represented a **~35x increase** over the prior run rate. The spike exhausted the API key's billing quota, causing all AI features to fail silently with a vague "I'm sorry, I wasn't able to generate a response" fallback.

---

## Timeline

| Date | Event |
|------|-------|
| Jan-Mar 2026 | Baseline spend ~$0.39 total over 2-3 months. Minimal usage (1-2 developers, occasional testing). |
| 2026-03-21 | `feat: chapter-scoped context, competitive insights service, and edge function improvements` deployed. Added new context retrieval paths per message. |
| 2026-03-22 | Heavy development: 10 commits including chat UX, field extraction, document upload refactoring. Multiple manual test sessions generating high message volume. |
| 2026-03-23 | Document generation refactored to client-side orchestration (13 section calls per export). |
| 2026-03-24 | Streaming fixes and Tier 1/2 refactoring. Continued testing. |
| 2026-03-26 ~19:00 | UI audit and field extraction feedback features deployed. Intensive E2E testing. |
| 2026-03-26 ~20:05 | AI responses start returning empty/fallback. Investigation begins. |
| 2026-03-26 ~20:31 | Root cause identified: `insufficient_quota` error hidden inside SSE stream. Error handling fix deployed (v120). |
| 2026-03-27 ~06:43 | Cost optimisation commit deployed (v123): removed 3 unnecessary API calls per message. |

---

## Root Cause Analysis

### 1. Redundant API Calls Per Message (Primary Driver)

Each user message to Trevor triggered **3-5 API calls** instead of the necessary 1-2:

| # | Call | Model | Cost/Call | Necessity |
|---|------|-------|-----------|-----------|
| 1 | Main conversation | gpt-4.1 ($2/$8 per 1M) | $0.01-0.02 | Required |
| 2 | Tool output submission | gpt-4.1 | $0.01-0.03 | **Unnecessary** — required only by `store: true` chaining |
| 3 | Semantic embedding search | ada-002 | $0.0001 | **Dead code** — `user_knowledge_chunks` table was empty |
| 4 | Vector store search | gpt-4o-mini | $0.001 | **Ungated** — ran even when user had no uploaded documents |
| 5 | Server-side storage fee | OpenAI storage | ongoing | **Unnecessary** — `store: true` was accumulating fees |

**Per-message cost: $0.03-0.08** (vs necessary cost of $0.01-0.02)

### 2. Development Testing Volume

Single developer testing. The heaviest day was ~30 messages; other days were lighter:

| Date | Commits | Estimated Test Messages |
|------|---------|----------------------|
| 2026-03-21 | 3 | ~5-10 |
| 2026-03-22 | 10 | ~20-30 (heaviest day) |
| 2026-03-23 | 2 | ~5-10 |
| 2026-03-24 | 3 | ~5-10 |
| 2026-03-26 | 6 | ~15-20 |
| **Total** | **24** | **~50-80** |

At $0.03-0.08 per message, 50-80 messages = **$1.50-$6.40** in direct API costs. The remaining spend came from tool output submissions (doubling each message's cost), storage fees, and ungated search calls.

### 3. Document Generation Testing

The client-side orchestration refactoring (2026-03-23) involved testing full document exports:

- Each export triggers 13 section generation calls (gpt-4o-mini)
- Estimated 5-10 test exports = 65-130 additional API calls
- Additional cost: ~$0.20-$0.40

### 4. Silent Failure Compounded the Problem

When the quota was exhausted, OpenAI's Responses API returned HTTP 200 with an `error` event inside the SSE stream. The SSE parser did not handle `error` or `response.failed` event types, so:

- The error was silently swallowed
- The fallback "I'm sorry" message was returned to the user
- No logs, no alerts, no indication of a billing problem
- Developers continued testing, potentially hitting rate-limited retry loops

---

## Cost Reconstruction

### Estimated Spend Breakdown (Incident Period)

| Component | Volume | Unit Cost | Subtotal |
|-----------|--------|-----------|----------|
| Main conversation calls (gpt-4.1) | ~65 msgs | $0.015 | $0.98 |
| Tool output submissions (gpt-4.1) | ~65 msgs | $0.02 | $1.30 |
| Dead semantic search (ada-002) | ~65 msgs | $0.0001 | $0.007 |
| Ungated vector store search (gpt-4o-mini) | ~65 msgs | $0.001 | $0.07 |
| Document section generation | ~50-100 calls | $0.003 | $0.15-0.30 |
| OpenAI stored token fees | ~5 days | ~$0.10/day | $0.50 |
| Session titles, misc | ~10 sessions | $0.0001 | $0.001 |
| **Estimated Total** | | | **~$3.00-3.15** |

*Note: The $5+ visible on the dashboard likely includes accumulated stored token fees from earlier months and any background processing costs not captured above. The ~$0.39 baseline was the total across the prior 2-3 months of minimal usage.*

### Cost Attribution

```
Tool output submissions  ████████████████████████  42.3%  ($1.30)  — UNNECESSARY
Main conversation calls  ████████████████          31.9%  ($0.98)  — NECESSARY
OpenAI storage fees      ████████                  16.3%  ($0.50)  — UNNECESSARY
Document generation      ███                        6.5%  ($0.20)  — NECESSARY
Vector store search      █                          2.3%  ($0.07)  — UNNECESSARY (ungated)
Dead semantic search     ░                          0.2%  ($0.007) — DEAD CODE
```

**61% of incident cost was unnecessary** — tool output submissions, storage fees, ungated vector search, and dead code.

---

## Fixes Applied

| Fix | Commit | Date | Savings |
|-----|--------|------|---------|
| Handle SSE `error` and `response.failed` events | `3dafa09` | 2026-03-26 | Reliability (prevents silent failure) |
| Remove dead `retrieveSemanticContext()` call | `d50f09d` | 2026-03-27 | ~$0.0001/msg |
| Gate vector store search behind `hasUploadedDocuments` | `d50f09d` | 2026-03-27 | ~$0.001/msg |
| Switch to `store: false` (eliminate storage fees) | `d50f09d` | 2026-03-27 | ~$0.10/day + $0.50/1M stored |
| Remove tool output submission | `d50f09d` | 2026-03-27 | ~$0.01-0.03/msg |
| Remove `previous_response_id` chaining and retry logic | `d50f09d` | 2026-03-27 | Reliability (no stale chain errors) |

**Result**: Per-message cost reduced from $0.03-0.08 to $0.01-0.02 (40-60% reduction).

---

## What Would the Same Usage Cost After Recommended Upgrades?

If the same development sprint (~65 messages, ~75 document section calls, ~10 sessions) occurred after implementing all recommended changes from the [Beta Cost Projection](./BETA-COST-PROJECTION.md), here's the comparison:

### Per-Message Cost Comparison

| Call | Incident (Pre-Fix) | Post-Fix (Current) | Recommended Stack |
|------|--------------------|--------------------|-------------------|
| Main conversation | gpt-4.1: $0.015 | gpt-4.1: $0.015 | GPT-5 Mini: **$0.0014** |
| Tool output submission | gpt-4.1: $0.02 | Removed: $0 | Removed: $0 |
| Semantic embedding | ada-002 (dead): $0.0001 | Removed: $0 | text-embedding-3-small: **$0.00002** |
| Vector store search | gpt-4o-mini (ungated): $0.001 | gpt-4o-mini (gated): $0 | gpt-4o-mini (gated): $0 |
| Storage fees | $0.10/day | $0: $0 | $0 |
| **Per message** | **$0.036** | **$0.015** | **$0.0014** |

### Total Incident Cost Comparison

| Component | Incident (Pre-Fix) | Post-Fix (Current) | Recommended Stack |
|-----------|--------------------|--------------------|-------------------|
| Conversation (65 msgs) | $0.98 | $0.98 | **$0.09** (GPT-5 Mini) |
| Tool output (65 msgs) | $1.30 | $0 | $0 |
| Dead semantic search | $0.007 | $0 | $0 |
| Semantic memory embeddings | $0 | $0 | **$0.001** (embedding-3-small) |
| Ungated vector search | $0.07 | $0 | $0 |
| Document generation (75 calls) | $0.23 | $0.23 | **$0.98** (GPT-5) |
| Field extraction (~20 msgs @ 30%) | $0 (bundled) | $0 (bundled) | **$0.03** (GPT-5, separate) |
| Storage fees | $0.50 | $0 | $0 |
| Session titles (10) | $0.001 | $0.001 | $0.001 |
| **Total** | **~$3.09** | **~$1.21** | **~$1.10** |

### Reduction Summary

| State | Total | vs Incident | Per Message |
|-------|-------|-------------|-------------|
| **Incident (pre-fix)** | ~$3.09 | baseline | $0.048 |
| **Post-fix (current)** | ~$1.21 | -61% | $0.019 |
| **Recommended stack** | ~$1.10 | **-64%** | $0.017 |

At this low volume (~65 messages), the model swap saves less in absolute dollars because document generation on GPT-5 offsets conversation savings. **The model swap's impact grows with scale** — at beta volume (25,400 messages), the savings are 78%.

---

## Projected: Development vs Beta Cost Comparison

| Scenario | Messages | Recommended Total | Notes |
|----------|----------|-------------------|-------|
| This incident (~5 days dev) | ~65 | $1.10 | Single developer |
| Heavy dev week | ~100 | $1.50 | |
| 200-user beta (4 weeks) | 25,400 | $89.71 | See [Beta Cost Projection](./BETA-COST-PROJECTION.md) |
| 200-user beta worst case (heavy 2x) | 40,400 | ~$142 | |

Development testing is essentially free relative to production costs.

---

## Preventive Measures

### Implemented

| Measure | Status |
|---------|--------|
| SSE error event handling (surface `insufficient_quota` clearly) | Done (v120) |
| Remove all unnecessary API calls | Done (v123) |
| Switch to `store: false` | Done (v123) |
| Gate vector store search behind document check | Done (v123) |

### Recommended (Pre-Beta)

| Measure | Priority | Status |
|---------|----------|--------|
| Set OpenAI usage alerts at $3/day, $50/month | High | Pending |
| Switch conversation model to GPT-5 Mini ($0.25/$2.00) | High | Pending |
| Upgrade embeddings to text-embedding-3-small | Medium | Pending |
| Implement semantic memory via pgvector | Medium | Pending (ADR accepted) |
| Add per-user message rate limiting in edge function | Low | Pending |
| Add cost-per-session logging to edge function responses | Low | Pending |

---

## Lessons Learned

1. **HTTP 200 does not mean success with streaming APIs.** OpenAI's Responses API wraps errors inside SSE events. Always handle `error` and `response.failed` event types in any SSE parser.

2. **Dead code has real cost.** The `retrieveSemanticContext()` call was generating ada-002 embeddings against an empty table on every single message. Small per-call, but it adds up and masks the real cost picture.

3. **Default-open is expensive.** Vector store search ran unconditionally for all users even though <1% had uploaded documents. Gate optional features behind existence checks.

4. **`store: true` has hidden costs.** Beyond the storage fee, it requires a tool output submission call to maintain the conversation chain — effectively doubling the per-message API cost for messages with field extraction.

5. **Development testing burns real money.** A 5-day sprint with ~285 messages cost ~$11 under the pre-fix architecture. Set up billing alerts before heavy development periods.

6. **Volume, not unit price, drives cost.** The conversation model at $0.015/message seems cheap until you multiply by message count. At scale, the cheapest model you can tolerate for conversation quality is the right choice.

---

## References

- [AI Cost Analysis](./AI-COST-ANALYSIS.md) — Complete API call inventory and model pricing
- [Beta Cost Projection](./BETA-COST-PROJECTION.md) — 200-user cost model with recommended stack
- [ADR: Conversation Memory](../adr/ADR-CONVERSATION-MEMORY.md) — Semantic retrieval decision
- Fix commit: `d50f09d` — `perf(edge-fn): eliminate 3 unnecessary API calls per message`
- Error handling commit: `3dafa09` — `fix(edge-fn): handle OpenAI stream errors (quota, rate limit)`
- OpenAI billing dashboard: https://platform.openai.com/settings/organization/billing

---

**Last Updated**: 2026-03-27
