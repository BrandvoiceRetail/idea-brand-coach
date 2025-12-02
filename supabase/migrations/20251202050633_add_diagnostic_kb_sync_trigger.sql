-- Create a trigger to automatically sync diagnostic to User KB after insertion
-- This runs server-side with proper authentication context

CREATE OR REPLACE FUNCTION sync_diagnostic_to_user_kb()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the edge function via pg_net (Supabase's HTTP client)
  -- This is commented out for now until we can properly configure pg_net
  -- For Phase 1, we'll skip User KB sync and implement it in Phase 2
  
  -- PERFORM
  --   net.http_post(
  --     url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-diagnostic-to-user-kb',
  --     headers := jsonb_build_object(
  --       'Content-Type', 'application/json',
  --       'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
  --     ),
  --     body := jsonb_build_object(
  --       'diagnosticData', jsonb_build_object('answers', NEW.answers),
  --       'scores', NEW.scores,
  --       'user_id', NEW.user_id
  --     )
  --   );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uncomment this when ready to enable automatic KB sync
-- CREATE TRIGGER after_diagnostic_insert
--   AFTER INSERT ON diagnostic_submissions
--   FOR EACH ROW
--   EXECUTE FUNCTION sync_diagnostic_to_user_kb();

-- Add comment explaining the current state
COMMENT ON FUNCTION sync_diagnostic_to_user_kb() IS 
'Trigger function to sync diagnostic to User KB. Currently disabled pending Phase 2 implementation.';
