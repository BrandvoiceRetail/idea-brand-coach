# Paywall Implementation Design Document

**Version:** 1.0
**Date:** 2025-01-30
**Status:** Design Phase
**Owner:** Product & Engineering Team

---

## Executive Summary

This document outlines the design and implementation plan for introducing a tiered subscription paywall into IDEA Brand Coach. The paywall will be presented **immediately after users complete the brand diagnostic** and **before account creation**, converting the diagnostic into a lead generation tool while monetizing access to the full platform.

### Business Model

- **$100 one-time setup fee** (all tiers)
- **Tier 1:** $25/month - Basic access
- **Tier 2:** $50/month - Professional access
- **Tier 3:** $150/month - Premium access

---

## Current Flow Analysis

### Existing User Journey

```
1. User visits /diagnostic (FreeDiagnostic.tsx)
2. User completes 6-question assessment
3. DiagnosticAuthModal shown (beta email capture)
4. User navigates to /diagnostic/results (DiagnosticResults.tsx)
5. Results displayed with CTA to sign up
6. User clicks sign up → /auth (Auth.tsx)
7. User creates account
8. User gains access to platform features
```

### Key Files in Current Flow

- `src/pages/FreeDiagnostic.tsx` - 6-question diagnostic
- `src/components/DiagnosticAuthModal.tsx` - Beta email capture modal
- `src/pages/DiagnosticResults.tsx` - Results display page
- `src/pages/Auth.tsx` - Sign up/sign in page
- `src/hooks/useDiagnostic.ts` - Diagnostic data management
- `src/hooks/useAuth.tsx` - Authentication management

---

## Proposed Flow with Paywall

### New User Journey

```
1. User visits /diagnostic (FreeDiagnostic.tsx)
2. User completes 6-question assessment
3. REMOVED: DiagnosticAuthModal (no longer shown)
4. User navigates to /paywall (NEW - PricingPaywall.tsx)
5. User sees diagnostic teaser + pricing tiers
6. User selects tier and pays (Stripe integration)
7. After payment success → /auth with email pre-filled
8. User creates account (required after payment)
9. Subscription status saved to database
10. User gains access to platform features based on tier
```

### Flow Diagram

```
┌─────────────────────┐
│  /diagnostic        │
│  (FreeDiagnostic)   │
│  Complete 6 Qs      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  /paywall           │  ◄── NEW PAGE
│  (PricingPaywall)   │
│  - Show diagnostic  │
│    teaser/preview   │
│  - Present 3 tiers  │
│  - $100 setup fee   │
│  - Monthly pricing  │
└──────────┬──────────┘
           │
           ├─────────────────┐
           │                 │
    User Pays         User Exits
           │                 │
           ▼                 ▼
┌─────────────────────┐   (Lost lead -
│  Stripe Checkout    │    follow-up via
│  Process Payment    │    email if captured)
└──────────┬──────────┘
           │
    Payment Success
           │
           ▼
┌─────────────────────┐
│  /auth?             │
│  email=xxx&         │
│  plan=tier2&        │
│  payment_id=xxx     │
│                     │
│  Create Account     │
│  (required)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Save subscription  │
│  to database        │
│  Grant access       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  /dashboard or      │
│  /idea/consultant   │
│  Full platform      │
│  access             │
└─────────────────────┘
```

---

## Pricing Tiers Design

### Tier Structure

| Feature | Tier 1: Starter<br>$25/mo | Tier 2: Professional<br>$50/mo | Tier 3: Premium<br>$150/mo |
|---------|---------------------------|--------------------------------|----------------------------|
| **Setup Fee** | $100 one-time | $100 one-time | $100 one-time |
| **Brand Diagnostic** | ✅ Full access | ✅ Full access | ✅ Full access |
| **AI Brand Coach** | ✅ 50 messages/mo | ✅ 200 messages/mo | ✅ Unlimited |
| **Brand Canvas** | ✅ View only | ✅ Full editing | ✅ Full editing + Export |
| **Brand Avatar Builder** | ✅ 1 avatar | ✅ 3 avatars | ✅ Unlimited avatars |
| **Document Upload** | ❌ Not available | ✅ 5 documents | ✅ Unlimited documents |
| **Chat History** | 30 days | 1 year | Unlimited |
| **Brand Copy Generator** | ❌ Not available | ✅ Limited templates | ✅ All templates |
| **Export/Download** | ❌ Not available | ✅ PDF export | ✅ PDF + MD + DOCX |
| **Priority Support** | ❌ | ❌ | ✅ |
| **1:1 Consultation** | ❌ | ❌ | ✅ 1 hour/quarter |

