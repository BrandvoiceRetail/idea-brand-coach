# Feature Gating System - Implementation Guide

**Purpose:** Central control of feature visibility based on deployment phase and dynamic feature flags
**Benefit:** One environment variable + database-backed flags control entire feature set
**Strategy:** Phase-based gating (P0 → P1 → P2) + Dynamic runtime flags

---

## Architecture Overview

The feature gating system has two layers:

### 1. Static Phase-Based Gating (Compile-Time)
- Controlled by `VITE_DEPLOYMENT_PHASE` environment variable
- Features organized into phases: P0 (Beta), P1 (Enhanced), P2 (Advanced)
- Configuration in `src/config/features.ts`
- Used for major feature rollouts

### 2. Dynamic Feature Flags (Runtime)
- Database-backed flags in Supabase
- Real-time updates via Supabase subscriptions
- Support for user/session targeting and percentage rollouts
- Used for gradual rollouts, A/B testing, and kill switches

---

## Quick Start

### 1. Set Deployment Phase

**Local Development (.env.local):**
```bash
# P0 Launch - Beta features only
VITE_DEPLOYMENT_PHASE=P0

# P1 Launch - Add collaboration features
VITE_DEPLOYMENT_PHASE=P1

# P2 Launch - All features
VITE_DEPLOYMENT_PHASE=P2
```

**Production (Environment Variables):**
1. Set in your hosting platform (Vercel, Amplify, etc.)
2. Add variable:
   - Key: `VITE_DEPLOYMENT_PHASE`
   - Value: `P0` (or `P1`, `P2`)
3. Redeploy application

### 2. Use Static Feature Gating

**Method 1: FeatureGate Component (Recommended)**
```tsx
import FeatureGate from '@/components/FeatureGate';

export default function BrandCanvasPage() {
  return (
    <FeatureGate feature="BRAND_CANVAS">
      {/* This content only shows in P1+ */}
      <BrandCanvasEditor />
    </FeatureGate>
  );
}
```

**Method 2: Programmatic Check**
```tsx
import { isFeatureAvailable, getCurrentPhase } from '@/config/features';

export default function Navigation() {
  const currentPhase = getCurrentPhase();

  return (
    <nav>
      <Link href="/diagnostic">Brand Diagnostic</Link>
      {isFeatureAvailable('BRAND_CANVAS', currentPhase) && (
        <Link href="/canvas">Brand Canvas</Link>
      )}
      {isFeatureAvailable('BRAND_ANALYTICS', currentPhase) && (
        <Link href="/analytics">Analytics</Link>
      )}
    </nav>
  );
}
```

### 3. Use Dynamic Feature Flags

**Method 1: useFeatureFlag Hook**
```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export default function BrandAnalytics() {
  const isAdvancedAnalyticsEnabled = useFeatureFlag('advanced_analytics', false);

  return (
    <div>
      <BasicAnalytics />
      {isAdvancedAnalyticsEnabled && <AdvancedAnalytics />}
    </div>
  );
}
```

**Method 2: Combined Gating**
```tsx
import FeatureGate from '@/components/FeatureGate';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export default function BrandCanvasPage() {
  const isExportEnabled = useFeatureFlag('brand_canvas_export', false);

  return (
    <FeatureGate feature="BRAND_CANVAS">
      <BrandCanvasEditor />
      {isExportEnabled && <ExportButton />}
    </FeatureGate>
  );
}
```

---

## Feature Hierarchy

### P0 Features (Beta Launch - Always Enabled)
```
✅ BRAND_DIAGNOSTIC          - 6-question IDEA assessment
✅ BRAND_AVATAR              - Customer persona builder
✅ INTERACTIVE_INSIGHT       - Deep customer insights and interactive learning
✅ BRAND_COACH               - AI brand consultant with RAG
✅ BRAND_CANVAS              - Visual brand strategy builder
✅ BRAND_COPY_GENERATOR      - AI-powered brand copywriting
✅ DASHBOARD                 - Brand coaching dashboard
✅ DOCUMENT_UPLOAD           - Upload brand documents (not in nav)
✅ CONVERSATION_HISTORY      - Access past sessions (not in nav)
```

### P1 Features (Enhanced - Enabled when phase >= P1)
```
✅ IDEA_FRAMEWORK            - Learn the IDEA Strategic Brand Framework
✅ FRAMEWORK_SUBMISSIONS     - Track IDEA framework progress
✅ TEAM_COLLABORATION        - Invite team members
```

