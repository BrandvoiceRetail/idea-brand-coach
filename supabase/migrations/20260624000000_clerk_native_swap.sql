-- =====================================================================
-- 20260624000000_clerk_native_swap.sql
-- CLERK NATIVE-AUTH CUTOVER MIGRATION  (FORWARD)
-- =====================================================================
-- WHAT: Switches RLS identity resolution from Supabase Auth (auth.uid(),
--       a uuid) to Clerk via Supabase native third-party auth, where the
--       caller id is the Clerk subject claim (auth.jwt()->>'sub'), a TEXT.
--
-- THIS MIGRATION IS DESTRUCTIVE AND IS *NOT* AUTO-APPLIED.
--   * Run it ONLY during the scheduled Clerk cutover window, AFTER the
--     Supabase "Clerk" third-party auth provider has been configured in
--     the dashboard (Authentication > Third-Party Auth).
--   * It converts every public.<t>.user_id column from uuid -> text and
--     drops the FOREIGN KEYs to auth.users(id). Clerk users have NO row in
--     auth.users, so these FKs MUST be dropped for inserts to succeed.
--   * Existing rows are keyed to Supabase UUID user_ids. A Clerk 'sub'
--     (e.g. 'user_2abc...') will NEVER equal an old UUID, so pre-cutover
--     rows become invisible/unowned under the new RLS. THIS IS ACCEPTED:
--     there are no real customers yet — only internal/QA data.
--   * Take a backup before running. Rollback: *_down.sql (same timestamp).
--
-- SCOPE (introspected live 2026-06-24 against the production DB):
--   * 34 public tables: user_id uuid -> text
--   * 30 FKs on user_id -> auth.users(id) dropped (29 ON DELETE CASCADE,
--     1 ON DELETE SET NULL = feedback_events)
--   * 121 RLS policies rebuilt with auth.uid() -> (auth.jwt()->>'sub')
--   * 2 column DEFAULTs (auth.uid()) -> (auth.jwt()->>'sub')
--     (coach_assets, coach_asset_events)
--
-- MANUAL-REVIEW HOTSPOTS are listed at the END of this file. Read them
-- before applying — some policies compare a uuid column that is NOT
-- user_id (profiles.id, beta_testers via profiles.id) and are NOT fixed
-- by this migration's text substitution.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- STEP 1: Drop the 121 RLS policies and recreate them with the Clerk
--         identity expression. (DROP+CREATE per policy; bodies are a
--         verbatim reconstruction from pg_policies with every auth.uid()
--         replaced by (auth.jwt()->>'sub').)
--         Policies are dropped here so the column type change in STEP 2
--         is not blocked by policy dependencies, then recreated against
--         the new text column.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert their own artifacts" ON public.artifacts;
CREATE POLICY "Users can insert their own artifacts" ON public.artifacts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own artifacts" ON public.artifacts;
CREATE POLICY "Users can update their own artifacts" ON public.artifacts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own artifacts" ON public.artifacts;
CREATE POLICY "Users can view their own artifacts" ON public.artifacts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own build state" ON public.avatar_build_state;
CREATE POLICY "Users can insert their own build state" ON public.avatar_build_state AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = avatar_build_state.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "Users can update their own build state" ON public.avatar_build_state;
CREATE POLICY "Users can update their own build state" ON public.avatar_build_state AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = avatar_build_state.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "Users can view their own build state" ON public.avatar_build_state;
CREATE POLICY "Users can view their own build state" ON public.avatar_build_state AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((auth.jwt()->>'sub') = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = avatar_build_state.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "Users can manage their own avatar fields" ON public.avatar_field_values;
CREATE POLICY "Users can manage their own avatar fields" ON public.avatar_field_values AS PERMISSIVE FOR ALL TO authenticated
  USING ((avatar_id IN ( SELECT avatars.id
   FROM avatars
  WHERE (avatars.user_id = (auth.jwt()->>'sub')))))
  WITH CHECK ((avatar_id IN ( SELECT avatars.id
   FROM avatars
  WHERE (avatars.user_id = (auth.jwt()->>'sub')))));

DROP POLICY IF EXISTS "Users can delete their own avatars" ON public.avatars;
CREATE POLICY "Users can delete their own avatars" ON public.avatars AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own avatars" ON public.avatars;
CREATE POLICY "Users can insert their own avatars" ON public.avatars AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = avatars.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can update their own avatars" ON public.avatars;
CREATE POLICY "Users can update their own avatars" ON public.avatars AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = avatars.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can view their own avatars" ON public.avatars;
CREATE POLICY "Users can view their own avatars" ON public.avatars AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own beta comments" ON public.beta_comments;
CREATE POLICY "Users can view their own beta comments" ON public.beta_comments AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own beta feedback" ON public.beta_feedback;
CREATE POLICY "Users can view their own beta feedback" ON public.beta_feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own beta tester records" ON public.beta_testers;
CREATE POLICY "Users can view their own beta tester records" ON public.beta_testers AS PERMISSIVE FOR SELECT TO public
  USING (((email IS NOT NULL) AND (email = ( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can delete their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can delete their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can insert their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_asset_audits.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')) AND (a.brand_id = a.brand_id)))) AND (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_asset_audits.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "Users can update their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can update their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_asset_audits.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')) AND (a.brand_id = a.brand_id)))) AND (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_asset_audits.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "Users can view their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can view their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete insights of their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can delete insights of their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can insert insights for their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can insert insights for their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can update insights of their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can update insights of their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can view insights of their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can view insights of their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "delete own brand_assets" ON public.brand_assets;
CREATE POLICY "delete own brand_assets" ON public.brand_assets AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "insert own brand_assets" ON public.brand_assets;
CREATE POLICY "insert own brand_assets" ON public.brand_assets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')) AND (a.brand_id = brand_assets.brand_id)))))));

DROP POLICY IF EXISTS "update own brand_assets" ON public.brand_assets;
CREATE POLICY "update own brand_assets" ON public.brand_assets AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')) AND (a.brand_id = brand_assets.brand_id)))))));

DROP POLICY IF EXISTS "view own brand_assets" ON public.brand_assets;
CREATE POLICY "view own brand_assets" ON public.brand_assets AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = (auth.jwt()->>'sub'))))) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = (auth.jwt()->>'sub')))))));

