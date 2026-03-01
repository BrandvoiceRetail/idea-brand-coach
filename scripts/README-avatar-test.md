# Avatar CRUD Integration Test

This document describes how to run the avatar CRUD integration test script.

## Overview

The `test-avatar-crud.ts` script comprehensively tests all avatar CRUD operations:

1. ✅ **Create Avatar** - Creates avatar with explicit name and all fields
2. ✅ **Fetch All Avatars** - Retrieves all avatars for a user, ordered by update time
3. ✅ **Get Avatar by ID** - Fetches a single avatar
4. ✅ **Update Avatar** - Modifies name, description, and demographics
5. ✅ **Duplicate Avatar** - Creates a copy with "Copy of" prefix
6. ✅ **Auto-Generate Unique Name** - Creates avatars with auto-incrementing names
7. ✅ **RLS Policies** - Verifies cross-user access is prevented
8. ✅ **Timestamp Auto-Update** - Confirms updated_at is automatically updated
9. ✅ **Delete Avatar** - Removes avatar and verifies deletion

## Prerequisites

Before running the test:

1. **Start Supabase local development environment:**
   ```bash
   supabase start
   ```

2. **Verify avatar migration is applied:**
   ```bash
   supabase migration list --local
   ```

   You should see `20260301000000_create_avatars_table.sql` in the list.

3. **Get a valid user ID:**
   ```bash
   npx tsx scripts/get-user-id.ts <email>
   ```

   Or create a test user through the application first.

## Running the Test

```bash
npx tsx scripts/test-avatar-crud.ts <user_id>
```

### Example

```bash
npx tsx scripts/test-avatar-crud.ts "123e4567-e89b-12d3-a456-426614174000"
```

## Expected Output

The script will:

1. Show a header with environment and user ID
2. Run each test with detailed output
3. Display a summary showing passed/failed tests
4. Exit with appropriate status code

### Success Example

```
🧪 Avatar CRUD Integration Test
============================================================
Environment: http://127.0.0.1:54321
User ID: 123e4567-e89b-12d3-a456-426614174000

📝 Test 1: Create Avatar with Explicit Name
------------------------------------------------------------
✅ Create Avatar: Created avatar with ID: abc123...
   Name: Test Avatar
   Description: Integration test avatar
   Demographics: {"age":"25-34",...}
   Created at: 3/1/2026, 12:00:00 PM

...

============================================================
TEST SUMMARY
============================================================
Total Tests: 9
Passed: 9
Failed: 0

✅ All tests passed!
```

## Environment Variables

You can override the default Supabase connection:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_ANON_KEY="your-anon-key" \
npx tsx scripts/test-avatar-crud.ts <user_id>
```

## Troubleshooting

### "relation 'public.avatars' does not exist"

- The migration hasn't been applied yet
- Run: `supabase migration up --local`
- Or restart Supabase: `supabase stop && supabase start`

### "User not authenticated" errors

- The user ID might be invalid
- Verify the user exists: `npx tsx scripts/get-user-id.ts <email>`

### RLS tests failing

- This is expected behavior - RLS policies should block cross-user access
- The test verifies that access is correctly denied

## What Gets Tested

### 1. Create Avatar (Test 1)
- Inserts avatar with all fields populated
- Verifies demographics, psychographics, buying_behavior JSONB fields
- Confirms timestamps are set

### 2. Fetch All Avatars (Test 2)
- Queries by user_id
- Verifies ordering by updated_at DESC
- Displays count and list

### 3. Get by ID (Test 3)
- Fetches single avatar
- Verifies RLS allows owner access

### 4. Update Avatar (Test 4)
- Modifies multiple fields
- Verifies partial updates work
- Confirms updated_at changes

### 5. Duplicate Avatar (Test 5)
- Creates copy with "Copy of" name
- Preserves all data fields
- Sets is_template to false

### 6. Auto-Generate Name (Test 6)
- Generates "Avatar 1", "Avatar 2", etc.
- Avoids name collisions
- Cleans up after test

### 7. RLS Policies (Test 7)
- Attempts cross-user read (should be blocked)
- Attempts cross-user update (should be blocked)
- Attempts cross-user delete (should be blocked)

### 8. Timestamp Auto-Update (Test 8)
- Records timestamp before update
- Waits 1 second
- Updates avatar
- Verifies timestamp changed

### 9. Delete Avatar (Test 9)
- Deletes created avatar
- Verifies deletion succeeded
- Cleans up test data

## Cleanup

The script automatically cleans up test data:
- Deletes created avatars at the end
- Removes auto-generated test avatars
- Leaves database in clean state

If the script crashes, you may need to manually delete test avatars:

```bash
npx tsx scripts/clear-user-data.ts <user_id>
```