### P2 Features (Advanced - Enabled when phase >= P2)
```
✅ BRAND_ANALYTICS           - Performance metrics dashboard
✅ COMPETITIVE_ANALYSIS      - AI competitor insights
✅ BRAND_INSIGHTS_LIBRARY    - Curated resources
✅ AI_WORKSHOP_FACILITATOR   - Guided workshops
```

---

## Managing Dynamic Feature Flags

### Creating Feature Flags (Admin Only)

**Via Supabase Dashboard:**
1. Navigate to Table Editor → `feature_flags`
2. Insert new row:
   ```json
   {
     "name": "new_feature",
     "description": "Description of the feature",
     "enabled": true,
     "targeting_rules": {
       "percentage": 10,
       "userIds": ["user-id-1", "user-id-2"]
     },
     "metadata": {
       "owner": "team-name",
       "phase": "P1"
     }
   }
   ```

### Targeting Rules

**1. Global On/Off**
```json
{
  "enabled": true,
  "targeting_rules": {}
}
```

**2. Specific Users**
```json
{
  "enabled": true,
  "targeting_rules": {
    "userIds": ["user-id-1", "user-id-2", "user-id-3"]
  }
}
```

**3. Percentage Rollout (User-Based)**
```json
{
  "enabled": true,
  "targeting_rules": {
    "percentage": 25  // 25% of users
  }
}
```

**4. Session-Based Rollout**
```json
{
  "enabled": true,
  "targeting_rules": {
    "sessionPercentage": 10  // 10% of sessions (includes anonymous)
  }
}
```

**5. Combined Targeting**
```json
{
  "enabled": true,
  "targeting_rules": {
    "userIds": ["admin-1", "admin-2"],  // Always on for these users
    "percentage": 5                      // + 5% of other users
  }
}
```

---

## Phase Transitions

### P0 → P1 (Enable Collaboration Features)

**Before:**
```bash
VITE_DEPLOYMENT_PHASE=P0
```
- Brand Diagnostic: ✅ Enabled
- Brand Coach: ✅ Enabled
- Brand Canvas: ✅ Enabled
- Brand Avatar: ✅ Enabled
- Framework Submissions: ❌ Coming Soon

**After:**
```bash
VITE_DEPLOYMENT_PHASE=P1
```
- Brand Diagnostic: ✅ Enabled
- Brand Coach: ✅ Enabled
- Brand Canvas: ✅ Enabled
- Brand Avatar: ✅ Enabled
- Framework Submissions: ✅ Enabled
- Brand Analytics: ❌ Coming Soon

**Steps:**
1. Update environment variable
2. Redeploy application
3. Verify new features appear
4. Monitor for 24 hours

### P1 → P2 (Enable Advanced Features)

**Update:**
```bash
VITE_DEPLOYMENT_PHASE=P2
```

**Newly Enabled:**
- Brand Analytics
- Competitive Analysis
- Brand Insights Library
- AI Workshop Facilitator

---

## Adding New Features

### 1. Define Feature in Registry

**File:** `src/config/features.ts`

```typescript
export const FEATURES: Record<string, Feature> = {
  // ... existing features ...

  MY_NEW_FEATURE: {
    id: 'MY_NEW_FEATURE',
    name: 'My New Feature',
    shortDescription: 'Brief description for cards',
    fullDescription: 'Detailed description for coming soon page',
    phase: 'P1',  // or 'P0', 'P2'
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

### 2. Use in Components

```tsx
import FeatureGate from '@/components/FeatureGate';

export default function MyFeaturePage() {
  return (
    <FeatureGate feature="MY_NEW_FEATURE">
      <MyFeatureComponent />
    </FeatureGate>
  );
}
```

### 3. Add Dynamic Flag (Optional)

For gradual rollouts:

```sql
INSERT INTO public.feature_flags (name, description, enabled, targeting_rules)
VALUES (
  'my_feature_advanced_mode',
  'Advanced mode for My Feature',
  true,
  '{"percentage": 10}'
);
```

---

## Examples

### Example 1: Route Protection

```tsx
// pages/BrandCanvas.tsx
import FeatureGate from '@/components/FeatureGate';

