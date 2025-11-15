# 📁 IDEA Brand Coach MVP Plan - November 13, 2025

## Overview

This folder contains the complete planning documentation for the IDEA Brand Coach RAG system MVP, created November 13, 2025.

---

## 📄 Documents in This Plan

### 1. [IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md](./IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md)
**Primary architecture and design document**

**Contents**:
- System architecture using OpenAI Responses API
- QMR (Query → Model → Response) framework explanation
- Intelligent context management with file search
- Multi-stage routing architecture (Router → Specialized Prompts → Synthesis)
- 5 specialized domain prompts (Diagnostic, Avatar, Canvas, CAPTURE, Core)
- Memory persistence strategy
- Routing logic and scalability
- GPT-5 model specifications
- Performance targets and cost analysis
- 10-week implementation timeline

**Use this for**: Strategic decisions, architecture discussions, stakeholder presentations

---

### 2. [MODEL_COMPARISON_TESTING_FRAMEWORK.md](./MODEL_COMPARISON_TESTING_FRAMEWORK.md)
**Reusable quarterly model evaluation system**

**Contents**:
- Three-dimensional evaluation framework (Quality, Performance, Cost)
- GPT-5 vs Claude Sonnet 4.5 baseline comparison
- Automated testing scripts and methodology
- Quality metrics specific to brand coaching
- Performance benchmarking protocols
- Cost analysis and ROI calculation
- Decision matrix for model upgrades
- Quarterly evaluation calendar

**Use this for**: Evaluating new models every 3 months, data-driven upgrade decisions

---

### 3. [SYSTEM_KNOWLEDGE_BASE_PLAN.md](./SYSTEM_KNOWLEDGE_BASE_PLAN.md)
**Comprehensive strategy for building the RAG knowledge base**