DROP POLICY IF EXISTS "Users can delete alerts of their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can delete alerts of their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can insert alerts for their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can insert alerts for their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can update alerts of their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can update alerts of their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can view alerts of their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can view alerts of their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "delete own brand_tests" ON public.brand_tests;
CREATE POLICY "delete own brand_tests" ON public.brand_tests AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "insert own brand_tests" ON public.brand_tests;
CREATE POLICY "insert own brand_tests" ON public.brand_tests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "update own brand_tests" ON public.brand_tests;
CREATE POLICY "update own brand_tests" ON public.brand_tests AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "view own brand_tests" ON public.brand_tests;
CREATE POLICY "view own brand_tests" ON public.brand_tests AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can delete their own brands" ON public.brands;
CREATE POLICY "Users can delete their own brands" ON public.brands AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own brands" ON public.brands;
CREATE POLICY "Users can insert their own brands" ON public.brands AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((primary_avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brands.primary_avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can update their own brands" ON public.brands;
CREATE POLICY "Users can update their own brands" ON public.brands AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((primary_avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brands.primary_avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can view their own brands" ON public.brands;
CREATE POLICY "Users can view their own brands" ON public.brands AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own business facts" ON public.business_facts;
CREATE POLICY "Users can insert their own business facts" ON public.business_facts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own business facts" ON public.business_facts;
CREATE POLICY "Users can update their own business facts" ON public.business_facts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own business facts" ON public.business_facts;
CREATE POLICY "Users can view their own business facts" ON public.business_facts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS canva_imported_designs_delete_own ON public.canva_imported_designs;
CREATE POLICY canva_imported_designs_delete_own ON public.canva_imported_designs AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS canva_imported_designs_select_own ON public.canva_imported_designs;
CREATE POLICY canva_imported_designs_select_own ON public.canva_imported_designs AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" ON public.chat_messages AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own chat messages" ON public.chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can insert their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can view their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS coach_asset_events_insert_own ON public.coach_asset_events;
CREATE POLICY coach_asset_events_insert_own ON public.coach_asset_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS coach_asset_events_select_own ON public.coach_asset_events;
CREATE POLICY coach_asset_events_select_own ON public.coach_asset_events AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS coach_assets_insert_own ON public.coach_assets;
CREATE POLICY coach_assets_insert_own ON public.coach_assets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS coach_assets_select_own ON public.coach_assets;
CREATE POLICY coach_assets_select_own ON public.coach_assets AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS coach_assets_update_own ON public.coach_assets;
CREATE POLICY coach_assets_update_own ON public.coach_assets AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = (auth.jwt()->>'sub')))
  WITH CHECK ((user_id = (auth.jwt()->>'sub')));

DROP POLICY IF EXISTS "Users can delete competitor assets of their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can delete competitor assets of their own avatars" ON public.competitor_assets AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can insert competitor assets for their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can insert competitor assets for their own avatars" ON public.competitor_assets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can update competitor assets of their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can update competitor assets of their own avatars" ON public.competitor_assets AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can view competitor assets of their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can view competitor assets of their own avatars" ON public.competitor_assets AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "own ledger read" ON public.credit_ledger;
CREATE POLICY "own ledger read" ON public.credit_ledger AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "own wallet read" ON public.credit_wallets;
CREATE POLICY "own wallet read" ON public.credit_wallets AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can delete their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can insert their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can update their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can view their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can insert their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can update their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = diagnostic_submissions.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = diagnostic_submissions.avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can view their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can view their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own evidence snapshots" ON public.evidence_snapshots;
CREATE POLICY "Users can insert their own evidence snapshots" ON public.evidence_snapshots AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own evidence snapshots" ON public.evidence_snapshots;
CREATE POLICY "Users can update their own evidence snapshots" ON public.evidence_snapshots AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own evidence snapshots" ON public.evidence_snapshots;
CREATE POLICY "Users can view their own evidence snapshots" ON public.evidence_snapshots AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can delete their own figma imports" ON public.figma_imports AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can insert their own figma imports" ON public.figma_imports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can update their own figma imports" ON public.figma_imports AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can view their own figma imports" ON public.figma_imports AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can create their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can create their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can delete their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can update their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can view their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own marketing audits" ON public.marketing_audits;
CREATE POLICY "Users can insert their own marketing audits" ON public.marketing_audits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own marketing audits" ON public.marketing_audits;
CREATE POLICY "Users can update their own marketing audits" ON public.marketing_audits AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own marketing audits" ON public.marketing_audits;
CREATE POLICY "Users can view their own marketing audits" ON public.marketing_audits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = id));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = id));