export default function BrandCanvas() {
  return (
    <FeatureGate feature="BRAND_CANVAS">
      <div>
        <h1>Brand Canvas</h1>
        <CanvasEditor />
      </div>
    </FeatureGate>
  );
}
```

**Result:**
- **P0:** Shows "Brand Canvas Coming Soon"
- **P1+:** Shows canvas editor

### Example 2: Automatic Navigation (Implemented in Layout.tsx)

The main navigation automatically shows only features available in the current phase:

```tsx
// src/components/Layout.tsx
import { getNavigationFeatures, getCurrentPhase } from '@/config/features';

export function Layout({ children }) {
  // Navigation items are automatically filtered by phase
  const navItems = useMemo(() => {
    const currentPhase = getCurrentPhase();
    const features = getNavigationFeatures(currentPhase);

    const items = [
      { name: "Home", href: "/", icon: HomeIcon },
    ];

    // Add only features available in current phase
    features.forEach(feature => {
      items.push({
        name: feature.name,
        href: feature.route,
        icon: feature.icon,
      });
    });

    return items;
  }, []);

  return (
    <nav>
      {navItems.map(item => (
        <Link key={item.name} to={item.href}>
          <item.icon />
          {item.name}
        </Link>
      ))}
    </nav>
  );
}
```

**Result:**
- **P0:** Brand Diagnostic, Home, Brand Avatar, Interactive Insight, Brand Coach, Brand Canvas, Brand Copy Generator, Dashboard
- **P1:** Adds IDEA Framework, Framework Submissions, Team Collaboration
- **P2:** Adds Brand Analytics, Competitive Analysis, Insights Library, AI Workshop Facilitator

### Example 3: Conditional UI Elements

```tsx
// pages/Dashboard.tsx
import { isFeatureAvailable, getCurrentPhase } from '@/config/features';

export default function Dashboard() {
  const currentPhase = getCurrentPhase();

  return (
    <div>
      <h1>Brand Dashboard</h1>

      {/* Always visible in P0+ */}
      <DiagnosticCard />
      <CanvasCard />

      {/* Only in P1+ */}
      {isFeatureAvailable('IDEA_FRAMEWORK', currentPhase) && (
        <IdeaFrameworkCard />
      )}

      {/* Only in P2+ */}
      {isFeatureAvailable('BRAND_ANALYTICS', currentPhase) && (
        <AnalyticsCard />
      )}
    </div>
  );
}
```

### Example 4: Gradual Rollout

```tsx
// pages/BrandAnalytics.tsx
import FeatureGate from '@/components/FeatureGate';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export default function BrandAnalytics() {
  const isAdvancedEnabled = useFeatureFlag('advanced_analytics', false);

  return (
    <FeatureGate feature="BRAND_ANALYTICS">
      <div>
        <BasicAnalytics />
        {isAdvancedEnabled && <AdvancedAnalytics />}
      </div>
    </FeatureGate>
  );
}
```

**Setup:**
1. Set phase to P2 (enables BRAND_ANALYTICS)
2. Create flag `advanced_analytics` with 10% rollout
3. Gradually increase percentage: 10% → 25% → 50% → 100%

### Example 5: Custom Coming Soon Page

```tsx
import FeatureGate from '@/components/FeatureGate';

export default function TeamCollaboration() {
  return (
    <FeatureGate
      feature="TEAM_COLLABORATION"
      comingSoonConfig={{
        title: 'Team Collaboration Coming Soon',
        description: 'Invite your team to collaborate on brand strategy!',
        icon: 'sparkles',
        estimatedRelease: 'Q2 2026',
        showCTA: true,
        ctaText: 'Join Waitlist',
        onCTAClick: () => console.log('Waitlist signup'),
      }}
    >
      <TeamCollaborationUI />
    </FeatureGate>
  );
}
```

---

## Testing

### Test Phase Transitions Locally

```bash
# Terminal 1 - Start dev server
npm run dev

# Terminal 2 - Test P0
echo "VITE_DEPLOYMENT_PHASE=P0" > .env.local
# Restart dev server
# Visit /canvas → Should show "Coming Soon"

# Test P1
echo "VITE_DEPLOYMENT_PHASE=P1" > .env.local
# Restart dev server
# Visit /canvas → Should show canvas editor
```

### Test Dynamic Flags

```tsx
// Create test flag in Supabase
INSERT INTO feature_flags (name, enabled, targeting_rules)
VALUES ('test_feature', true, '{"percentage": 50}');

