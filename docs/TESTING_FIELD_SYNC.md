# Testing Field Sync Implementation

## 🎯 Quick Test Plan

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Open Browser Console
Press F12 and watch for `[FieldSync]` messages

### 3. Test Field Extraction
Navigate to Brand Coach V2 and send these test messages:

```
Message 1: "My brand name is AcmeTech"
Expected Console: [FieldSync] ✓ Saved brand_name (ai)

Message 2: "We sell eco-friendly water bottles to millennials"
Expected Console: [FieldSync] ✓ Saved product (ai)
Expected Console: [FieldSync] ✓ Saved target_audience (ai)

Message 3: "Our mission is to reduce plastic waste by 50% by 2030"
Expected Console: [FieldSync] ✓ Saved brand_mission (ai)
```

### 4. Test Manual Edit
1. Click on "Brand Name" field in left panel
2. Change value to "AcmeTech Inc."
3. Click outside field
4. Expected Console: `[FieldSync] ✓ Saved brand_name (manual)`

### 5. Test Persistence
1. Note the field values
2. Refresh the page (F5)
3. Expected: All fields reload with same values
4. Console should show: `[FieldSync] Loaded X fields from database`

### 6. Test Migration (First Time Users)
If you have existing localStorage data:
1. Check localStorage before: `localStorage.getItem('brandCoach_field_brand_name')`
2. Refresh page
3. Expected Console: `[FieldSync] Migrated X fields from localStorage`
4. Check localStorage after: Should still exist (backward compatibility)

## 🔍 Verify in Database

Run this query in Supabase SQL Editor:

```sql
-- See your saved fields
SELECT
    field_id,
    LEFT(field_value, 50) as value_preview,
    field_source,
    is_locked,
    updated_at
FROM avatar_field_values
WHERE avatar_id IN (
    SELECT id FROM avatars WHERE user_id = auth.uid()
)
ORDER BY updated_at DESC
LIMIT 20;
```

## ✅ Success Criteria

### Console Output
- [x] Shows field loads on mount
- [x] Shows saves for AI extractions
- [x] Shows saves for manual edits
- [x] Shows field count status every 30 seconds

### UI Behavior
- [x] Fields appear in left panel when extracted
- [x] Manual edits stick when clicking away
- [x] Header shows "X fields saved" badge
- [x] Fields persist across page refreshes

### Database Verification
- [x] Fields exist in avatar_field_values table
- [x] field_source shows 'ai' or 'manual' correctly
- [x] is_locked = true for manual edits
- [x] updated_at timestamps are recent

## 🐛 Troubleshooting

### No Console Output?
1. Check avatar exists:
   ```javascript
   // In browser console
   console.log(currentAvatar?.id)
   ```

2. Check if hook is running:
   - Add `console.log('Hook mounted')` in useSimpleFieldSync
   - Should appear on page load

### Fields Not Saving?
1. Check Network tab for Supabase calls
2. Look for 401/403 errors (auth issues)
3. Verify RLS policies:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'avatar_field_values';
   ```

### Fields Not Loading?
1. Clear all localStorage:
   ```javascript
   localStorage.clear()
   ```
2. Check database has fields:
   ```sql
   SELECT COUNT(*) FROM avatar_field_values
   WHERE avatar_id IN (
     SELECT id FROM avatars WHERE user_id = auth.uid()
   );
   ```

### Too Many Saves?
Watch for rapid `[FieldSync]` messages. If too frequent:
- Increase debounce in useSimpleFieldSync.ts
- Check for infinite loops in field updates

## 📊 Expected Behavior Timeline

```
T+0s:   Page loads
T+0.1s: [FieldSync] Loading existing fields from database...
T+0.2s: [FieldSync] Loaded 5 fields from database
T+1s:   User starts chatting
T+3s:   AI responds with field extraction
T+3.5s: [FieldSync] ✓ Saved brand_name (ai)
T+10s:  User manually edits field
T+10.5s: [FieldSync] ✓ Saved brand_name (manual)
T+30s:  [FieldSync] Status: 5 fields saved, 5 fields in UI
T+45s:  User refreshes page
T+45.1s: [FieldSync] Loading existing fields from database...
T+45.2s: [FieldSync] Loaded 5 fields from database
```

## 🎉 Working Correctly If...

1. **New User Flow:**
   - Default avatar created automatically
   - Fields save as extracted
   - Persist across refreshes

2. **Existing User Flow:**
   - localStorage migrates on first load
   - Previous fields appear
   - New fields add to existing

3. **Chat Flow:**
   - AI extractions save immediately
   - Manual edits override AI values
   - Locked fields protected from AI

## 📝 Test Report Template

```markdown
Date: [DATE]
Tester: [NAME]

## Test Results
- [ ] Fields extract from chat
- [ ] Manual edits save
- [ ] Fields persist on refresh
- [ ] localStorage migration works
- [ ] Save indicator shows in header
- [ ] Console logs are working

## Issues Found
1. [Issue description]
   - Steps to reproduce
   - Expected vs Actual

## Database Check
- Avatar ID: [UUID]
- Field Count: [NUMBER]
- Last Update: [TIMESTAMP]
```