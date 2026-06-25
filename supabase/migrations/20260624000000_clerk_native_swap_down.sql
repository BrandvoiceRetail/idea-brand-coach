-- =====================================================================
-- 20260624000000_clerk_native_swap_down.sql
-- CLERK NATIVE-AUTH CUTOVER MIGRATION  (ROLLBACK / DOWN)
-- =====================================================================
-- Reverses 20260624000000_clerk_native_swap.sql:
--   * user_id text -> uuid  (USING user_id::uuid)
--   * restores the dropped FOREIGN KEYs to auth.users(id)
--   * restores the auth.uid() column DEFAULTs
--   * rebuilds the 121 RLS policies with their ORIGINAL auth.uid() bodies
--
-- WARNING: user_id::uuid will FAIL if any row holds a Clerk-style id that
-- is not a valid uuid (e.g. 'user_2abc...'). Before rolling back, delete or
-- re-key any Clerk-created rows. Restoring the auth.users FKs will likewise
-- FAIL if any surviving user_id has no matching auth.users row.
-- Take a backup first.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- STEP 1 (down): Drop the Clerk-era policies so the column type can revert.
--                (Policies recreated with original bodies in STEP 5.)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert their own artifacts" ON public.artifacts;
DROP POLICY IF EXISTS "Users can update their own artifacts" ON public.artifacts;
DROP POLICY IF EXISTS "Users can view their own artifacts" ON public.artifacts;
DROP POLICY IF EXISTS "Users can insert their own build state" ON public.avatar_build_state;
DROP POLICY IF EXISTS "Users can update their own build state" ON public.avatar_build_state;
DROP POLICY IF EXISTS "Users can view their own build state" ON public.avatar_build_state;
DROP POLICY IF EXISTS "Users can manage their own avatar fields" ON public.avatar_field_values;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON public.avatars;
DROP POLICY IF EXISTS "Users can insert their own avatars" ON public.avatars;
DROP POLICY IF EXISTS "Users can update their own avatars" ON public.avatars;
DROP POLICY IF EXISTS "Users can view their own avatars" ON public.avatars;
DROP POLICY IF EXISTS "Users can view their own beta comments" ON public.beta_comments;
DROP POLICY IF EXISTS "Users can view their own beta feedback" ON public.beta_feedback;
DROP POLICY IF EXISTS "Users can view their own beta tester records" ON public.beta_testers;
DROP POLICY IF EXISTS "Users can delete their own asset audits" ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can insert their own asset audits" ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can update their own asset audits" ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can view their own asset audits" ON public.brand_asset_audits;
DROP POLICY IF EXISTS "Users can delete insights of their own avatars" ON public.brand_asset_competitive_insights;
DROP POLICY IF EXISTS "Users can insert insights for their own avatars" ON public.brand_asset_competitive_insights;
DROP POLICY IF EXISTS "Users can update insights of their own avatars" ON public.brand_asset_competitive_insights;
DROP POLICY IF EXISTS "Users can view insights of their own avatars" ON public.brand_asset_competitive_insights;
DROP POLICY IF EXISTS "delete own brand_assets" ON public.brand_assets;
DROP POLICY IF EXISTS "insert own brand_assets" ON public.brand_assets;
DROP POLICY IF EXISTS "update own brand_assets" ON public.brand_assets;
DROP POLICY IF EXISTS "view own brand_assets" ON public.brand_assets;
DROP POLICY IF EXISTS "Users can delete alerts of their own avatars" ON public.brand_defense_alerts;
DROP POLICY IF EXISTS "Users can insert alerts for their own avatars" ON public.brand_defense_alerts;
DROP POLICY IF EXISTS "Users can update alerts of their own avatars" ON public.brand_defense_alerts;
DROP POLICY IF EXISTS "Users can view alerts of their own avatars" ON public.brand_defense_alerts;
DROP POLICY IF EXISTS "delete own brand_tests" ON public.brand_tests;
DROP POLICY IF EXISTS "insert own brand_tests" ON public.brand_tests;
DROP POLICY IF EXISTS "update own brand_tests" ON public.brand_tests;
DROP POLICY IF EXISTS "view own brand_tests" ON public.brand_tests;
DROP POLICY IF EXISTS "Users can delete their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can insert their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can update their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can view their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can insert their own business facts" ON public.business_facts;
DROP POLICY IF EXISTS "Users can update their own business facts" ON public.business_facts;
DROP POLICY IF EXISTS "Users can view their own business facts" ON public.business_facts;
DROP POLICY IF EXISTS canva_imported_designs_delete_own ON public.canva_imported_designs;
DROP POLICY IF EXISTS canva_imported_designs_select_own ON public.canva_imported_designs;
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert their own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update their own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS coach_asset_events_insert_own ON public.coach_asset_events;
DROP POLICY IF EXISTS coach_asset_events_select_own ON public.coach_asset_events;
DROP POLICY IF EXISTS coach_assets_insert_own ON public.coach_assets;
DROP POLICY IF EXISTS coach_assets_select_own ON public.coach_assets;
DROP POLICY IF EXISTS coach_assets_update_own ON public.coach_assets;
DROP POLICY IF EXISTS "Users can delete competitor assets of their own avatars" ON public.competitor_assets;
DROP POLICY IF EXISTS "Users can insert competitor assets for their own avatars" ON public.competitor_assets;
DROP POLICY IF EXISTS "Users can update competitor assets of their own avatars" ON public.competitor_assets;
DROP POLICY IF EXISTS "Users can view competitor assets of their own avatars" ON public.competitor_assets;
DROP POLICY IF EXISTS "own ledger read" ON public.credit_ledger;
DROP POLICY IF EXISTS "own wallet read" ON public.credit_wallets;
DROP POLICY IF EXISTS "Users can delete their own decision triggers" ON public.decision_triggers;
DROP POLICY IF EXISTS "Users can insert their own decision triggers" ON public.decision_triggers;
DROP POLICY IF EXISTS "Users can update their own decision triggers" ON public.decision_triggers;
DROP POLICY IF EXISTS "Users can view their own decision triggers" ON public.decision_triggers;
DROP POLICY IF EXISTS "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions;
DROP POLICY IF EXISTS "Users can insert their own diagnostic submissions" ON public.diagnostic_submissions;
DROP POLICY IF EXISTS "Users can update their own diagnostic submissions" ON public.diagnostic_submissions;
DROP POLICY IF EXISTS "Users can view their own diagnostic submissions" ON public.diagnostic_submissions;
DROP POLICY IF EXISTS "Users can insert their own evidence snapshots" ON public.evidence_snapshots;
DROP POLICY IF EXISTS "Users can update their own evidence snapshots" ON public.evidence_snapshots;
DROP POLICY IF EXISTS "Users can view their own evidence snapshots" ON public.evidence_snapshots;
DROP POLICY IF EXISTS "Users can delete their own figma imports" ON public.figma_imports;
DROP POLICY IF EXISTS "Users can insert their own figma imports" ON public.figma_imports;
DROP POLICY IF EXISTS "Users can update their own figma imports" ON public.figma_imports;
DROP POLICY IF EXISTS "Users can view their own figma imports" ON public.figma_imports;
DROP POLICY IF EXISTS "Users can create their own submissions" ON public.idea_framework_submissions;
DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.idea_framework_submissions;
DROP POLICY IF EXISTS "Users can update their own submissions" ON public.idea_framework_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.idea_framework_submissions;
DROP POLICY IF EXISTS "Users can insert their own marketing audits" ON public.marketing_audits;
DROP POLICY IF EXISTS "Users can update their own marketing audits" ON public.marketing_audits;
DROP POLICY IF EXISTS "Users can view their own marketing audits" ON public.marketing_audits;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own signatures" ON public.signatures;
DROP POLICY IF EXISTS "Users can update their own signatures" ON public.signatures;
DROP POLICY IF EXISTS "Users can view their own signatures" ON public.signatures;
DROP POLICY IF EXISTS "Users can delete snapshots of their own avatars" ON public.trust_gap_snapshots;
DROP POLICY IF EXISTS "Users can insert snapshots for their own avatars" ON public.trust_gap_snapshots;
DROP POLICY IF EXISTS "Users can update snapshots of their own avatars" ON public.trust_gap_snapshots;
DROP POLICY IF EXISTS "Users can view snapshots of their own avatars" ON public.trust_gap_snapshots;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can upload their own documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can delete their own diagnostic results" ON public.user_diagnostic_results;
DROP POLICY IF EXISTS "Users can insert their own diagnostic results" ON public.user_diagnostic_results;
DROP POLICY IF EXISTS "Users can update their own diagnostic results" ON public.user_diagnostic_results;
DROP POLICY IF EXISTS "Users can view their own diagnostic results" ON public.user_diagnostic_results;
DROP POLICY IF EXISTS "Users can delete own knowledge" ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can insert own knowledge" ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can update own knowledge" ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can view own knowledge" ON public.user_knowledge_base;
DROP POLICY IF EXISTS "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can update their own knowledge chunks" ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can view their own knowledge chunks" ON public.user_knowledge_chunks;
DROP POLICY IF EXISTS "Users can delete their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can insert their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can view their own memories" ON public.user_memories;
DROP POLICY IF EXISTS "Users can delete reviews for their products" ON public.user_product_reviews;
DROP POLICY IF EXISTS "Users can insert reviews for their products" ON public.user_product_reviews;
DROP POLICY IF EXISTS "Users can view reviews for their products" ON public.user_product_reviews;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.user_products;
DROP POLICY IF EXISTS "Users can insert their own products" ON public.user_products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.user_products;
DROP POLICY IF EXISTS "Users can view their own products" ON public.user_products;
DROP POLICY IF EXISTS "own subscription read" ON public.user_subscriptions;


