# P1 Features - Post-Launch Roadmap
## IDEA Brand Coach Platform

**Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Planning Phase

---

## Overview

This document defines all features **deferred to P1 (post-launch)**. These features exist in the codebase but are marked as lower priority to ensure a focused P0 beta launch.

**P0 Completion Requirement**: All three core P0 features must be functional and stable before beginning P1 development.

See [P0_FEATURES.md](./P0_FEATURES.md) for beta launch requirements.

---

## P1 Feature Categories

1. [Advanced IDEA Framework Modules](#p11-advanced-idea-framework-modules)
2. [Avatar & Customer Research Tools](#p12-avatar--customer-research-tools)
3. [Brand Canvas & Visual Tools](#p13-brand-canvas--visual-tools)
4. [Beta Journey & Feedback Flows](#p14-beta-journey--feedback-flows)
5. [Document Upload & Knowledge Base](#p15-document-upload--knowledge-base)
6. [Advanced Dashboard Features](#p16-advanced-dashboard-features)

---

## P1.1 - Advanced IDEA Framework Modules

### Features to Defer

**Existing Routes (All behind ProtectedRoute):**
- `/idea` - IDEA Framework landing page
- `/idea/consultant` - IDEA Framework Consultant (will become alias for `/brand-coach`)
- `/idea/insight` - Insight module deep-dive
- `/idea/distinctive` - Distinctive module deep-dive
- `/idea/empathy` - Empathy module deep-dive
- `/idea/authenticity` - Authenticity module deep-dive
- `/idea-diagnostic` - Full authenticated diagnostic (vs free version)

### Components
- `IdeaDiagnostic.tsx` - Extended diagnostic (15+ questions)
- `IdeaFramework.tsx` - Framework overview page
- `IdeaInsight.tsx` - Insight deep-dive module
- `IdeaDistinctive.tsx` - Distinctive deep-dive module
- `IdeaEmpathy.tsx` - Empathy deep-dive module
- `IdeaAuthenticity.tsx` - Authenticity deep-dive module

### Rationale
- P0 FreeDiagnostic (6 questions) provides sufficient value for beta
- Full framework modules add complexity and onboarding friction
- Can be layered in based on beta feedback

### Migration Path
- Link from diagnostic results as "Learn More" CTAs
- Unlock progressively as users engage with Brand Coach
- Use Brand Coach to recommend specific modules based on low scores

---

## P1.2 - Avatar & Customer Research Tools

### Features to Defer

**Routes:**
- `/avatar` - Avatar Builder (behind ProtectedRoute)
- `/research-learning` - Research & Learning hub (behind ProtectedRoute)

**Components:**
- `AvatarBuilder.tsx` - Customer avatar creation tool
- `SurveyBuilder.tsx` (`src/components/research/`)
- `CustomerReviewAnalyzer.tsx` (`src/components/research/`)

### Rationale
- These are advanced features for power users
- Require significant onboarding and education
- Better suited for paying customers post-beta
- P0 diagnostic provides enough customer insight data

### Migration Path
- Introduce as premium features (paid tier)
- Use Brand Coach to recommend avatar building when appropriate
- Example: "To improve your Empathy score, build a detailed customer avatar"

---

## P1.3 - Brand Canvas & Visual Tools

### Features to Defer

**Routes:**
- `/canvas` - Brand Canvas builder (behind ProtectedRoute)
- `/value-lens` - Value Lens tool (behind ProtectedRoute)

**Components:**
- `BrandCanvas.tsx` - Interactive brand strategy canvas
- `ValueLens.tsx` - Value proposition builder
- `LogoProcessor.tsx` - Logo analysis tool
- `BrandCanvasPDFExport.tsx` - PDF export functionality
- `AvatarPDFExport.tsx` - Avatar PDF export

### Rationale
- These are workshop-style tools requiring time investment
- Better experienced after establishing brand strategy foundation via diagnostic + Brand Coach
- Require more user time and engagement

### Migration Path
- Offer as guided workflows after diagnostic completion
- Integrate with Brand Coach recommendations
- Example: "Let's create your brand canvas based on your diagnostic insights"

---

## P1.4 - Beta Journey & Feedback Flows

### Features to Defer

**Routes:**
- `/beta` - Beta welcome page (public)
- `/beta/journey` - Beta tester journey tracker (behind ProtectedRoute)
- `/beta/feedback` - Structured feedback collection (behind ProtectedRoute)

**Components:**
- `BetaWelcome.tsx` - Beta program landing page
- `BetaJourney.tsx` - Progress tracking for beta testers
- `BetaFeedback.tsx` - Feedback form
- `BetaNavigationWidget.tsx` - Persistent beta navigation

**Database:**
- `beta_testers` table - Already exists
- Edge Function: `save-beta-feedback`

### Rationale
- P0 focuses on core product value, not beta program infrastructure
- Can gather feedback through simpler means (email, support chat, quick surveys)
- Structured beta program can launch alongside P1

### Migration Path
- Launch formal beta program after P0 stabilizes
- Use feedback to prioritize P1 feature rollout
- Simple feedback collection via:
  - Post-session surveys in Brand Coach
  - Email follow-ups
  - Support chat (Intercom/Zendesk)

---

## P1.5 - Document Upload & Knowledge Base

### Current State

**Existing Infrastructure (Ready but Unused):**
- ✅ Database table: `uploaded_documents`
- ✅ Storage bucket: `documents`
- ✅ RLS policies configured
- ✅ Edge Function: `document-processor`
- ✅ UI Component: `DocumentUpload.tsx` (used in IdeaFrameworkConsultant)

**Database Schema:**
```sql
CREATE TABLE public.uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  extracted_content TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Why P1
- Adds complexity to RAG implementation
- Requires robust file processing pipeline (PDF/Word/text extraction)
- Can start with diagnostic data only and expand
- Document processing (OCR, parsing) adds latency
- Need file size limits, virus scanning, format validation

### Migration Path

**Phase 1 (P0)**: RAG uses diagnostic + profile data only

**Phase 2 (P1.5)**: Add document upload capability
- User uploads brand guidelines, strategy docs, competitive analysis
- `document-processor` Edge Function extracts text
- Text chunked and embedded into `user_knowledge_chunks`
- Brand Coach references uploaded documents in responses

**Phase 3 (P2)**: Advanced document analysis
- Competitive document analysis
- Multi-document synthesis
- Visual content analysis (logo, design assets)

---

## P1.6 - Advanced Dashboard Features

### Features to Defer

**Dashboard Enhancements (Not Yet Built):**
- Historical diagnostic trend charts
- Brand health score tracking over time
- Comparative analysis (vs industry benchmarks)
- Team collaboration features
- Export reports (PDF/PowerPoint)
- Analytics dashboards (engagement, progress, ROI)

**Current P0 Dashboard Scope:**
- Show latest diagnostic scores
- Quick access to Brand Coach
- Link to retake diagnostic

### Rationale
- P0 dashboard can show latest diagnostic only
- Trend tracking requires time and multiple submissions
- Advanced analytics better suited for paid tiers
- Team features require collaboration infrastructure

### Migration Path

**P1 Dashboard Features (in priority order):**

1. **Historical Tracking** (P1.6.1)
   - Line charts showing score changes over time
   - Comparison of diagnostic submissions
   - "Your Progress" section

2. **Brand Health Dashboard** (P1.6.2)
   - Overall brand health score
   - Category breakdowns with explanations
   - Suggested focus areas

3. **PDF Report Export** (P1.6.3)
   - Professional PDF of diagnostic results
   - Brand Coach conversation summary
   - Actionable recommendations

4. **Team Collaboration** (P1.6.4 - P2 consideration)
   - Invite team members
   - Shared diagnostic results
   - Collaborative Brand Coach sessions

---

## P1 Implementation Priority

**Recommended Rollout Sequence (Post-P0 Launch):**

### Phase P1.1 (Week 1-2 post-launch)
**Focus**: Enhance existing features based on beta feedback
- Historical diagnostic tracking
- Improved Brand Coach suggested prompts
- Dashboard polish and analytics

### Phase P1.2 (Week 3-4 post-launch)
**Focus**: Document upload integration
- Enable document upload in Brand Coach
- Integrate with RAG pipeline
- File processing and extraction

### Phase P1.3 (Week 5-8 post-launch)
**Focus**: IDEA Framework deep-dive modules
- Enable /idea/insight, /idea/distinctive, etc.
- Create guided learning paths
- Integrate with Brand Coach recommendations

### Phase P1.4 (Week 9-12 post-launch)
**Focus**: Advanced tools (Avatar, Canvas, Value Lens)
- Unlock avatar builder
- Enable brand canvas
- Add value lens tool
- Guided workflows

### Phase P1.5 (Week 13+ post-launch)
**Focus**: Team & enterprise features
- Team collaboration
- Multi-user accounts
- Enterprise-grade analytics
- White-label considerations (P2)

---

## Feature Comparison: P0 vs P1

| Feature | P0 Beta | P1 Future |
|---------|---------|-----------|
| **Diagnostic** | ✅ Free 6-question | ✅ Extended 15-question |
| **Account Creation** | ✅ Email + Google OAuth | ✅ + LinkedIn, SSO |
| **Brand Coach GPT** | ✅ RAG with diagnostic data | ✅ + Document upload RAG |
| **Diagnostic Results** | ✅ Basic scores + insights | ✅ + Trend analysis, comparisons |
| **Dashboard** | ✅ Minimal (latest results, Brand Coach access) | ✅ Full analytics, history, charts |
| **IDEA Framework Modules** | ❌ Deferred | ✅ 4 deep-dive modules |
| **Avatar Builder** | ❌ Deferred | ✅ Full avatar creation |
| **Brand Canvas** | ❌ Deferred | ✅ Interactive canvas |
| **Value Lens** | ❌ Deferred | ✅ Value prop builder |
| **Document Upload** | ❌ Deferred (schema ready) | ✅ Full upload + RAG |
| **PDF/PPT Export** | ❌ Not planned | ✅ Professional reports |
| **Team Collaboration** | ❌ Not planned | ⏳ P2 consideration |
| **White-label** | ❌ Not planned | ⏳ P3 consideration |

---

## Success Metrics for P1 Launch

**Engagement Metrics:**
- 40%+ of P0 users adopt at least one P1 feature
- 20%+ use document upload RAG
- 30%+ explore IDEA deep-dive modules
- 15%+ create customer avatars

**Retention Metrics:**
- 60%+ return within 14 days of P1 feature release
- 25%+ weekly active users (vs 15% in P0)

**Business Metrics:**
- 30%+ conversion to paid tier (if introducing pricing)
- 50%+ reduction in support tickets (better self-service)

---

## Dependencies

**P1 Features Require P0 Completion:**
- ✅ Data access layer with service interfaces
- ✅ RAG infrastructure (pgvector, embeddings)
- ✅ Chat message persistence
- ✅ Stable diagnostic → auth → save flow

**Additional Infrastructure for P1:**
- File processing pipeline (PDF, Word, text extraction)
- Charts/visualization library (Recharts or similar)
- PDF generation library (jsPDF or Puppeteer)
- Team management database schema
- Analytics tracking (PostHog, Amplitude)

---

## Open Questions for Product Team

1. **Pricing Strategy**: When do we introduce paid tiers? Which features are premium?
   - Recommendation: P0 free, P1.5+ introduces paid tiers

2. **Document Upload Limits**: File size, format restrictions, storage quotas?
   - Recommendation: 10MB per file, 100MB total per user, PDF/Word/txt only

3. **Team Features Scope**: Multi-user accounts, role-based access, shared workspaces?
   - Recommendation: Defer to P2, focus on individual users first

4. **Industry Benchmarks**: Do we provide comparative data (e.g., "Your score vs SaaS average")?
   - Recommendation: P1.6+ feature, requires data aggregation strategy

5. **White-label/Enterprise**: Do we pursue enterprise customization?
   - Recommendation: P3+, focus on product-market fit first

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-07 | 1.0 | Extracted from P0_BETA_LAUNCH_ROADMAP.md v1.3 |
