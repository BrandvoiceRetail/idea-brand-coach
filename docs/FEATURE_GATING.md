# Feature Gating System

**Purpose:** Central control of feature visibility via deployment phases and dynamic feature flags.
**Strategy:** Phase-based gating (P0/P1/P2) for major releases + dynamic runtime flags for gradual rollouts.

---

## Overview

The IDEA Brand Coach uses two complementary feature gating layers:

### 1. Phase-Based Gating (Compile-Time)
- Controlled by `VITE_DEPLOYMENT_PHASE` environment variable
- Features organized into phases: P0 (Beta), P1 (Enhanced), P2 (Advanced)
- Configuration in `src/config/features.ts`
- Used for major feature rollouts

### 2. Dynamic Feature Flags (Runtime)
- Controlled by `LOCAL_FEATURE_FLAGS` in `src/hooks/useFeatureFlag.ts`
- For gradual rollouts, A/B testing, and kill switches
- Real-time toggling via Admin UI at `/admin/feature-flags`
- **Local-only** (changes not persisted to database)

### Architecture Diagram

```
Feature Flag System
├── Phase-Based Gating (src/config/features.ts)
│   ├── Major releases
│   ├── Compile-time, environment variable
│   └── Phases: P0 / P1 / P2
└── Dynamic Flags (src/hooks/useFeatureFlag.ts)
    ├── Gradual rollouts
    ├── A/B testing
    ├── Kill switches
    └── Runtime control
```

Use BOTH for maximum control: `<FeatureGate>` wraps pages (phase-based), `useFeatureFlag()` for sub-features (dynamic).

---

## Quick Start

### Environment Setup

```bash
# .env.local
VITE_DEPLOYMENT_PHASE=P0  # P0, P1, or P2
```

### Import Statements

```typescript
// Static gating
import FeatureGate from '@/components/FeatureGate';
import { isFeatureAvailable, getCurrentPhase } from '@/config/features';

// Dynamic flags
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
```

### Usage Patterns

**Protect entire page:**
```tsx
<FeatureGate feature="BRAND_CANVAS">
  <YourComponent />
</FeatureGate>
```

**Conditional UI element:**
```tsx
const currentPhase = getCurrentPhase();
{isFeatureAvailable('BRAND_ANALYTICS', currentPhase) && (
  <AnalyticsButton />
)}
```

**Dynamic feature flag:**
```tsx
const isEnabled = useFeatureFlag('advanced_analytics', false);
{isEnabled && <AdvancedFeatures />}
```

**Custom coming soon page:**
```tsx
<FeatureGate
  feature="TEAM_COLLABORATION"
  comingSoonConfig={{
    title: 'Coming Soon',
    description: 'Feature description',
    estimatedRelease: 'Q2 2026',
  }}
>
  <YourComponent />
</FeatureGate>
```

**Combined gating (phase + flag):**
```tsx
<FeatureGate feature="BRAND_ANALYTICS">
  <BasicAnalytics />
  {useFeatureFlag('advanced_analytics', false) && <AdvancedAnalytics />}
</FeatureGate>
```

---

## Implementation Guide

### Current Features by Phase

#### P0 (Beta Launch - Always Enabled)
- BRAND_DIAGNOSTIC - 6-question IDEA assessment
- BRAND_AVATAR - Customer persona builder
- INTERACTIVE_INSIGHT - Deep customer insights and interactive learning
- BRAND_COACH - AI brand consultant with RAG
- BRAND_CANVAS - Visual brand strategy builder
- BRAND_COPY_GENERATOR - AI-powered brand copywriting
- DASHBOARD - Brand coaching dashboard
- DOCUMENT_UPLOAD - Upload brand documents (not in nav)
- CONVERSATION_HISTORY - Access past sessions (not in nav)

#### P1 (Enhanced - Enabled when phase >= P1)
- IDEA_FRAMEWORK - Learn the IDEA Strategic Brand Framework
- FRAMEWORK_SUBMISSIONS - Track IDEA framework progress
- TEAM_COLLABORATION - Invite team members

#### P2 (Advanced - Enabled when phase >= P2)
- BRAND_ANALYTICS - Performance metrics dashboard
- COMPETITIVE_ANALYSIS - AI competitor insights
- BRAND_INSIGHTS_LIBRARY - Curated resources
- AI_WORKSHOP_FACILITATOR - Guided workshops

### Adding a New Feature to the Registry

**Step 1:** Define in `src/config/features.ts`:

