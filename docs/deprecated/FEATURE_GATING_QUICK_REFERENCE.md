# Feature Gating Quick Reference

## Environment Setup

```bash
# .env.local
VITE_DEPLOYMENT_PHASE=P0  # P0, P1, or P2
```

## Import Statements

```typescript
// Static gating
import FeatureGate from '@/components/FeatureGate';
import { isFeatureAvailable, getCurrentPhase } from '@/config/features';

// Dynamic flags
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
```

## Usage Patterns

### 1. Protect Entire Page

```tsx
<FeatureGate feature="BRAND_CANVAS">
  <YourComponent />
</FeatureGate>
```

### 2. Conditional UI Element

```tsx
const currentPhase = getCurrentPhase();
{isFeatureAvailable('BRAND_ANALYTICS', currentPhase) && (
  <AnalyticsButton />
)}
```

### 3. Dynamic Feature Flag

```tsx
const isEnabled = useFeatureFlag('advanced_analytics', false);
{isEnabled && <AdvancedFeatures />}
```

### 4. Custom Coming Soon

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

## Current Features by Phase

### P0 (Beta Launch)
- ✅ BRAND_DIAGNOSTIC
- ✅ BRAND_AVATAR
- ✅ INTERACTIVE_INSIGHT
- ✅ BRAND_COACH
- ✅ BRAND_CANVAS
- ✅ BRAND_COPY_GENERATOR
- ✅ DASHBOARD
- ✅ DOCUMENT_UPLOAD (not in nav)
- ✅ CONVERSATION_HISTORY (not in nav)

### P1 (Enhanced)
- ✅ IDEA_FRAMEWORK
- ✅ FRAMEWORK_SUBMISSIONS
- ✅ TEAM_COLLABORATION

### P2 (Advanced)
- ✅ BRAND_ANALYTICS
- ✅ COMPETITIVE_ANALYSIS
- ✅ BRAND_INSIGHTS_LIBRARY
- ✅ AI_WORKSHOP_FACILITATOR

## Database Operations

### Create Feature Flag

```sql
INSERT INTO feature_flags (name, description, enabled, targeting_rules)
VALUES (
  'my_feature',
  'Description',
  true,
  '{"percentage": 25}'
);
```

### Update Flag

```sql
UPDATE feature_flags
SET enabled = true,
    targeting_rules = '{"percentage": 50}'
WHERE name = 'my_feature';
```

### Targeting Rules Examples

```json
// All users
{"percentage": 100}

// Specific users only
{"userIds": ["user-id-1", "user-id-2"]}

// 25% rollout
{"percentage": 25}

// Combined
{"userIds": ["admin-1"], "percentage": 10}
```

## Common Scenarios

### Scenario 1: New P1 Feature
1. Add to `src/config/features.ts` with `phase: 'P1'`
2. Wrap component with `<FeatureGate feature="YOUR_FEATURE">`
3. Test with `VITE_DEPLOYMENT_PHASE=P0` and `P1`

### Scenario 2: Gradual Rollout
1. Add feature to registry with appropriate phase
2. Create dynamic flag: `{"percentage": 10}`
3. Use both in component:
```tsx
<FeatureGate feature="FEATURE_ID">
  {useFeatureFlag('feature_advanced', false) && <Advanced />}
</FeatureGate>
```
4. Increase percentage: 10% → 25% → 50% → 100%

### Scenario 3: Kill Switch
1. Create flag: `{"enabled": true}`
2. Use in component: `useFeatureFlag('feature_name', true)`
3. To disable: Set `enabled: false` in database
4. Change propagates in real-time

## Troubleshooting

### Feature not showing
- ✅ Check `VITE_DEPLOYMENT_PHASE` value
- ✅ Restart dev server after env change
- ✅ Clear browser cache
- ✅ Check browser console for errors

### Dynamic flag not updating
- ✅ Verify Supabase Realtime is enabled
- ✅ Check RLS policies
- ✅ Look for subscription errors in console

### Wrong coming soon message
- ✅ Update feature config in `src/config/features.ts`
- ✅ Or use custom `comingSoonConfig` prop

## File Locations

- **Feature Registry:** `src/config/features.ts`
- **FeatureGate Component:** `src/components/FeatureGate.tsx`
- **ComingSoon Component:** `src/components/ComingSoon.tsx`
- **useFeatureFlag Hook:** `src/hooks/useFeatureFlag.ts`
- **Database Schema:** `supabase/migrations/20251124_feature_flags.sql`
- **Examples:** `src/examples/feature-gating-examples.tsx`
- **Full Guide:** `docs/FEATURE_GATING_GUIDE.md`

## Testing Commands

```bash
# Test P0
echo "VITE_DEPLOYMENT_PHASE=P0" > .env.local
npm run dev

# Test P1
echo "VITE_DEPLOYMENT_PHASE=P1" > .env.local
npm run dev

# Test P2
echo "VITE_DEPLOYMENT_PHASE=P2" > .env.local
npm run dev

# Apply migration
supabase db push
```

## API Quick Reference

```typescript
// Check availability
isFeatureAvailable(featureId, phase): boolean

// Get current phase
getCurrentPhase(): DeploymentPhase

// Get nav features
getNavigationFeatures(phase): Feature[]

// Use dynamic flag
useFeatureFlag(flagName, defaultValue): boolean
```

---

**Need more details?** See `docs/FEATURE_GATING_GUIDE.md` for complete documentation.