-- ---------------------------------------------------------------------
-- STEP 2 (down): Drop the Clerk text DEFAULTs before reverting type.
-- ---------------------------------------------------------------------
ALTER TABLE public.coach_assets ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE public.coach_asset_events ALTER COLUMN user_id DROP DEFAULT;

-- ---------------------------------------------------------------------
-- STEP 3 (down): Convert user_id text -> uuid on all 34 tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.artifacts ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.avatar_build_state ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.avatars ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.beta_comments ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.beta_feedback ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.brand_asset_audits ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.brands ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.business_facts ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.canva_connections ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.canva_imported_designs ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.canva_oauth_states ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.chat_messages ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.chat_sessions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.coach_asset_events ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.coach_assets ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.credit_ledger ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.credit_wallets ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.decision_triggers ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.diagnostic_submissions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.evidence_snapshots ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.feedback_events ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.figma_connections ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.figma_imports ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.figma_oauth_state ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.idea_framework_submissions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.marketing_audits ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.signatures ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.uploaded_documents ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.user_diagnostic_results ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.user_knowledge_base ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.user_knowledge_chunks ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.user_memories ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.user_products ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.user_subscriptions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- ---------------------------------------------------------------------
-- STEP 4 (down): Restore auth.uid() DEFAULTs on the two ledger tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.coach_assets ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.coach_asset_events ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ---------------------------------------------------------------------
-- STEP 5 (down): Restore the FOREIGN KEYs to auth.users(id).
-- ---------------------------------------------------------------------
ALTER TABLE public.artifacts ADD CONSTRAINT artifacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.avatars ADD CONSTRAINT avatars_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.brands ADD CONSTRAINT brands_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.business_facts ADD CONSTRAINT business_facts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.canva_connections ADD CONSTRAINT canva_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.canva_imported_designs ADD CONSTRAINT canva_imported_designs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.canva_oauth_states ADD CONSTRAINT canva_oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_sessions ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.coach_asset_events ADD CONSTRAINT coach_asset_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.coach_assets ADD CONSTRAINT coach_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.credit_wallets ADD CONSTRAINT credit_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.decision_triggers ADD CONSTRAINT decision_triggers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.diagnostic_submissions ADD CONSTRAINT diagnostic_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.evidence_snapshots ADD CONSTRAINT evidence_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.feedback_events ADD CONSTRAINT feedback_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.figma_connections ADD CONSTRAINT figma_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.figma_imports ADD CONSTRAINT figma_imports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.figma_oauth_state ADD CONSTRAINT figma_oauth_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.idea_framework_submissions ADD CONSTRAINT idea_framework_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.marketing_audits ADD CONSTRAINT marketing_audits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.signatures ADD CONSTRAINT signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.uploaded_documents ADD CONSTRAINT uploaded_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_diagnostic_results ADD CONSTRAINT user_diagnostic_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_knowledge_base ADD CONSTRAINT user_knowledge_base_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_knowledge_chunks ADD CONSTRAINT user_knowledge_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_memories ADD CONSTRAINT user_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_products ADD CONSTRAINT user_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- STEP 6 (down): Recreate the 121 RLS policies with ORIGINAL auth.uid()
--                bodies (the DROP IF EXISTS lines below are harmless
--                no-ops after STEP 1; kept so this block is idempotent).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own artifacts" ON public.artifacts;
CREATE POLICY "Users can insert their own artifacts" ON public.artifacts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own artifacts" ON public.artifacts;
CREATE POLICY "Users can update their own artifacts" ON public.artifacts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own artifacts" ON public.artifacts;
CREATE POLICY "Users can view their own artifacts" ON public.artifacts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own build state" ON public.avatar_build_state;
CREATE POLICY "Users can insert their own build state" ON public.avatar_build_state AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = avatar_build_state.avatar_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can update their own build state" ON public.avatar_build_state;
CREATE POLICY "Users can update their own build state" ON public.avatar_build_state AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = avatar_build_state.avatar_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their own build state" ON public.avatar_build_state;
CREATE POLICY "Users can view their own build state" ON public.avatar_build_state AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = avatar_build_state.avatar_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can manage their own avatar fields" ON public.avatar_field_values;
CREATE POLICY "Users can manage their own avatar fields" ON public.avatar_field_values AS PERMISSIVE FOR ALL TO authenticated
  USING ((avatar_id IN ( SELECT avatars.id
   FROM avatars
  WHERE (avatars.user_id = auth.uid()))))
  WITH CHECK ((avatar_id IN ( SELECT avatars.id
   FROM avatars
  WHERE (avatars.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can delete their own avatars" ON public.avatars;
CREATE POLICY "Users can delete their own avatars" ON public.avatars AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own avatars" ON public.avatars;
CREATE POLICY "Users can insert their own avatars" ON public.avatars AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = avatars.brand_id) AND (b.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can update their own avatars" ON public.avatars;
CREATE POLICY "Users can update their own avatars" ON public.avatars AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = avatars.brand_id) AND (b.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can view their own avatars" ON public.avatars;
CREATE POLICY "Users can view their own avatars" ON public.avatars AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own beta comments" ON public.beta_comments;
CREATE POLICY "Users can view their own beta comments" ON public.beta_comments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own beta feedback" ON public.beta_feedback;
CREATE POLICY "Users can view their own beta feedback" ON public.beta_feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own beta tester records" ON public.beta_testers;
CREATE POLICY "Users can view their own beta tester records" ON public.beta_testers AS PERMISSIVE FOR SELECT TO public
  USING (((email IS NOT NULL) AND (email = ( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS "Users can delete their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can delete their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can insert their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_asset_audits.avatar_id) AND (a.user_id = auth.uid()) AND (a.brand_id = a.brand_id)))) AND (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_asset_audits.brand_id) AND (b.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can update their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can update their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_asset_audits.avatar_id) AND (a.user_id = auth.uid()) AND (a.brand_id = a.brand_id)))) AND (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_asset_audits.brand_id) AND (b.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their own asset audits" ON public.brand_asset_audits;
CREATE POLICY "Users can view their own asset audits" ON public.brand_asset_audits AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete insights of their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can delete insights of their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can insert insights for their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can insert insights for their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update insights of their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can update insights of their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view insights of their own avatars" ON public.brand_asset_competitive_insights;
CREATE POLICY "Users can view insights of their own avatars" ON public.brand_asset_competitive_insights AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_asset_competitive_insights.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "delete own brand_assets" ON public.brand_assets;
CREATE POLICY "delete own brand_assets" ON public.brand_assets AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "insert own brand_assets" ON public.brand_assets;
CREATE POLICY "insert own brand_assets" ON public.brand_assets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = auth.uid())))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = auth.uid()) AND (a.brand_id = brand_assets.brand_id)))))));

