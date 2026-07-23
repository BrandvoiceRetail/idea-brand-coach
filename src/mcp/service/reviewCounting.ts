/**
 * Layer 3 (execution) — the deterministic review-mining engine (Trevor's Review Mining skill).
 *
 * Given a corpus of reviews + a role-tagged keyword set, COUNT what customers say and return a
 * validation verdict against the hypothesis. Pure and deterministic: no LLM, no network, no clock.
 * This is the "counting" the LLM avatar stages never do — it turns "here are some quotes" into
 * "N of the reviews we read say X", which is what makes a positioning read defensible.
 *
 * Cast-iron rule (enforced structurally, not by instruction): every number is a count of reviews
 * actually supplied, and every VOC quote is a verbatim substring of a real review body. The engine
 * can only surface what is present — it has no path to invent.
 *
 * Two deliberate improvements over the manual skill, both because WE hold the raw review bodies
 * (the skill works off Amazon's filter UI, which hides the overlap):
 *   1. The hypothesis "reach" is the EXACT de-duplicated union of hypothesis-term matches, not a
 *      conservative range — we can see which reviews overlap.
 *   2. Negated matches ("not much volume") are flagged per term, so a raw count can't masquerade
 *      as a positive signal.
 *
 * Denominator honesty (Phase 2 / Tier 0): shares are computed against the reviews we ACTUALLY read.
 * When that is a sample of a larger written-review base, the result says so — never presenting a
 * sample share as the whole base.
 */
import type {
  Denominator,
  KeywordSpec,
  ReviewInput,
  ReviewMiningResult,
  ThemeCount,
  Verdict,
  VocFragment,
} from '../contracts/reviewMining.js';

/** Validation thresholds (share of the hypothesis union among reviews analysed). From the skill. */
const VERDICT_VALIDATED = 0.2; // >= 20% using the hypothesis language unprompted = validated
const VERDICT_SUPPORTIVE = 0.1; // 10-20% = supportive, soften the hero claim; < 10% = real but not felt
/** Max verbatim voice-of-customer fragments returned (one per distinct reviewer). */
const MAX_VOC_FRAGMENTS = 5;
/** Negation tokens; a match with one of these shortly before the term is a negated mention. */
const NEGATION = /\b(?:no|not|n't|never|without|hardly|barely|isn't|wasn't|didn't|doesn't|don't)\b/;

export interface MineReviewsInput {
  hypothesis: string;
  keywords: KeywordSpec[];
  reviews: ReviewInput[];
  productTitle?: string;
  /** The true written-review base if known; when reviews.length < this, the result is a sample. */
  writtenReviewsTotal?: number | null;
}

/**
 * Fold a string to a canonical form for substring/word matching. Ported (twin-file pattern) from
 * the Deno edge function `avatar-objections` — the MCP gateway is a separate bundle and cannot
 * import across the boundary. Removes representation mismatches only (case, curly quotes, dashes,
 * entities, whitespace); it can never let a fabricated match through, because the words must remain.
 */
