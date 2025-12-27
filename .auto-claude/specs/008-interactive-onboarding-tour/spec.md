# Specification: Interactive Onboarding Tour

## Overview

This task builds a guided onboarding experience using React Joyride to walk new users through the platform's key features (Diagnostic, IDEA Framework, Avatar Builder, Brand Coach) and educate them on brand strategy methodology. The tour differentiates the platform from competitor educational courses (like StoryBrand) by providing an interactive guided experience rather than static tools, reducing support burden and improving user activation rates.

## Workflow Type

**Type**: feature

**Rationale**: This introduces new functionality (onboarding tour system) to the existing application without modifying core business logic or requiring architectural changes. It's a pure feature addition that enhances user experience through education.

## Task Scope

### Services Involved
- **main** (primary) - React frontend application where tour will be implemented

### This Task Will:
- [ ] Install and integrate React Joyride library for tour functionality
- [ ] Create tour step definitions highlighting 4 key features (Diagnostic, IDEA Framework, Avatar Builder, Brand Coach)
- [ ] Implement auto-launch logic for new users after account creation
- [ ] Add user controls to skip and revisit the tour
- [ ] Integrate analytics tracking for tour completion metrics
- [ ] Ensure mobile-responsive implementation using existing Tailwind CSS
- [ ] Store tour completion state in user profile/preferences

### Out of Scope:
- Modifying the actual features being highlighted (Diagnostic, Avatar Builder, etc.)
- Creating new user authentication flows
- Redesigning UI components for tour compatibility
- Building a custom tour library from scratch
- Multi-language support (English only for initial implementation)

## Service Context

### main

**Tech Stack:**
- Language: TypeScript
- Framework: React
- Build Tool: Vite
- Styling: Tailwind CSS
- UI Components: Radix UI
- State Management: React Hooks (implied)
- Backend: Supabase
- Package Manager: bun
- Testing: Vitest

**Key Directories:**
- `src/` - Source code
- `test/` - Test files

**Entry Point:** `src/App.tsx`

**How to Run:**
```bash
npm run dev
```

**Port:** 3000

**Environment Variables:**
- `VITE_SUPABASE_URL`: https://ecdrxtbclxfpkknasmrw.supabase.co
- `VITE_SUPABASE_PUBLISHABLE_KEY`: (configured)
- `VITE_SUPABASE_PROJECT_ID`: ecdrxtbclxfpkknasmrw

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `package.json` | main | Add `react-joyride` dependency |
| `src/App.tsx` | main | Integrate OnboardingTour component and trigger logic |
| `src/components/OnboardingTour.tsx` | main | **CREATE** - Main tour component with step definitions |
| `src/hooks/useOnboardingTour.ts` | main | **CREATE** - Custom hook for tour state management |
| `src/lib/analytics.ts` | main | **CREATE/UPDATE** - Add tour tracking events |
| `src/types/tour.ts` | main | **CREATE** - TypeScript types for tour state |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| Existing Radix UI component usage | Modal/Dialog patterns for tour overlay styling consistency |
| Existing Supabase integration files | Analytics event tracking patterns |
| Tailwind config files | Responsive breakpoint usage for mobile optimization |

## Patterns to Follow

### React Joyride Core Implementation

From React Joyride documentation:

```typescript
import Joyride, { CallBackProps, STATUS, EVENTS } from 'react-joyride';

const steps = [
  {
    target: '.diagnostic-feature',
    content: 'Start with our Diagnostic tool to assess your brand strength.',
    placement: 'bottom',
    disableBeacon: true,
    title: 'Diagnostic Assessment'
  },
  {
    target: '.idea-framework',
    content: 'Learn the IDEA Framework: Identity, Differentiation, Emotion, Action.',
    placement: 'right'
  }
];

<Joyride
  steps={steps}
  run={run}
  continuous={true}
  showProgress={true}
  showSkipButton={true}
  callback={handleJoyrideCallback}
  styles={{
    options: {
      primaryColor: '#your-brand-color'
    }
  }}
/>
```

**Key Points:**
- Use `disableBeacon: true` on first step to avoid animation delay
- `continuous: true` enables auto-advance between steps
- `callback` prop is essential for analytics tracking
- Steps require unique DOM selectors (use IDs or specific classes)

### Analytics Callback Handler

From React Joyride analytics pattern:

