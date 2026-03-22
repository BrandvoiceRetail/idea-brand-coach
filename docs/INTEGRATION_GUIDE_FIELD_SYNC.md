# Integration Guide: Field Database Sync for Single Avatar Workflow

## Quick Integration Steps

### Step 1: Update BrandCoachV2.tsx

Add the following changes to `src/pages/v2/BrandCoachV2.tsx`:

```typescript
// 1. Add import after other hook imports (around line 19)
import { useFieldDatabaseSync } from '@/hooks/useFieldDatabaseSync';

// 2. After the useFieldExtractionV2 hook (around line 116), add:
const {
  saveAllFields,
  loadFields,
  isSaving,
  isLoading: isLoadingFields,
} = useFieldDatabaseSync({
  avatarId: currentAvatar?.id || null,
  fieldValues,
  fieldSources,
  onFieldLoad: (fieldId, value, source) => {
    // This will be called when fields are loaded from DB
    setFieldManual(fieldId, value);
  },
  autoSave: true,
  saveDebounceMs: 1000, // Save after 1 second of no changes
});

// 3. Update the loading state check (around line 512)
if (isLoadingAuth || isLoadingChapter || isLoadingSessions || isLoadingAvatars || isLoadingFields) {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

// 4. Add a save indicator in the header (around line 530)
{isSaving && (
  <Badge variant="outline" className="text-xs">
    <Loader2 className="h-3 w-3 animate-spin mr-1" />
    Saving...
  </Badge>
)}
```

### Step 2: Update useFieldExtractionV2.ts

Modify the hook to properly handle field loading:

```typescript
// In src/hooks/useFieldExtractionV2.ts

// Add a method to set fields from database (add after line 245)
const setFieldsFromDatabase = useCallback((fields: Record<string, { value: string, source: 'ai' | 'manual' }>) => {
  Object.entries(fields).forEach(([fieldId, field]) => {
    baseHook.setFieldValue(fieldId, field.value, field.source);
  });
}, [baseHook]);

// Add to the return object (around line 254)
return {
  extractFields,
  fieldValues,
  fieldSources,
  fieldMetadata,
  setFieldManual,
  extractedCount,
  clearFields: baseHook.clearFields,
  setFieldLock,
  isFieldLocked,
  setFieldsFromDatabase, // Add this
};
```

### Step 3: Fix Avatar Switching Field Load

Update `useAvatarFieldSync.ts` to trigger field loading:

```typescript
// In src/hooks/useAvatarFieldSync.ts

interface UseAvatarFieldSyncProps {
  currentAvatarId: string | undefined;
  clearFields: () => void;
  loadFields: () => Promise<void>; // Add this
}

export function useAvatarFieldSync({
  currentAvatarId,
  clearFields,
  loadFields, // Add this
}: UseAvatarFieldSyncProps): void {
  const previousAvatarId = useRef<string | undefined>(currentAvatarId);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      previousAvatarId.current = currentAvatarId;
      // Load fields on first mount
      if (currentAvatarId) {
        loadFields();
      }
      return;
    }

    const isActualSwitch =
      previousAvatarId.current !== undefined &&
      currentAvatarId !== undefined &&
      previousAvatarId.current !== currentAvatarId;

    if (isActualSwitch) {
      console.log(`Switching avatars: ${previousAvatarId.current} → ${currentAvatarId}`);
      clearFields();
      // Load new avatar's fields
      loadFields();
    }

    previousAvatarId.current = currentAvatarId;
  }, [currentAvatarId, clearFields, loadFields]);
}
```

### Step 4: Update the useAvatarFieldSync call in BrandCoachV2

```typescript
// Update around line 195 in BrandCoachV2.tsx
useAvatarFieldSync({
  currentAvatarId: currentAvatar?.id,
  clearFields,
  loadFields, // Add this from useFieldDatabaseSync
});
```

## Testing the Integration

### Test Case 1: Single Avatar Field Persistence
1. Open Brand Coach V2
2. Chat with Trevor and let AI extract some fields
3. Manually edit a field
4. Refresh the page
5. **Expected:** All fields should reload with correct values

### Test Case 2: Avatar Switching
1. Fill fields in Avatar 1
2. Create and switch to Avatar 2
3. Fill different fields in Avatar 2
4. Switch back to Avatar 1
5. **Expected:** Avatar 1 fields should be restored

### Test Case 3: Auto-Save Indication
1. Edit a field manually
2. Watch for "Saving..." indicator
3. Check browser console for "[FieldSync]" logs
4. **Expected:** Save completes within 1-2 seconds

## Troubleshooting

### Fields Not Loading
Check console for:
```
[FieldSync] Loading fields for avatar: <avatar-id>
[FieldSync] Loaded X fields from database
```

If not seeing these:
- Verify avatar ID is being passed
- Check Supabase RLS policies
- Ensure avatar_field_values table exists

### Fields Not Saving
Check console for:
```
[FieldSync] Saving fields for avatar: <avatar-id>
[FieldSync] Successfully saved X fields
```

If saves are failing:
- Check network tab for Supabase errors
- Verify user authentication
- Check field value format (strings only)

### Migration from localStorage
On first load with existing data:
```
[FieldSync] Migrated X fields from localStorage
```

This should only happen once per avatar.

## Performance Considerations

1. **Debouncing**: Fields save after 1 second of no changes
2. **Batch Updates**: Multiple fields save in one DB call
3. **Diff Checking**: Only changed fields are saved
4. **Loading State**: UI shows loading while fetching

## Next Steps

After integration:
1. Test with multiple avatars
2. Verify field locking works (manual edits protected from AI)
3. Check performance with many fields (50+)
4. Add error recovery for failed saves
5. Consider adding offline support

## Success Indicators

✅ Fields persist across refreshes
✅ Avatar switching maintains separate fields
✅ Manual edits save automatically
✅ AI extractions save to database
✅ Console shows sync activity
✅ No data loss on avatar switch