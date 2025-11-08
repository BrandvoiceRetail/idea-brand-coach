# P0 Beta Launch Roadmap - IDEA Brand Coach
## Executive Summary & Index

**Version:** 2.0 (Modular)
**Last Updated:** 2025-11-07
**Status:** Planning Phase
**Estimated Timeline:** 14 working days

---

## 📋 Documentation Index

This roadmap has been decomposed into focused, modular documents for easier navigation and maintenance:

### Core Planning Documents

1. **[P0_FEATURES.md](./docs/P0_FEATURES.md)** ⭐
   - Three core features for beta launch
   - Current state analysis
   - Migration strategy
   - Success criteria
   - ~60% completion status

2. **[TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md)** 🏗️
   - System architecture diagrams
   - Data access layer (Repository Pattern)
   - RAG implementation with LangChain
   - Database schema & migrations
   - Security & data privacy
   - Complete data flow documentation

3. **[P1_FEATURES.md](./docs/P1_FEATURES.md)** 🚀
   - Post-launch feature roadmap
   - Deferred features (IDEA modules, Avatar Builder, etc.)
   - P1 implementation phases
   - Feature prioritization

4. **[P0_IMPLEMENTATION_PLAN.md](./docs/P0_IMPLEMENTATION_PLAN.md)** 📅
   - Day-by-day implementation plan
   - 4 sprint breakdown (14 days total)
   - Success metrics & launch criteria
   - Risk mitigation strategies
   - Launch checklist

---

## Quick Start Guide