### Pricing Psychology

- **Setup fee** creates commitment and filters serious users
- **Tier 1** positioned as entry point for solopreneurs
- **Tier 2** positioned as "most popular" (anchor pricing)
- **Tier 3** positioned as premium for agencies/larger brands

---

## Technical Implementation Plan

### Phase 1: Frontend Components (Week 1)

#### 1.1 Create PricingPaywall Component

**File:** `src/pages/PricingPaywall.tsx`

```tsx
interface PricingTier {
  id: 'starter' | 'professional' | 'premium';
  name: string;
  monthlyPrice: number;
  setupFee: number;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export default function PricingPaywall() {
  // Component logic
  // - Display diagnostic preview/teaser
  // - Show 3 pricing cards
  // - Handle tier selection
  // - Integrate Stripe checkout
}
```

**Key Features:**
- Diagnostic results teaser (limited preview)
- 3 pricing cards with feature comparison
- "Most Popular" badge on Tier 2
- Setup fee prominently displayed
- CTA buttons to start Stripe checkout

#### 1.2 Update FreeDiagnostic Component

**File:** `src/pages/FreeDiagnostic.tsx`

**Changes:**
```diff
- setShowBetaCapture(true);
+ navigate('/paywall');
```

**Remove:**
- DiagnosticAuthModal integration
- Beta email capture logic

**Keep:**
- Store diagnostic data to localStorage
- Calculate scores and results

#### 1.3 Update Routing

**File:** `src/App.tsx`

```tsx
import PricingPaywall from "./pages/PricingPaywall";

// Add route
<Route path="/paywall" element={<PricingPaywall />} />
```

#### 1.4 Update Auth Component

**File:** `src/pages/Auth.tsx`

**Changes:**
- Accept URL params: `?email=xxx&plan=tier&payment_id=xxx`
- Pre-fill email field if provided
- Show "Complete your account setup" messaging if coming from paywall
- Save subscription metadata after account creation

---

### Phase 2: Payment Integration (Week 2)

#### 2.1 Stripe Setup

**Required:**
- Stripe account (test + production)
- Create 3 Price objects in Stripe:
  - `price_starter_monthly` ($25/month recurring)
  - `price_professional_monthly` ($50/month recurring)
  - `price_premium_monthly` ($150/month recurring)
- Create 1 Price object for setup fee:
  - `price_setup_fee` ($100 one-time)

**Stripe Checkout Session Flow:**
1. User clicks "Subscribe" on tier
2. Frontend calls Supabase Edge Function: `create-checkout-session`
3. Edge function creates Stripe checkout with:
   - Selected recurring price
   - Setup fee (one-time)
   - Customer email (if available)
   - Success URL: `/auth?session_id={CHECKOUT_SESSION_ID}`
   - Cancel URL: `/paywall`
4. User completes payment
5. Redirected back to `/auth` with session_id
6. Frontend verifies payment and creates account

#### 2.2 Supabase Edge Function

**File:** `supabase/functions/create-checkout-session/index.ts`

