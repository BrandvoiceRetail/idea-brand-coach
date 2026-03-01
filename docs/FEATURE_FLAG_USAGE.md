# Feature Flag Usage Guide

**Purpose:** Guide for using dynamic feature flags for gradual rollouts, A/B testing, and feature toggling
**Scope:** LOCAL_FEATURE_FLAGS system (local-only, in-memory flags)
**Audience:** Developers implementing features with gradual rollout requirements

---

## Table of Contents

1. [Overview](#overview)
2. [When to Use Feature Flags](#when-to-use-feature-flags)
3. [Adding New Feature Flags](#adding-new-feature-flags)
4. [Rollout Process](#rollout-process)
5. [Admin UI Usage](#admin-ui-usage)
6. [Testing Strategies](#testing-strategies)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Real-World Example: v2-multi-avatar](#real-world-example-v2-multi-avatar)

---

## Overview

The IDEA Brand Coach application uses two complementary feature gating systems:

### 1. Phase-Based Gating (Compile-Time)
- Controlled by `VITE_DEPLOYMENT_PHASE` environment variable
- For major feature releases (P0 → P1 → P2)
- See: [`docs/FEATURE_GATING_GUIDE.md`](./FEATURE_GATING_GUIDE.md)

### 2. Dynamic Feature Flags (Runtime) ← **This Document**
- Controlled by `LOCAL_FEATURE_FLAGS` in `src/hooks/useFeatureFlag.ts`
- For gradual rollouts, A/B testing, and kill switches
- Real-time toggling via Admin UI
- **Local-only** (changes not persisted to database)

### Feature Flag Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Feature Flag System                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────┐      ┌────────────────────┐   │
│  │  Phase-Based Gating │      │  Dynamic Flags     │   │
│  │  (src/config/       │      │  (src/hooks/       │   │
│  │   features.ts)      │      │   useFeatureFlag)  │   │
│  ├─────────────────────┤      ├────────────────────┤   │
│  │ • Major releases    │      │ • Gradual rollouts │   │
│  │ • Compile-time      │      │ • A/B testing      │   │
│  │ • Environment var   │      │ • Kill switches    │   │
│  │ • Phase: P0/P1/P2   │      │ • Runtime control  │   │
│  └─────────────────────┘      └────────────────────┘   │
│                                                           │
│            Use BOTH for maximum control:                 │
│   <FeatureGate> wraps page (phase-based)               │
│   useFeatureFlag() for sub-features (dynamic)          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## When to Use Feature Flags

### ✅ Use Dynamic Feature Flags For:

1. **Gradual Rollouts**
   - New UI redesigns (V1 → V2)
   - Performance-risky features
   - User-facing changes requiring validation
   - Example: Multi-avatar interface rollout (10% → 50% → 100%)

2. **A/B Testing**
   - Testing different UX approaches
   - Comparing feature variants
   - Gathering usage metrics
   - Example: Two different copy generation algorithms

3. **Kill Switches**
   - High-risk features that may need instant rollback
   - Third-party integrations
   - Features with unknown performance impact
   - Example: AI-powered recommendations

4. **Beta Features Within a Phase**
   - Feature is P0 (always on) but specific sub-features need gradual rollout
   - Example: Brand Canvas (P0) → Canvas Export (gradual)

### ❌ Don't Use Dynamic Flags For:

1. **Major Phase Transitions**
   - Use `VITE_DEPLOYMENT_PHASE` instead
   - Example: Enabling all P1 features → use phase transition

2. **Simple On/Off Features**
   - If you'll never do gradual rollout → use phase-based gating
   - Example: Beta testing page → phase-based is simpler

3. **Temporary Code**
   - Use `if (import.meta.env.DEV)` instead
   - Example: Debug logging

---

## Adding New Feature Flags

### Step 1: Define the Flag

**File:** `src/hooks/useFeatureFlag.ts`

```typescript
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Existing flags...

  'my-new-feature': {
    name: 'my-new-feature',
    enabled: true,
    targeting_rules: {
      // Session-based percentage rollout
      sessionPercentage: 0,  // Start at 0% (disabled)
    },
  },
};
```

**Flag Configuration Options:**

```typescript
interface FeatureFlag {
  name: string;                // Unique flag name (kebab-case)
  enabled: boolean;             // Global on/off switch
  targeting_rules?: {
    userIds?: string[];        // Whitelist specific user IDs
    percentage?: number;       // User-based rollout (0-100)
    sessionPercentage?: number; // Session-based rollout (0-100)
  };
}
```

### Step 2: Use the Flag in Your Component

**Pattern 1: Simple Toggle**

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

**Pattern 2: Combined with Phase Gating**

```tsx
import FeatureGate from '@/components/FeatureGate';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function MyFeaturePage() {
  const isAdvancedEnabled = useFeatureFlag('my-new-feature', false);

  return (
    <FeatureGate feature="MY_FEATURE">
      <div>
        <BasicFeature />
        {isAdvancedEnabled && <AdvancedFeature />}
      </div>
    </FeatureGate>
  );
}
```

**Pattern 3: Early Return**

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function AvatarBuilder() {
  const isV2Enabled = useFeatureFlag('v2-multi-avatar', false);

  // Early return for V2
  if (isV2Enabled) {
    return <MultiAvatarInterface />;
  }

  // V1 fallback
  return <SingleAvatarBuilder />;
}
```

### Step 3: Test the Flag

See [Testing Strategies](#testing-strategies) section below.

---

## Rollout Process

### Gradual Rollout Strategy

Follow this process for safe, gradual rollouts:

#### Phase 1: Development & QA (0%)

```typescript
'my-new-feature': {
  name: 'my-new-feature',
  enabled: false,  // Disabled for everyone
  targeting_rules: {
    sessionPercentage: 0,
  },
}
```

**Actions:**
1. Develop feature behind flag
2. Test locally with `enabled: true`
3. QA validates both V1 (flag off) and V2 (flag on)
4. Deploy to production with `enabled: false`

#### Phase 2: Internal Testing (Whitelist)

```typescript
'my-new-feature': {
  name: 'my-new-feature',
  enabled: true,
  targeting_rules: {
    userIds: [
      'internal-user-1-uuid',
      'internal-user-2-uuid',
      'qa-user-uuid',
    ],
  },
}
```

**Actions:**
1. Enable for internal team members
2. Monitor for errors/performance issues
3. Gather initial feedback
4. Fix critical issues
5. Duration: 1-3 days

#### Phase 3: Canary Rollout (10%)

```typescript
'my-new-feature': {
  name: 'my-new-feature',
  enabled: true,
  targeting_rules: {
    sessionPercentage: 10,  // 10% of all sessions
  },
}
```

**Actions:**
1. Enable for 10% of users
2. Monitor metrics:
   - Error rates
   - Performance (page load, API latency)
   - User behavior (engagement, drop-off)
3. Watch for bug reports
4. Duration: 3-7 days

#### Phase 4: Gradual Increase (50%)

```typescript
'my-new-feature': {
  name: 'my-new-feature',
  enabled: true,
  targeting_rules: {
    sessionPercentage: 50,
  },
}
```

**Actions:**
1. Increase to 50% if canary is successful
2. Continue monitoring
3. Address feedback
4. Duration: 3-7 days

#### Phase 5: Full Rollout (100%)

```typescript
'my-new-feature': {
  name: 'my-new-feature',
  enabled: true,
  targeting_rules: {
    sessionPercentage: 100,
  },
}
```

**Actions:**
1. Enable for all users
2. Monitor for 7-14 days
3. Once stable, remove flag and old code

#### Phase 6: Cleanup

```typescript
// Remove flag entirely
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // 'my-new-feature' removed
};

// Simplify component code
export function MyFeature() {
  // Remove flag check
  return <NewFeatureV2 />;
}
```

**Actions:**
1. Delete flag from `LOCAL_FEATURE_FLAGS`
2. Remove `useFeatureFlag()` hook calls
3. Delete legacy code (V1)
4. Update tests

### Rollback Procedure

If issues are detected at any phase:

**Option 1: Instant Disable via Admin UI**
1. Navigate to `/admin/feature-flags`
2. Toggle flag to **disabled**
3. All users immediately see V1 (fallback)

**Option 2: Reduce Percentage**
1. Navigate to `/admin/feature-flags`
2. Adjust percentage slider to lower value (e.g., 50% → 10%)
3. Fewer users see V2 while you fix issues

**Option 3: Code Change**
```typescript
// Set enabled: false or sessionPercentage: 0
'my-new-feature': {
  name: 'my-new-feature',
  enabled: false,  // Instant disable
}
```

---

## Admin UI Usage

### Accessing the Admin UI

**URL:** `http://localhost:5173/admin/feature-flags` (dev)
**Production:** `https://yourdomain.com/admin/feature-flags`

**Features:**
- View all feature flags
- Toggle enabled/disabled state
- Adjust percentage rollout
- Real-time updates (reactive UI)

### Admin UI Walkthrough

#### Tab 1: Phase-Based Features

Shows all features from `src/config/features.ts`:

| Feature | Phase | Status | Route | Category |
|---------|-------|--------|-------|----------|
| Brand Diagnostic | P0 | Live | /diagnostic | diagnostic |
| Brand Canvas | P0 | Live | /canvas | core |
| Team Collaboration | P1 | Coming Soon | /team | collaboration |
| Brand Analytics | P2 | Coming Q3 2026 | /analytics | analytics |

**Purpose:** View-only reference for phase-based features

#### Tab 2: Dynamic Feature Flags

Interactive controls for runtime flags:

```
┌─────────────────────────────────────────────────┐
│  v2-multi-avatar                                │
│  Multi-avatar interface for customer personas   │
│  ───────────────────────────────────────────────│
│  Enabled: [Toggle ON/OFF]                       │
│  Session Rollout: [────●────────] 50%          │
│  Current: 50% of sessions see V2                │
└─────────────────────────────────────────────────┘
```

**Controls:**

1. **Enabled Toggle (Switch)**
   - Turn flag globally on/off
   - When **off**: All users see V1 (0% rollout)
   - When **on**: Rollout percentage applies

2. **Percentage Slider**
   - Adjust rollout from 0% to 100%
   - Updates in real-time
   - Shows current percentage below slider

**Example Workflow:**

1. **Initial State:** `enabled: false`, `sessionPercentage: 0`
   - All users see V1

2. **Enable for 10% testing:**
   - Toggle **enabled** to ON
   - Set slider to **10%**
   - ~10% of sessions see V2

3. **Increase to 50%:**
   - Move slider to **50%**
   - ~50% of sessions see V2

4. **Full rollout:**
   - Move slider to **100%**
   - All users see V2

5. **Emergency rollback:**
   - Toggle **enabled** to OFF
   - Instantly reverts everyone to V1

### Admin UI Limitations

⚠️ **Important:** The admin UI updates **in-memory flags only**

- Changes **DO NOT persist** across:
  - Server restarts
  - Browser refreshes
  - Code deployments

- For persistent changes:
  - Update `LOCAL_FEATURE_FLAGS` in `src/hooks/useFeatureFlag.ts`
  - Commit and deploy

- **Future Enhancement:** Connect to Supabase for persistent storage

---

## Testing Strategies

### Strategy 1: Manual Browser Testing

**Test Enabled/Disabled States:**

```bash
# Terminal
npm run dev
```

**Browser:**
```javascript
// 1. Open browser console
// 2. Navigate to page with feature flag
// 3. Check which version is showing
```

**Edit flag in code:**
```typescript
// src/hooks/useFeatureFlag.ts
'my-feature': {
  enabled: true,  // Change to false
  targeting_rules: {
    sessionPercentage: 100,  // Change to 0
  },
}
```

**Reload browser → verify toggle works**

### Strategy 2: Percentage Rollout Testing

**Automated Testing Script:**

The `useFeatureFlag.ts` hook includes a testing utility:

```typescript
import { testPercentageDistribution } from '@/hooks/useFeatureFlag';

// Test 50% rollout with 1000 sessions
const result = testPercentageDistribution(50, 1000);
console.log(result);
// {
//   targetPercentage: 50,
//   sampleSize: 1000,
//   enabledCount: 498,
//   actualPercentage: 49.8,
//   deviation: 0.2
// }
```

**Manual Browser Testing:**

1. **Set flag to 50% rollout:**
   ```typescript
   'my-feature': {
     enabled: true,
     targeting_rules: {
       sessionPercentage: 50,
     },
   }
   ```

2. **Open browser console:**
   ```javascript
   // Clear session to simulate new user
   sessionStorage.clear();
   ```

3. **Reload page multiple times:**
   - ~50% of reloads should show V2
   - ~50% should show V1

4. **Test different percentages:**
   - 10%: ~1 in 10 reloads shows V2
   - 100%: All reloads show V2
   - 0%: No reloads show V2

**Detailed Instructions:**

See: `PERCENTAGE_ROLLOUT_TESTING.md` (if exists) or follow these steps:

1. Navigate to page with feature flag
2. Open DevTools Console (F12)
3. Run: `sessionStorage.clear()`
4. Reload page (Cmd+R / Ctrl+R)
5. Observe which version shows
6. Repeat steps 3-5 at least 10 times
7. Calculate: `(V2 count / total reloads) * 100` ≈ target percentage

### Strategy 3: User ID Targeting

**Test specific users:**

```typescript
'my-feature': {
  enabled: true,
  targeting_rules: {
    userIds: [
      '12345678-1234-1234-1234-123456789abc',  // Your test user ID
    ],
  },
}
```

**Get user ID:**
```javascript
// Browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('User ID:', user?.id);
```

**Test:**
1. Log in as whitelisted user → should see V2
2. Log in as different user → should see V1
3. Log out (anonymous) → should see V1

### Strategy 4: Admin UI Testing

**Interactive testing via Admin UI:**

1. **Navigate to admin page:**
   ```
   http://localhost:5173/admin/feature-flags
   ```

2. **Toggle flag on/off:**
   - Open admin page in one tab
   - Open feature page in another tab
   - Toggle flag in admin tab
   - Reload feature tab → observe change

3. **Adjust percentage:**
   - Set to 0% → reload feature page → should see V1
   - Set to 100% → reload feature page → should see V2
   - Set to 50% → reload multiple times → ~50% should see V2

### Strategy 5: Automated Unit Tests

**Test flag evaluation logic:**

```typescript
// src/hooks/useFeatureFlag.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureFlag } from './useFeatureFlag';

describe('useFeatureFlag', () => {
  it('returns default value when flag does not exist', () => {
    const { result } = renderHook(() =>
      useFeatureFlag('nonexistent-flag', false)
    );
    expect(result.current).toBe(false);
  });

  it('returns false when flag is disabled', () => {
    // Mock LOCAL_FEATURE_FLAGS with disabled flag
    const { result } = renderHook(() =>
      useFeatureFlag('disabled-flag', false)
    );
    expect(result.current).toBe(false);
  });

  it('respects percentage rollout', () => {
    // Test percentage-based targeting
    // Mock multiple session IDs and verify distribution
  });
});
```

### Strategy 6: Integration Testing

**Test entire user flow:**

```typescript
// tests/integration/feature-flag-flow.test.ts
import { test, expect } from '@playwright/test';

test('v2-multi-avatar rollout', async ({ page }) => {
  // Test 0% rollout
  await page.goto('/avatar');
  await expect(page.locator('[data-testid="single-avatar"]')).toBeVisible();

  // Update flag to 100% (via admin API or code)
  // ...

  // Test 100% rollout
  await page.reload();
  await expect(page.locator('[data-testid="multi-avatar"]')).toBeVisible();
});
```

---

## Best Practices

### ✅ DO

1. **Start with 0% rollout**
   ```typescript
   'new-feature': {
     enabled: false,  // or sessionPercentage: 0
   }
   ```
   - Deploy with flag disabled
   - Verify fallback works in production
   - Then enable gradually

2. **Use meaningful flag names**
   ```typescript
   // Good
   'v2-multi-avatar'
   'advanced-analytics-export'
   'canvas-pdf-generation'

   // Bad
   'flag1'
   'test'
   'new-feature'
   ```

3. **Document your flags**
   ```typescript
   /**
    * v2-multi-avatar
    *
    * Gradual rollout of multi-avatar interface.
    * Replaces single-avatar builder with support for multiple personas.
    *
    * Rollout plan:
    * - 2026-03-01: 0% (deployed but disabled)
    * - 2026-03-08: 10% (canary)
    * - 2026-03-15: 50% (gradual increase)
    * - 2026-03-22: 100% (full rollout)
    * - 2026-04-05: Remove flag (cleanup)
    */
   'v2-multi-avatar': {
     name: 'v2-multi-avatar',
     enabled: true,
     targeting_rules: {
       sessionPercentage: 0,
     },
   }
   ```

4. **Monitor during rollouts**
   - Error rates
   - Page load times
   - User feedback
   - Conversion metrics

5. **Test both branches**
   - V1 (flag off)
   - V2 (flag on)
   - Toggling between them

6. **Remove flags after full rollout**
   - Don't accumulate dead flags
   - Clean up after 100% rollout is stable
   - Delete legacy code

7. **Use session-based rollout for anonymous users**
   ```typescript
   targeting_rules: {
     sessionPercentage: 25,  // Works for logged-out users
   }
   ```

8. **Use user-based rollout for authenticated features**
   ```typescript
   targeting_rules: {
     percentage: 25,  // Requires authenticated user
   }
   ```

### ❌ DON'T

1. **Don't skip testing**
   - Always test both V1 and V2
   - Never deploy without verifying fallback

2. **Don't rush rollouts**
   ```typescript
   // Bad: 0% → 100% in one day
   // Good: 0% → 10% → 50% → 100% over 2-3 weeks
   ```

3. **Don't forget to clean up**
   ```typescript
   // Bad: Accumulating 50+ flags over time
   // Good: Remove flags after full rollout
   ```

4. **Don't nest too many flags**
   ```tsx
   // Bad
   if (useFeatureFlag('flag1')) {
     if (useFeatureFlag('flag2')) {
       if (useFeatureFlag('flag3')) {
         return <Feature />; // Too complex!
       }
     }
   }

   // Good
   const isEnabled = useFeatureFlag('combined-feature', false);
   return isEnabled ? <Feature /> : <Fallback />;
   ```

5. **Don't use flags for permanent configuration**
   ```typescript
   // Bad: Feature flags for app settings
   'enable-dark-mode'  // Use user preferences instead
   'api-endpoint'      // Use environment variables instead

   // Good: Feature flags for rollouts
   'v2-dark-mode-ui'   // Gradual rollout of new dark mode
   ```

6. **Don't rely on admin UI for permanent changes**
   - Admin UI changes are **in-memory only**
   - Always update code for persistent changes

---

## Troubleshooting

### Problem: Flag not working in production

**Symptoms:**
- Flag works locally but not in production
- All users see V1 despite flag being enabled

**Solutions:**

1. **Check flag is defined in code:**
   ```typescript
   // src/hooks/useFeatureFlag.ts
   const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
     'my-feature': { /* ... */ },  // Ensure flag exists
   };
   ```

2. **Verify code was deployed:**
   ```bash
   git log --oneline -5  # Check recent commits
   # Ensure commit with flag is deployed
   ```

3. **Check flag is enabled:**
   ```typescript
   'my-feature': {
     enabled: true,  // Must be true
     targeting_rules: {
       sessionPercentage: 100,  // Must be > 0
     },
   }
   ```

4. **Check browser console for errors:**
   ```javascript
   // Look for useFeatureFlag errors
   ```

### Problem: Percentage rollout not distributing correctly

**Symptoms:**
- 50% flag shows V2 for 80% of users (or 20%)
- Distribution is heavily skewed

**Solutions:**

1. **Test distribution with utility function:**
   ```typescript
   import { testPercentageDistribution } from '@/hooks/useFeatureFlag';
   console.log(testPercentageDistribution(50, 1000));
   // Should show ~50% with <1% deviation
   ```

2. **Clear sessionStorage:**
   ```javascript
   // Browser console
   sessionStorage.clear();
   location.reload();
   ```

3. **Check hash function:**
   - Verify `simpleHash()` in `useFeatureFlag.ts` is unchanged
   - Ensure session IDs are unique

### Problem: Flag changes not reflecting immediately

**Symptoms:**
- Update flag in admin UI
- Reload page
- Still shows old version

**Causes & Solutions:**

1. **Admin UI changes are in-memory only:**
   - Update `LOCAL_FEATURE_FLAGS` in code
   - Commit and deploy
   - **OR** accept that admin changes are temporary

2. **Browser caching:**
   ```javascript
   // Hard reload
   Cmd+Shift+R (Mac)
   Ctrl+Shift+R (Windows)
   ```

3. **React state not updating:**
   - Check `subscribeFlagUpdates()` is working
   - Look for React re-render issues

### Problem: Users stuck on one variant

**Symptoms:**
- User always sees V2 (or V1) despite 50% rollout
- Can't switch variants

**Cause:**
- Session ID is persisted in `sessionStorage`
- Same session always hashes to same result

**Solution:**
```javascript
// Browser console
sessionStorage.removeItem('ff_session_id');
location.reload();
```

**By Design:**
- This is correct behavior
- Ensures consistent experience per session
- User shouldn't randomly switch between V1/V2

### Problem: Flag works for some users but not others

**Symptoms:**
- Internal team sees V2
- External users see V1

**Check:**

1. **User ID whitelist:**
   ```typescript
   targeting_rules: {
     userIds: ['internal-user-id'],  // Remove or expand
   }
   ```

2. **Percentage targeting:**
   ```typescript
   targeting_rules: {
     percentage: 10,  // User-based (requires auth)
     sessionPercentage: 10,  // Session-based (works for anonymous)
   }
   ```

3. **User authentication:**
   - `percentage` only works for authenticated users
   - Use `sessionPercentage` for anonymous users

---

## Real-World Example: v2-multi-avatar

### Background

**Objective:** Replace single-avatar builder with multi-avatar interface

**Risk Level:** High
- Critical user-facing feature
- Significant UX change
- Multiple components affected

**Approach:** Gradual rollout with feature flag

### Implementation

#### 1. Define the Flag

```typescript
// src/hooks/useFeatureFlag.ts
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  'v2-multi-avatar': {
    name: 'v2-multi-avatar',
    enabled: true,
    targeting_rules: {
      sessionPercentage: 0,  // Start disabled
    },
  },
};
```

#### 2. Build V2 Interface

```typescript
// src/components/avatar/MultiAvatarInterface.tsx
export function MultiAvatarInterface() {
  const avatars = usePersistedField<Avatar[]>('avatars', []);
  const [activeAvatarId, setActiveAvatarId] = useState<string | null>(null);

  return (
    <div>
      <AvatarSelector
        avatars={avatars}
        activeId={activeAvatarId}
        onSelect={setActiveAvatarId}
      />
      <AvatarEditor avatarId={activeAvatarId} />
    </div>
  );
}
```

#### 3. Add Conditional Rendering

```typescript
// src/pages/AvatarBuilder.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { MultiAvatarInterface } from '@/components/avatar/MultiAvatarInterface';

export function AvatarBuilder() {
  const isV2Enabled = useFeatureFlag('v2-multi-avatar', false);

  // V2: Multi-avatar interface
  if (isV2Enabled) {
    return <MultiAvatarInterface />;
  }

  // V1: Single-avatar builder (fallback)
  return (
    <div>
      <h1>Avatar Builder</h1>
      <AvatarDemographicsWithPersistence />
    </div>
  );
}
```

#### 4. Test Both Versions

```bash
# Terminal
npm run dev
```

**Test V1 (flag disabled):**
```typescript
'v2-multi-avatar': {
  enabled: false,
}
```
Navigate to `/avatar` → should see single-avatar builder

**Test V2 (flag enabled):**
```typescript
'v2-multi-avatar': {
  enabled: true,
  targeting_rules: {
    sessionPercentage: 100,
  },
}
```
Navigate to `/avatar` → should see multi-avatar interface

#### 5. Deploy with Flag Disabled

```typescript
'v2-multi-avatar': {
  enabled: true,
  targeting_rules: {
    sessionPercentage: 0,  // Deploy at 0%
  },
}
```

**Verify in production:**
- All users see V1
- No errors in logs
- V2 code is deployed but inactive

#### 6. Gradual Rollout

**Week 1: Internal testing (10%)**
```typescript
sessionPercentage: 10,
```
- Monitor error rates
- Gather feedback
- Fix critical bugs

**Week 2: Expand (50%)**
```typescript
sessionPercentage: 50,
```
- Half of users see V2
- Compare metrics (engagement, drop-off)
- Address feedback

**Week 3: Full rollout (100%)**
```typescript
sessionPercentage: 100,
```
- All users on V2
- Monitor for 1-2 weeks

**Week 6: Cleanup**
```typescript
// Remove flag
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // 'v2-multi-avatar' removed
};
```

```tsx
// Remove flag check
export function AvatarBuilder() {
  // Remove: const isV2Enabled = useFeatureFlag('v2-multi-avatar', false);
  // Remove: if (isV2Enabled) { ... }

  return <MultiAvatarInterface />;  // V2 only
}
```

### Testing Performed

1. **Manual browser testing:**
   - Tested flag on/off toggle
   - Verified V1/V2 rendering
   - Checked for console errors

2. **Percentage distribution testing:**
   ```typescript
   testPercentageDistribution(10, 1000);  // 10.1% (0.1% deviation)
   testPercentageDistribution(50, 1000);  // 49.8% (0.2% deviation)
   testPercentageDistribution(100, 1000); // 100.0% (0% deviation)
   ```

3. **Admin UI testing:**
   - Toggle enabled/disabled
   - Adjust percentage slider (0% → 100%)
   - Verify real-time updates

4. **Session-based testing:**
   - Clear `sessionStorage`
   - Reload multiple times
   - Observe ~50% distribution at 50% rollout

### Lessons Learned

1. **Start at 0%:**
   - Deployed with flag disabled
   - Verified fallback works in production
   - No user impact

2. **Test both branches:**
   - Bugs found in V1 during testing
   - Good thing we tested fallback!

3. **Session-based rollout works well:**
   - Smooth distribution
   - Users get consistent experience per session
   - No weird toggling between V1/V2

4. **Admin UI is powerful:**
   - Instant rollback capability
   - Easy percentage adjustments
   - Great for testing

5. **Clean up promptly:**
   - Plan cleanup from the start
   - Remove flag 2-4 weeks after 100%
   - Keeps codebase clean

---

## Summary

### Quick Checklist

- [ ] Define flag in `LOCAL_FEATURE_FLAGS`
- [ ] Implement V2 feature
- [ ] Add `useFeatureFlag()` hook to component
- [ ] Test V1 (flag off) and V2 (flag on)
- [ ] Deploy with `enabled: false` or `sessionPercentage: 0`
- [ ] Verify in production (all users see V1)
- [ ] Gradual rollout: 0% → 10% → 50% → 100%
- [ ] Monitor metrics at each stage
- [ ] Full rollout for 2+ weeks
- [ ] Remove flag and legacy code

### Key Takeaways

1. **Feature flags enable safe rollouts**
   - Deploy code without enabling feature
   - Gradual rollout reduces risk
   - Instant rollback if issues arise

2. **Use session-based rollout for anonymous users**
   - Works for logged-out users
   - Consistent experience per session
   - Good distribution

3. **Admin UI provides control**
   - Real-time toggling
   - Percentage adjustments
   - **But changes are temporary (in-memory)**

4. **Clean up after rollout**
   - Remove flags promptly
   - Delete legacy code
   - Keep codebase maintainable

5. **Test thoroughly**
   - Both V1 and V2
   - Distribution accuracy
   - Toggle behavior

---

## Related Documentation

- **Phase-Based Gating:** [`docs/FEATURE_GATING_GUIDE.md`](./FEATURE_GATING_GUIDE.md)
- **Quick Reference:** [`docs/FEATURE_GATING_QUICK_REFERENCE.md`](./FEATURE_GATING_QUICK_REFERENCE.md)
- **Code Examples:** [`src/examples/feature-gating-examples.tsx`](../src/examples/feature-gating-examples.tsx)
- **Feature Registry:** [`src/config/features.ts`](../src/config/features.ts)
- **useFeatureFlag Hook:** [`src/hooks/useFeatureFlag.ts`](../src/hooks/useFeatureFlag.ts)
- **Admin UI:** [`src/pages/admin/FeatureFlagAdmin.tsx`](../src/pages/admin/FeatureFlagAdmin.tsx)

---

**Questions or Issues?**
- Check [Troubleshooting](#troubleshooting) section
- Review [Real-World Example](#real-world-example-v2-multi-avatar)
- Consult existing implementation files
