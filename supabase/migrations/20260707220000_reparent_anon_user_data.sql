-- Carry an anonymous /v5 run into a real account (task #31 residual amnesia).
-- Applied to prod 2026-07-07 via MCP (migration name reparent_anon_user_data);
-- this file mirrors it for the repo record.
--
-- Moves every user-owned row from p_from (an anonymous auth user) to p_to
-- (the real account), handling the known unique constraints:
--   * uq_brands_user_id: one brand per user — if the target already has a
--     brand, the source brand row stays put and every brand_id reference is
--     repointed to the target's brand instead.
--   * avatars_user_id_name_key: rename colliding avatars '<name> (imported)'.
--   * uq_avatars_one_primary_per_brand: demote incoming is_primary when the
--     target brand already has a primary avatar.
--   * user_products_user_id_asin_key: skip ASINs the target already imported.
--   * uq_business_facts_current_per_field: demote incoming is_current rows
--     the target already has a current value for.
-- Remaining user_id tables are swept dynamically; per-table failures fall
-- back to row-wise moves so one bad row never blocks the rest. Billing and
-- OAuth-connection tables are excluded on purpose.
-- SECURITY DEFINER: called ONLY by the reparent-anon-run edge function via
-- the service role, which verifies BOTH identities' JWTs first. Not granted
-- to anon/authenticated.
CREATE OR REPLACE FUNCTION public.reparent_anon_user_data(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb := '{}'::jsonb;
  v_moved integer;
  v_from_brand uuid;
  v_to_brand uuid;
  r record;
  row_r record;
  v_row_moved integer;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RAISE EXCEPTION 'invalid reparent pair';
  END IF;

  -- ── Brands: move if the target has none, otherwise repoint children. ──
  SELECT id INTO v_from_brand FROM brands WHERE user_id = p_from LIMIT 1;
  SELECT id INTO v_to_brand   FROM brands WHERE user_id = p_to   LIMIT 1;
  IF v_from_brand IS NOT NULL THEN
    IF v_to_brand IS NULL THEN
      UPDATE brands SET user_id = p_to WHERE id = v_from_brand;
      v_summary := v_summary || jsonb_build_object('brands', 1);
      v_to_brand := v_from_brand;
    ELSE
      -- Repoint every brand_id reference from the anon brand to the real one.
      FOR r IN
        SELECT c.table_name FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_name = c.table_name AND t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'public' AND c.column_name = 'brand_id' AND c.table_name <> 'brands'
      LOOP
        BEGIN
          EXECUTE format('UPDATE %I SET brand_id = $1 WHERE brand_id = $2', r.table_name)
            USING v_to_brand, v_from_brand;
        EXCEPTION WHEN OTHERS THEN
          -- leave conflicting references on the anon brand; the sweep below
          -- still moves the rows' user_id so nothing disappears for the user
          NULL;
        END;
      END LOOP;
      v_summary := v_summary || jsonb_build_object('brands', 'repointed');
    END IF;
  END IF;

  -- ── Avatars: rename collisions, demote extra primaries, then move. ──
  UPDATE avatars a SET name = a.name || ' (imported)'
  WHERE a.user_id = p_from
    AND EXISTS (SELECT 1 FROM avatars b WHERE b.user_id = p_to AND b.name = a.name);
  UPDATE avatars a SET is_primary = false
  WHERE a.user_id = p_from AND a.is_primary
    AND EXISTS (SELECT 1 FROM avatars b WHERE b.brand_id = a.brand_id AND b.is_primary AND b.user_id = p_to);
  UPDATE avatars SET user_id = p_to WHERE user_id = p_from;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  IF v_moved > 0 THEN v_summary := v_summary || jsonb_build_object('avatars', v_moved); END IF;

  -- ── business_facts: demote incoming currents the target already has. ──
  UPDATE business_facts f SET is_current = false
  WHERE f.user_id = p_from AND f.is_current
    AND EXISTS (SELECT 1 FROM business_facts g
                WHERE g.user_id = p_to AND g.field_identifier = f.field_identifier AND g.is_current);

  -- ── Generic sweep over every remaining user_id table. ──
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
      AND c.table_name NOT IN (
        'brands', 'avatars',
        'credit_wallets', 'credit_ledger', 'user_subscriptions',
        'canva_connections', 'canva_oauth_states', 'canva_imported_designs',
        'figma_connections', 'figma_oauth_state', 'figma_imports'
      )
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I SET user_id = $1 WHERE user_id = $2', r.table_name)
        USING p_to, p_from;
      GET DIAGNOSTICS v_moved = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      -- Unique conflict somewhere in the set: retry row by row, skipping the
      -- rows the target effectively already owns (e.g. same ASIN).
      v_moved := 0;
      FOR row_r IN EXECUTE format('SELECT id FROM %I WHERE user_id = $1', r.table_name) USING p_from
      LOOP
        BEGIN
          EXECUTE format('UPDATE %I SET user_id = $1 WHERE id = $2', r.table_name)
            USING p_to, row_r.id;
          GET DIAGNOSTICS v_row_moved = ROW_COUNT;
          v_moved := v_moved + v_row_moved;
        EXCEPTION WHEN OTHERS THEN
          NULL; -- skip the conflicting row
        END;
      END LOOP;
    END;
    IF v_moved > 0 THEN
      v_summary := v_summary || jsonb_build_object(r.table_name, v_moved);
    END IF;
  END LOOP;

  RETURN v_summary;
END;
$$;

-- Service-role only: never callable from the client roles directly.
REVOKE ALL ON FUNCTION public.reparent_anon_user_data(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reparent_anon_user_data(uuid, uuid) FROM anon, authenticated;