```typescript
import Stripe from 'stripe';

export default async function handler(req: Request) {
  const { priceId, email } = await req.json();

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: priceId, // recurring price
        quantity: 1,
      },
      {
        price: 'price_setup_fee', // one-time setup fee
        quantity: 1,
      }
    ],
    customer_email: email,
    success_url: `${req.headers.get('origin')}/auth?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/paywall`,
    metadata: {
      source: 'brand_diagnostic',
    }
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

#### 2.3 Stripe Webhook Handler

**File:** `supabase/functions/stripe-webhook/index.ts`

**Handles:**
- `checkout.session.completed` - Save subscription to database
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Mark subscription as cancelled
- `invoice.payment_failed` - Handle failed payments

---

### Phase 3: Database Schema (Week 2)

#### 3.1 New Tables

**Table: `subscriptions`**

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

**Table: `payment_transactions`**

```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- amount in cents
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_stripe_payment_intent_id ON payment_transactions(stripe_payment_intent_id);
```

#### 3.2 Update Existing Tables

**Table: `profiles`**

```sql
ALTER TABLE profiles
ADD COLUMN subscription_tier TEXT DEFAULT 'none' CHECK (subscription_tier IN ('none', 'starter', 'professional', 'premium')),
ADD COLUMN subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due'));
```

#### 3.3 Row Level Security (RLS) Policies

```sql
-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only authenticated users can view their own payment transactions
CREATE POLICY "Users can view own transactions"
  ON payment_transactions FOR SELECT
  USING (auth.uid() = user_id);
```

---

### Phase 4: Access Control & Feature Gating (Week 3)

#### 4.1 Subscription Check Hook

**File:** `src/hooks/useSubscription.ts`

```typescript
export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!error && data) {
        setSubscription(data);
      }
      setIsLoading(false);
    };

    fetchSubscription();
  }, [user]);

  return {
    subscription,
    isLoading,
    tier: subscription?.tier || 'none',
    isActive: subscription?.status === 'active',
    hasAccess: (feature: string) => checkFeatureAccess(subscription?.tier, feature)
  };
}

function checkFeatureAccess(tier: string | undefined, feature: string): boolean {
  // Feature access matrix
  const accessMatrix = {
    'starter': ['diagnostic', 'chat_basic', 'avatar_single', 'canvas_view'],
    'professional': ['diagnostic', 'chat_pro', 'avatar_multi', 'canvas_edit', 'docs_limited', 'export_pdf'],
    'premium': ['diagnostic', 'chat_unlimited', 'avatar_unlimited', 'canvas_full', 'docs_unlimited', 'export_all', 'priority_support', 'consultation']
  };

  if (!tier || tier === 'none') return false;
  return accessMatrix[tier]?.includes(feature) || false;
}
```

#### 4.2 Protected Route Component

**File:** `src/components/SubscriptionGate.tsx`

```typescript
interface SubscriptionGateProps {
  requiredTier: 'starter' | 'professional' | 'premium';
  feature?: string;
  children: React.ReactNode;
}

export function SubscriptionGate({ requiredTier, feature, children }: SubscriptionGateProps) {
  const { tier, isActive, hasAccess } = useSubscription();

  if (!isActive) {
    return <UpgradePrompt message="Subscribe to access this feature" />;
  }

  if (feature && !hasAccess(feature)) {
    return <UpgradePrompt message="Upgrade your plan to unlock this feature" />;
  }

  const tierLevel = { none: 0, starter: 1, professional: 2, premium: 3 };
  if (tierLevel[tier] < tierLevel[requiredTier]) {
    return <UpgradePrompt message={`Upgrade to ${requiredTier} tier to access this feature`} />;
  }

  return <>{children}</>;
}
```

#### 4.3 Apply Gates to Features

**Example: Brand Coach Chat**

```tsx
// src/pages/IdeaFrameworkConsultant.tsx
<SubscriptionGate requiredTier="starter" feature="chat_basic">
  <ChatInterface />
</SubscriptionGate>
```

**Example: Document Upload**

```tsx
// src/components/DocumentUpload.tsx
<SubscriptionGate requiredTier="professional" feature="docs_limited">
  <DocumentUploadForm />
