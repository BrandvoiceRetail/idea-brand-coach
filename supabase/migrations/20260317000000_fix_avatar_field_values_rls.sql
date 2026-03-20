-- Fix avatar_field_values RLS policy
-- The original policy joined through brands table, but avatars.brand_id is nullable,
-- which caused all access to be blocked when brand_id is NULL.
-- Use the same direct user_id pattern as the avatars table.

DROP POLICY IF EXISTS "Users can manage their own avatar fields" ON avatar_field_values;

CREATE POLICY "Users can manage their own avatar fields" ON avatar_field_values
    FOR ALL
    USING (
        avatar_id IN (
            SELECT id FROM avatars
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        avatar_id IN (
            SELECT id FROM avatars
            WHERE user_id = auth.uid()
        )
    );

-- Reload PostgREST schema cache so the table is fully visible
NOTIFY pgrst, 'reload schema';
