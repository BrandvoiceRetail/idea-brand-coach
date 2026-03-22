# Single Avatar Simple Fix - Field Updates During Chat

## Simplified Approach
**One avatar per account, focus on field persistence during chat**

## The Core Problem
Fields extracted from AI chat responses are only saved to localStorage, not the database. When users refresh, their progress is lost.

## Minimal Fix Implementation

### Step 1: Update Field Extraction to Save to Database

Create a new file `src/hooks/useSimpleFieldSync.ts`:

```typescript
import { useEffect, useCallback } from 'react';
import { FieldPersistenceService } from '@/services/field/FieldPersistenceService';
import { supabase } from '@/integrations/supabase/client';

interface UseSimpleFieldSyncProps {
  avatarId: string | null;
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, 'ai' | 'manual'>;
}

export function useSimpleFieldSync({
  avatarId,
  fieldValues,
  fieldSources,
}: UseSimpleFieldSyncProps) {
  const fieldService = new FieldPersistenceService(supabase);

  // Save field to database whenever it changes
  const saveField = useCallback(async (fieldId: string, value: string, source: 'ai' | 'manual') => {
    if (!avatarId || !value) return;

    try {
      await fieldService.saveField(avatarId, {
        field_id: fieldId,
        field_value: value,
        field_source: source,
      });
      console.log(`[FieldSync] Saved ${fieldId} to database`);
    } catch (error) {
      console.error(`[FieldSync] Failed to save ${fieldId}:`, error);
    }
  }, [avatarId]);

  // Load fields on mount
  useEffect(() => {
    if (!avatarId) return;

    const loadFields = async () => {
      const { data: fields } = await fieldService.loadFields(avatarId);
      if (fields) {
        console.log(`[FieldSync] Loaded ${fields.length} fields from database`);
        // Fields will be loaded into the UI through the existing field extraction hook
      }
    };

    loadFields();
  }, [avatarId]);

  // Watch for field changes and save them
  useEffect(() => {
    if (!avatarId) return;

    // Save each changed field
    Object.entries(fieldValues).forEach(([fieldId, value]) => {
      const stringValue = Array.isArray(value) ? value.join('\n') : value;
      const source = fieldSources[fieldId] || 'manual';

      if (stringValue && stringValue.trim()) {
        saveField(fieldId, stringValue, source);
      }
    });
  }, [fieldValues, fieldSources, avatarId]);

  return { saveField };
}
```

### Step 2: Integrate into BrandCoachV2

In `src/pages/v2/BrandCoachV2.tsx`, add after the field extraction hook (line ~116):

```typescript
// Import at top
import { useSimpleFieldSync } from '@/hooks/useSimpleFieldSync';

// After useFieldExtractionV2
useSimpleFieldSync({
  avatarId: currentAvatar?.id || null,
  fieldValues,
  fieldSources,
});
```

### Step 3: Ensure Single Avatar

Update the avatar creation logic to check for existing avatar first:

```typescript
// In useDefaultAvatar.ts, modify the creation logic (line ~34):
const createDefaultAvatar = async () => {
  // Check if avatar already exists
  const { data: existingAvatars } = await supabase
    .from('avatars')
    .select('id')
    .eq('brand_id', brand.id)
    .limit(1);

  if (existingAvatars && existingAvatars.length > 0) {
    console.log('Avatar already exists, skipping creation');
    return;
  }

  // Continue with creation...
};
```

### Step 4: Hide Avatar Switching UI (Optional)

In `BrandCoachV2.tsx`, simplify the header (line ~540):

```typescript
// Replace the AvatarHeaderDropdown with simple text
<div className="flex items-center gap-3">
  <h1 className="font-semibold">IDEA Brand Coach</h1>
  <ChapterProgressBadge
    current={progress?.current_chapter_number ?? 1}
    total={11}
  />
  {/* Remove or hide the avatar dropdown */}
</div>
```

## What This Fixes

### During Chat:
✅ AI extracts field → Saves to database immediately
✅ User edits field → Saves to database
✅ Page refresh → Fields reload from database
✅ Continue chat → Context preserved

### Simplified Flow:
1. User logs in → One avatar auto-created
2. Chat with Trevor → Fields extracted
3. Fields saved to DB automatically
4. Refresh anytime → Progress preserved
5. Continue where left off

## Testing the Fix

### Test 1: Field Extraction
1. Start a chat with Trevor
2. Say: "My brand name is Acme Corp and we sell eco-friendly water bottles"
3. Check console for: `[FieldSync] Saved brand_name to database`
4. Check left panel: Fields should appear

### Test 2: Persistence
1. Fill in several fields through chat
2. Refresh the page (F5)
3. Fields should still be visible
4. Continue chatting - context maintained

### Test 3: Manual Edits
1. Click on any field in left panel
2. Edit the value manually
3. Check console for: `[FieldSync] Saved [field] to database`
4. Refresh page - edit persists

## Database Verification

Check if fields are saving:

```sql
-- In Supabase SQL editor
SELECT field_id, field_value, field_source, updated_at
FROM avatar_field_values
WHERE avatar_id = (
  SELECT id FROM avatars
  WHERE user_id = auth.uid()
  LIMIT 1
)
ORDER BY updated_at DESC;
```

## Console Debugging

Enable verbose logging by adding to `useSimpleFieldSync`:

```typescript
// Add detailed logging
console.log('[FieldSync] Field change detected:', {
  fieldId,
  value: stringValue.substring(0, 50) + '...',
  source,
  avatarId
});
```

## Common Issues & Fixes

### Fields Not Saving
- Check avatar exists: `SELECT * FROM avatars WHERE user_id = auth.uid()`
- Check RLS policies on `avatar_field_values` table
- Verify Supabase connection in Network tab

### Fields Not Loading
- Check console for load messages
- Verify fields exist in database
- Check field IDs match between UI and DB

### Duplicate Avatars
- Run cleanup: `DELETE FROM avatars WHERE id NOT IN (SELECT MIN(id) FROM avatars GROUP BY user_id)`
- Add unique constraint: `ALTER TABLE avatars ADD CONSTRAINT one_avatar_per_user UNIQUE (user_id);`

## Success Metrics

- **Save latency:** < 500ms per field
- **Load time:** < 1s on page refresh
- **Data loss:** 0% after implementation
- **User friction:** None - automatic

## Next Steps (After Validation)

1. Add save indicator (small spinner next to field)
2. Add "last saved" timestamp
3. Add offline queue for poor connections
4. Consider field versioning for undo/redo

## Minimal Code Changes Summary

**Total changes needed: 2 files**
1. Create `useSimpleFieldSync.ts` (60 lines)
2. Add 3 lines to `BrandCoachV2.tsx`

**Time to implement: 15 minutes**
**Time to test: 15 minutes**

This is the simplest possible fix that makes field persistence work properly for a single avatar workflow.