```typescript
export const FEATURES: Record<string, Feature> = {
  MY_NEW_FEATURE: {
    id: 'MY_NEW_FEATURE',
    name: 'My New Feature',
    shortDescription: 'Brief description for cards',
    fullDescription: 'Detailed description for coming soon page',
    phase: 'P1',
    route: '/my-feature',
    icon: Sparkles,
    statusMessage: 'Coming Soon',
    estimatedRelease: 'Q2 2026',
    showInNav: true,
    category: 'core',
    requiresAuth: true,
  },
};
```

**Step 2:** Wrap your component:

```tsx
<FeatureGate feature="MY_NEW_FEATURE">
  <MyFeatureComponent />
</FeatureGate>
```

Navigation is automatically filtered by phase in `src/components/Layout.tsx`.

### Adding a Dynamic Feature Flag

**Step 1:** Define the flag in `src/hooks/useFeatureFlag.ts`:

```typescript
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  'my-new-feature': {
    name: 'my-new-feature',
    enabled: true,
    targeting_rules: {
      sessionPercentage: 0,  // Start at 0% (disabled)
    },
  },
};
```

**Flag Configuration Options:**

```typescript
interface FeatureFlag {
  name: string;                // Unique flag name (kebab-case)
  enabled: boolean;            // Global on/off switch
  targeting_rules?: {
    userIds?: string[];        // Whitelist specific user IDs
    percentage?: number;       // User-based rollout (0-100)
    sessionPercentage?: number; // Session-based rollout (0-100)
  };
}
```

**Step 2:** Use in your component:

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function MyFeature() {
  const isV2Enabled = useFeatureFlag('my-new-feature', false);

  if (isV2Enabled) {
    return <NewFeatureV2 />;
  }
  return <LegacyFeatureV1 />;
}
```

### When to Use Which

**Use Phase-Based Gating for:**
- Major phase transitions (P0 -> P1 -> P2)
- Simple on/off features tied to a release phase
- Page-level feature gating

**Use Dynamic Feature Flags for:**
- Gradual rollouts (10% -> 50% -> 100%)
- A/B testing different UX approaches
- Kill switches for high-risk features
- Beta sub-features within a phase

**Do NOT use flags for:**
- Temporary debug code (use `import.meta.env.DEV`)
- Permanent configuration (use environment variables or user preferences)

### Gradual Rollout Process

Follow this standard rollout process:

1. **Development (0%):** Deploy with flag disabled. Test locally with `enabled: true`.
2. **Internal Testing (Whitelist):** Enable for team via `userIds`. Duration: 1-3 days.
3. **Canary (10%):** Enable `sessionPercentage: 10`. Monitor errors, performance, feedback. Duration: 3-7 days.
4. **Expansion (50%):** Increase to 50%. Continue monitoring. Duration: 3-7 days.
5. **Full Rollout (100%):** Enable for all. Monitor 7-14 days.
6. **Cleanup:** Remove flag from code, delete legacy code path.

**Rollback options:**
- **Admin UI:** Toggle flag off at `/admin/feature-flags` (instant, in-memory only)
- **Reduce percentage:** Lower the slider in admin UI
- **Code change:** Set `enabled: false` or `sessionPercentage: 0`

### Phase Transitions

To transition from P0 to P1:
1. Update `VITE_DEPLOYMENT_PHASE=P1` in environment
2. Redeploy application
3. Verify new features appear
4. Monitor for 24 hours

---

## API Reference

### FeatureGate Component

```tsx
<FeatureGate
  feature="FEATURE_ID"
  fallback={<CustomFallback />}
  comingSoonConfig={{
    title: string;
    description: string;
    icon?: 'construction' | 'sparkles';
    estimatedRelease?: string;
    showCTA?: boolean;
    ctaText?: string;
    onCTAClick?: () => void;
  }}
>
  <ProtectedContent />
</FeatureGate>
```

### useFeatureFlag Hook

```typescript
const isEnabled = useFeatureFlag(
  'flag_name',        // Flag name
  false,              // Default value
  {
    defaultValue?: boolean;
    userId?: string;
    sessionId?: string;
  }
);
```

### Feature Registry Functions

```typescript
// Check if feature is available in current phase
isFeatureAvailable(featureId: FeatureId, phase: DeploymentPhase): boolean

// Get current deployment phase
getCurrentPhase(): DeploymentPhase

// Get navigation features for a phase
getNavigationFeatures(phase: DeploymentPhase): Feature[]

// Get all features for a phase
getFeaturesForPhase(phase: DeploymentPhase): Feature[]

// Get a single feature
getFeature(featureId: FeatureId): Feature

// Get feature status info
getFeatureStatus(featureId: FeatureId, phase: DeploymentPhase): {
  available: boolean;
  statusMessage: string;
  estimatedRelease: string;
}
```

### Percentage Distribution Testing

```typescript
import { testPercentageDistribution } from '@/hooks/useFeatureFlag';

