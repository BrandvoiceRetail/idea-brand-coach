# Database Schema Verification Checklist

**Task:** subtask-7-1 - Verify database schema and RLS policies
**Date:** 2026-03-01

## Automated Verification Complete ✓

Run: `node verify-schema.mjs` to see results

- ✅ All migration files created
- ✅ All migration files contain RLS enablement
- ✅ All migration files contain policies
- ✅ TypeScript types include all new tables
- ✅ TypeScript types include avatar_id in chat_sessions
- ✅ Foreign key relationships defined
- ✅ Data migration logic verified

## Manual Verification Required

### Access Supabase Studio

1. Open Supabase Studio: https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw
2. Or local: http://127.0.0.1:54323 (if Supabase is running)

### Verification Steps

#### 1. Verify brands table exists with correct columns

Navigate to: Table Editor → brands

- [ ] Table exists
- [ ] Columns: id (UUID), user_id (UUID), name (TEXT), description (TEXT), created_at (TIMESTAMP), updated_at (TIMESTAMP)
- [ ] user_id → auth.users FK exists
- [ ] RLS enabled (lock icon visible)

#### 2. Verify avatars table exists with brand_id FK

Navigate to: Table Editor → avatars

- [ ] Table exists
- [ ] Columns: id (UUID), brand_id (UUID), name (TEXT), persona_data (JSONB), created_at (TIMESTAMP), updated_at (TIMESTAMP)
- [ ] brand_id → brands FK exists
- [ ] RLS enabled (lock icon visible)

#### 3. Verify performance_metrics table exists with avatar_id FK

Navigate to: Table Editor → performance_metrics

- [ ] Table exists
- [ ] Columns: id (UUID), avatar_id (UUID), metric_type (TEXT), metric_value (NUMERIC), recorded_at (TIMESTAMP), metadata (JSONB), created_at (TIMESTAMP)
- [ ] avatar_id → avatars FK exists
- [ ] RLS enabled (lock icon visible)

#### 4. Verify chat_sessions has avatar_id column

Navigate to: Table Editor → chat_sessions

- [ ] avatar_id column exists
- [ ] avatar_id is UUID type
- [ ] avatar_id is nullable
- [ ] avatar_id → avatars FK exists

#### 5. Test RLS policies by querying as authenticated user

Navigate to: SQL Editor

Login as a test user, then run:

```sql
-- Should see only your brands
SELECT * FROM brands;

-- Should see only your avatars
SELECT * FROM avatars;

-- Should see only your metrics
SELECT * FROM performance_metrics;
```

- [ ] Queries return only user's own data
- [ ] No errors about missing policies
- [ ] RLS is enforcing security

#### 6. Verify all existing users have default brand and avatar

Navigate to: SQL Editor

```sql
-- Check counts match
SELECT
  (SELECT COUNT(*) FROM profiles) as users,
  (SELECT COUNT(*) FROM brands) as brands,
  (SELECT COUNT(*) FROM avatars) as avatars;
```

- [ ] users = brands = avatars
- [ ] All existing users have exactly 1 brand
- [ ] All existing users have exactly 1 avatar

#### 7. Verify all chat_sessions are linked to avatars

Navigate to: SQL Editor

```sql
-- Check all sessions are linked
SELECT
  COUNT(*) as total,
  COUNT(avatar_id) as linked,
  COUNT(CASE WHEN avatar_id IS NULL THEN 1 END) as unlinked
FROM chat_sessions;
```

- [ ] unlinked = 0
- [ ] All chat_sessions have an avatar_id
- [ ] No orphaned sessions

---

## Completion Criteria

ALL checkboxes above must be checked before marking subtask-7-1 as complete.

## How to Complete Verification

1. Open Supabase Studio (link above)
2. Go through each verification step
3. Check off each item as you verify it
4. If any item fails, document the issue
5. Fix any issues before proceeding
6. When all items pass, update implementation_plan.json status to "completed"

## Troubleshooting

### Tables don't exist
- Check if migrations have been applied: Dashboard → Database → Migrations
- If not applied, run: `supabase db push` (for remote) or `supabase db reset` (for local)

### RLS policies missing
- Re-run the migration files
- Check Database → Policies to see what's there

### Data migration didn't run
- Check migration history
- Manually run: `supabase/migrations/20260228230012_migrate_existing_users_to_brands.sql`

---

**Created:** 2026-03-01
**Status:** Pending Manual Verification
**Blocking:** Subtask completion