```typescript
const handleJoyrideCallback = (data: CallBackProps) => {
  const { action, status, type, index, step } = data;

  if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
    // Track completion/skip
    trackEvent('onboarding_tour_completed', {
      status,
      steps_completed: index + 1
    });
    setRun(false);
  }

  if (type === EVENTS.STEP_AFTER) {
    // Track individual step completion
    trackEvent('onboarding_step_viewed', {
      step_index: index,
      step_target: step.target
    });
  }
};
```

**Key Points:**
- Handle both `STATUS.FINISHED` and `STATUS.SKIPPED` to reset tour state
- Track individual steps with `EVENTS.STEP_AFTER`
- Use destructured `CallBackProps` for type safety
- Reset `run` state to false after completion

### State Management Pattern

```typescript
const useOnboardingTour = () => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const shouldShowTour = () => {
    // Check if user is new and hasn't completed tour
    const hasCompletedTour = localStorage.getItem('onboarding_tour_completed');
    const isNewUser = /* check from user profile */;
    return isNewUser && !hasCompletedTour;
  };

  const startTour = () => setRun(true);
  const resetTour = () => {
    setRun(false);
    setStepIndex(0);
  };

  return { run, stepIndex, shouldShowTour, startTour, resetTour };
};
```

**Key Points:**
- Controlled state with `run` boolean
- Separate check for tour eligibility
- Provide methods to start and reset tour
- Store completion in persistent storage

## Requirements

### Functional Requirements

1. **Auto-launch for New Users**
   - Description: Tour automatically starts after new user completes account creation
   - Acceptance: Tour appears on first login without manual trigger
   - Implementation: Check user creation date and tour completion status on app mount

2. **Feature Highlighting**
   - Description: Tour must showcase 4 key features with educational content
   - Acceptance: Tour includes steps for Diagnostic, IDEA Framework, Avatar Builder, Brand Coach
   - Implementation: Create step definitions with clear value propositions for each feature

3. **User Control (Skip/Revisit)**
   - Description: Users can skip tour immediately or revisit later via settings
   - Acceptance:
     - Skip button visible on all tour steps
     - "Start Tour" button available in user menu/settings
     - Tour can be completed multiple times
   - Implementation:
     - Use Joyride's built-in `showSkipButton={true}`
     - Add menu item to re-trigger tour
     - Don't block re-runs after completion

4. **Analytics Tracking**
   - Description: Track tour engagement metrics for product analytics
   - Acceptance: Events logged for tour start, completion, skip, and individual step views
   - Implementation: Integrate with Supabase analytics using Joyride callback system
   - Metrics to track:
     - `onboarding_tour_started`
     - `onboarding_tour_completed`
     - `onboarding_tour_skipped`
     - `onboarding_step_viewed` (with step index)

5. **Mobile Responsiveness**
   - Description: Tour must work seamlessly on mobile devices
   - Acceptance: Tour tooltips position correctly on screens <768px width
   - Implementation:
     - React Joyride handles responsive positioning automatically
     - Test on mobile breakpoints
     - Use `placement: 'auto'` for complex responsive scenarios

### Edge Cases

1. **Missing DOM Elements** - If a tour target element doesn't exist (e.g., feature hidden by permissions), handle `TARGET_NOT_FOUND` callback event gracefully by skipping that step
2. **Mid-tour Navigation** - If user navigates away during tour, persist current step index and offer to resume
3. **Concurrent Tours** - Ensure only one tour instance runs at a time (prevent duplicate overlays)
4. **Slow Network** - Handle case where tour starts before features fully load by delaying `run={true}` until DOM ready
5. **Tour Completion State Sync** - If user completes tour on one device, sync completion status across devices via Supabase

## Implementation Notes

### DO
- Install React Joyride: `bun add react-joyride`
- Follow existing TypeScript patterns in the codebase
- Use Tailwind CSS for any custom tour styling (maintain design consistency)
- Integrate with existing Supabase setup for analytics tracking
- Add unique `data-tour` attributes to target elements for reliable selectors
- Wait for DOM readiness before setting `run={true}`
- Use existing Radix UI design tokens for tour overlay colors
- Write unit tests for tour state logic using Vitest
- Test on mobile viewports (375px, 768px, 1024px)