DROP POLICY IF EXISTS "Users can insert their own signatures" ON public.signatures;
CREATE POLICY "Users can insert their own signatures" ON public.signatures AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own signatures" ON public.signatures;
CREATE POLICY "Users can update their own signatures" ON public.signatures AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own signatures" ON public.signatures;
CREATE POLICY "Users can view their own signatures" ON public.signatures AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete snapshots of their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can delete snapshots of their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can insert snapshots for their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can insert snapshots for their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can update snapshots of their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can update snapshots of their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can view snapshots of their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can view snapshots of their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can delete their own documents" ON public.uploaded_documents AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can update their own documents" ON public.uploaded_documents AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can upload their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can upload their own documents" ON public.uploaded_documents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can view their own documents" ON public.uploaded_documents AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can delete their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can insert their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can update their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_diagnostic_results.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_diagnostic_results.avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can view their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can view their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can delete own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can insert own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_base.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_base.avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can update own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can update own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_base.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_base.avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can view own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can view own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_chunks.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_chunks.avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can update their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can update their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.jwt()->>'sub') = user_id))
  WITH CHECK ((((auth.jwt()->>'sub') = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_chunks.brand_id) AND (b.user_id = (auth.jwt()->>'sub')))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_chunks.avatar_id) AND (a.user_id = (auth.jwt()->>'sub'))))))));

