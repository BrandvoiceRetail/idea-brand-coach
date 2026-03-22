# Single Avatar Chat Workflow - Ready to Implement

## Summary
The single avatar chat workflow needs field persistence fixes. Chat sessions already support avatars, but fields aren't properly syncing with the database when extracted or edited.

## Core Issue
**Fields are stored in localStorage only, not persisting to the `avatar_field_values` database table.**

## Solution Components Created

### 1. ✅ Field Database Sync Hook
**File:** `src/hooks/useFieldDatabaseSync.ts`
- Auto-loads fields when avatar selected
- Auto-saves field changes (debounced)
- Migrates localStorage → database
- Handles batch updates efficiently

### 2. ✅ Integration Guide
**File:** `docs/INTEGRATION_GUIDE_FIELD_SYNC.md`
- Step-by-step integration instructions
- Code snippets for BrandCoachV2.tsx
- Testing procedures
- Troubleshooting guide

### 3. ✅ Implementation Plan
**File:** `docs/SINGLE_AVATAR_WORKFLOW_FIX.md`
- Current state analysis
- Task breakdown
- Testing checklist
- Success metrics

## Quick Start Implementation (30 minutes)

### Step 1: Import the sync hook (5 min)
In `BrandCoachV2.tsx` after line 19:
```typescript
import { useFieldDatabaseSync } from '@/hooks/useFieldDatabaseSync';
```

### Step 2: Add sync hook (10 min)
After `useFieldExtractionV2` (line 116):
```typescript
const { saveAllFields, loadFields, isSaving } = useFieldDatabaseSync({
  avatarId: currentAvatar?.id || null,
  fieldValues,
  fieldSources,
  onFieldLoad: setFieldManual,
  autoSave: true,
});
```

### Step 3: Update avatar field sync (5 min)
Modify `useAvatarFieldSync` call (line 195):
```typescript
useAvatarFieldSync({
  currentAvatarId: currentAvatar?.id,
  clearFields,
  loadFields, // Add this
});
```

### Step 4: Test (10 min)
1. Edit a field manually
2. Refresh page → Field should persist
3. Switch avatars → Fields should swap
4. Check console for `[FieldSync]` logs

## What This Fixes

### Before:
- ❌ Fields lost on page refresh
- ❌ Fields not loading when switching avatars
- ❌ Manual edits not persisting
- ❌ AI extractions not saving to DB

### After:
- ✅ All fields persist to database
- ✅ Avatar switching loads correct fields
- ✅ Manual edits auto-save (1s debounce)
- ✅ AI extractions save immediately
- ✅ localStorage migrates to DB automatically

## Database Schema (Already Exists)

Table: `avatar_field_values`
```sql
avatar_id     UUID (FK → avatars.id)
field_id      VARCHAR
field_value   TEXT
field_source  ENUM('ai', 'manual')
is_locked     BOOLEAN
confidence    FLOAT
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

## Verification Commands

Check if fields are saving:
```sql
SELECT * FROM avatar_field_values
WHERE avatar_id = '<current-avatar-id>'
ORDER BY updated_at DESC;
```

Check localStorage migration:
```javascript
// In browser console
localStorage.getItem('brandCoach_field_brand_name')
// Should migrate to DB and clear after first load
```

## Performance Metrics

- Field load time: < 500ms
- Auto-save delay: 1 second after last edit
- Batch save: All fields in one DB call
- Migration: One-time per avatar

## Next Steps After Implementation

1. **Add visual feedback:**
   - "Saving..." indicator when syncing
   - "Fields loaded" toast on avatar switch
   - Sync status icon in header

2. **Enhanced features:**
   - Manual save button (in addition to auto-save)
   - Undo/redo for field edits
   - Field history/versions
   - Bulk field operations

3. **Performance optimizations:**
   - IndexedDB for offline support
   - Optimistic updates
   - Background sync worker

## Success Criteria

✅ Single user can:
- Create avatar (auto-created on first login)
- Chat with Trevor
- Have fields extracted automatically
- Edit fields manually
- Refresh page without losing data
- Continue conversation with context

✅ System maintains:
- One avatar per user minimum
- Separate fields per avatar
- Separate chat sessions per avatar
- Consistent state across refreshes

## Support & Debugging

If fields aren't persisting:
1. Check browser console for `[FieldSync]` logs
2. Verify Supabase connection
3. Check RLS policies on `avatar_field_values`
4. Ensure user is authenticated
5. Look for network errors in browser DevTools

Common issues:
- **"No avatar found"** → useDefaultAvatar should create one
- **"Fields not loading"** → Check loadFields() is called
- **"Fields not saving"** → Check autoSave is enabled
- **"Wrong fields shown"** → Verify avatar ID in sync