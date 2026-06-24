-- business_facts — dedicated owner-confirmed BUSINESS-FACT / PRODUCT-TRUTH store
-- (Gold-Workbook Output Engine, Phase 2 fixer).
--
-- The context write-back originally stored BUSINESS-FACT answers (slots 7,8,9,10,11,16)
-- and PRODUCT-TRUTH confirmations (slots 5,6) into public.user_knowledge_base with
-- category='business_facts'. That category is NOT permitted by the live
-- user_knowledge_base_category_check CHECK constraint
-- (diagnostic|avatar|insights|canvas|copy|capture|core|consultant), so every such
-- write was rejected with Postgres 23514 — breaking "never ask twice" for the entire
-- BUSINESS-FACT tier (the manifest §5/§7 "single unlock for Output B").
--
-- Extending the existing CHECK would be a DROP+ADD CONSTRAINT on a live table, which the
-- additive-only guardrail forbids. Instead this introduces the dedicated `business_facts`
-- store the slot contract (SlotStore union) and the resolver's resolution order already
-- name as a first-class store. The KB versioning shape (field_identifier / content /
-- structured_data / version / is_current) is preserved so the resolver and write-back
-- keep their "exactly one current row per field, history retained" behaviour unchanged.
--
-- ADDITIVE ONLY: CREATE ... IF NOT EXISTS, new policies, new indexes. No ALTER / DROP of
-- existing objects. RLS = owner-only, cloned from the artifacts policy style
-- (auth.uid() = user_id), same as the rest of the output-engine tables.

CREATE TABLE IF NOT EXISTS public.business_facts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field_identifier TEXT NOT NULL,
    content          TEXT,
    structured_data  JSONB,
    version          INTEGER NOT NULL DEFAULT 1,
    is_current       BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one current row per (user, field). Historical versions (is_current=false)
-- are unconstrained so the version chain can hold any number of superseded rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_facts_current_per_field
    ON public.business_facts (user_id, field_identifier)
    WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_business_facts_user_id ON public.business_facts (user_id);
CREATE INDEX IF NOT EXISTS idx_business_facts_field ON public.business_facts (field_identifier);

ALTER TABLE public.business_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business facts"
    ON public.business_facts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own business facts"
    ON public.business_facts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business facts"
    ON public.business_facts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