</SubscriptionGate>
```

---

### Phase 5: User Experience Enhancements (Week 3-4)

#### 5.1 Subscription Management Page

**File:** `src/pages/SubscriptionManagement.tsx`

**Features:**
- Current plan details
- Billing history
- Upgrade/downgrade options
- Cancel subscription
- Update payment method (Stripe Customer Portal)

#### 5.2 Usage Tracking

**For metered features (Tier 1 & 2):**
- Track AI chat message count per month
- Track document uploads
- Display usage meters in UI
- Soft limits with upgrade prompts

**File:** `src/hooks/useUsageTracking.ts`

#### 5.3 Email Notifications

**Trigger emails for:**
- Payment success
- Subscription created
- Payment failed
- Subscription ending soon
- Upgrade prompts based on usage

---

## Migration Strategy

### Pre-Launch Checklist

- [ ] **Stripe account configured** (test + production)
- [ ] **Pricing tiers created in Stripe**
- [ ] **Database schema migrated**
- [ ] **Edge functions deployed**
- [ ] **Webhook endpoint configured**
- [ ] **RLS policies applied**
- [ ] **Frontend components built and tested**
- [ ] **Payment flow tested end-to-end**
- [ ] **Email templates created**
- [ ] **Error handling implemented**
- [ ] **Analytics tracking configured**
- [ ] **Legal pages updated** (Terms, Privacy Policy, Refund Policy)

### Rollout Plan

#### Option A: Hard Launch (Recommended for Beta)

1. Deploy paywall to production
2. Update `/diagnostic` flow immediately
3. Existing users grandfathered (free access)
4. New users see paywall after diagnostic

#### Option B: Gradual Rollout

1. Deploy paywall behind feature flag
2. Enable for 10% of new users (A/B test)
3. Monitor conversion rates
4. Gradually increase to 100%

### Handling Existing Users

**Strategy: Grandfather existing beta users**

- Users who signed up before paywall launch get free "legacy" tier
- Legacy tier = Tier 2 (Professional) features
- Add `grandfathered: true` flag to profiles table
- Display "Legacy Beta User" badge in account settings

```sql
UPDATE profiles
SET subscription_tier = 'legacy',
    subscription_status = 'active'
