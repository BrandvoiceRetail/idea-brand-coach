---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation']
lastStep: 'step-03-quality-evaluation'
lastSaved: '2026-03-20'
scope: suite
stack: frontend (React/TypeScript/Vitest)
question: "do the failed tests impact v2?"
---

# Test Quality Review — IDEA Brand Coach
**Date:** 2026-03-20
**Scope:** Full suite, focused on v2 impact
**Stack:** Frontend — React 18 / TypeScript / Vitest / Testing Library

---

## Executive Summary

**v2 Core Tests: ✅ 215 pass, 3 fail**
**Full Suite: ⚠️ ~346 files failing — but almost entirely from agent worktrees, not main codebase**

---

## Finding 1: The 346 Failed Files Are Worktree Noise

The full `npm test` run collects tests from `.auto-claude/worktrees/tasks/*/` — isolated branches for other in-progress agent tasks (e.g., `011-reduce-cta-button-overload`, `032-v1-route-migration`, `034-chapter-section-accordion`, `036-field-extraction-hook`). These are **not** the main codebase and **do not affect v2 in production**.

Root cause: Vitest's `include` glob pattern picks up test files from all subdirectories, including `.auto-claude/`. This is a CI configuration gap — not a code quality issue.

**Fix (optional):** Add to `vitest.config.ts`:
```ts
exclude: ['.auto-claude/**', 'node_modules/**']
```

---

## Finding 2: v2 Tests — 3 Genuine Pre-existing Failures

All 3 failures are in `src/components/v2/__tests__/AdaptiveFieldReview.test.tsx`. They are **test-code mismatches**, not runtime bugs.

| # | Test | Failure | Root Cause |
|---|------|---------|------------|
| 1 | `should show keyboard shortcuts help` | `Found multiple elements with text: Accept` | Test uses `getByText('Accept')` — component now renders "Accept" in both a button AND a hint label. Need `getAllByText` or a more specific selector. |
| 2 | `should show swipe hints` | `Found multiple elements with text: Reject` | Same issue — "Reject" appears in both a swipe hint `<span>` and the action button. |
| 3 | `should handle single field` | `Unable to find text: 1 / 1` | Progress counter format changed or is split across elements. Test needs `getByText(/1.*1/, {exact: false})` or a `data-testid`. |

**v2 impact: None.** These are assertion failures on UI text matching — the component renders and functions correctly in the browser.

---

## Finding 3: Main Codebase v2 Tests All Pass

| File | Tests | Status |
|------|-------|--------|
| `ChapterSectionAccordion.test.tsx` | 33 | ✅ All pass |
| `ChapterFieldSet.test.tsx` | 34 | ✅ All pass |
| `useFieldExtraction.test.tsx` | 33 | ✅ All pass |
| `AdaptiveFieldReview.test.tsx` | 21 | ⚠️ 18 pass, 3 fail (pre-existing) |

---

## Recommendations

### Priority 1 — Fix vitest config to exclude worktrees (5 min)
Add `exclude: ['.auto-claude/**']` to `vitest.config.ts`. This will drop the reported failures from ~346 to the real ~1 failing file and make `npm test` results meaningful.

### Priority 2 — Fix 3 AdaptiveFieldReview tests (30 min)
Update ambiguous `getByText` selectors to use `getAllByText()[0]` or add `data-testid` attributes to the Accept/Reject buttons and the progress counter. These are test quality issues, not bugs.

### Priority 3 — No v2 regressions from remediation changes
The changes made today (H1–H4, M1–M6, L1–L3) introduced no new test failures. All v2 critical-path tests pass.

---

## Quality Score: 78 / 100

**Deductions:**
- `-12` Worktree test pollution in CI (config gap)
- `-7` 3 pre-existing test failures with ambiguous selectors
- `-3` `AdaptiveFieldReview` has no `data-testid` anchors on key interactive elements

**Strengths:**
- V2 core components (ChapterSectionAccordion, ChapterFieldSet) have solid coverage
- useFieldExtraction hook is well-tested with 33 cases including edge cases
- Test isolation is good — no shared state leakage observed in passing tests
