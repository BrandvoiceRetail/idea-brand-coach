-- Backstop against duplicate avatars per user.
--
-- Context: the client auto-creates a "Default Avatar" when a user has none. A render-timing
-- race in useDefaultAvatar (per-mount in-memory guard over an async-loaded avatar list) could
-- fire the create before the existing list loaded, producing many identical "Default Avatar"
-- rows over time. The deterministic fix lives here: enforce one name per user at the DB layer
-- so any residual race (e.g. multiple tabs) fails the insert instead of duplicating.
--
-- Idempotent: safe to re-run. Requires no pre-existing (user_id, name) duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS avatars_user_id_name_key
  ON public.avatars (user_id, name);