DROP POLICY IF EXISTS "Users can view their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can view their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.user_memories;
CREATE POLICY "Users can delete their own memories" ON public.user_memories AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own memories" ON public.user_memories;
CREATE POLICY "Users can insert their own memories" ON public.user_memories AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own memories" ON public.user_memories;
CREATE POLICY "Users can update their own memories" ON public.user_memories AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own memories" ON public.user_memories;
CREATE POLICY "Users can view their own memories" ON public.user_memories AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can delete reviews for their products" ON public.user_product_reviews;
CREATE POLICY "Users can delete reviews for their products" ON public.user_product_reviews AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_products
  WHERE ((user_products.id = user_product_reviews.product_id) AND (user_products.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can insert reviews for their products" ON public.user_product_reviews;
CREATE POLICY "Users can insert reviews for their products" ON public.user_product_reviews AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_products
  WHERE ((user_products.id = user_product_reviews.product_id) AND (user_products.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can view reviews for their products" ON public.user_product_reviews;
CREATE POLICY "Users can view reviews for their products" ON public.user_product_reviews AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_products
  WHERE ((user_products.id = user_product_reviews.product_id) AND (user_products.user_id = (auth.jwt()->>'sub'))))));

DROP POLICY IF EXISTS "Users can delete their own products" ON public.user_products;
CREATE POLICY "Users can delete their own products" ON public.user_products AS PERMISSIVE FOR DELETE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can insert their own products" ON public.user_products;
CREATE POLICY "Users can insert their own products" ON public.user_products AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can update their own products" ON public.user_products;
CREATE POLICY "Users can update their own products" ON public.user_products AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "Users can view their own products" ON public.user_products;
CREATE POLICY "Users can view their own products" ON public.user_products AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));

DROP POLICY IF EXISTS "own subscription read" ON public.user_subscriptions;
CREATE POLICY "own subscription read" ON public.user_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.jwt()->>'sub') = user_id));