**For Project Managers:**
- Read [Executive Summary](#executive-summary) below
- Review [P0_FEATURES.md](./docs/P0_FEATURES.md) for scope
- Check [P0_IMPLEMENTATION_PLAN.md](./docs/P0_IMPLEMENTATION_PLAN.md) for timeline

**For Developers:**
- Start with [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md)
- Then [P0_IMPLEMENTATION_PLAN.md](./docs/P0_IMPLEMENTATION_PLAN.md) for tasks
- Reference [P0_FEATURES.md](./docs/P0_FEATURES.md) for requirements

**For Product Team:**
- Review [P0_FEATURES.md](./docs/P0_FEATURES.md) for MVP scope
- Check [P1_FEATURES.md](./docs/P1_FEATURES.md) for future roadmap
- Review success metrics in [P0_IMPLEMENTATION_PLAN.md](./docs/P0_IMPLEMENTATION_PLAN.md)

---

## Executive Summary

### What We're Building (P0 MVP)

Three core features for beta launch:

1. **Brand Diagnostic Flow** 📊
   - Anonymous 6-question IDEA framework assessment
   - Account creation triggered at completion
   - Diagnostic data saved to Supabase
   - Historical tracking

2. **Authentication System** 🔐
   - Email/password sign-up and sign-in
   - Optional Google OAuth
   - Profile auto-creation
   - Session management

3. **Brand Coach GPT with RAG** 🤖
   - AI-powered brand consultant
   - LangChain-based RAG pipeline
   - Personalized responses based on diagnostic data
   - Persistent chat history
   - Suggested prompts from diagnostic scores

### Current Implementation Status

**What Already Exists (~60% Complete):**
- ✅ FreeDiagnostic - Complete 6-question UI
- ✅ Auth System - Supabase auth configured
- ✅ Brand Coach UI - Full chat interface (`IdeaFrameworkConsultant.tsx`)
- ✅ Edge Function - GPT-4 consultant (`idea-framework-consultant`)
- ✅ Document Upload - File processing capability
- ✅ Protected Routes - Route guarding working

**What We Need to Build (40% Remaining):**
- ❌ Data Access Layer - Interface-based service architecture
- ❌ RAG System - LangChain + vector embeddings
- ❌ Database Schema - Diagnostic tables, pgvector, chat history
- ❌ Auth Integration - Connect diagnostic → signup → save flow
- ❌ UI Refactoring - Migrate to service layer pattern

**Key Insight**: This is primarily a **refactoring and integration project**, not a greenfield build.

### Timeline

**Revised Estimate: 14 working days** (vs original 28-day waterfall estimate)

| Sprint | Days | Goal |
|--------|------|------|
| Sprint 1 | 1-5 | Data Layer & RAG Infrastructure |
| Sprint 2 | 6-8 | Integration & Auth Flow |
| Sprint 3 | 9-11 | Brand Coach UI Refactoring |
| Sprint 4 | 12-14 | Testing & Launch Prep |

**Post-Launch**: Weeks 3-4 monitoring, then P1 development

### Success Criteria

**Launch Requirements:**
- [ ] Users complete diagnostic without account
- [ ] Seamless account creation flow
- [ ] Diagnostic data saves to Supabase
- [ ] Brand Coach provides personalized advice using RAG
- [ ] Chat history persists across sessions
- [ ] Mobile responsive
- [ ] No critical bugs

**Beta Metrics (30 days):**
- 100+ diagnostic completions
- 60%+ signup conversion
- 40%+ Brand Coach usage
- 50%+ 7-day retention
- NPS > 40

See [P0_IMPLEMENTATION_PLAN.md - Success Metrics](./docs/P0_IMPLEMENTATION_PLAN.md#success-metrics) for complete details.

---

## P0 vs P1 Feature Comparison

| Feature | P0 Beta | P1 Post-Launch |
|---------|---------|----------------|
| **Diagnostic** | ✅ 6 questions | 15+ questions |
| **Auth** | ✅ Email + Google OAuth | + LinkedIn, SSO |
| **Brand Coach** | ✅ RAG with diagnostic | + Document RAG |
| **Results** | ✅ Basic scores | + Trends, comparisons |
| **Dashboard** | ✅ Minimal | Full analytics |
| **IDEA Modules** | ❌ Deferred | ✅ 4 deep-dives |
| **Avatar Builder** | ❌ Deferred | ✅ Full tool |
| **Brand Canvas** | ❌ Deferred | ✅ Interactive |
| **Document Upload** | ❌ Deferred | ✅ Full RAG |
| **Team Features** | ❌ Not planned | P2 consideration |

**Rationale**: P0 focuses on proving core value (diagnostic → personalized coaching). P1 adds depth and advanced tools.

---

## Technology Stack

### Frontend
- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **State**: React Query (TanStack)
- **UI**: shadcn/ui + Tailwind CSS
- **Type Safety**: TypeScript

### Backend
- **Database**: Supabase PostgreSQL + pgvector
- **Auth**: Supabase Auth (JWT)
- **Functions**: Deno Edge Functions
- **Vector Search**: IVFFlat index

### AI/ML
- **LLM**: OpenAI GPT-4.1
- **Embeddings**: OpenAI text-embedding-ada-002
- **Framework**: LangChain 0.1.0
- **Pattern**: Simple RAG with Conversational Memory

---

## Architecture Overview

### High-Level Flow

```
User → FreeDiagnostic → Auth → Supabase → Brand Coach GPT (RAG) → Response
         (6 questions)   (Sign up)  (Save)    (LangChain)      (Personalized)
```

### Data Access Layer

```
UI Components → React Hooks → Service Interfaces → Supabase Implementations
                (useChat)     (IChatService)       (SupabaseChatService)
```

**Benefits:**
- Clean separation of concerns
- Easy testing (mock services)
- Swappable backend
- Type-safe contracts

See [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md) for complete details.

---

## Risk Summary

### Top 5 Technical Risks

1. **RAG retrieval quality poor** → Extensive testing, fine-tuning
2. **Breaking existing IdeaFrameworkConsultant** → Keep old function as backup
3. **Data migration bugs (localStorage → Supabase)** → Validation, rollback plan
4. **LangChain ESM import issues in Deno** → Pin versions, test upfront
5. **Vector search performance** → Optimize indexes, caching

### Top 3 Product Risks

1. **Users don't see value in Brand Coach** → Strong onboarding, suggested prompts
2. **Too much auth friction** → Simple signup, optional OAuth
3. **Brand Coach responses feel generic** → Improve RAG context, refine prompts

See [P0_IMPLEMENTATION_PLAN.md - Risk Mitigation](./docs/P0_IMPLEMENTATION_PLAN.md#risk-mitigation) for mitigation strategies.

---

## Next Steps

### Immediate Actions

1. **Review & Approve**: Stakeholder sign-off on this roadmap
2. **Set Up Project Board**: Create tasks in Linear, Jira, or GitHub Projects
3. **Kickoff Meeting**: Align team on Day 1 start date
4. **Dev Environment**: Ensure Supabase project is accessible, OpenAI API key configured

### Day 1 Tasks (Implementation Start)

See [P0_IMPLEMENTATION_PLAN.md - Phase 1: Day 1](./docs/P0_IMPLEMENTATION_PLAN.md#day-1-typescript-types--service-interfaces)

1. Create TypeScript type definitions
2. Create service interface contracts
3. Set up project management board
4. Schedule daily standups

---

## Related Documentation

### In This Repository
- [P0_FEATURES.md](./docs/P0_FEATURES.md) - Feature requirements and current state
- [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md) - Architecture and data flow
- [P1_FEATURES.md](./docs/P1_FEATURES.md) - Post-launch feature roadmap
- [P0_IMPLEMENTATION_PLAN.md](./docs/P0_IMPLEMENTATION_PLAN.md) - Day-by-day implementation guide

### External Resources
- [Supabase Documentation](https://supabase.com/docs)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [React Query (TanStack)](https://tanstack.com/query/latest)

### Project Context
- [PRODUCTION_READINESS_AUDIT.md](./PRODUCTION_READINESS_AUDIT.md) - Pre-launch audit
- [KEY_RISKS_AND_LIMITATIONS.md](./KEY_RISKS_AND_LIMITATIONS.md) - Known risks
- [README.md](./README.md) - Project setup

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-07 | 1.0 | Initial monolithic roadmap | Claude Code |
| 2025-11-07 | 1.1 | Added Data Access Layer architecture | Claude Code |
| 2025-11-07 | 1.2 | Enhanced RAG implementation details | Claude Code |
| 2025-11-07 | 1.3 | Revised based on existing codebase analysis (14-day timeline) | Claude Code |
| 2025-11-07 | 2.0 | **Decomposed into modular documents**:<br>- Created P0_FEATURES.md (feature requirements)<br>- Created TECHNICAL_ARCHITECTURE.md (system design)<br>- Created P1_FEATURES.md (post-launch roadmap)<br>- Created P0_IMPLEMENTATION_PLAN.md (day-by-day plan)<br>- Updated this file as executive summary + index | Claude Code |

---

## Feedback & Questions

For questions about this roadmap:
- **Product**: Refer to [P0_FEATURES.md](./docs/P0_FEATURES.md)
- **Technical**: Refer to [TECHNICAL_ARCHITECTURE.md](./docs/TECHNICAL_ARCHITECTURE.md)
- **Timeline**: Refer to [P0_IMPLEMENTATION_PLAN.md](./docs/P0_IMPLEMENTATION_PLAN.md)
- **P1 Planning**: Refer to [P1_FEATURES.md](./docs/P1_FEATURES.md)
