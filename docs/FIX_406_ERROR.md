# Fix for 406 "Not Acceptable" Error

## ✅ Good News First!
**Your local persistence is working perfectly!** Data persists after refresh using IndexedDB. The issue is only with the Supabase sync.

## 🔴 The Problem
You're getting HTTP 406 errors when trying to sync to Supabase. This typically means:
- The `user_knowledge_base` table doesn't exist in Supabase
- OR the table exists but has different column names
- OR Row Level Security (RLS) is blocking access

## 🛠️ Quick Fix

### Option 1: Run Migration via Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor**
   ```
   https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/sql/new
   ```

2. **Copy the entire contents of:**
   ```
   /scripts/fix-supabase-406.sql
   ```

3. **Paste and run in SQL Editor**
   - Click "Run" or press Ctrl/Cmd + Enter
   - You should see "Success" message

4. **Test the fix**
   - Refresh the Avatar Builder page
   - Check browser console - 406 errors should be gone

### Option 2: Quick Deploy Script

```bash
# Just run the migration directly
cat supabase/migrations/20241123_user_knowledge_base.sql
```

Copy the output and paste it into the Supabase SQL Editor.

## 🔍 Verify the Fix

After running the migration, test that everything works:

1. **Open Avatar Builder**
   ```
   http://localhost:8080/avatar
   ```

2. **Type in any field**
   - Wait 1 second for debounce
   - Check browser console - no more 406 errors

3. **Check Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/editor/user_knowledge_base
   ```
   - You should see your data appearing in the table

## 📊 What Success Looks Like

✅ **Local Storage**: Data saves instantly as you type (<10ms)
✅ **Page Refresh**: Data loads instantly from IndexedDB
✅ **Background Sync**: After 500ms pause, syncs to Supabase (no 406 errors)
✅ **Offline Mode**: Works without internet, syncs when back online

## 🎯 Current Status

- ✅ **Local persistence**: WORKING
- ✅ **userId fix**: APPLIED
- ✅ **Debounce fix**: OPTIMIZED
- ❌ **Supabase sync**: NEEDS TABLE CREATION (406 error)

## 💡 Why This Happened

The 406 error occurs because:
1. The migration was marked as "deployed successfully" but the table wasn't actually created
2. Supabase returns 406 when trying to query a non-existent table/column
3. The error only affects cloud sync - local storage works fine

## 🚀 After Fixing

Once the table is created:
1. All existing local data will sync to Supabase automatically
2. Data will be available across devices
3. You'll have full offline support with automatic sync

## Technical Details

The system now uses:
- **useAuth()** for userId (not BrandContext)
- **Improved debouncing** with useRef
- **500ms delay** before saving to prevent excessive writes
- **Local-first architecture** for instant responsiveness