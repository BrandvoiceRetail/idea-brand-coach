# IDEA Brand Coach - Brief vs. Reality Checklist

Quick reference for what Trevor asked for vs. what's implemented.

---

## Component Checklist

### ✅ = Complete | ⚠️ = Partial | ❌ = Missing

---

## 1. Brand Diagnostic Tool (Lead Magnet)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Public landing page | ✅ | `FreeDiagnostic.tsx` works |
| Captures email after submission | ⚠️ | Uses legacy `BetaTesterCapture` |
| Uses IDEA Diagnostic prompt | ❌ | No taskType routing |
| Generates Brand Snapshot | ⚠️ | Saves data, no "snapshot" format |
| Creates HTML-to-PDF | ❌ | **No PDF generation** |
| PDF stored in Supabase | ❌ | No Supabase Storage usage |
| PDF includes actionable CTA | ❌ | Results page has CTAs, no PDF |

**Status: 40% Complete** - Core flow works, missing PDF lead magnet

---

## 2. AI Brand Coach (Chat Interface)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Authenticated users only | ✅ | Protected route working |
| Powered by Brand Coach prompt | ⚠️ | Hardcoded, not DB-driven |
| Preloads diagnostic summary | ✅ | RAG system retrieves context |
| Stores conversation history | ✅ | `chat_messages` table with RLS |
| File uploads (metadata only) | ⚠️ | UI exists, backend not wired |

**Status: 70% Complete** - Functional, needs DB prompts + file wiring

---

## 3. Prompt Router (Core Architecture)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Single GPT endpoint | ❌ | **7 separate Edge Functions** |
| Router selects prompt by taskType | ❌ | No routing logic |
| Prompts stored in Supabase | ❌ | All hardcoded in functions |
| Admin-only edit permissions | ❌ | No `prompts` table |
| Logging (taskType, timestamp, tokens) | ❌ | No logging infrastructure |
| runAI() function positioning statement | ❌ | Not implemented |

**Status: 0% Complete** - Core architecture requirement not met

---

## 4. Paywall and Training Access

| Requirement | Status | Notes |
|-------------|--------|-------|
| Stripe integration | ❌ | **No Stripe code** |
| Free tier: 1 diagnostic, 3 chats | ❌ | No usage limits |
| Pro tier: Unlimited access | ❌ | No subscription logic |
| Training content (Vimeo/Loom) | ❌ | **No training pages exist** |
| RLS for Pro-only content | ❌ | No tier-based access |

**Status: 0% Complete** - Entire monetization missing

---

## 5. Specialist Prompts

### 5.1 Shared Core Prompt
| Requirement | Status | Notes |
|-------------|--------|-------|
| Applied to every GPT call | ❌ | No shared prompt concept |
| Establishes IDEA tone/voice | ⚠️ | Each function has own tone |
| Reinforces IDEA principles | ⚠️ | Principles mentioned, not shared |

**Status: 20% Complete**

---

### 5.2 IDEA Prompt (taskType: diagnostic or brand_canvas)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Four-part canvas output | ❌ | No AI generation |
| Insight, Distinctive, Empathetic, Authentic | ⚠️ | Manual form has fields |
| Key Takeaway | ⚠️ | Results page has takeaways |
| UI: Four panels | ⚠️ | `BrandCanvas.tsx` has panels |
| PDF export | ❌ | No PDF export |

**Status: 30% Complete** - Manual form exists, no AI generation

---

### 5.3 Avatar 2.0 Prompt (taskType: avatar)

| Requirement | Status | Notes |
|-------------|--------|-------|
| AI-generated avatar profile | ❌ | **Manual form only** |
| Output fields per brief | ⚠️ | Form has similar fields |
| Buying Intent focus | ⚠️ | Field exists |
| Emotional Drivers | ⚠️ | `psychographics.desires` |
| Trust Triggers | ⚠️ | `psychographics.triggers` |
| Reusable by CAPTURE/Coach | ❌ | No integration |

**Status: 25% Complete** - Form exists, no AI generation

---

### 5.4 CAPTURE Prompt (taskType: capture)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Content evaluation tool | ❌ | **Tool doesn't exist** |
| CAPTURE model scoring | ❌ | Not implemented |
| Score out of 100 | ❌ | - |
| Category breakdown | ❌ | - |
| Rewritten improved version | ❌ | - |
| UI: Original vs. Improved | ❌ | - |

**Status: 0% Complete** - Entire tool missing

---

### 5.5 Brand Coach Prompt (taskType: coach)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Conversational coaching | ✅ | Works well |
| Retrieves diagnostic context | ✅ | RAG system working |
| Provides practical next steps | ⚠️ | Generic advice, no tool routing |
| Suggests which tool to use next | ❌ | **No tool suggestions** |
| One-click access to suggested tool | ❌ | No integration |

**Status: 60% Complete** - Chat works, missing tool suggestions

---

## 6. UI to Prompt Mapping

| UI Section | Required taskType | Current Status |
|------------|-------------------|----------------|
| Diagnostic Page | `diagnostic` | ❌ Not using taskType |
| Brand Canvas Tool | `brand_canvas` | ❌ Manual form |
| Avatar Builder | `avatar` | ❌ Manual form |
| CAPTURE | `capture` | ❌ Doesn't exist |
| Brand Coach Chat | `coach` | ⚠️ Works, no taskType |

**Status: 10% Complete** - Routing not implemented

---

## Summary Scorecard

| Component | Completion % | Critical? |
|-----------|-------------|-----------|
| 1. Diagnostic Tool | 40% | ⚠️ Medium (needs PDF) |
| 2. Brand Coach | 70% | ⚠️ Low (functional) |
| 3. Prompt Router | 0% | 🔴 **HIGH** (core architecture) |
| 4. Paywall | 0% | 🔴 **HIGH** (monetization) |
| 5. Training Access | 0% | 🔴 **HIGH** (course delivery) |
| 6. Shared Core Prompt | 20% | 🟡 Medium |
| 7. IDEA Prompt (AI gen) | 30% | 🟡 Medium |
| 8. Avatar 2.0 (AI gen) | 25% | 🟡 Medium |
| 9. CAPTURE Tool | 0% | 🔴 **HIGH** (core feature) |
| 10. Tool Suggestions | 0% | 🟡 Medium |

**Overall: 40% Aligned with Brief**

---

## Critical Path to MVP

### Must Have (Blocks Launch)
1. ❌ Stripe paywall (no revenue without this)
2. ❌ Training content pages (can't deliver course)
3. ❌ CAPTURE tool (major advertised feature)
4. ❌ PDF lead magnet (weak conversions without)

### Should Have (Brief Compliance)
5. ❌ Prompt router architecture
6. ❌ AI-generated Canvas/Avatar

### Nice to Have (Polish)
7. ⚠️ Tool suggestions from Coach
8. ⚠️ Document upload wiring
9. ⚠️ Admin prompt editing UI

---

## Recommended Approach

**Phase 1: Critical Monetization (6-8 hours)**
- Add Stripe paywall
- Add training content pages
- Add usage limits enforcement

**Phase 2: Critical Features (6-8 hours)**
- Build CAPTURE tool
- Add PDF generation for diagnostics
- Wire document uploads

**Phase 3: Architecture (Optional - defer to V2)**
- Build prompt router
- Migrate to database prompts
- Add tool suggestion logic

**Total for Viable MVP: 12-16 hours**

---

**Decision Point:** Confirm with Trevor which phases are mandatory for launch.

**Created:** 2025-11-08 | Matthew Kerns
