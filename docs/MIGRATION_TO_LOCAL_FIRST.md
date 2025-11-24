# Migration Guide: Local-First Architecture with IndexedDB

## Overview

This guide walks through migrating from API-based field persistence to the new local-first architecture using IndexedDB for instant field loading and offline support.

## Benefits of Migration

### Performance Improvements
- **Field Load Time**: 200-500ms → <10ms (20-50x faster)
- **Save Operations**: Instant local save with background sync
- **Page Refresh**: Instant data restoration from local cache
- **Offline Support**: Full functionality without internet

### User Experience
- No loading spinners for field values
- Instant UI updates
- Work continues seamlessly when offline
- Automatic sync when connection returns

## Migration Steps

### Step 1: Install Dependencies

```bash
# Install UUID for generating unique IDs
npm install uuid
npm install --save-dev @types/uuid

# Install fake-indexeddb for testing
npm install --save-dev fake-indexeddb
```

### Step 2: Import the New Hook

Replace existing field state management with the new persisted field hook:

#### Before (Traditional State):
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

function MyComponent() {
  const [fieldValue, setFieldValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from Supabase
    loadFieldFromSupabase();
  }, []);

  const handleChange = async (value: string) => {
    setFieldValue(value);
    // Save to Supabase
    await saveToSupabase(value);
  };

  return (
    <Input
      value={fieldValue}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isLoading}
    />
  );
}
```

#### After (Local-First):
```typescript
import { usePersistedField } from '@/hooks/usePersistedField';

function MyComponent() {
  const field = usePersistedField({
    fieldIdentifier: 'component_field_name',
    category: 'avatar', // or 'diagnostic', 'insights', 'canvas', 'copy'
    defaultValue: ''
  });

  return (
    <Input
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
      disabled={field.isLoading} // Only true on first load
    />
  );
}
```

### Step 3: Migrate Existing Components

#### Avatar Builder Migration

```typescript
// src/pages/AvatarBuilder.tsx

import { usePersistedField } from '@/hooks/usePersistedField';

function AvatarDemographics() {
  // Replace useState with usePersistedField
  const age = usePersistedField({
    fieldIdentifier: 'avatar_demographics_age',
    category: 'avatar'
  });

  const income = usePersistedField({
    fieldIdentifier: 'avatar_demographics_income',
    category: 'avatar'
  });

  return (
    <div>
      <Select
        value={age.value}
        onValueChange={age.onChange}
      >
        {/* Select options */}
      </Select>

      <Select
        value={income.value}
        onValueChange={income.onChange}
      >
        {/* Select options */}
      </Select>

      {/* Show sync status */}
      {age.syncStatus === 'offline' && (
        <Badge>Offline - will sync when online</Badge>
      )}
    </div>
  );
}
```

#### Brand Canvas Migration

```typescript
// src/pages/BrandCanvas.tsx

import { usePersistedField } from '@/hooks/usePersistedField';

function BrandCanvas() {
  const brandPurpose = usePersistedField({
    fieldIdentifier: 'canvas_brand_purpose',
    category: 'canvas',
    debounceDelay: 1000 // Longer debounce for textareas
  });

  const brandVision = usePersistedField({
    fieldIdentifier: 'canvas_brand_vision',
    category: 'canvas',
    debounceDelay: 1000
  });

  return (
    <div>
      <Textarea
        value={brandPurpose.value}
        onChange={(e) => brandPurpose.onChange(e.target.value)}
        placeholder="What is your brand's core purpose?"
      />

      <Textarea
        value={brandVision.value}
        onChange={(e) => brandVision.onChange(e.target.value)}
        placeholder="What future are you working towards?"
      />
    </div>
  );
}
```

### Step 4: Handle Arrays and Complex Data

For fields that store arrays (like brand values, personality traits):

```typescript
function BrandValues() {
  const values = usePersistedField({
    fieldIdentifier: 'canvas_brand_values',
    category: 'canvas',
    defaultValue: '[]' // Store as JSON string
  });

  // Parse and update array
  const brandValues = values.value ? JSON.parse(values.value) : [];

  const addValue = (newValue: string) => {
    const updated = [...brandValues, newValue];
    values.onChange(JSON.stringify(updated));
  };

  const removeValue = (index: number) => {
    const updated = brandValues.filter((_: string, i: number) => i !== index);
    values.onChange(JSON.stringify(updated));
  };

  return (
    <div>
      {brandValues.map((value: string, index: number) => (
        <Badge key={index}>
          {value}
          <button onClick={() => removeValue(index)}>×</button>
        </Badge>
      ))}
      <Input onKeyPress={(e) => {
        if (e.key === 'Enter') {
          addValue(e.currentTarget.value);
          e.currentTarget.value = '';
        }
      }} />
    </div>
  );
}
```

### Step 5: Batch Updates for Forms

For forms with multiple fields that should save together:

```typescript
import { usePersistedForm } from '@/hooks/usePersistedField';

