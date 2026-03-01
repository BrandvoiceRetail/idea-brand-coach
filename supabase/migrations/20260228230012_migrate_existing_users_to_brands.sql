-- ============================================
-- Data Migration: Existing Users to Brands/Avatars
-- Creates default brand and avatar for each existing user
-- Links all existing chat_sessions to the new avatar
-- ============================================

DO $$
DECLARE
  user_record RECORD;
  new_brand_id UUID;
  new_avatar_id UUID;
BEGIN
  -- Loop through each user in profiles
  FOR user_record IN SELECT id FROM public.profiles
  LOOP
    -- Create a default brand for this user
    INSERT INTO public.brands (user_id, name, description, created_at, updated_at)
    VALUES (
      user_record.id,
      'My Brand',
      'Default brand created during migration',
      now(),
      now()
    )
    RETURNING id INTO new_brand_id;

    -- Create a default avatar for this brand
    INSERT INTO public.avatars (brand_id, name, persona_data, created_at, updated_at)
    VALUES (
      new_brand_id,
      'Default Avatar',
      '{"description": "Default avatar created during migration"}'::jsonb,
      now(),
      now()
    )
    RETURNING id INTO new_avatar_id;

    -- Update all chat_sessions for this user to link to the new avatar
    UPDATE public.chat_sessions
    SET avatar_id = new_avatar_id
    WHERE user_id = user_record.id
      AND avatar_id IS NULL;

    -- Log progress (optional, will appear in migration logs)
    RAISE NOTICE 'Migrated user % - created brand % and avatar %',
      user_record.id, new_brand_id, new_avatar_id;
  END LOOP;

  -- Log completion
  RAISE NOTICE 'Migration completed successfully';
END $$;