export function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/&(?:quot|ldquo|rdquo|#34);/g, '"')
    .replace(/&(?:apos|lsquo|rsquo|#39|#x27);/g, "'")
    .replace(/&(?:ndash|mdash|#8211|#8212);/g, '-')
    .replace(/&(?:hellip|#8230);/g, '...')
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word-boundary matcher for a term over already-normalised text. "thick" does NOT match "thicker". */
function termMatcher(term: string): RegExp {
  const t = normaliseForMatch(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${t}\\b`, 'g');
}

/** True if the term occurs as a whole word in the normalised text. */
function mentions(normText: string, re: RegExp): boolean {
  re.lastIndex = 0;
  return re.test(normText);
}

/** Does a negation token appear within ~24 chars before any match of the term? */
function isNegated(normText: string, re: RegExp): boolean {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normText)) !== null) {
    const window = normText.slice(Math.max(0, m.index - 24), m.index);
    if (NEGATION.test(window)) return true;
  }
  return false;
}

/** Split a body into sentence-sized verbatim substrings (each piece is an exact substring). */
function sentences(body: string): string[] {
  const out = body.match(/[^.!?\n]*[.!?]?/g) ?? [];
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Stable identity for reviewer de-dup; anonymous reviews are distinct by index, never merged. */
function reviewerKey(r: ReviewInput, index: number): string {
  const name = (r.reviewer ?? '').trim();
  return name && name.toLowerCase() !== 'anonymous' ? `name:${name.toLowerCase()}` : `idx:${index}`;
}

export function mineReviews(input: MineReviewsInput): ReviewMiningResult {
  const { hypothesis, productTitle = '', writtenReviewsTotal = null } = input;
  // De-dup keywords by term (first role wins), preserving order.
  const seen = new Set<string>();
  const keywords = input.keywords.filter((k) => {
    const key = normaliseForMatch(k.term);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const reviewsAnalysed = input.reviews.length;
  const norm = input.reviews.map((r) => normaliseForMatch(r.body));
  const titleNorm = normaliseForMatch(productTitle);

  const themes: ThemeCount[] = keywords.map((k) => {
    const re = termMatcher(k.term);
    let mentionCount = 0;
    let negated = 0;
    for (const text of norm) {
      if (mentions(text, re)) {
        mentionCount += 1;
        if (isNegated(text, re)) negated += 1;
      }
    }
    return {
      term: k.term,
      role: k.role,
      mentions: mentionCount,
      share: reviewsAnalysed > 0 ? mentionCount / reviewsAnalysed : 0,
      nameInflated: titleNorm.length > 0 && mentions(titleNorm, termMatcher(k.term)),
      negatedMentions: negated,
    };
  });

  // Exact hypothesis union: reviews containing >= 1 hypothesis-role term.
  const hypothesisMatchers = keywords.filter((k) => k.role === 'hypothesis').map((k) => termMatcher(k.term));
  let hypothesisReach = 0;
  const reachFlags = norm.map((text) => {
    const hit = hypothesisMatchers.some((re) => mentions(text, re));
    if (hit) hypothesisReach += 1;
    return hit;
  });
  const reachShare = reviewsAnalysed > 0 ? hypothesisReach / reviewsAnalysed : 0;

  const verdict: Verdict = {
    level:
      hypothesisReach === 0 ? 'absent'
        : reachShare >= VERDICT_VALIDATED ? 'validated'
          : reachShare >= VERDICT_SUPPORTIVE ? 'supportive'
            : 'not_felt',
    hypothesisReach,
    share: reachShare,
    statement: verdictStatement(hypothesis, hypothesisReach, reviewsAnalysed, reachShare, writtenReviewsTotal),
  };

  const voc = pickVoc(input.reviews, reachFlags, hypothesisMatchers);

  const isFullCorpus = writtenReviewsTotal !== null && reviewsAnalysed >= writtenReviewsTotal;
  const denominator: Denominator = { reviewsAnalysed, writtenReviewsTotal, isFullCorpus };

  const cautions = buildCautions(themes, denominator);

  return { hypothesis, denominator, themes, verdict, voc, cautions, grounding: 'evidence' };
}

function verdictStatement(
  hypothesis: string, reach: number, analysed: number, share: number, writtenTotal: number | null,
): string {
  const base = `${(share * 100).toFixed(0)}% (${reach} of ${analysed}) of the reviews we read use the hypothesis language`;
  const scope = writtenTotal !== null && analysed < writtenTotal ? ` — a sample of ${writtenTotal} written reviews` : '';
  const call =
    reach === 0 ? `No reviews mention "${hypothesis}". Do not build on it.`
      : share >= VERDICT_VALIDATED ? `Validated: lead with it.`
        : share >= VERDICT_SUPPORTIVE ? `Supportive but soften the hero claim.`
          : `Real but not felt — do not lead with it.`;
  return `${base}${scope}. ${call}`;
}

/** Verbatim VOC: first hypothesis-bearing sentence per distinct reviewer, ranked by emotional charge. */
function pickVoc(reviews: ReviewInput[], reachFlags: boolean[], hypothesisMatchers: RegExp[]): VocFragment[] {
  const perReviewer = new Map<string, VocFragment & { score: number }>();
  reviews.forEach((r, i) => {
    if (!reachFlags[i]) return;
    const key = reviewerKey(r, i);
    if (perReviewer.has(key)) return; // one fragment per reviewer, first wins deterministically
    const sentence = sentences(r.body).find((s) => {
      const sn = normaliseForMatch(s);
      return hypothesisMatchers.some((re) => mentions(sn, re));
    });
    if (!sentence) return;
    const sn = normaliseForMatch(sentence);
    const score = (/[!]/.test(sentence) ? 2 : 0) + (/\b(?:i|my|me)\b/.test(sn) ? 1 : 0) - sentence.length / 1000;
    perReviewer.set(key, { quote: sentence, reviewer: r.reviewer ?? null, rating: r.rating ?? null, score });
  });
  return [...perReviewer.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_VOC_FRAGMENTS)
    .map(({ quote, reviewer, rating }) => ({ quote, reviewer, rating }));
}

function buildCautions(themes: ThemeCount[], denominator: Denominator): string[] {
  const cautions: string[] = [];
  const inflated = themes.filter((t) => t.nameInflated).map((t) => `"${t.term}"`);
  if (inflated.length) {
    cautions.push(
      `Name-inflated: ${inflated.join(', ')} appear in the product title, so reviewers naming the product pad these counts — not unprompted language.`,
    );
  }
  const negated = themes.filter((t) => t.negatedMentions > 0);
  for (const t of negated) {
    cautions.push(`"${t.term}": ${t.negatedMentions} of ${t.mentions} mentions are negated (e.g. "not ...") — read them before using this theme.`);
  }
  if (!denominator.isFullCorpus && denominator.writtenReviewsTotal !== null) {
    cautions.push(
      `Sample: counts are over the ${denominator.reviewsAnalysed} reviews we read, out of ${denominator.writtenReviewsTotal} written reviews. Shares are "of the sample", not the full base.`,
    );
  } else if (denominator.writtenReviewsTotal === null) {
    cautions.push(
      `Shares are of the ${denominator.reviewsAnalysed} reviews we read; the full written-review total is unknown, so treat them as directional.`,
    );
  }
  return cautions;
}