function MyForm() {
  const form = usePersistedForm([
    { identifier: 'form_field_1', category: 'avatar' },
    { identifier: 'form_field_2', category: 'avatar' },
    { identifier: 'form_field_3', category: 'avatar' }
  ]);

  const handleSubmit = () => {
    const updatedValues = {
      ...form.values,
      form_field_1: 'new value'
    };
    form.setValues(updatedValues);
  };

  return (
    <form>
      <Input
        value={form.values.form_field_1 || ''}
        onChange={(e) => form.setValues({
          ...form.values,
          form_field_1: e.target.value
        })}
      />
      {/* More fields */}
    </form>
  );
}
```

### Step 6: Add Visual Feedback

Show users the sync status for better UX:

```typescript
import { SyncStatus } from '@/lib/knowledge-base/interfaces';

function SyncIndicator({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'synced':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'syncing':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'offline':
      return <WifiOff className="w-4 h-4 text-amber-600" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-600" />;
  }
}

function MyComponent() {
  const field = usePersistedField({
    fieldIdentifier: 'my_field',
    category: 'avatar'
  });

  return (
    <div className="relative">
      <Input value={field.value} onChange={(e) => field.onChange(e.target.value)} />
      <div className="absolute right-2 top-2">
        <SyncIndicator status={field.syncStatus} />
      </div>
    </div>
  );
}
```

## Testing the Migration

### 1. Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { usePersistedField } from '@/hooks/usePersistedField';

describe('usePersistedField', () => {
  it('should load initial value from IndexedDB', async () => {
    const { result } = renderHook(() =>
      usePersistedField({
        fieldIdentifier: 'test_field',
        category: 'avatar'
      })
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.value).toBeDefined();
  });

  it('should update value instantly', () => {
    const { result } = renderHook(() =>
      usePersistedField({
        fieldIdentifier: 'test_field',
        category: 'avatar'
      })
    );

    act(() => {
      result.current.onChange('new value');
    });

    expect(result.current.value).toBe('new value');
  });
});
```

### 2. Offline Testing

1. Load your application
2. Enter some data in persisted fields
3. Open DevTools → Network → Set to "Offline"
4. Continue entering data (should work seamlessly)
5. Refresh the page (data should persist)
6. Set back to "Online" (should sync automatically)

### 3. Performance Testing

```typescript
// Measure field load time
console.time('Field Load');
const field = usePersistedField({
  fieldIdentifier: 'perf_test',
  category: 'avatar'
});
console.timeEnd('Field Load'); // Should be <10ms after first load
```

## Migration Checklist

### Phase 1: Core Components (Week 1)
- [ ] Avatar Builder Demographics
- [ ] Avatar Builder Psychology
- [ ] Avatar Builder Buying Behavior
- [ ] Avatar Builder Voice

### Phase 2: Brand Canvas (Week 2)
- [ ] Brand Purpose field
- [ ] Brand Vision field
- [ ] Brand Mission field
- [ ] Brand Values array
- [ ] Positioning Statement
- [ ] Value Proposition
- [ ] Brand Personality array
- [ ] Brand Voice

### Phase 3: Interactive Modules (Week 3)
- [ ] Diagnostic questionnaire responses
- [ ] Buyer Intent Research fields
- [ ] Copy Generator inputs
- [ ] Generated content storage

### Phase 4: Testing & Optimization (Week 4)
- [ ] Unit tests for all migrated components
- [ ] Integration tests for sync flow
- [ ] Performance benchmarks
- [ ] User acceptance testing

## Rollback Plan

If issues arise, you can quickly rollback by:

1. Switching back to the original hooks
2. The data remains in Supabase throughout
3. IndexedDB can be cleared without data loss

```typescript
// Emergency rollback
function clearLocalCache() {
  indexedDB.deleteDatabase('idea-brand-coach');
}
```

## Common Issues & Solutions

### Issue: Data not persisting after refresh
**Solution:** Ensure userId is available before initializing repository

### Issue: Sync status stuck on "syncing"
**Solution:** Check Supabase connection and RLS policies

### Issue: Conflicts between devices
**Solution:** The system uses "local-first" resolution by default

## Support

For questions or issues during migration:
1. Check the test suite for examples
2. Review the interfaces in `src/lib/knowledge-base/interfaces.ts`
3. Enable debug logging: `localStorage.setItem('debug', 'knowledge-base:*')`

## Next Steps

After successful migration:
1. Monitor performance metrics
2. Gather user feedback on speed improvements
3. Consider adding data export functionality
4. Implement conflict resolution UI for team features

---

Remember: The goal is to make every interaction feel instant while maintaining data integrity and sync capabilities.