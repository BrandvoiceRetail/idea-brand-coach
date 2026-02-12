

## Fix: Diagnostic Results Not Showing After Completion

### Problem

Two issues cause results to sometimes not display:

1. **Race condition**: For authenticated users, `syncFromLocalStorage()` clears localStorage before `DiagnosticResults` can read it, and the React Query for `latestDiagnostic` hasn't refetched yet -- so both data sources are empty, causing a redirect back to `/diagnostic`.

2. **Data shape mismatch**: `FreeDiagnostic` saves `scores.overall` inside the scores object, but `DiagnosticResults` expects a top-level `overallScore` property.

### Solution

#### 1. Fix `DiagnosticResults.tsx` - Handle both data shapes and avoid premature redirect

- When reading from localStorage, handle both the old format (`overallScore` at top level) and new format (`scores.overall` inside scores object)
- Don't redirect to `/diagnostic` immediately when no data is found for authenticated users -- wait for the query to settle and allow `syncFromLocalStorage` to complete and refetch

#### 2. Fix `FreeDiagnostic.tsx` - Don't sync on the diagnostic page itself

- Remove the auto-sync `useEffect` from `FreeDiagnostic.tsx`. This is the source of the race condition -- it clears localStorage while the user is navigating away.
- Instead, move the sync logic into `DiagnosticResults.tsx` where it can be properly sequenced: read localStorage first for display, then sync to DB in the background.

### Technical Changes

**File: `src/pages/DiagnosticResults.tsx`**
- Update the `useEffect` to:
  - Always try localStorage first (for immediate display)
  - Handle both `overallScore` (old) and `scores.overall` (new) formats
  - For authenticated users, trigger `syncFromLocalStorage` after displaying results
  - Use `latestDiagnostic` from DB as a secondary/updated source
  - Only redirect if truly no data exists anywhere after loading completes

**File: `src/pages/FreeDiagnostic.tsx`**
- Remove the `useEffect` that auto-syncs on this page (lines 204-215)
- This prevents localStorage from being cleared before results page reads it

### Expected Outcome

- Users will always see results immediately after completing the diagnostic (from localStorage)
- Authenticated users will have their data synced to DB in the background
- No more redirects back to `/diagnostic` after completing an assessment