DROP POLICY IF EXISTS "update own brand_assets" ON public.brand_assets;
CREATE POLICY "update own brand_assets" ON public.brand_assets AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = auth.uid()))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = auth.uid())))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = auth.uid()) AND (a.brand_id = brand_assets.brand_id)))))));

DROP POLICY IF EXISTS "view own brand_assets" ON public.brand_assets;
CREATE POLICY "view own brand_assets" ON public.brand_assets AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = brand_assets.brand_id) AND (b.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brand_assets.avatar_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can delete alerts of their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can delete alerts of their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can insert alerts for their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can insert alerts for their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update alerts of their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can update alerts of their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view alerts of their own avatars" ON public.brand_defense_alerts;
CREATE POLICY "Users can view alerts of their own avatars" ON public.brand_defense_alerts AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = brand_defense_alerts.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "delete own brand_tests" ON public.brand_tests;
CREATE POLICY "delete own brand_tests" ON public.brand_tests AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS "insert own brand_tests" ON public.brand_tests;
CREATE POLICY "insert own brand_tests" ON public.brand_tests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS "update own brand_tests" ON public.brand_tests;
CREATE POLICY "update own brand_tests" ON public.brand_tests AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS "view own brand_tests" ON public.brand_tests;
CREATE POLICY "view own brand_tests" ON public.brand_tests AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (brand_assets ba
     JOIN avatars a ON ((a.id = ba.avatar_id)))
  WHERE ((ba.id = brand_tests.asset_id) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can delete their own brands" ON public.brands;
CREATE POLICY "Users can delete their own brands" ON public.brands AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own brands" ON public.brands;
CREATE POLICY "Users can insert their own brands" ON public.brands AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((primary_avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brands.primary_avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can update their own brands" ON public.brands;
CREATE POLICY "Users can update their own brands" ON public.brands AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND ((primary_avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = brands.primary_avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can view their own brands" ON public.brands;
CREATE POLICY "Users can view their own brands" ON public.brands AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own business facts" ON public.business_facts;
CREATE POLICY "Users can insert their own business facts" ON public.business_facts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own business facts" ON public.business_facts;
CREATE POLICY "Users can update their own business facts" ON public.business_facts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own business facts" ON public.business_facts;
CREATE POLICY "Users can view their own business facts" ON public.business_facts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS canva_imported_designs_delete_own ON public.canva_imported_designs;
CREATE POLICY canva_imported_designs_delete_own ON public.canva_imported_designs AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS canva_imported_designs_select_own ON public.canva_imported_designs;
CREATE POLICY canva_imported_designs_select_own ON public.canva_imported_designs AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" ON public.chat_messages AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own chat messages" ON public.chat_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can insert their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can view their own chat sessions" ON public.chat_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS coach_asset_events_insert_own ON public.coach_asset_events;
CREATE POLICY coach_asset_events_insert_own ON public.coach_asset_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS coach_asset_events_select_own ON public.coach_asset_events;
CREATE POLICY coach_asset_events_select_own ON public.coach_asset_events AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS coach_assets_insert_own ON public.coach_assets;
CREATE POLICY coach_assets_insert_own ON public.coach_assets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS coach_assets_select_own ON public.coach_assets;
CREATE POLICY coach_assets_select_own ON public.coach_assets AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS coach_assets_update_own ON public.coach_assets;
CREATE POLICY coach_assets_update_own ON public.coach_assets AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete competitor assets of their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can delete competitor assets of their own avatars" ON public.competitor_assets AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can insert competitor assets for their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can insert competitor assets for their own avatars" ON public.competitor_assets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update competitor assets of their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can update competitor assets of their own avatars" ON public.competitor_assets AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view competitor assets of their own avatars" ON public.competitor_assets;
CREATE POLICY "Users can view competitor assets of their own avatars" ON public.competitor_assets AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = competitor_assets.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "own ledger read" ON public.credit_ledger;
CREATE POLICY "own ledger read" ON public.credit_ledger AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "own wallet read" ON public.credit_wallets;
CREATE POLICY "own wallet read" ON public.credit_wallets AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can delete their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can insert their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can update their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own decision triggers" ON public.decision_triggers;
CREATE POLICY "Users can view their own decision triggers" ON public.decision_triggers AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can delete their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can insert their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can update their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = diagnostic_submissions.brand_id) AND (b.user_id = auth.uid()))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = diagnostic_submissions.avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can view their own diagnostic submissions" ON public.diagnostic_submissions;
CREATE POLICY "Users can view their own diagnostic submissions" ON public.diagnostic_submissions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own evidence snapshots" ON public.evidence_snapshots;
CREATE POLICY "Users can insert their own evidence snapshots" ON public.evidence_snapshots AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own evidence snapshots" ON public.evidence_snapshots;
CREATE POLICY "Users can update their own evidence snapshots" ON public.evidence_snapshots AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own evidence snapshots" ON public.evidence_snapshots;
CREATE POLICY "Users can view their own evidence snapshots" ON public.evidence_snapshots AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can delete their own figma imports" ON public.figma_imports AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can insert their own figma imports" ON public.figma_imports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can update their own figma imports" ON public.figma_imports AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own figma imports" ON public.figma_imports;
CREATE POLICY "Users can view their own figma imports" ON public.figma_imports AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can create their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can create their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can delete their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can update their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own submissions" ON public.idea_framework_submissions;
CREATE POLICY "Users can view their own submissions" ON public.idea_framework_submissions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own marketing audits" ON public.marketing_audits;
CREATE POLICY "Users can insert their own marketing audits" ON public.marketing_audits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own marketing audits" ON public.marketing_audits;
CREATE POLICY "Users can update their own marketing audits" ON public.marketing_audits AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own marketing audits" ON public.marketing_audits;
CREATE POLICY "Users can view their own marketing audits" ON public.marketing_audits AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));

DROP POLICY IF EXISTS "Users can insert their own signatures" ON public.signatures;
CREATE POLICY "Users can insert their own signatures" ON public.signatures AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own signatures" ON public.signatures;
CREATE POLICY "Users can update their own signatures" ON public.signatures AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own signatures" ON public.signatures;
CREATE POLICY "Users can view their own signatures" ON public.signatures AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete snapshots of their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can delete snapshots of their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can insert snapshots for their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can insert snapshots for their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update snapshots of their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can update snapshots of their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view snapshots of their own avatars" ON public.trust_gap_snapshots;
CREATE POLICY "Users can view snapshots of their own avatars" ON public.trust_gap_snapshots AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM avatars
  WHERE ((avatars.id = trust_gap_snapshots.avatar_id) AND (avatars.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can delete their own documents" ON public.uploaded_documents AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can update their own documents" ON public.uploaded_documents AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can upload their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can upload their own documents" ON public.uploaded_documents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own documents" ON public.uploaded_documents;
CREATE POLICY "Users can view their own documents" ON public.uploaded_documents AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can delete their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can insert their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can update their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_diagnostic_results.brand_id) AND (b.user_id = auth.uid()))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_diagnostic_results.avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can view their own diagnostic results" ON public.user_diagnostic_results;
CREATE POLICY "Users can view their own diagnostic results" ON public.user_diagnostic_results AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can delete own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can insert own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_base.brand_id) AND (b.user_id = auth.uid()))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_base.avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can update own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can update own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_base.brand_id) AND (b.user_id = auth.uid()))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_base.avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can view own knowledge" ON public.user_knowledge_base;
CREATE POLICY "Users can view own knowledge" ON public.user_knowledge_base AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can delete their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can insert their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_chunks.brand_id) AND (b.user_id = auth.uid()))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_chunks.avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can update their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can update their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND ((brand_id IS NULL) OR (EXISTS ( SELECT 1
   FROM brands b
  WHERE ((b.id = user_knowledge_chunks.brand_id) AND (b.user_id = auth.uid()))))) AND ((avatar_id IS NULL) OR (EXISTS ( SELECT 1
   FROM avatars a
  WHERE ((a.id = user_knowledge_chunks.avatar_id) AND (a.user_id = auth.uid())))))));