const result = testPercentageDistribution(50, 1000);
// { targetPercentage: 50, sampleSize: 1000, enabledCount: 498,
//   actualPercentage: 49.8, deviation: 0.2 }
```

### Database Schema (for future persistent flags)

```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  targeting_rules JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feature_flag_evaluations (
  id UUID PRIMARY KEY,
  flag_name TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  evaluated_to BOOLEAN NOT NULL,
  context JSONB DEFAULT '{}',
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Troubleshooting

### Feature not showing after phase change
- Check `VITE_DEPLOYMENT_PHASE` value in `.env.local`
- Restart dev server (env changes require restart)
- Clear browser cache
- Check browser console for phase info

### Dynamic flag not working in production
- Verify flag is defined in `LOCAL_FEATURE_FLAGS` in code
- Confirm code was deployed (`git log --oneline -5`)
- Check `enabled: true` and `sessionPercentage > 0`
- Check browser console for useFeatureFlag errors

### Percentage rollout not distributing correctly
- Test with `testPercentageDistribution(50, 1000)` utility
- Clear sessionStorage: `sessionStorage.clear(); location.reload();`
- Ensure sample size is large enough (30+ reloads for manual testing)

### Flag changes not reflecting immediately
- Admin UI changes are in-memory only; they do not persist across refreshes or deploys
- For permanent changes, update `LOCAL_FEATURE_FLAGS` in code and deploy
- Try hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Users stuck on one variant
- By design: session ID persists in sessionStorage for consistent experience
- To simulate new session: `sessionStorage.removeItem('ff_session_id'); location.reload();`

### Wrong "Coming Soon" message
- Update feature config in `src/config/features.ts`
- Or use custom `comingSoonConfig` prop on `<FeatureGate>`

---

## Best Practices

### DO
- Start new flags at 0% rollout and deploy disabled
- Use meaningful kebab-case flag names (`v2-multi-avatar`, not `flag1`)
- Document flags with rollout plan in comments
- Test both V1 (flag off) and V2 (flag on) paths
- Monitor error rates, performance, and user feedback during rollouts
- Remove flags after stable 100% rollout (do not accumulate dead flags)
- Use `sessionPercentage` for anonymous users, `percentage` for authenticated

### DON'T
- Skip testing; always verify the fallback path
- Rush rollouts: follow the 0% -> 10% -> 50% -> 100% schedule over 2-3 weeks
- Nest more than one flag check per component
- Use flags for permanent config (use env vars or user preferences)
- Rely on admin UI for permanent changes (in-memory only)
- Hardcode feature checks (`if (true)`)

---

## File Locations

| Resource | Path |
|----------|------|
| Feature Registry | `src/config/features.ts` |
| FeatureGate Component | `src/components/FeatureGate.tsx` |
| ComingSoon Component | `src/components/ComingSoon.tsx` |
| useFeatureFlag Hook | `src/hooks/useFeatureFlag.ts` |
| Feature Gating Examples | `src/examples/feature-gating-examples.tsx` |
| Admin UI | `src/pages/admin/FeatureFlagAdmin.tsx` |
| DB Migration | `supabase/migrations/20251124_feature_flags.sql` |

---

## Common Scenarios

### Scenario 1: New P1 Feature
1. Add to `src/config/features.ts` with `phase: 'P1'`
2. Wrap component with `<FeatureGate feature="YOUR_FEATURE">`
3. Test with `VITE_DEPLOYMENT_PHASE=P0` (hidden) and `P1` (visible)

### Scenario 2: Gradual Rollout Within a Phase
1. Add feature to registry with appropriate phase
2. Define dynamic flag with `sessionPercentage: 0`
3. Use both: `<FeatureGate>` for page + `useFeatureFlag()` for sub-feature
4. Increase percentage: 10% -> 25% -> 50% -> 100%

### Scenario 3: Kill Switch
1. Create flag: `{ enabled: true }` with `useFeatureFlag('name', true)` (default ON)
2. To disable in emergency: Set `enabled: false` in code or admin UI
3. Change propagates immediately in current sessions

### Real-World Example: v2-multi-avatar

The multi-avatar interface rollout used session-based percentage targeting:

```typescript
'v2-multi-avatar': {
  name: 'v2-multi-avatar',
  enabled: true,
  targeting_rules: {
    sessionPercentage: 0,  // Start disabled, increase over weeks
  },
}
```

In `AvatarBuilder.tsx`:
```tsx
const isV2Enabled = useFeatureFlag('v2-multi-avatar', false);
if (isV2Enabled) return <MultiAvatarInterface />;
return <SingleAvatarBuilder />;
```

Rollout schedule: 0% (deploy) -> 10% (week 1) -> 50% (week 2) -> 100% (week 3) -> cleanup (week 6).
