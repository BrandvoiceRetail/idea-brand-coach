/**
 * Layer 0 (contract) — Review Mining output shape (Trevor's Review Mining skill, in code).
 *
 * Quantifies what customers actually say, in their own words, against the review base — so a
 * positioning hypothesis is VALIDATED or KILLED by counts, not vibes. This is the deterministic
 * (Layer 3) counterpart to the LLM avatar stages: given a corpus + a tagged keyword set, it COUNTS.
 * Nothing here is probabilistic — same inputs, same output.
 *
 * Honesty is the whole point (Trevor's cast-iron rule): every number traces to reviews actually
 * supplied, every quote is a verbatim substring of a real review body, and the denominator is stated.
 * When the corpus we counted over is a SAMPLE of a larger written-review base (the Tier-0 case — we
 * fetch what Amazon renders on /dp/, not the full /product-reviews/ catalog), the result says so:
 * shares are "of the N reviews we read", never silently presented as the whole base. See
 * `_bmad-output/planning-artifacts/2026-07-19-review-evidence-build-plan.md` (Phase 2 / Tier 0).
 */
import { z } from 'zod';

/**
 * The five keyword roles from the skill's keyword-set design. Roles drive the maths:
 * the validation verdict is computed on the union of `hypothesis` terms only; `comparison`
 * terms are the ones most likely name-inflated; a low `adjacent` count is itself a finding.
 */
export const keywordRoleSchema = z.enum([
  'hypothesis',  // the benefit in its spoken variants (thicker, thick, fuller) — drives the verdict
  'adjacent',    // near-synonyms the owner is tempted to claim (volume) — low count = a finding
  'comparison',  // current positioning language (growth) — flag when title-inflated
  'secondary',   // texture / experience words (soft, smell, lather)
  'problem',     // what the customer is escaping (falling, shedding, breakage)
]);
export type KeywordRole = z.infer<typeof keywordRoleSchema>;

/** One keyword to test as its own filter, tagged with its role. */
export const keywordSpecSchema = z.object({
  term: z.string().min(1),
  role: keywordRoleSchema,
});
export type KeywordSpec = z.infer<typeof keywordSpecSchema>;

/** One review in the corpus we count over. `reviewer`/`rating` are optional (thin scrapes omit them). */
export const reviewInputSchema = z.object({
  body: z.string(),
  rating: z.number().nullable().optional(),
  reviewer: z.string().nullable().optional(),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** Per-keyword theme count row (the table). */
export const themeCountSchema = z.object({
  term: z.string(),
  role: keywordRoleSchema,
  /** Reviews (in the counted corpus) containing this term. Distinct reviews, never raw hits. */
  mentions: z.number().int().nonnegative(),
  /** mentions / reviewsAnalysed, 0..1. Share of what we READ, not asserted of the full base. */
  share: z.number().min(0).max(1),
  /** True when `term` appears in the product title — reviewers naming the product pad this count. */
  nameInflated: z.boolean(),
  /** Of `mentions`, how many have a negation token immediately before the term ("not much volume"). */
  negatedMentions: z.number().int().nonnegative(),
});
export type ThemeCount = z.infer<typeof themeCountSchema>;

/** Validation verdict against the hypothesis (thresholds from the skill). */
export const verdictSchema = z.object({
  level: z.enum(['validated', 'supportive', 'not_felt', 'absent']),
  /** Exact de-duplicated count of reviews mentioning ANY hypothesis-role term (the union). */
  hypothesisReach: z.number().int().nonnegative(),
  /** hypothesisReach / reviewsAnalysed. */
  share: z.number().min(0).max(1),
  statement: z.string(),
});
export type Verdict = z.infer<typeof verdictSchema>;

/** A verbatim voice-of-customer fragment for copy/creative. Copied exactly; never paraphrased. */
export const vocFragmentSchema = z.object({
  quote: z.string().min(1),
  reviewer: z.string().nullable(),
  rating: z.number().nullable(),
});
export type VocFragment = z.infer<typeof vocFragmentSchema>;

/** Denominator honesty block — what we counted over, and whether it is the whole base. */
export const denominatorSchema = z.object({
  reviewsAnalysed: z.number().int().nonnegative(),
  writtenReviewsTotal: z.number().int().nonnegative().nullable(),
  isFullCorpus: z.boolean(),
});
export type Denominator = z.infer<typeof denominatorSchema>;

export const reviewMiningResultSchema = z.object({
  hypothesis: z.string(),
  denominator: denominatorSchema,
  themes: z.array(themeCountSchema),
  verdict: verdictSchema,
  voc: z.array(vocFragmentSchema),
  cautions: z.array(z.string()),
  /** Always 'evidence' — counts and quotes trace to real reviews or the function refuses to run. */
  grounding: z.literal('evidence'),
});
export type ReviewMiningResult = z.infer<typeof reviewMiningResultSchema>;