DROP POLICY IF EXISTS "Users can view their own knowledge chunks" ON public.user_knowledge_chunks;
CREATE POLICY "Users can view their own knowledge chunks" ON public.user_knowledge_chunks AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.user_memories;
CREATE POLICY "Users can delete their own memories" ON public.user_memories AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own memories" ON public.user_memories;
CREATE POLICY "Users can insert their own memories" ON public.user_memories AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own memories" ON public.user_memories;
CREATE POLICY "Users can update their own memories" ON public.user_memories AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own memories" ON public.user_memories;
CREATE POLICY "Users can view their own memories" ON public.user_memories AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete reviews for their products" ON public.user_product_reviews;
CREATE POLICY "Users can delete reviews for their products" ON public.user_product_reviews AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM user_products
  WHERE ((user_products.id = user_product_reviews.product_id) AND (user_products.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can insert reviews for their products" ON public.user_product_reviews;
CREATE POLICY "Users can insert reviews for their products" ON public.user_product_reviews AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_products
  WHERE ((user_products.id = user_product_reviews.product_id) AND (user_products.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view reviews for their products" ON public.user_product_reviews;
CREATE POLICY "Users can view reviews for their products" ON public.user_product_reviews AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM user_products
  WHERE ((user_products.id = user_product_reviews.product_id) AND (user_products.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can delete their own products" ON public.user_products;
CREATE POLICY "Users can delete their own products" ON public.user_products AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own products" ON public.user_products;
CREATE POLICY "Users can insert their own products" ON public.user_products AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own products" ON public.user_products;
CREATE POLICY "Users can update their own products" ON public.user_products AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own products" ON public.user_products;
CREATE POLICY "Users can view their own products" ON public.user_products AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "own subscription read" ON public.user_subscriptions;
CREATE POLICY "own subscription read" ON public.user_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

COMMIT;