### DON'T
- Create a custom tour library when React Joyride is proven and maintained
- Block users from skipping the tour (respect user agency)
- Use generic CSS classes as selectors (risk of conflicts)
- Start tour before target elements are mounted
- Hardcode tour completion in database (use user preferences table)
- Make tour steps too long (keep content concise)
- Forget to handle keyboard navigation (accessibility)
- Skip TypeScript types for tour state

## Development Environment

### Start Services

```bash
# Install new dependency
bun add react-joyride

# Start development server
npm run dev
```

### Service URLs
- main: http://localhost:3000

### Required Environment Variables
- `VITE_SUPABASE_URL`: https://ecdrxtbclxfpkknasmrw.supabase.co
- `VITE_SUPABASE_PUBLISHABLE_KEY`: (from .env)
- `VITE_SUPABASE_PROJECT_ID`: ecdrxtbclxfpkknasmrw

## Success Criteria

The task is complete when:

1. [ ] React Joyride installed and tour renders without console errors
2. [ ] Tour automatically launches for new users after first login
3. [ ] All 4 feature highlights (Diagnostic, IDEA Framework, Avatar Builder, Brand Coach) are included with educational content
4. [ ] Skip button works on all steps and properly logs skip event
5. [ ] "Start Tour" button in user menu/settings allows revisiting
6. [ ] Analytics events tracked to Supabase (start, complete, skip, step views)
7. [ ] Tour is fully responsive on mobile (tested at 375px, 768px, 1024px)
8. [ ] No console errors or warnings
9. [ ] Existing tests still pass
10. [ ] Tour completion state persists across sessions
11. [ ] Manual browser verification: tour can be completed end-to-end

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| useOnboardingTour hook logic | `test/hooks/useOnboardingTour.test.ts` | Tour state transitions, eligibility checks, reset functionality |
| Tour step definitions | `test/components/OnboardingTour.test.tsx` | All 4 features have valid step configurations |
| Analytics callback handler | `test/lib/analytics.test.ts` | Correct events fired for start/complete/skip/step transitions |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Tour auto-launch on new user login | main ↔ Supabase | Tour appears for users created within last 24hrs who haven't completed tour |
| Tour completion persistence | main ↔ Supabase | Completion status stored and retrieved correctly |
| Skip functionality | main | Skip button closes tour and logs analytics event |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| New User Onboarding | 1. Create new account 2. Complete login 3. Wait for DOM ready | Tour launches automatically on dashboard |
| Complete Tour Flow | 1. Start tour 2. Click through all steps 3. Complete final step | All 4 features highlighted, completion tracked, tour closes |
| Skip Tour Flow | 1. Start tour 2. Click "Skip" button | Tour immediately closes, skip event tracked |
| Revisit Tour Flow | 1. Navigate to settings/menu 2. Click "Start Tour" 3. Tour launches | Tour restarts from beginning |

### Browser Verification (frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Dashboard (new user) | `http://localhost:3000/dashboard` | Tour auto-launches, first step targets Diagnostic feature |
| Tour Step 1 | N/A | Diagnostic feature highlighted with educational tooltip |
| Tour Step 2 | N/A | IDEA Framework explained clearly |
| Tour Step 3 | N/A | Avatar Builder value proposition displayed |
| Tour Step 4 | N/A | Brand Coach feature highlighted as final step |
| Mobile viewport (375px) | `http://localhost:3000/dashboard` | Tooltips position correctly without overflow |
| Settings page | `http://localhost:3000/settings` | "Start Tour" button visible and functional |

### Database Verification (Supabase)
| Check | Query/Command | Expected |
|-------|---------------|----------|
| Analytics events logged | Query Supabase analytics table for tour events | Events for `onboarding_tour_started`, `onboarding_tour_completed`, `onboarding_step_viewed` exist |
| Tour completion stored | Query user preferences/profile table | `onboarding_tour_completed: true` for test user |

### QA Sign-off Requirements
- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass
- [ ] All E2E tests pass (tour flows)
- [ ] Browser verification complete for desktop (1920x1080) and mobile (375x667)
- [ ] Tour works correctly for both new and returning users
- [ ] Skip functionality verified
- [ ] Revisit functionality verified via settings menu
- [ ] Analytics events confirmed in Supabase
- [ ] No regressions in existing functionality (login, dashboard, features)
- [ ] Code follows TypeScript best practices
- [ ] No accessibility violations (keyboard navigation works)
- [ ] No security vulnerabilities (tour doesn't expose sensitive data)
- [ ] Tour content reviewed for clarity and value messaging