// Use in component
const isEnabled = useFeatureFlag('test_feature', false);
console.log('Test feature enabled:', isEnabled);
```

### Test in Browser Console

```javascript
// Check current phase
const { getCurrentPhase } = await import('./src/config/features.ts');
console.log('Current phase:', getCurrentPhase());

// Check feature availability
const { isFeatureAvailable } = await import('./src/config/features.ts');
console.log('Canvas available:', isFeatureAvailable('BRAND_CANVAS', 'P0'));
console.log('Canvas available:', isFeatureAvailable('BRAND_CANVAS', 'P1'));
```

---

## Database Schema

### feature_flags Table

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
```

### feature_flag_evaluations Table

```sql
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

### Issue: Features not showing after phase change

**Solution:**
1. Check environment variable is set correctly
2. Restart dev server (changes require restart)
3. Clear browser cache
4. Check browser console for phase info

### Issue: Dynamic flag not updating in real-time

**Solution:**
1. Verify Supabase Realtime is enabled for `feature_flags` table
2. Check browser console for subscription errors
3. Verify RLS policies allow reading flags

### Issue: Wrong "Coming Soon" message

**Solution:**
Update the feature config in `src/config/features.ts`:
```typescript
MY_FEATURE: {
  name: 'Correct Name',
  shortDescription: 'Correct short description',
  fullDescription: 'Correct full description',
  statusMessage: 'Coming Soon',
  // ...
}
```

---

## Best Practices

### DO ✅
- Use `FeatureGate` component for page-level gating
- Use `useFeatureFlag()` for fine-grained control
- Set explicit phase in environment variables
- Test phase transitions before deploying
- Document new features in registry
- Use dynamic flags for gradual rollouts
- Track flag evaluations for analytics

### DON'T ❌
- Hardcode feature checks (`if (true)`)
- Mix different gating approaches without reason
- Skip testing coming soon pages
- Deploy without verifying phase variable
- Add features without assigning a phase
- Use dynamic flags for major phase transitions

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
// Get feature by ID
getFeature(featureId: FeatureId): Feature

// Get all features for phase
getFeaturesForPhase(phase: DeploymentPhase): Feature[]

// Get navigation features
getNavigationFeatures(phase: DeploymentPhase): Feature[]

// Check if feature is available
isFeatureAvailable(featureId: FeatureId, phase: DeploymentPhase): boolean

// Get feature status
getFeatureStatus(featureId: FeatureId, phase: DeploymentPhase): {
  available: boolean;
  statusMessage: string;
  estimatedRelease: string;
}

// Get current phase
getCurrentPhase(): DeploymentPhase
```

---

## Migration Guide

### Running the Migration

```bash
# Apply the feature flags migration
supabase db push

# Or if using Supabase CLI
supabase migration up
```

### Seeding Initial Flags

```sql
-- Run this in Supabase SQL Editor
INSERT INTO public.feature_flags (name, description, enabled, targeting_rules, metadata)
VALUES
  ('brand_canvas_export', 'Export brand canvas to PDF', false, '{"percentage": 0}', '{"phase": "P1"}'),
  ('team_collaboration', 'Team collaboration features', false, '{"percentage": 0}', '{"phase": "P1"}'),
  ('brand_analytics', 'Advanced brand analytics', false, '{"percentage": 0}', '{"phase": "P2"}')
ON CONFLICT (name) DO NOTHING;
```

---

## Next Steps

1. **Set deployment phase:** Add `VITE_DEPLOYMENT_PHASE=P0` to `.env.local`
2. **Run migration:** Apply the feature flags database schema
3. **Update navigation:** Use `getNavigationFeatures()` in your navigation component
4. **Protect routes:** Wrap pages with `<FeatureGate>` component
5. **Test transitions:** Verify phase changes work correctly
6. **Add dynamic flags:** Create flags for gradual rollouts

---

**Questions?** Check the implementation files:
- Feature registry: `src/config/features.ts`
- FeatureGate component: `src/components/FeatureGate.tsx`
- useFeatureFlag hook: `src/hooks/useFeatureFlag.ts`
- Database schema: `supabase/migrations/20251124_feature_flags.sql`
