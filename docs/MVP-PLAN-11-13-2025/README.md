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
- 5 specialized prompts (Diagnostic, Avatar, Canvas, CAPTURE, Core)
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

### 4. [QMR_KNOWLEDGE_BASE_INTEGRATION_GUIDE.md](./QMR_KNOWLEDGE_BASE_INTEGRATION_GUIDE.md)
**Technical guide for ensuring relevant knowledge reaches the Model**

**Contents**:
- Deep dive into QMR (Query → Model → Response) framework
- How file search selects relevant chunks from 10,000+ documents
- 5 optimization strategies for retrieval quality
- Retrieval quality metrics (precision, recall, MRR, similarity distribution)
- Troubleshooting guide for poor retrieval (4 common symptoms + solutions)
- Testing & validation suite (automated tests + manual audits)
- Configuration best practices (per-category tuning)

**Use this for**: Optimizing RAG retrieval, debugging generic responses, ensuring Trevor's content is prioritized

---

### 5. [ARCHIVED_ASSISTANTS_API_PLAN.md](./ARCHIVED_ASSISTANTS_API_PLAN.md)
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

### Want to optimize retrieval quality?
→ Read **QMR_KNOWLEDGE_BASE_INTEGRATION_GUIDE.md**

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

### 3. **Context Management**: File Search with QMR Framework ✅
- **Why**: Intelligent semantic retrieval reduces tokens by 93%
- **Benefit**: 3.3s response time vs 9.3s without RAG
- **Cost Impact**: $0.05/query vs $0.32/query

### 4. **Architecture Pattern**: Response Chaining (not threads) ✅
- **Why**: Simpler than thread management, stateless-first design
- **Benefit**: 50% less code complexity
- **Memory**: Via `previous_response_id` + database persistence

---

## 💰 Cost Summary

**Monthly Operating Costs** (at 30K queries/month):

| Component | Cost |
|-----------|------|
| GPT-5 API Calls | $282/month |
| Vector Storage (25GB) | $75/month |
| PostgreSQL (User Profiles) | $25/month |
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
2. **Intelligent Context Management**: QMR framework with file search (93% token reduction)
3. **Cost-Effective**: GPT-5 delivers best ROI ($282/month at 30K queries)
4. **Data-Driven Decisions**: Quarterly testing framework removes guesswork
5. **Scalable**: Design supports 1K to 100K+ queries/month
6. **Comprehensive Knowledge Base**: Trevor's book + marketing frameworks with legal compliance
7. **Optimized Retrieval**: 5 strategies ensure relevant knowledge reaches the Model

---

## 📋 Document Roadmap

**For Stakeholders & Decision Makers:**
1. Start with **High-Level Design** for architecture overview
2. Review **Key Decisions Made** section above
3. Check **Cost Summary** and **Implementation Timeline**

**For Implementers & Developers:**
1. Read **High-Level Design** for technical architecture
2. Follow **System Knowledge Base Plan** to build vector stores
3. Use **QMR Integration Guide** to optimize retrieval
4. Reference **Model Comparison Framework** for quarterly evaluations

**For Ongoing Operations:**
1. **Weekly**: Monitor retrieval quality (QMR Integration Guide)
2. **Monthly**: Update knowledge base (System KB Plan)
3. **Quarterly**: Run model comparison tests (Testing Framework)

---

## 📐 Architecture Summary

```
User Query
    ↓
Router Prompt (Intent Classification)
    ↓
Specialized Prompt + Vector Store
├─ Diagnostic KB (10K docs) - Brand assessment
├─ Avatar KB (8K docs) - Customer profiling
├─ Canvas KB (7K docs) - Business models
├─ CAPTURE KB (12K docs) - Marketing execution
└─ Core KB (5K docs) - Brand foundations
    ↓
File Search (Semantic Retrieval)
├─ Embed query as vector
├─ Compare to all chunks in vector store
├─ Select top 20 most relevant (similarity > 0.7)
└─ Build Query with retrieved context
    ↓
GPT-5 Model Processing
├─ Query = System Prompt + Retrieved Chunks + History + User Message
├─ Attention mechanism weights by relevance
└─ Generate expert response citing sources
    ↓
Response + Memory Persistence
├─ Save to chat_messages table
├─ Update user profile
└─ Store response_id for next interaction
```

---

## 💡 Success Criteria

**Before Launch:**
- [ ] All 5 vector stores populated with knowledge base
- [ ] Trevor's book uploaded and tested (retrieval quality > 75%)
- [ ] Routing accuracy > 95% on test queries
- [ ] Average response time < 3 seconds (p95)
- [ ] Cost per query < $0.01

**Post-Launch (30 days):**
- [ ] User satisfaction > 4.0/5.0
- [ ] Response relevance score > 80%
- [ ] 60%+ of responses cite Trevor's methodology
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