-- ---------------------------------------------------------------------
-- STEP 2: Drop FOREIGN KEYs on user_id that reference auth.users(id).
--         REQUIRED: Clerk users have no auth.users row, so these FKs
--         would reject every Clerk-owned insert. (All ON DELETE CASCADE
--         except feedback_events = ON DELETE SET NULL.)
-- ---------------------------------------------------------------------
ALTER TABLE public.artifacts DROP CONSTRAINT IF EXISTS artifacts_user_id_fkey;
ALTER TABLE public.avatars DROP CONSTRAINT IF EXISTS avatars_user_id_fkey;
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_user_id_fkey;
ALTER TABLE public.business_facts DROP CONSTRAINT IF EXISTS business_facts_user_id_fkey;
ALTER TABLE public.canva_connections DROP CONSTRAINT IF EXISTS canva_connections_user_id_fkey;
ALTER TABLE public.canva_imported_designs DROP CONSTRAINT IF EXISTS canva_imported_designs_user_id_fkey;
ALTER TABLE public.canva_oauth_states DROP CONSTRAINT IF EXISTS canva_oauth_states_user_id_fkey;
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;
ALTER TABLE public.coach_asset_events DROP CONSTRAINT IF EXISTS coach_asset_events_user_id_fkey;
ALTER TABLE public.coach_assets DROP CONSTRAINT IF EXISTS coach_assets_user_id_fkey;
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_user_id_fkey;
ALTER TABLE public.credit_wallets DROP CONSTRAINT IF EXISTS credit_wallets_user_id_fkey;
ALTER TABLE public.decision_triggers DROP CONSTRAINT IF EXISTS decision_triggers_user_id_fkey;
ALTER TABLE public.diagnostic_submissions DROP CONSTRAINT IF EXISTS diagnostic_submissions_user_id_fkey;
ALTER TABLE public.evidence_snapshots DROP CONSTRAINT IF EXISTS evidence_snapshots_user_id_fkey;
ALTER TABLE public.feedback_events DROP CONSTRAINT IF EXISTS feedback_events_user_id_fkey;
ALTER TABLE public.figma_connections DROP CONSTRAINT IF EXISTS figma_connections_user_id_fkey;
ALTER TABLE public.figma_imports DROP CONSTRAINT IF EXISTS figma_imports_user_id_fkey;
ALTER TABLE public.figma_oauth_state DROP CONSTRAINT IF EXISTS figma_oauth_state_user_id_fkey;
ALTER TABLE public.idea_framework_submissions DROP CONSTRAINT IF EXISTS idea_framework_submissions_user_id_fkey;
ALTER TABLE public.marketing_audits DROP CONSTRAINT IF EXISTS marketing_audits_user_id_fkey;
ALTER TABLE public.signatures DROP CONSTRAINT IF EXISTS signatures_user_id_fkey;
ALTER TABLE public.uploaded_documents DROP CONSTRAINT IF EXISTS uploaded_documents_user_id_fkey;
ALTER TABLE public.user_diagnostic_results DROP CONSTRAINT IF EXISTS user_diagnostic_results_user_id_fkey;
ALTER TABLE public.user_knowledge_base DROP CONSTRAINT IF EXISTS user_knowledge_base_user_id_fkey;
ALTER TABLE public.user_knowledge_chunks DROP CONSTRAINT IF EXISTS user_knowledge_chunks_user_id_fkey;
ALTER TABLE public.user_memories DROP CONSTRAINT IF EXISTS user_memories_user_id_fkey;
ALTER TABLE public.user_products DROP CONSTRAINT IF EXISTS user_products_user_id_fkey;
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;

-- ---------------------------------------------------------------------
-- STEP 3: Drop the auth.uid() column DEFAULT before the type change
--         (a uuid-typed default blocks the conversion to text).
-- ---------------------------------------------------------------------
ALTER TABLE public.coach_assets ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE public.coach_asset_events ALTER COLUMN user_id DROP DEFAULT;

-- ---------------------------------------------------------------------
-- STEP 4: Convert user_id uuid -> text on all 34 tables.
--         (Dependent indexes/unique constraints are preserved by
--          Postgres across an in-place USING cast; no manual rebuild
--          needed — the btree opclass for text is applied automatically.)
-- ---------------------------------------------------------------------
ALTER TABLE public.artifacts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.avatar_build_state ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.avatars ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.beta_comments ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.beta_feedback ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.brand_asset_audits ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.brands ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.business_facts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.canva_connections ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.canva_imported_designs ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.canva_oauth_states ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.chat_messages ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.chat_sessions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.coach_asset_events ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.coach_assets ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.credit_ledger ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.credit_wallets ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.decision_triggers ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.diagnostic_submissions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.evidence_snapshots ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.feedback_events ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.figma_connections ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.figma_imports ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.figma_oauth_state ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.idea_framework_submissions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.marketing_audits ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.signatures ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.uploaded_documents ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_diagnostic_results ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_knowledge_base ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_knowledge_chunks ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_memories ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_products ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_subscriptions ALTER COLUMN user_id TYPE text USING user_id::text;

