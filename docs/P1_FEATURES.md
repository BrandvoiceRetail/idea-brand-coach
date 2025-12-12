# P1 Features - Post-Launch Roadmap
## IDEA Brand Coach Platform

**Version:** 2.0
**Last Updated:** 2025-11-24
**Status:** Planning Phase

---

## Overview

This document defines all features **planned for P1 (post-P0 launch)**. Features are managed through the centralized Feature Registry (`src/config/features.ts`) which controls phase gating, navigation visibility, and status messaging across the platform.

**P0 Completion Requirement**: All core P0 features must be functional and stable before beginning P1 development.

See [P0_FEATURES.md](./P0_FEATURES.md) for beta launch requirements.

---

## Feature Registry System

All features are now centrally managed in `src/config/features.ts`. This ensures:
- Single source of truth for feature availability
- Automatic phase-based navigation filtering
- Consistent status messaging across the platform
- Easy promotion/demotion of features between phases

The deployment phase is controlled via `VITE_DEPLOYMENT_PHASE` environment variable (defaults to 'P0').

---

## P1 Core Features (from Feature Registry)

The following features are marked as `phase: 'P1'` in the feature registry and will be enabled when `VITE_DEPLOYMENT_PHASE=P1`:

### 1. Dashboard
- **Route**: `/dashboard`
- **Status**: Coming Soon (Q1 2026)
- **Category**: Core
- **Show in Nav**: Yes
- **Requires Auth**: Yes
- **Description**: Your brand coaching dashboard - Access all your brand coaching tools, view your progress, and manage your brand strategy from one central location.

### 2. IDEA Framework
- **Route**: `/idea`
- **Status**: Coming Soon (Q1 2026)
- **Category**: Core
- **Show in Nav**: Yes
- **Requires Auth**: No
- **Description**: Learn the IDEA Strategic Brand Framework™ - A practical, step-by-step process to build trust, stand out in crowded markets, and turn hesitant browsers into loyal buyers.

### 3. Framework Submissions
- **Route**: `/submissions`
- **Status**: Coming Soon (Q1 2026)
- **Category**: Diagnostic
- **Show in Nav**: Yes
- **Requires Auth**: Yes
- **Description**: Track your IDEA framework progress - View all your completed framework assessments, track progress over time, and see how your brand strategy evolves.

### 4. Team Collaboration
- **Route**: `/team`
- **Status**: Coming Soon (Q2 2026)
- **Category**: Collaboration
- **Show in Nav**: Yes
- **Requires Auth**: Yes
- **Description**: Invite team members to collaborate on brand strategy. Share insights, documents, and consultant conversations with controlled access.

---

## Additional P1 Feature Categories

Beyond the core P1 features in the registry, the following categories represent areas for future P1 development:

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

## P1.7 - Subscription Management & Payment Integration

### Overview

The subscription and payment system enables users to select and pay for service tiers, manage their subscriptions, and unlock premium features based on their plan.

### Current State (Phase 2 - In Progress)

**Implemented:**
- ✅ `/subscribe` route displays pricing tiers (Starter, Professional, Premium)
- ✅ Pricing page shows features and pricing for each tier
- ✅ Auth flow redirects to `/subscribe` after sign in/sign up
- ✅ Selected tier stored in localStorage
- ✅ User can click through subscription flow (no payment required)

**Not Yet Implemented:**
- ❌ Stripe payment integration
- ❌ `user_subscriptions` database table
- ❌ Subscription status tracking in database
- ❌ Active subscription check and enforcement
- ❌ Upgrade/downgrade functionality
- ❌ Billing portal for subscription management
- ❌ Feature gating based on subscription tier
- ❌ Usage tracking (messages, avatars, documents per tier)
- ❌ Payment webhooks for subscription lifecycle events

### P1 Requirements (Future Phases)

#### P1.7.1 - Database Schema

Create `user_subscriptions` table:

```sql
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')) DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id) -- One active subscription per user
);

-- RLS policies
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON public.user_subscriptions(stripe_customer_id);
```

#### P1.7.2 - Stripe Integration

**Setup Requirements:**
- Stripe account and API keys (test + production)
- Stripe webhook endpoint configuration
- Product and price IDs in Stripe dashboard

**Implementation Steps:**

1. **Checkout Session Creation**
   - Create Edge Function: `create-checkout-session`
   - Accept tier selection and user info
   - Create Stripe checkout session
   - Redirect to Stripe hosted checkout

2. **Webhook Handler**
   - Create Edge Function: `stripe-webhooks`
   - Handle events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Update `user_subscriptions` table based on webhook events
   - Send confirmation emails

3. **Billing Portal**
   - Create Edge Function: `create-portal-session`
   - Redirect users to Stripe Customer Portal
   - Allow users to manage payment methods, view invoices, cancel subscriptions

#### P1.7.3 - Subscription Status UI

**PricingPaywall Component Updates:**
- Show "Current Plan" badge on user's active tier
- Show "Upgrade" button for higher tiers
- Show "Manage Subscription" button for current tier
- Disable "Downgrade" temporarily (require manual support)

