# Single Avatar Chat Workflow - Implementation Plan

## Current State Analysis

### ✅ What's Working:
1. **Avatar Management** - Creation, switching, and persistence via `useAvatarService`
2. **Default Avatar** - Automatically created for new users via `useDefaultAvatar`
3. **Field Extraction** - AI responses extract fields with `useFieldExtractionV2`
4. **Chat Sessions** - Associated with avatars via `avatar_id`
5. **Database Schema** - Tables exist for avatars, fields, and sessions

### ❌ Issues to Fix:
1. **Field Loading** - Fields not loading from DB when switching avatars
2. **Field Persistence** - Fields may only be in localStorage, not DB
3. **Session Context** - Chat may lose context when switching avatars
4. **Field Sync** - Manual edits may not persist to the database

## Implementation Tasks

### Task 1: Fix Field Loading from Database (Priority: P0)

**Problem:** When switching avatars, fields are cleared but not loaded from the database.

**Solution:**
```typescript
// In useFieldExtractionV2.ts or create new useAvatarFields.ts
const loadFieldsFromDatabase = async (avatarId: string) => {
  const fieldService = new FieldPersistenceService(supabase);
  const { data: fields, error } = await fieldService.loadFields(avatarId);

  if (fields) {
    // Convert DB fields to fieldValues format
    fields.forEach(field => {
      setFieldValue(field.field_id, field.field_value);
      setFieldSource(field.field_id, field.field_source);
    });
  }
};

// Add to avatar switch effect
useEffect(() => {
  if (currentAvatarId) {
    loadFieldsFromDatabase(currentAvatarId);
  }
}, [currentAvatarId]);
```

### Task 2: Ensure Field Persistence to Database (Priority: P0)

**Problem:** Fields may only save to localStorage, not the database.

**Solution:**
```typescript
// Modify setFieldManual in useFieldExtractionV2
const setFieldManual = useCallback(async (fieldId: string, value: string) => {
  // Update local state immediately
  baseHook.setFieldManual(fieldId, value);

  // Persist to database
  if (avatarId) {
    const fieldService = new FieldPersistenceService(supabase);
    await fieldService.saveField(avatarId, {
      field_id: fieldId,
      field_value: value,
      field_source: 'manual',
    });
  }
}, [avatarId, baseHook]);
```

### Task 3: Add Field Database Sync Hook (Priority: P0)

**Create:** `src/hooks/useFieldDatabaseSync.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { FieldPersistenceService } from '@/services/field/FieldPersistenceService';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from '@/lib/utils';

export function useFieldDatabaseSync(
  avatarId: string | null,
  fieldValues: Record<string, string>,
  fieldSources: Record<string, 'ai' | 'manual'>
) {
  const fieldService = new FieldPersistenceService(supabase);

  // Load fields when avatar changes
  useEffect(() => {
    if (!avatarId) return;

    const loadFields = async () => {
      const { data: fields } = await fieldService.loadFields(avatarId);
      if (fields) {
        // Update local state with DB values
        fields.forEach(field => {
          if (field.field_value) {
            // Trigger field update in parent component
            updateFieldFromDB(field.field_id, field.field_value, field.field_source);
          }
        });
      }
    };

    loadFields();
  }, [avatarId]);

  // Save fields to DB (debounced)
  const saveFieldToDB = useCallback(
    debounce(async (fieldId: string, value: string, source: 'ai' | 'manual') => {
      if (!avatarId) return;

      await fieldService.saveField(avatarId, {
        field_id: fieldId,
        field_value: value,
        field_source: source,
      });
    }, 500),
    [avatarId]
  );

  // Watch for field changes and save
  useEffect(() => {
    Object.entries(fieldValues).forEach(([fieldId, value]) => {
      const source = fieldSources[fieldId] || 'manual';
      saveFieldToDB(fieldId, value, source);
    });
  }, [fieldValues, fieldSources]);
}
```

### Task 4: Update BrandCoachV2 Integration (Priority: P0)

**Modify:** `src/pages/v2/BrandCoachV2.tsx`

```typescript
// Add after line 116 (useFieldExtractionV2)
import { useFieldDatabaseSync } from '@/hooks/useFieldDatabaseSync';

// Add after field extraction setup
useFieldDatabaseSync(
  currentAvatar?.id || null,
  fieldValues,
  fieldSources
);
```

### Task 5: Fix Chat Session Continuity (Priority: P1)

**Problem:** Chat sessions may not properly switch with avatars.

**Solution in BrandCoachV2:**
```typescript
// Ensure sessions reload when avatar changes
useEffect(() => {
  if (currentAvatar?.id) {
    // This should trigger session reload for the avatar
    // The useChatSessions hook already has avatarId parameter
    // Just need to ensure it's reactive
  }
}, [currentAvatar?.id]);
```

### Task 6: Add Field Migration from localStorage (Priority: P1)

**Create migration utility:**
```typescript
// In useFieldDatabaseSync or separate migration
const migrateLocalStorageFields = async (avatarId: string) => {
  const fieldService = new FieldPersistenceService(supabase);
  const { migrated, error } = await fieldService.migrateFromLocalStorage(avatarId);

  if (migrated > 0) {
    console.log(`Migrated ${migrated} fields from localStorage to database`);
    // Clear localStorage after successful migration
    clearLocalStorageFields();
  }
};

// Run once per avatar
useEffect(() => {
  if (avatarId && !hasMigrated.current[avatarId]) {
    migrateLocalStorageFields(avatarId);
    hasMigrated.current[avatarId] = true;
  }
}, [avatarId]);
```

## Testing Checklist

### Single Avatar Flow:
- [ ] User logs in → Default avatar created automatically
- [ ] Chat with Trevor → Fields extracted from responses
- [ ] Manual field edits → Persist to database
- [ ] Page refresh → Fields reload correctly
- [ ] Continue chat → Previous context maintained

### Avatar Switching Flow:
- [ ] Create second avatar
- [ ] Fill some fields in Avatar 1
- [ ] Switch to Avatar 2 → Avatar 1 fields cleared from view
- [ ] Fill different fields in Avatar 2
- [ ] Switch back to Avatar 1 → Avatar 1 fields restored
- [ ] Chat sessions remain separate per avatar

### Field Persistence:
- [ ] AI-extracted fields → Save to DB
- [ ] Manual field edits → Save to DB
- [ ] Locked fields → Respect lock status
- [ ] Field conflicts → Manual takes priority

## Implementation Order

1. **Day 1 Morning:** Implement useFieldDatabaseSync hook
2. **Day 1 Afternoon:** Integrate with BrandCoachV2
3. **Day 2 Morning:** Test single avatar flow end-to-end
4. **Day 2 Afternoon:** Test avatar switching and field persistence
5. **Day 3:** Fix any issues and add migration utility

## Success Metrics

- Fields persist across page refreshes
- Avatar switching maintains separate field sets
- Chat sessions stay associated with correct avatar
- No data loss when switching avatars
- Manual edits always preserved
- Performance: Field loads < 500ms

## Code Quality Checklist

- [ ] TypeScript types for all field operations
- [ ] Error handling for DB operations
- [ ] Loading states during field fetch
- [ ] Debounced saves to prevent overload
- [ ] Console logging for debugging
- [ ] Unit tests for sync logic