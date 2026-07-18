-- Rename the "Signature" artifact subsystem to "Positioning Statement" (2026-07 taxonomy cleanup).
--
-- HISTORY: this artifact was called the "Signature" (the "your customer isn't buying X, they're
-- buying Y" line) until this migration. "Signature" was never part of Trevor Bradford's framework
-- taxonomy (not in the book, not in IDEA-POLICY-TERM-001); it is folded into the Brand Canvas
-- Positioning Statement (Canvas element #5), same job, same inputs. No real user rows existed at
-- rename time (QA/test/dogfood accounts only), so artifacts.kind values are migrated in place.
--
-- The generic trg_sync_brand_id trigger + sync_brand_id_from_avatar() carry across the table rename
-- unchanged (the trigger has no signature-specific logic). artifacts.kind is a plain text column
-- with no CHECK/enum on its values, so the UPDATE below needs no type change.
--
-- MUST deploy WITH the renamed code (edge fn reveal-positioning-statement, MCP gateway, SPA) — the
-- old code references `signatures`/`signature_text`/kind 'signature' and breaks the moment this lands.

-- 1. Core table, column, primary key, foreign keys, indexes.
alter table public.signatures rename to positioning_statements;
alter table public.positioning_statements rename column signature_text to positioning_statement_text;

alter table public.positioning_statements rename constraint signatures_pkey to positioning_statements_pkey;
alter table public.positioning_statements rename constraint signatures_artifact_id_fkey to positioning_statements_artifact_id_fkey;
alter table public.positioning_statements rename constraint signatures_brand_id_fkey to positioning_statements_brand_id_fkey;
alter table public.positioning_statements rename constraint signatures_user_id_fkey to positioning_statements_user_id_fkey;

alter index public.idx_signatures_artifact_id rename to idx_positioning_statements_artifact_id;
alter index public.idx_signatures_avatar_id rename to idx_positioning_statements_avatar_id;
alter index public.idx_signatures_brand_id rename to idx_positioning_statements_brand_id;
alter index public.idx_signatures_posthog_distinct_id rename to idx_positioning_statements_posthog_distinct_id;
alter index public.idx_signatures_user_id rename to idx_positioning_statements_user_id;

-- 2. RLS policies (behaviour identical; names follow the new noun).
alter policy "Users can insert their own signatures" on public.positioning_statements rename to "Users can insert their own positioning statements";
alter policy "Users can update their own signatures" on public.positioning_statements rename to "Users can update their own positioning statements";
alter policy "Users can view their own signatures"   on public.positioning_statements rename to "Users can view their own positioning statements";

-- 3. Migrate existing artifact rows (test/QA/dogfood only) to the new kind.
update public.artifacts set kind = 'positioning_statement' where kind = 'signature';

-- 4. Consumer columns on other tables.
alter table public.feedback_events rename column chosen_signature      to chosen_positioning_statement;
alter table public.feedback_events rename column signature_options     to positioning_statement_options;
alter table public.feedback_events rename column q2_signature_felt_right to q2_positioning_statement_felt_right;
alter table public.brand_assets    rename column signature_version     to positioning_statement_version;