WHERE created_at < '2025-02-15'; -- Paywall launch date
```

---

## Revenue Projections

### Assumptions

- 1,000 diagnostics completed per month
- 10% conversion rate to paid (conservative)
- Tier distribution: 40% Starter, 50% Professional, 10% Premium

### Monthly Recurring Revenue (MRR)

| Tier | Conversions | Monthly Price | MRR |
|------|-------------|---------------|-----|
| Starter | 40 | $25 | $1,000 |
| Professional | 50 | $50 | $2,500 |
| Premium | 10 | $150 | $1,500 |
| **Total** | **100** | - | **$5,000** |

### Setup Fee Revenue

- 100 conversions × $100 = **$10,000/month one-time**

### First Year Projection

- MRR Month 1: $5,000
- MRR Month 12: $60,000 (assuming growth)
- Setup fees: $120,000 (100 conversions/month × 12 months)
- **Total Year 1: ~$180,000 - $240,000**

---

## Risk Mitigation

### Risk 1: Low Conversion Rate

**Mitigation:**
- Offer 7-day free trial (no setup fee)
- Show compelling value in diagnostic results preview
- Add testimonials and social proof
- Implement exit-intent popup with discount

### Risk 2: Payment Processing Issues

**Mitigation:**
- Comprehensive error handling
- Multiple payment retry attempts
- Clear error messaging
- Backup payment collection via invoice

### Risk 3: Churn Rate

**Mitigation:**
- Engagement emails during first 30 days
- Proactive customer success outreach
- Usage analytics to identify at-risk users
- Win-back campaigns for churned users

### Risk 4: Refund Requests

**Mitigation:**
- Clear refund policy (30-day money-back guarantee?)
- Setup fee non-refundable (stated clearly)
- Proactive support for struggling users
- Exit survey to understand cancellation reasons

---

## Success Metrics

### Primary KPIs

- **Conversion Rate:** Diagnostic completions → Paid subscriptions
- **MRR Growth:** Month-over-month recurring revenue
- **Churn Rate:** Monthly subscription cancellations
- **Customer Lifetime Value (LTV):** Average revenue per customer
- **Customer Acquisition Cost (CAC):** Marketing spend / new customers

### Secondary KPIs

- **Average Revenue Per User (ARPU)**
- **Tier distribution** (% in each tier)
- **Time to first payment** (diagnostic → payment)
- **Payment success rate**
- **Upgrade rate** (Tier 1 → Tier 2 → Tier 3)

### Target Goals (Month 3)

- Conversion rate: >10%
- Churn rate: <5%
- MRR: >$10,000
- LTV:CAC ratio: >3:1

---

## Technical Dependencies

### Required Services

- ✅ **Stripe** - Payment processing, subscription management
- ✅ **Supabase** - Database, authentication, edge functions
- ⚠️ **Email Service** - Transactional emails (Resend, SendGrid, or Postmark)
- ⚠️ **Analytics** - Conversion tracking (PostHog, Mixpanel, or Amplitude)

### Environment Variables

```env
# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Pricing IDs
VITE_STRIPE_PRICE_STARTER=price_xxx
VITE_STRIPE_PRICE_PROFESSIONAL=price_xxx
VITE_STRIPE_PRICE_PREMIUM=price_xxx
VITE_STRIPE_PRICE_SETUP_FEE=price_xxx
```

---

## Implementation Timeline

### Week 1: Frontend & UX
- ✅ Design paywall page mockup
- ✅ Create PricingPaywall component
- ✅ Update FreeDiagnostic flow
- ✅ Update routing
- ✅ Build subscription gate components

### Week 2: Backend & Payments
- ✅ Set up Stripe account
- ✅ Create Stripe products/prices
- ✅ Build checkout session edge function
- ✅ Build webhook handler edge function
- ✅ Create database schema
- ✅ Apply RLS policies

### Week 3: Feature Gating & Access Control
- ✅ Build useSubscription hook
- ✅ Implement feature access checks
- ✅ Apply gates to protected features
- ✅ Build usage tracking
- ✅ Create subscription management page

### Week 4: Testing & Launch
- ✅ End-to-end payment testing (test mode)
- ✅ Test all tier access levels
- ✅ Test webhook processing
- ✅ Load testing
- ✅ Deploy to production
- ✅ Monitor first 100 conversions

---

## Open Questions

1. **Trial period?** Should we offer a 7-day free trial instead of/in addition to setup fee?
2. **Annual pricing?** Offer annual plans with discount (e.g., 2 months free)?
3. **Refund policy?** 30-day money-back guarantee? Setup fee refundable?
4. **Failed payments?** How many retry attempts before downgrading/suspending?
5. **Grandfather existing users?** Free access or discounted pricing?
6. **Usage overage fees?** Charge extra if Tier 1/2 users exceed limits, or just soft limit with upgrade prompt?

---

## Next Steps

1. **Review & Approve** this design document with stakeholders
2. **Answer open questions** above
3. **Set up Stripe account** and configure pricing
4. **Start Week 1 implementation** (frontend components)
5. **Schedule weekly progress reviews**

---

## Appendix

### A. Competitor Pricing Analysis

| Competitor | Entry Price | Mid-Tier | Premium | Notes |
|------------|-------------|----------|---------|-------|
| Brand Strategy Tool A | $29/mo | $79/mo | $199/mo | No setup fee |
| Brand Strategy Tool B | $49/mo | $99/mo | $249/mo | 14-day trial |
| AI Consultant C | Free | $25/mo | $100/mo | Freemium model |

**Positioning:** Our $100 setup fee + $25-150/mo positions us as a premium, commitment-based tool.

### B. Legal Considerations

- **Terms of Service** must clearly state subscription terms
- **Privacy Policy** must cover payment data handling
- **Refund Policy** must be clearly communicated before purchase
- **Auto-renewal disclosure** required by FTC
- **Sales tax** collection may be required (Stripe Tax can handle this)

### C. Customer Support Requirements

- **Payment issues** - Priority support queue
- **Subscription changes** - Self-service + manual override
- **Refund requests** - Defined SLA (24-48 hours)
- **Technical issues** - Different SLA by tier (Premium = priority)

---

**Document Status:** Draft for Review
**Last Updated:** 2025-01-30
**Next Review:** After stakeholder approval
