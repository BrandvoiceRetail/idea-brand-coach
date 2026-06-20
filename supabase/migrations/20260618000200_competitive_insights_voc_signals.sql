-- ============================================
-- Competitor-Agents P5 — voice-of-customer (VoC) signals on competitive insights
-- (plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md §4 P5).
--
-- The reviews/social-proof modality of competitor-analysis-asset mines the
-- fetched competitor reviews for avatar S1 vocabulary + S4 objections. Those
-- signals are persisted INTO the insight record here (additive jsonb column),
-- NOT into user_knowledge_base avatar_s1_vocab / avatar_s4_objections — that KB
-- write path is owned by the avatar-vocabulary / avatar-objections fns and is
-- intentionally left untouched (TODO(competitor-agents:voc-kb-write) in the fn).
--
-- Shape of voc_signals (matches lib.ts VocSignals):
--   { vocab_clusters: [{ cluster, customer_words: string[], frequency_signal, why_it_matters }],
--     objections:     [{ hesitation, verbatim_signal, resolution }],
--     grounding: 'evidence',
--     evidence_refs: [{ kind, ref }] }
-- Null for non-reviews modalities or when nothing survives the grounding gate.
-- ============================================

ALTER TABLE public.brand_asset_competitive_insights
  ADD COLUMN IF NOT EXISTS voc_signals JSONB;

COMMENT ON COLUMN public.brand_asset_competitive_insights.voc_signals IS
  'Voice-of-customer signals (avatar S1 vocab + S4 objections) mined from '
  'competitor reviews, grounded to the fetched review corpus. Null unless the '
  'reviews/social-proof modality produced grounded signals. See '
  'docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md P5.';