**Dashboard Component:**
- Display current subscription tier and status
- Show renewal date or trial end date
- Link to billing portal for subscription management
- Display usage metrics (messages used, avatars created, etc.)

#### P1.7.4 - Feature Gating

**Implementation:**
- Create `useSubscription` hook to fetch user's current subscription
- Check subscription tier before allowing feature access
- Graceful degradation (show upgrade prompt when limit reached)

**Usage Tracking:**
- Track AI chat messages per billing cycle
- Track brand avatars created
- Track documents uploaded
- Display usage meters on dashboard

**Limits Enforcement:**
```typescript
interface TierLimits {
  starter: {
    chatMessages: 50,
    avatars: 1,
    documents: 0,
    chatHistory: '30 days'
  },
  professional: {
    chatMessages: 200,
    avatars: 3,
    documents: 5,
    chatHistory: '1 year'
  },
  premium: {
    chatMessages: -1, // unlimited
    avatars: -1,
    documents: -1,
    chatHistory: 'unlimited'
  }
}
```

#### P1.7.5 - Implementation Path

**P1 Phase (Stripe Setup - Week 1)**
- Set up Stripe account and products
- Create database schema for subscriptions
- Build Edge Functions for checkout and webhooks

**P1 Phase (Payment Flow - Week 2)**
- Integrate Stripe Checkout into `/subscribe` page
- Handle successful payment and subscription activation
- Test subscription creation flow end-to-end

**P1 Phase (Subscription Management - Week 3)**
- Build billing portal integration
- Add subscription status display to dashboard
- Implement upgrade/downgrade logic

**P1 Phase (Feature Gating - Week 4)**
- Implement usage tracking
- Add feature gates based on subscription tier
- Build usage meters and upgrade prompts

### Success Criteria

- ✅ Users can successfully subscribe using Stripe
- ✅ Subscription status accurately reflected in database
- ✅ Users can manage billing through Stripe portal
- ✅ Feature access properly gated by subscription tier
- ✅ Usage limits enforced with graceful upgrade prompts
- ✅ Webhook events properly update subscription status
- ✅ No payment data stored outside of Stripe (PCI compliance)

### TODOs / Notes

- **Security**: Never store payment card details - Stripe handles all PCI compliance
- **Testing**: Use Stripe test mode extensively before production launch
- **Webhooks**: Implement retry logic and idempotency for webhook handling
- **Support**: Create admin interface to view/manage user subscriptions
- **Trials**: Consider offering 7-day or 14-day free trial for Professional/Premium tiers
- **Coupons**: Implement coupon/promo code support for beta users
- **Annual Plans**: Consider offering annual billing at discounted rate

---

## P1.8 - Email Support Contact

### Overview

Add email support functionality to allow users to contact the IDEA Brand Coach team directly via email.

### Email Address

**Support Email:** `contact@ideabrandconsultancy.com`

### Implementation Options

#### Option A: Simple Mailto Link (Quick)
- Add "Contact Support" link to Help section
- Uses native mailto: link
- Zero backend required
- Example: `<a href="mailto:contact@ideabrandconsultancy.com">Contact Support</a>`

#### Option B: Contact Form with Email (Recommended)
- Create contact form UI component
- Capture: name, email, subject, message
- Edge Function sends email via Resend API
- Sends confirmation to user + notification to support team

### Edge Function Requirements (Option B)

**Required Setup:**
1. Resend.com account and API key (`RESEND_API_KEY`)
2. Verified email domain at https://resend.com/domains
3. Edge function: `send-support-email`

### UI Placement

- Start Here page "Need Help?" section
- Footer contact link
- Help menu in navigation
- Brand Coach "Need more help?" prompt

### Priority

**Low priority** - Can use simple mailto link initially, upgrade to contact form in later P1 phase.

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
| **Dashboard** | ❌ Deferred to P1 | ✅ Full analytics, history, charts |
| **Home Navigation** | ❌ Hidden in P0 | ✅ Visible in P1+ |
| **IDEA Framework Modules** | ❌ Deferred | ✅ 4 deep-dive modules |
| **Framework Submissions** | ❌ Deferred | ✅ Progress tracking |
| **Avatar Builder** | ✅ Available in P0 | ✅ Enhanced version |
| **Brand Canvas** | ✅ Available in P0 | ✅ Enhanced version |
| **Value Lens** | ✅ Available in P0 | ✅ Enhanced version |
| **Document Upload** | ❌ Deferred (schema ready) | ✅ Full upload + RAG |
| **PDF/PPT Export** | ❌ Not planned | ✅ Professional reports |
| **Team Collaboration** | ❌ Deferred to P1 | ✅ Q2 2026 |
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

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-07 | 1.0 | Extracted from P0_BETA_LAUNCH_ROADMAP.md v1.3 | Claude Code |
| 2025-11-24 | 2.0 | **Updated to reflect Feature Registry system:**<br>- Added Feature Registry System overview<br>- Documented P1 core features from features.ts<br>- Moved Dashboard from P0 to P1<br>- Added Home navigation visibility gating<br>- Updated feature comparison table<br>- Aligned with centralized feature configuration | Claude Code |