-- ---------------------------------------------------------------------
-- STEP 5: Restore the (now text) default to the Clerk identity, ONLY
--         on the two tables whose original default was auth.uid().
-- ---------------------------------------------------------------------
ALTER TABLE public.coach_assets ALTER COLUMN user_id SET DEFAULT (auth.jwt()->>'sub');
ALTER TABLE public.coach_asset_events ALTER COLUMN user_id SET DEFAULT (auth.jwt()->>'sub');

COMMIT;

-- =====================================================================
-- MANUAL-REVIEW HOTSPOTS  (a human MUST verify these before/after apply)
-- =====================================================================
-- The auth.uid() -> (auth.jwt()->>'sub') text substitution is correct for
-- every comparison against a user_id column (those columns are converted
-- to text in STEP 4). The following are NOT covered by that and can break
-- or mis-scope, because they compare a uuid column that STAYS uuid:
--
--   [H1] public.profiles  (3 policies: SELECT/INSERT/UPDATE "...own profile")
--        Compare profiles.id = auth.uid().  profiles.id is the uuid PK and
--        is NOT converted by this migration. After substitution the clause
--        becomes  (auth.jwt()->>'sub') = id  i.e. text = uuid  -> RUNTIME
--        ERROR (operator does not exist: text = uuid).
--        DECIDE: convert profiles.id (and FK profiles_id_fkey -> auth.users,
--        plus profiles_current_avatar_id_fkey) to a text Clerk id as part
--        of the cutover, OR cast in the policy (id::text). profiles.id is
--        the app's user PK — converting it is the consistent choice but is
--        intentionally left for human decision (out of the user_id scope).
--
--   [H2] public.beta_testers  (1 policy: SELECT "...own beta tester records")
--        Subquery:  email = (SELECT profiles.email FROM profiles
--                             WHERE profiles.id = auth.uid())
--        Same text=uuid break on profiles.id inside the subquery. Resolves
--        automatically IF profiles.id is converted to text per [H1];
--        otherwise add an explicit cast.
--
-- auth.uid() INSIDE SUBQUERIES/JOINS that ARE safe (listed for awareness —
-- they compare a CONVERTED user_id, so text=text holds post-migration):
--   avatar_build_state, avatar_field_values, brand_asset_audits,
--   brand_asset_competitive_insights, brand_assets, brand_defense_alerts,
--   brand_tests, competitor_assets, diagnostic_submissions,
--   trust_gap_snapshots, user_diagnostic_results, user_knowledge_base,
--   user_knowledge_chunks, user_product_reviews  (all join avatars.user_id
--   / brands.user_id / user_products.user_id, which become text).
--
-- SECURITY DEFINER / SECURITY INVOKER functions in public referencing
-- auth.uid() — NOT rewritten here; review each (param type uuid vs the new
-- text caller id; pass the Clerk id explicitly or cast):
--   * match_document_chunks(...)            [SECURITY DEFINER, 3 overloads; match_user_id uuid]
--   * match_user_documents(...)             [SECURITY DEFINER; match_user_id uuid]
--   * match_user_knowledge(...)             [SECURITY DEFINER; p_user_id uuid]
--   * update_knowledge_entry(...)           [SECURITY DEFINER; p_user_id uuid]
--   * save_artifact_atomic(...)             [SECURITY INVOKER, 2 overloads; p_user_id uuid]
--   * save_asset_audit_atomic(...)          [SECURITY INVOKER]
--   * set_context_avatars(uuid[])           [SECURITY INVOKER]
--   * set_current_avatar(uuid)              [SECURITY INVOKER]
--   * set_primary_avatar(uuid)              [SECURITY INVOKER]
--   (Each contains auth.uid() in its body and/or takes a uuid user param.
--    With Clerk, auth.uid() returns NULL and the caller id is text — these
--    must be updated to read (auth.jwt()->>'sub') and accept text ids.)
--
-- VIEWS in public referencing auth.uid(): NONE found.
-- =====================================================================
