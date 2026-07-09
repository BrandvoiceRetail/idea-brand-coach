-- Latest v5 run snapshot per listing (Matthew's ruling 2026-07-08: the
-- previously generated brief must be instantly available whenever the
-- customer returns — latest only, durable). Overwritten on each completed
-- run; RLS on user_products already scopes it to the owner.
-- Applied to prod 2026-07-09 via MCP (user_products_last_run_snapshot).
ALTER TABLE public.user_products ADD COLUMN IF NOT EXISTS last_run jsonb;
ALTER TABLE public.user_products ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
