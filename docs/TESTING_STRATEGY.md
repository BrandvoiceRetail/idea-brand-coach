# Testing Strategy

Comprehensive testing guide for the IDEA Brand Coach application covering unit tests, field sync testing, feature flag testing, manual QA, and beta testing procedures.

---

## Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run with Vitest UI
npm run test:ui

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

### Test Coverage Targets

- Target: >= 85% coverage for all new code
- Unit tests for utilities and hooks
- Component tests for UI logic
- Integration tests for data flows

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('should render with title', () => {
    render(<Component title="Test" onAction={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should call onAction when clicked', () => {
    const mockAction = vi.fn();
    render(<Component title="Test" onAction={mockAction} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});
```

---

## Unit Testing

### Principles

- Pure logic tests with no external dependencies
- Component tests use `@testing-library/react`
- Integration tests combine multiple components/services
- Follow TDD when possible (see best practices guide: `node_modules/@matthewkerns/software-development-best-practices-guide/04-quality-through-testing/TDD_WORKFLOW.md`)

### Feature Flag Unit Tests

```typescript
// src/hooks/useFeatureFlag.test.ts
import { describe, it, expect } from 'vitest';
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

### Integration Test Example (Playwright)

```typescript
// tests/integration/feature-flag-flow.test.ts
import { test, expect } from '@playwright/test';

test('v2-multi-avatar rollout', async ({ page }) => {
  await page.goto('/avatar');
  await expect(page.locator('[data-testid="single-avatar"]')).toBeVisible();

  // Update flag to 100% (via admin API or code)
  await page.reload();
  await expect(page.locator('[data-testid="multi-avatar"]')).toBeVisible();
});
```

---

## Field Sync Testing

### Data Flow Architecture

Text fields follow this pipeline:

1. **User Input** - Text field on page (Brand Canvas, Avatar Builder, etc.)
2. **Local Save** - `usePersistedField` hook saves to IndexedDB (instant, <10ms)
3. **Supabase Sync** - `SupabaseSyncService` syncs to `user_knowledge_base` table (background)
4. **OpenAI Sync** - `sync-to-openai-vector-store` uploads to OpenAI Vector Stores
5. **Chatbot Retrieval** - Brand Coach GPT retrieves from Vector Stores

### Verification Points

- **Local:** Check browser IndexedDB -> `idea-brand-coach` -> `knowledge_entries`
- **Supabase:** Check `user_knowledge_base` table for entry with matching `field_identifier`
- **OpenAI:** Check entry has `openai_file_id` and `openai_synced_at`
- **Chatbot:** Ask chatbot and verify it references the data

### Fields to Test

#### Brand Canvas (`/brand-canvas`)

| Field Identifier | Field Name | Test Value |
|-----------------|------------|------------|
| `canvas_brand_purpose` | Brand Purpose | "My test purpose is to help people succeed" |
| `canvas_brand_vision` | Brand Vision | "My vision is a world where everyone thrives" |
| `canvas_brand_mission` | Brand Mission | "My mission is to provide exceptional tools" |
| `canvas_positioning_statement` | Positioning Statement | "We position ourselves as the trusted leader" |
| `canvas_value_proposition` | Value Proposition | "We deliver unmatched value through innovation" |
| `canvas_brand_voice` | Brand Voice | "Our voice is friendly yet professional" |
| `canvas_brand_values` | Brand Values (Array) | ["Integrity", "Innovation", "Excellence"] |
| `canvas_brand_personality` | Brand Personality (Array) | ["Trustworthy", "Bold", "Caring"] |

**Chatbot test query:** "What do you know about my brand purpose, vision, and mission?"

#### Avatar Builder (`/avatar`)

| Field Identifier | Field Name | Test Value |
|-----------------|------------|------------|
| `avatar_name` | Avatar Name | "Sarah the Strategic Shopper" |
| `avatar_demographics_age` | Age | "35-45" |
| `avatar_demographics_income` | Income | "$75,000-$100,000" |
| `avatar_demographics_location` | Location | "Urban areas in Northeast USA" |
| `avatar_demographics_lifestyle` | Lifestyle | "Busy professional with two kids" |
| `avatar_psychology_values` | Values (Array) | ["Family", "Success", "Time"] |
| `avatar_psychology_fears` | Fears (Array) | ["Missing out", "Making wrong choice"] |
| `avatar_psychology_desires` | Desires (Array) | ["Simplicity", "Premium quality"] |
| `avatar_psychology_triggers` | Triggers (Array) | ["Social proof", "Scarcity", "Authority"] |
| `avatar_buying_behavior_intent` | Buyer Intent | "high" |
| `avatar_buying_behavior_decision_factors` | Decision Factors (Array) | ["Reviews", "Brand trust", "Price"] |
| `avatar_buying_behavior_shopping_style` | Shopping Style | "Research-heavy, comparison shopping" |
| `avatar_buying_behavior_price_consciousness` | Price Consciousness | "moderate" |
| `avatar_voice_customer_feedback` | Voice of Customer | "I love the quality but wish it was easier to find" |

**Chatbot test query:** "What do you know about my target customer avatar?"

### Field Sync Testing Procedure

#### Setup (Before Testing)

1. **Get User ID:** Run in browser console: `localStorage.getItem('supabase.auth.token')`
2. **Clear Supabase data:**
   ```sql
   DELETE FROM chat_messages WHERE user_id = 'YOUR_USER_ID';
   DELETE FROM user_knowledge_base WHERE user_id = 'YOUR_USER_ID';
   ```
3. **Clear IndexedDB:** DevTools -> Application -> IndexedDB -> Delete `idea-brand-coach` -> Refresh

#### Per-Field Test Steps

1. Navigate to the page and enter test value in the field
2. Wait 5 seconds for debounce + sync
3. **Verify Local:** DevTools -> Application -> IndexedDB -> `idea-brand-coach` -> `knowledge_entries`
4. **Verify Supabase:** Check `user_knowledge_base` table for `field_identifier` match, `is_current = true`
5. **Trigger OpenAI sync** (if not automatic):
   ```bash
   curl -X POST 'https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/sync-to-openai-vector-store' \
     -H "Authorization: Bearer [YOUR_ANON_KEY]" \
     -H "Content-Type: application/json" \
     -d '{"user_id": "[YOUR_USER_ID]", "category": "canvas"}'
   ```
6. **Verify OpenAI:** Check `openai_file_id` is NOT NULL in `user_knowledge_base`
7. **Test chatbot:** Navigate to Brand Coach, ask test query, verify response references the data

#### Quick IndexedDB Check Script

```javascript
// Paste in browser console
(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('idea-brand-coach');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction(['knowledge_entries'], 'readonly');
  const store = tx.objectStore('knowledge_entries');
  const all = await store.getAll();
  console.table(all.map(e => ({
    field: e.fieldIdentifier,
    content: e.content.substring(0, 50) + '...',
    synced: e.lastSyncedAt ? 'Yes' : 'No'
  })));
})();
```

### Success Criteria

A field is "Working" when:
- Saves to IndexedDB within 1 second
- Syncs to Supabase within 10 seconds
- Has `openai_file_id` within 60 seconds (or manual trigger)
- Chatbot retrieves and uses the value

Overall target: 90%+ fields working (20/22).

### Common Field Sync Issues

| Issue | Check | Fix |
|-------|-------|-----|
| Not saving to IndexedDB | Browser console for errors | Verify `usePersistedField` hook initialization |
| Not syncing to Supabase | Network tab for failed requests | Verify user authenticated; check RLS policies |
| Not syncing to OpenAI | `openai_file_id` is NULL | Manually trigger sync; check OpenAI API key |
| Chatbot ignores data | Edge function logs | Verify `openai_file_id` set; check vector store IDs |

---

## Feature Flag Testing

### Manual Browser Testing

1. Set flag value in `src/hooks/useFeatureFlag.ts`
2. Run `npm run dev`
3. Navigate to page with feature flag
4. Verify correct version displays
5. Toggle `enabled` / `sessionPercentage` and reload to verify both paths

### Percentage Rollout Testing

**Automated verification:**
```typescript
import { testPercentageDistribution } from '@/hooks/useFeatureFlag';
console.log(testPercentageDistribution(50, 1000));
// Expected: ~50% with <1% deviation
```

**Manual browser testing:**
1. Set `sessionPercentage` to target value (e.g., 50)
2. In browser console: `sessionStorage.clear()`
3. Reload page, note which version appears
4. Repeat 20-30 times
5. Calculate: `(V2 count / total) * 100` should approximate target

### User ID Targeting Testing

```typescript
'my-feature': {
  enabled: true,
  targeting_rules: {
    userIds: ['your-test-user-uuid'],
  },
}
```

1. Log in as whitelisted user -> should see V2
2. Log in as different user -> should see V1
3. Log out (anonymous) -> should see V1

### Admin UI Testing

1. Navigate to `http://localhost:5173/admin/feature-flags`
2. Toggle flag on/off in admin tab
3. Adjust percentage slider
4. Reload feature page in separate tab to verify changes
5. Note: admin UI changes are in-memory only and reset on refresh/deploy

---

## Manual Testing (P0 Beta)

### Test Environment Setup

**Prerequisites:**
- Access to staging environment
- Valid test email addresses (Gmail for OAuth testing)
- Multiple browsers for cross-browser testing
- Mobile device or browser dev tools for responsive testing

### Feature 1: Brand Diagnostic Flow

#### 1.1 Anonymous Diagnostic Completion
1. Navigate to homepage -> Click "Start Free Diagnostic"
2. Complete all 6 questions (vary scores 1-5)
3. Test "Previous" button, validation (proceed without answer)
4. Click "Complete Assessment" on final question

**Expected:** Progress bar updates; Next disabled until answer selected; Modal shows correct score; Modal offers Sign Up / Sign In tabs.

#### 1.2 Account Creation from Diagnostic
1. Complete diagnostic, switch to "Sign Up" tab in modal
2. Fill: Name, Email (`testuser+[timestamp]@gmail.com`), Password
3. Click "Create Free Account"

**Expected:** Form validation works; Success toast; Auto signed in; Redirect to `/diagnostic/results`; Data persisted to DB.

#### 1.3 Sign In from Diagnostic (Existing User)
1. Complete diagnostic, switch to "Sign In" tab
2. Enter existing credentials

**Expected:** Login succeeds; localStorage data synced to DB; Previous diagnostics preserved.

#### 1.4 Google OAuth
1. Complete diagnostic -> Click "Continue with Google"
2. Complete OAuth flow

**Expected:** OAuth popup opens; Profile auto-created; Diagnostic data synced.

#### 1.5 Skip Account Creation
1. Complete diagnostic -> Click "Skip for now - View Results"

**Expected:** Results page shows scores; Data in localStorage only; Data lost after browser close.

### Feature 2: Authentication System

#### 2.1 Email/Password Sign Up
- Navigate to `/auth` -> "Sign Up" tab -> Fill form -> Submit
- Test validation: invalid email, short password, missing name

#### 2.2 Email/Password Sign In
- Navigate to `/auth` -> Enter credentials -> Submit
- Test wrong password, non-existent email -> Error toast

#### 2.3 Password Reset
- Click "Forgot password?" -> Enter email -> Check email -> Reset -> Sign in with new password

#### 2.4 Sign Out
- Sign in -> Click "Sign Out" -> Verify session cleared, protected routes inaccessible

#### 2.5 Protected Routes
- Sign out -> Navigate to `/brand-coach` directly -> Verify redirect to `/auth`

### Feature 3: Brand Coach GPT with RAG

#### 3.1 Access Brand Coach
- Sign in with completed diagnostic -> Navigate to Brand Coach
- Verify: page loads, diagnostic scores in profile card, suggested prompts visible

#### 3.2 Diagnostic-Based Suggested Prompts
- Sign in with low "Insight" score -> Check prompts reflect weaknesses
- Low Distinctive -> "What makes my brand stand out?"
- Low Empathetic -> "How do I build deeper emotional connections?"
- Low Authentic -> "How can I communicate more authentically?"

#### 3.3 Send Chat Message
- Type "How can I improve my brand messaging?" -> Send
- **Expected:** Loading spinner; User message right-aligned blue; AI response left-aligned gray; Response references IDEA framework; Input cleared.

#### 3.4 Chat Persistence
- Send 2-3 messages -> Sign out -> Sign in -> Navigate to Brand Coach
- **Expected:** All previous messages displayed in correct order.

#### 3.5 Clear Chat History
- Send messages -> Click "Clear Chat" -> Confirm
- **Expected:** Messages removed; Success toast; Suggested prompts reappear.

#### 3.6 Document Upload
- Click document upload area -> Select PDF -> Wait for upload
- **Expected:** Progress bar; Success toast; Document in list with "Processing" status; Status changes to "Completed".
- Test invalid file type (error toast) and >10MB file (error toast).

#### 3.7 RAG-Enhanced Responses
- Upload document with specific brand info -> Wait for processing -> Ask related question
- **Expected:** AI response references uploaded document content.

#### 3.8 Keyboard Shortcuts
- Enter: sends message
- Shift+Enter: new line

### Feature 4: Integration & Cross-Cutting

#### 4.1 Complete User Journey (E2E)
1. Start anonymous on homepage
2. Complete diagnostic
3. Create account from modal
4. View results page
5. Navigate to Brand Coach
6. Upload document
7. Send 3 messages
8. Sign out, sign in again
9. Verify all data persists

#### 4.2 Cross-Browser Compatibility
Test in: Chrome, Firefox, Safari, Edge (latest versions).

#### 4.3 Mobile Responsiveness
- Open on mobile or dev tools mobile view
- Complete diagnostic, create account, use Brand Coach
- **Expected:** No horizontal scroll; touch works; forms usable; chat functional.

#### 4.4 Error Handling
- **Network offline:** Disable network mid-operation -> Error toast, no crash
- **Invalid session:** Delete session from Supabase -> Redirect to auth
- **Rate limiting:** Rapid chat messages -> Graceful handling
- **Large file:** Upload >10MB -> Validation error before upload

### Defect Reporting Template

```
**Title:** [Brief description]
**Severity:** [Critical/High/Medium/Low]
**Environment:** [Browser, OS, Device]
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
**Expected Result:** [What should happen]
**Actual Result:** [What actually happened]
**Screenshots:** [If applicable]
**Console Errors:** [Any errors from browser console]
```

---

## Beta Testing

### Test Checklist Summary

#### Brand Diagnostic Flow
- [ ] Anonymous diagnostic completion
- [ ] Account creation from diagnostic
- [ ] Sign in from diagnostic
- [ ] Google OAuth from diagnostic
- [ ] Skip account creation
- [ ] Data persistence and sync
- [ ] Score calculation accuracy

#### Authentication System
- [ ] Email/password sign up
- [ ] Email/password sign in
- [ ] Google OAuth sign up / sign in
- [ ] Password reset
- [ ] Sign out
- [ ] Protected route guards
- [ ] Session persistence

#### Brand Coach GPT
- [ ] Access (authenticated only)
- [ ] Diagnostic scores displayed
- [ ] Suggested prompts (based on scores)
- [ ] Send/receive chat messages
- [ ] Chat history persistence
- [ ] Clear chat history
- [ ] Document upload and processing
- [ ] RAG-enhanced responses
- [ ] Keyboard shortcuts

#### Integration & Cross-Cutting
- [ ] Complete user journey (end-to-end)
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness
- [ ] Error handling and recovery
- [ ] Performance (page load <3s)
- [ ] Accessibility (keyboard navigation)

### Sign-Off

**Tester Name:** _______________
**Date Completed:** _______________
**Overall Assessment:** _______________
**Blockers Found:** _______________
**Ready for Beta Launch:** [ ] Yes [ ] No

---

## Time Budget (Field Sync Testing)

| Task | Time | Notes |
|------|------|-------|
| Setup & Clear | 15 min | Get user ID, clear databases |
| Brand Canvas Testing | 60 min | 8 fields x 7 min each |
| Avatar Testing | 90 min | 14 fields x 6 min each |
| Chatbot Verification | 30 min | Test queries for both |
| Bug Investigation | 60 min | For any failures |
| Documentation | 30 min | Fill in results table |
| Final Report | 15 min | Summary + next steps |