**Contents**:
- Three-tier knowledge architecture (Trevor's book + marketing syntheses + web content)
- Trevor's book upload instructions (PDF → Vector stores)
- Legal framework for synthesizing copyrighted marketing books
- 5 domain-specific vector stores (Diagnostic, Avatar, Canvas, CAPTURE, Core)
- Document preparation pipeline and templates
- Quality assurance and maintenance plan
- Cost estimates and implementation timeline

**Use this for**: Building and maintaining the system knowledge base, understanding content strategy

---

### 4. [SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md](./SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md)
**Architectural guide for separating and aggregating two knowledge bases**

**Contents**:
- System Knowledge Base (shared): Trevor's book + marketing frameworks across 5 vector stores
- User Knowledge Base (per-user isolated): Diagnostic results, uploaded documents, conversation history
- Runtime aggregation strategy: Parallel retrieval from both sources (75% System / 25% User)
- Security & data isolation: RLS policies, user_id filtering, cross-user leakage prevention
- Optimization strategies: Adaptive distribution, low-score prioritization, Trevor content boosting
- Retrieval quality metrics: System vs User balance, Trevor's representation, context relevance
- Complete implementation examples with parallel retrieval and query construction

**Use this for**: Understanding two-KB architecture, implementing per-user isolation, optimizing System+User aggregation

---

### 5. [CHATBOT_DATA_ACCESS_TOOLS_PLAN.md](./CHATBOT_DATA_ACCESS_TOOLS_PLAN.md)
**Unified tool-based architecture for knowledge base access**

**Contents**:
- 10 file_search tools (5 System KB + 5 User KB)
- Domain-specific tool organization
- Parallel tool execution strategy (System + User retrieval)
- Tool selection and routing logic
- Vector store configuration per domain
- Security and data isolation patterns

**Use this for**: Understanding tool architecture, implementing knowledge base access patterns

---

### 6. [prompts/](./prompts/) ⭐ NEW
**Complete system prompt definitions using 7-step framework**

**Contents**:
- 7 total prompts: Router, Synthesis, + 5 specialized domain prompts
- Each prompt in separate file with complete 7-step framework structure
- [Router Prompt](./prompts/router-prompt.md) ✅ Complete - Intent classification
- [Synthesis Prompt](./prompts/synthesis-prompt.md) ⏳ In Progress - Multi-domain aggregation
- [Diagnostic Prompt](./prompts/diagnostic-prompt.md) ⏳ In Progress - Brand assessment
- [Avatar Prompt](./prompts/avatar-prompt.md) ⏳ In Progress - Customer personas
- [Canvas Prompt](./prompts/canvas-prompt.md) ⏳ In Progress - Business models
- [CAPTURE Prompt](./prompts/capture-prompt.md) ⏳ In Progress - Marketing strategy
- [Core Prompt](./prompts/core-prompt.md) ⏳ In Progress - Brand foundations
- Tool definitions and configuration
- Domain-specific tone matrix and response formats
- Hypothetical few-shot examples per domain

**Use this for**: Understanding chatbot behavior, prompt engineering, system implementation

---

### 7. [ARCHIVED_ASSISTANTS_API_PLAN.md](./ARCHIVED_ASSISTANTS_API_PLAN.md)
**Historical reference - Original plan using deprecated API**

**Contents**:
- Original Assistants API architecture (deprecated)
- Comprehensive migration decision record
- Cost-benefit analysis: Assistants API → Responses API
- Feature parity comparison
- ROI calculation ($80K savings by avoiding future migration)
- Lessons learned

**Use this for**: Understanding why we chose Responses API, historical reference

---

## 🎯 Quick Navigation

### Want to understand the architecture?
→ Read **IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md**

### Want to evaluate a new model?
→ Use **MODEL_COMPARISON_TESTING_FRAMEWORK.md**

### Want to build the knowledge base?
→ Follow **SYSTEM_KNOWLEDGE_BASE_PLAN.md**

### Want to understand System vs User KB separation?
→ Read **SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md**

### Want to understand the chatbot prompts and behavior?
→ Read **prompts/README.md** and individual prompt files

### Want to implement tool-based knowledge access?
→ Read **CHATBOT_DATA_ACCESS_TOOLS_PLAN.md**

### Want to know why we didn't use Assistants API?
→ Read **ARCHIVED_ASSISTANTS_API_PLAN.md**

---

## 📊 Key Decisions Made

### 1. **API Platform**: OpenAI Responses API ✅
- **Why**: Assistants API sunsets August 2026
- **Benefit**: Future-proof, simpler architecture, better performance
- **Savings**: $80K by avoiding migration in 2026

### 2. **AI Model**: GPT-5 (Standard) ✅
- **Why**: Best balance of quality, performance, and cost
- **Alternative Evaluated**: Claude Sonnet 4.5 (2.1% better quality, but 48% more expensive)
- **Decision**: GPT-5 - cost savings ($258/month) outweigh marginal quality gain

### 3. **Knowledge Base Architecture**: Dual KB with Runtime Aggregation ✅
- **System KB (Shared)**: Trevor's book + marketing frameworks (42K docs, 25GB, OpenAI Vector Stores)
- **User KB (Per-User)**: Diagnostic results + uploaded documents (PostgreSQL with RLS)
- **Aggregation**: Parallel retrieval - 75% System KB + 25% User KB at query time
- **Benefit**: Expert methodology (Trevor) + personalized context (user) in single response

### 4. **Context Management**: File Search with Semantic Retrieval ✅
- **Why**: Intelligent retrieval reduces tokens by 93% (2K vs 32K)
- **Benefit**: 3.3s response time vs 9.3s without RAG
- **Cost Impact**: $0.05/query vs $0.32/query

### 5. **Architecture Pattern**: Response Chaining (not threads) ✅
- **Why**: Simpler than thread management, stateless-first design
- **Benefit**: 50% less code complexity
- **Memory**: Via `previous_response_id` + database persistence

---

## 💰 Cost Summary

**Monthly Operating Costs** (at 30K queries/month):

| Component | Cost |
|-----------|------|
| GPT-5 API Calls | $282/month |
| System KB Vector Storage (25GB) | $75/month |
| PostgreSQL (User KB + Profiles) | $25/month |
| Redis Cache | $20/month |
| **Total** | **~$402/month** |

**Scales linearly with volume**:
- 1K queries: ~$100/month
- 10K queries: ~$200/month
- 100K queries: ~$1,200/month

---

## 🚀 Implementation Timeline

**Phase 1: Foundation** (Weeks 1-2)
- Set up Responses API infrastructure
- Create router and specialized prompts
- Implement conversation manager

**Phase 2: Vector Stores** (Weeks 3-4)
- Upload knowledge documents
- Configure 5 vector stores
- Test file search accuracy

**Phase 3: Routing Logic** (Weeks 5-6)
- Implement pattern-based routing
- Build AI-powered router
- Test routing accuracy

**Phase 4: Memory System** (Weeks 7-8)
- Entity extraction pipeline
- User profile persistence
- Cross-session memory testing

**Phase 5: Optimization** (Weeks 9-10)
- Multi-layer caching
- Performance monitoring
- Production deployment

**Total**: 10 weeks to production-ready MVP

---

## 📅 Maintenance Schedule

### Quarterly (Every 3 Months)
- [ ] Run model comparison tests
- [ ] Evaluate new model releases
- [ ] Review cost and performance trends
- [ ] Decide on model upgrades

### Monthly
- [ ] Review quality metrics from production
- [ ] Analyze cost trends
- [ ] Update knowledge base (vector stores)
- [ ] Monitor performance SLAs

### Weekly
- [ ] Check error rates and uptime
- [ ] Review user feedback
- [ ] Update user profiles database
- [ ] Monitor API usage and costs

---

## 🔗 Related Resources

**External Documentation**:
- [OpenAI Responses API Docs](https://platform.openai.com/docs/guides/responses)
- [OpenAI GPT-5 Model Card](https://platform.openai.com/docs/models/gpt-5)
- [OpenAI Vector Stores Guide](https://platform.openai.com/docs/assistants/tools/file-search)
- [Anthropic Claude Sonnet 4.5 Docs](https://www.anthropic.com/claude/sonnet)

**Internal Documentation**:
- `CLAUDE.md` - Development best practices
- `docs/plans/` - Other implementation plans
- `docs/adr/` - Architecture decision records

---

## 📞 Support & Questions

**For implementation questions**:
- Review high-level design document first
- Check model comparison framework for evaluation methodology
- Consult archived plan for historical context

**For quarterly model evaluations**:
- Use testing framework scripts
- Follow quick start guide
- Apply decision matrix objectively

---

## 🎓 Key Takeaways

1. **Future-Proof Architecture**: Built on OpenAI's strategic platform (Responses API)
2. **Dual Knowledge Base Design**: System KB (shared expert knowledge) + User KB (isolated context)
3. **Runtime Aggregation**: Parallel retrieval from both sources (75% System / 25% User)
4. **Cost-Effective**: GPT-5 delivers best ROI ($282/month at 30K queries)
5. **Data-Driven Decisions**: Quarterly testing framework removes guesswork
6. **Scalable**: Design supports 1K to 100K+ queries/month
7. **Expert + Personalized**: Trevor's methodology combined with user's specific brand context
8. **Security First**: User KB strictly isolated with RLS, no cross-user data leakage

---

## 📋 Document Roadmap

**For Stakeholders & Decision Makers:**
1. Start with **High-Level Design** for architecture overview
2. Review **Key Decisions Made** section above
3. Check **Cost Summary** and **Implementation Timeline**

**For Implementers & Developers:**
1. Read **High-Level Design** for technical architecture
2. Read **prompts/** directory to understand chatbot behavior and system prompts
3. Follow **Chatbot Data Access Tools Plan** for tool architecture
4. Follow **System Knowledge Base Plan** to build vector stores
5. Use **System/User KB Separation Guide** to implement dual knowledge base
6. Reference **Model Comparison Framework** for quarterly evaluations

**For Ongoing Operations:**
1. **Weekly**: Monitor retrieval quality and prompt performance
2. **Monthly**: Update knowledge base (System KB Plan) and refine prompts
3. **Quarterly**: Run model comparison tests (Testing Framework)

---

## 📐 Architecture Summary

```
User Query
    ↓
Stage 1: Router Prompt (Intent Classification)
    ├─ Output: Single domain ["diagnostic"]
    ├─ Output: Multiple domains ["avatar", "capture"]
    └─ Output: Clarification request
    ↓
Stage 2: Specialized Prompt(s) Execute in Parallel
    ↓
PARALLEL RETRIEVAL FROM TWO KNOWLEDGE BASES:
    ┌─────────────────────┐         ┌─────────────────────┐
    │   SYSTEM KB         │         │    USER KB          │
    │   (Shared)          │         │    (Per-User)       │
    ├─────────────────────┤         ├─────────────────────┤
    │ Trevor's Book +     │         │ User's Diagnostic   │
    │ Marketing Syntheses │         │ Uploaded Documents  │
    │                     │         │ Conversation History│
    │ Storage:            │         │                     │
    │ - Diagnostic (10K)  │         │ Storage:            │
    │ - Avatar (8K)       │         │ - user_knowledge_   │
    │ - Canvas (7K)       │         │   chunks table      │
    │ - CAPTURE (12K)     │         │ - chat_messages     │
    │ - Core (5K)         │         │                     │
    │                     │         │ Filter:             │
    │ OpenAI Vector Store │         │ WHERE user_id=X     │
    └──────────┬──────────┘         └──────────┬──────────┘
               │                               │
               │   Retrieve 15 chunks          │  Retrieve 5 chunks
               │   (75% of context)            │  (25% of context)
               └───────────┬───────────────────┘
                           │
                   AGGREGATE 20 CHUNKS
                           ↓
                 Build Augmented Query
    ┌───────────────────────────────────────────────┐
    │ Query Components (per specialized prompt):   │
    │ ├─ System Prompt (500 tokens)                │
    │ ├─ System KB Context (1,500 tokens)          │
    │ ├─ User KB Context (500 tokens)              │
    │ ├─ Conversation History (800 tokens)         │
    │ └─ User Question (200 tokens)                │
    │ Total: ~3,500 tokens per domain              │
    └───────────────────────┬───────────────────────┘
                            ↓
                  GPT-5 Model Processing
    ├─ Attention mechanism weights by relevance
    └─ Generate expert response citing both sources
                            ↓
         Single Domain Response OR Multiple Responses
                            ↓
    ┌───────────────────────┴───────────────────────┐
    │                                                │
Single Domain          Multiple Domains (2+ responses)
    │                               ↓
    │                   ┌───────────────────────────┐
    │                   │ Stage 3: Synthesis Prompt │
    │                   │ Combines all responses    │
    │                   │ into cohesive answer +    │
    │                   │ offers deeper exploration │
    │                   └───────────┬───────────────┘
    │                               │
    └───────────────┬───────────────┘
                    ↓
      Final Response + Memory Persistence
    ├─ Save to chat_messages table (User KB)
    ├─ Update user profile
    └─ Store response_id for next interaction
```

---

## 💡 Success Criteria

**Before Launch:**
- [ ] System KB: All 5 vector stores populated with Trevor's book + marketing syntheses
- [ ] User KB: Database schema deployed with RLS policies
- [ ] Trevor's book uploaded and tested (System KB retrieval quality > 75%)
- [ ] User diagnostic sync tested (User KB isolation verified)
- [ ] Routing accuracy > 95% on test queries
- [ ] Runtime aggregation working (System KB + User KB parallel retrieval)
- [ ] Average response time < 3 seconds (p95)
- [ ] Cost per query < $0.01

**Post-Launch (30 days):**
- [ ] User satisfaction > 4.0/5.0
- [ ] Response relevance score > 80%
- [ ] 60%+ of responses cite Trevor's methodology (System KB)
- [ ] User context included in 90%+ of responses (User KB)
- [ ] No cross-user data leakage incidents (User KB security)
- [ ] System uptime > 99.5%
- [ ] Cost tracking within budget

---

**Plan Created**: November 13, 2025
**Last Updated**: November 13, 2025
**Status**: ✅ Complete & Ready for Implementation
**Next Steps**: Begin Phase 1 implementation or review with stakeholders

---

## 📧 Document Owners

**System Architecture**: Development Team
**Knowledge Base Strategy**: Content Team + Trevor (IP owner)
**Model Selection**: Data Science Team
**Operations & Monitoring**: DevOps Team

**Questions?** Refer to relevant document first, then consult document owner.
