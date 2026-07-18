/**
 * competitor-analysis-asset — pure analyzer logic (Deno-free, unit-testable).
 *
 * Holds everything in the analyzer that does NOT touch Deno/fetch/Supabase:
 * the canonical IDEA enum, prompt builders, the defensive JSON parse, score
 * clamping, evidence rendering, context compaction, and the GROUNDING GATE
 * (`cleanCompetitors`). `index.ts` is the thin Deno edge entry that wires HTTP,
 * auth, DataForSEO and persistence around these.
 *
 * Mirrors the repo convention of separating storage-agnostic logic from the
 * edge entry (see _shared/memory.ts), so this file imports cleanly under vitest.
 *
 * GROUNDING GATE (plan §3): cleanCompetitors drops any competitor not anchored
 * to a real gathered-evidence ref, or missing any of the four IDEA scores. No
 * fabricated competitors/prices/scores/quotes survive.
 */

import type { AmazonProduct } from "../_shared/dataforseo.ts";

// ── Canonical IDEA enum — single source of truth (supabase/functions/_shared/idea.ts) ─
// Imported for use in this module AND re-exported so existing importers keep working.
import { DIMENSIONS, DIMENSION_LABELS } from "../_shared/idea.ts";
import type { Dimension } from "../_shared/idea.ts";
export { DIMENSIONS, DIMENSION_LABELS };
export type { Dimension };

export type Modality =
  | 'marketplace-listing'
  | 'web/store-copy'
  | 'visual/creative'
  | 'email/lifecycle'
  | 'social/content'
  | 'reviews/social-proof'
  | 'program/community';

/** The default modality when a touchpoint does not carry one. */
export const DEFAULT_MODALITY: Modality = 'marketplace-listing';

const MODALITIES: Modality[] = [
  'marketplace-listing',
  'web/store-copy',
  'visual/creative',
  'email/lifecycle',
  'social/content',
  'reviews/social-proof',
  'program/community',
];

/**
 * Resolve the modality for a request. A touchpoint's analyzer is routed by its
 * modality; when the caller does not supply a recognised one we fall back to the
 * marketplace-listing analyzer (the P2 priority), mirroring the edge entry.
 */
export function resolveModality(requested: unknown): Modality {
  return MODALITIES.includes(requested as Modality) ? (requested as Modality) : DEFAULT_MODALITY;
}

/**
 * The evidence source a modality routes to. `stub` modalities have no
 * evidence-gathering wired yet, so the analyzer returns needs_input rather than
 * fabricating a read (grounding gate).
 */
export type ModalitySource = 'dataforseo' | 'firecrawl-url' | 'reviews' | 'stub';

/**
 * The analyzer-routing contract: which evidence source each modality uses. This
 * is the single source of truth for the `gatherEvidence` switch in index.ts — the
 * edge entry routes by exactly this map, so the routing can be unit-tested here
 * without the Deno runtime.
 *
 *  - marketplace-listing -> DataForSEO (ASIN + category top-N)        [P2]
 *  - web/store-copy      -> Firecrawl URL-fetch on competitorUrls     [P5]
 *  - reviews/social-proof-> DataForSEO reviews / Firecrawl review URLs[P5]
 *  - visual / email / social / program -> stubbed (needs_input)
 */
export function routeModality(modality: Modality): ModalitySource {
  switch (modality) {
    case 'marketplace-listing':
      return 'dataforseo';
    case 'web/store-copy':
      return 'firecrawl-url';
    case 'reviews/social-proof':
      return 'reviews';
    // TODO(competitor-agents:LT-1): wire the remaining 4 modality evidence sources
    // (see docs/brand-funnel-builder/COMPETITOR_AGENTS_LONGTERM.md §LT-1). Each
    // replaces a 'stub' here with a gatherEvidence branch in index.ts:
    //   visual/creative  -> Claude-vision on competitor screenshots (DataForSEO
    //                       image URLs / upload) -> 'vision'
    //   email/lifecycle  -> user-upload library (competitor_assets)  -> 'upload'
    //   social/content   -> Firecrawl URL-fetch / upload             -> 'firecrawl-url'/'upload'
    //   program/community-> user-upload / URL-fetch                  -> 'upload'/'firecrawl-url'
    // Grounding gate still applies: anything not anchored to a fetched/uploaded
    // evidence item is omitted or flagged grounding:'inference'.
    case 'visual/creative':
    case 'email/lifecycle':
    case 'social/content':
    case 'program/community':
    default:
      return 'stub';
  }
}

/** Whether a modality has a wired evidence source (vs. a stub that emits needs_input). */
export function isModalityWired(modality: Modality): boolean {
  return routeModality(modality) !== 'stub';
}

/** One gathered competitor evidence record (the ONLY thing the model may score). */
export interface CompetitorEvidence {
  /** Stable id used as the evidence_ref `ref` so every score is anchorable. */
  ref: string;
  kind: string; // 'listing' | 'url' | 'review' | 'screenshot'
  name: string;
  url?: string;
  /** Compacted, model-readable rendering of the evidence. */
  text: string;
}

export interface CleanCompetitor {
  name: string;
  url: string | null;
  idea_scores: { i: number; d: number; e: number; a: number };
  rationale: string;
  gap_to_our_avatar: string;
  evidence_refs: { kind: string; ref: string }[];
}

/** One scraped competitor review (P5 reviews modality, from review-scraper / DataForSEO). */
export interface CompetitorReview {
  reviewerName?: string;
  rating?: number;
  title?: string;
  body: string;
  verified?: boolean;
  date?: string;
}

// ── Voice-of-customer (VoC) — P5 reviews modality ────────────────────────────
// The reviews modality ALSO mines the fetched competitor reviews for avatar
// vocabulary (S1) and objections (S4) signals, feeding the same shape the
// `avatar-vocabulary` (avatar_s1_vocab) and `avatar-objections`
// (avatar_s4_objections) fns emit. Both are EVIDENCE-only: every term/quote MUST
// be a literal substring of the supplied review corpus (substring grounding,
// cloned from those fns) — no invented vocabulary, no invented quotes.

/** Labeled frequency bands (matches avatar-vocabulary FREQUENCY_BANDS). */
export const VOC_FREQUENCY_BANDS = ['Very high', 'High', 'Medium-high', 'Medium', 'Low-medium', 'Low'];

/** S1 vocabulary cluster — verbatim customer words grouped by emotion. */
export interface VocCluster {
  cluster: string;
  customer_words: string[];
  frequency_signal: string;
  why_it_matters: string;
}

/** S4 objection — a purchase blocker anchored by a verbatim customer quote. */
export interface VocObjection {
  hesitation: string;
  verbatim_signal: string;
  resolution: string;
}

/**
 * VoC signals mined from competitor reviews, toward avatar S1 vocab / S4
 * objections. Persisted into the insight record (`voc_signals`); the
 * user_knowledge_base S1/S4 write path is intentionally NOT touched here
 * (see index.ts TODO(competitor-agents:voc-kb-write)).
 */
export interface VocSignals {
  vocab_clusters: VocCluster[];
  objections: VocObjection[];
  grounding: 'evidence';
  /** Refs of the review-evidence items the VoC was mined from. */
  evidence_refs: { kind: string; ref: string }[];
}

// ── Evidence rendering ───────────────────────────────────────────────────────

/** Render a DataForSEO Amazon product as grounded evidence text. */
export function renderProductEvidence(p: AmazonProduct): string {
  const lines: string[] = [];
  if (p.title) lines.push(`Title: ${p.title}`);
  if (p.brand) lines.push(`Brand: ${p.brand}`);
  if (typeof p.price === 'number') lines.push(`Price: ${p.currency ?? ''}${p.price}`.trim());
  if (typeof p.rating === 'number') lines.push(`Rating: ${p.rating}${p.reviewsCount ? ` (${p.reviewsCount} reviews)` : ''}`);
  if (p.bullets.length > 0) lines.push(`Bullets: ${p.bullets.join(' | ')}`);
  if (p.description) lines.push(`Description: ${p.description.slice(0, 600)}`);
  return lines.join('\n');
}

/** Max chars of fetched web copy embedded as one evidence item (token guard). */
export const MAX_URL_EVIDENCE_CHARS = 2500;

/**
 * Render fetched web/store-copy (a competitor page's main content) as grounded
 * evidence text. Collapses runs of whitespace and caps length — the model only
 * ever sees what was actually fetched (grounding gate), bounded for tokens.
 */
export function renderUrlEvidence(title: string | undefined, content: string): string {
  const lines: string[] = [];
  if (title && title.trim()) lines.push(`Page title: ${title.trim()}`);
  const body = content.replace(/\s+/g, ' ').trim().slice(0, MAX_URL_EVIDENCE_CHARS);
  if (body) lines.push(`Page copy: ${body}`);
  return lines.join('\n');
}

/** Max reviews + per-body chars folded into one competitor's review evidence. */
export const MAX_REVIEWS_PER_EVIDENCE = 15;
export const MAX_REVIEW_BODY_CHARS = 400;

/**
 * Render a competitor's scraped reviews as grounded evidence text. Each line is
 * a verbatim review (rating + body), so the model — and the VoC substring gate —
 * only ever see real customer language.
 */
export function renderReviewEvidence(reviews: CompetitorReview[]): string {
  const lines = reviews
    .slice(0, MAX_REVIEWS_PER_EVIDENCE)
    .map((r) => {
      const star = typeof r.rating === 'number' ? `★${r.rating} ` : '';
      const title = r.title ? `${r.title.trim()} — ` : '';
      const body = r.body.replace(/\s+/g, ' ').trim().slice(0, MAX_REVIEW_BODY_CHARS);
      return `${star}${title}${body}`.trim();
    })
    .filter((l) => l.length > 0);
  return lines.join('\n');
}

/**
 * Build the single review corpus string + a lowercased haystack for VoC
 * substring grounding (mirrors the `normaliseReviews` pattern in
 * avatar-vocabulary / avatar-objections).
 */
export function buildReviewCorpus(reviews: CompetitorReview[]): { corpus: string; haystack: string } {
  const corpus = reviews
    .map((r) => [r.title ?? '', r.body ?? ''].filter((s) => s.trim()).join('. '))
    .filter((s) => s.trim())
    .join('\n\n')
    .trim();
  return { corpus, haystack: corpus.toLowerCase() };
}

// ── Context compaction ───────────────────────────────────────────────────────

/**
 * The avatar/brand-strategy fields audit-asset always grounds on (its
 * CORE_FIELDS — the field_id keys of user_knowledge_base / avatar_field_values).
 * Surfacing the SAME fields here is what gives the competitor read Calculation
 * Parity with the brand's own audit: both judges see the same avatar context.
 */
export const AVATAR_CORE_FIELDS: { key: string; label: string }[] = [
  { key: 'psychographics', label: 'Psychographics' },
  { key: 'demographics', label: 'Demographics' },
  { key: 'painPoints', label: 'Pain points' },
  { key: 'goals', label: 'Goals' },
  { key: 'emotionalTriggers', label: 'Emotional triggers' },
  { key: 'emotionalConnection', label: 'Emotional connection' },
  { key: 'brandValues', label: 'Brand values' },
  { key: 'brandPromise', label: 'Brand promise' },
  { key: 'positioningStatement', label: 'Positioning statement' },
  { key: 'differentiators', label: 'Differentiators' },
  { key: 'uniqueValue', label: 'Unique value' },
  { key: 'consumerInsight', label: 'Consumer insight' },
  { key: 'brandPersonality', label: 'Brand personality' },
];

/**
 * Compact a host-supplied avatar context object into prompt text. Renders the
 * audit-asset CORE_FIELDS first (Calculation Parity — same grounding the brand's
 * own audit sees), then the friendlier aliases the host may also pass. The
 * server-side KB loader (loadAvatarFromKb) maps user_knowledge_base
 * `avatar_<field_id>` rows onto these same keys, so both paths agree.
 */
export function formatAvatar(avatar: unknown): string {
  if (!avatar) return '';
  if (typeof avatar === 'string') return avatar.trim();
  if (typeof avatar !== 'object') return '';
  const a = avatar as Record<string, unknown>;
  const lines: string[] = [];
  const push = (label: string, v: unknown): void => {
    if (typeof v === 'string' && v.trim()) lines.push(`- ${label}: ${v.trim()}`);
    else if (Array.isArray(v)) {
      const items = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      if (items.length > 0) lines.push(`- ${label}: ${items.join(', ')}`);
    }
  };
  // audit-asset CORE_FIELDS, in the same order the brand's own audit grounds on.
  for (const { key, label } of AVATAR_CORE_FIELDS) push(label, a[key]);
  // Friendlier aliases the host may also supply (kept for backward-compat).
  push('Avatar name', a.name);
  push('Core values', a.values);
  push('Fears', a.fears);
  push('Desires', a.desires);
  push('Decision factors', a.decisionFactors ?? a.decision_factors);
  push('Vocabulary', a.vocabulary ?? a.words_we_use);
  push('Objections', a.objections);
  return lines.join('\n');
}

/** Compact a host-supplied Positioning Statement context into prompt text. */
export function formatPositioningStatement(positioning_statement: unknown): string {
  if (!positioning_statement) return '';
  if (typeof positioning_statement === 'string') return positioning_statement.trim();
  if (typeof positioning_statement !== 'object') return '';
  const s = positioning_statement as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof s.positioning_statement === 'string') lines.push(`- Positioning Statement: ${s.positioning_statement.trim()}`);
  if (typeof s.statement === 'string') lines.push(`- Positioning Statement: ${s.statement.trim()}`);
  if (typeof s.position === 'string') lines.push(`- Position: ${s.position.trim()}`);
  if (typeof s.promise === 'string') lines.push(`- Promise: ${s.promise.trim()}`);
  if (typeof s.villain === 'string') lines.push(`- Villain: ${s.villain.trim()}`);
  if (typeof s.identity_payoff === 'string') lines.push(`- Identity payoff: ${s.identity_payoff.trim()}`);
  return lines.join('\n');
}

/** Compact the brand's own asset + its audit_result into prompt text. */
export function formatOurAsset(ourAsset: unknown, auditResult: unknown): string {
  const parts: string[] = [];
  if (typeof ourAsset === 'string' && ourAsset.trim()) parts.push(`OUR ASSET:\n${ourAsset.trim().slice(0, 1500)}`);
  else if (ourAsset && typeof ourAsset === 'object') parts.push(`OUR ASSET:\n${JSON.stringify(ourAsset).slice(0, 1500)}`);
  if (auditResult && typeof auditResult === 'object') {
    const ar = auditResult as Record<string, unknown>;
    const scores = ar.scores ?? ar.idea_scores;
    if (scores) parts.push(`OUR ASSET IDEA AUDIT: ${JSON.stringify(scores)}`);
  }
  return parts.join('\n\n');
}

// ── Defensive JSON parse (clone of audit-idea-map brace-scan) ────────────────

export function extractBalancedObjects(text: string): string[] {
  const objs: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          objs.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return objs;
}

/** Parse the model's `{competitors, strategic_angle}` object, tolerant of fences. */
export function parseAnalysis(rawText: string): Record<string, unknown> | null {
  const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // fall through to brace-scan
  }
  for (const obj of extractBalancedObjects(rawText)) {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).competitors)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // skip
    }
  }
  return null;
}

/** Clamp a raw score to 0-100 integer, or undefined when not a finite number. */
export function clampScore(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Clean + ground-gate the model output. Drops any competitor not anchored to a
 * real evidence ref (grounding gate) or missing any of the four IDEA scores.
 */
export function cleanCompetitors(
  raw: unknown,
  evidenceByRef: Map<string, CompetitorEvidence>,
): CleanCompetitor[] {
  if (!Array.isArray(raw)) return [];
  const out: CleanCompetitor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const scoresRaw = (c.idea_scores ?? c.scores) as Record<string, unknown> | undefined;
    if (!scoresRaw || typeof scoresRaw !== 'object') continue;
    const i = clampScore(scoresRaw.i ?? scoresRaw.insight);
    const d = clampScore(scoresRaw.d ?? scoresRaw.distinctive);
    const e = clampScore(scoresRaw.e ?? scoresRaw.empathetic);
    const a = clampScore(scoresRaw.a ?? scoresRaw.authentic);
    if (i === undefined || d === undefined || e === undefined || a === undefined) continue;

    // Grounding gate: keep ONLY evidence refs that correspond to gathered evidence.
    const refsRaw = Array.isArray(c.evidence_refs) ? c.evidence_refs : [];
    const refs: { kind: string; ref: string }[] = [];
    for (const r of refsRaw) {
      if (r && typeof r === 'object') {
        const ro = r as Record<string, unknown>;
        const ref = typeof ro.ref === 'string' ? ro.ref : '';
        if (ref && evidenceByRef.has(ref)) {
          refs.push({ kind: typeof ro.kind === 'string' ? ro.kind : evidenceByRef.get(ref)!.kind, ref });
        }
      }
    }
    // A competitor with no anchorable evidence is a fabrication — drop it.
    if (refs.length === 0) continue;

    const name = typeof c.name === 'string' && c.name.trim()
      ? c.name.trim()
      : evidenceByRef.get(refs[0].ref)!.name;
    const evUrl = evidenceByRef.get(refs[0].ref)!.url ?? null;
    out.push({
      name,
      url: typeof c.url === 'string' && c.url.trim() ? c.url.trim() : evUrl,
      idea_scores: { i, d, e, a },
      rationale: typeof c.rationale === 'string' ? c.rationale.trim() : '',
      gap_to_our_avatar: typeof c.gap_to_our_avatar === 'string' ? c.gap_to_our_avatar.trim() : '',
      evidence_refs: refs,
    });
  }
  return out;
}

// ── Prompt builders ──────────────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return `<persona>
You are Trevor, a brand coach inside the IDEA Brand Coach. Your job is the COMPETITIVE Trust Gap read: for a single funnel touchpoint, you score each competitor on the same IDEA dimensions you use to audit this brand's own assets, and find where this brand can win, grounded in the brand's own avatar and Positioning Statement.
</persona>

<the-four-pillars>
IDEA dimensions (score each 0-100), read here against the competitor's asset exactly as they are read against the brand's own asset in audit-asset:
- ${DIMENSION_LABELS.insight} (insight): does the asset show it understands what really drives this customer?
- ${DIMENSION_LABELS.distinctive} (distinctive): does it stand out and avoid blending in with the category?
- ${DIMENSION_LABELS.empathetic} (empathetic): would this customer feel understood by it?
- ${DIMENSION_LABELS.authentic} (authentic): does it feel genuine and believable, true to the Positioning Statement?
</the-four-pillars>

<scoring>
Score EACH competitor on all four pillars, each 0 to 100, judging the competitor's asset ONLY against OUR avatar and Positioning Statement (same lens as the brand's own audit, so the two are comparable). Do not invent avatar facts. If the competitor's asset contradicts or ignores what OUR avatar wants, score the relevant dimensions low and say why. Base every score ONLY on that competitor's supplied evidence. Then write a short rationale and a gap_to_our_avatar: where this competitor is weak against OUR avatar and Positioning Statement, i.e. the opening for us.
</scoring>

<grounding-rule>
You are scoring ONLY the competitors supplied in the COMPETITOR EVIDENCE block. Do NOT invent competitors, brands, prices, ratings, or quotes. Every competitor in your output MUST carry an evidence_refs array citing the ref id(s) of the evidence you used (the ref values are given with each evidence item). If you cannot ground a competitor in the supplied evidence, do not include it. Quote only short phrases that appear in the evidence.
</grounding-rule>

<strategic-angle>
After scoring, write ONE strategic_angle: the single sharpest way this brand can win at this touchpoint given the competitors' collective IDEA weaknesses and our avatar and Positioning Statement. Concrete and actionable, not generic.
</strategic-angle>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops, commas, or hyphens.
- Use UK English spelling. No emojis, no hype.
</voice-rules>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"competitors":[{"name":"...","url":"...","idea_scores":{"i":0,"d":0,"e":0,"a":0},"rationale":"...","gap_to_our_avatar":"...","evidence_refs":[{"kind":"listing","ref":"asin:..."}]}],"strategic_angle":"..."}
Score every supplied competitor. idea_scores values are integers 0-100. Every competitor must include at least one evidence_refs entry whose ref matches a supplied evidence item. No markdown inside any string. No trailing commentary outside the JSON.
</output-contract>`;
}

export function buildUserMessage(
  modality: Modality,
  touchpointId: string,
  evidence: CompetitorEvidence[],
  avatarText: string,
  positioningStatementText: string,
  ourAssetText: string,
): string {
  const parts: string[] = [];
  parts.push(`TOUCHPOINT: ${touchpointId} (modality: ${modality})`);
  if (avatarText) parts.push(`OUR AVATAR:\n${avatarText}`);
  if (positioningStatementText) parts.push(`OUR POSITIONING STATEMENT:\n${positioningStatementText}`);
  if (ourAssetText) parts.push(ourAssetText);
  const evidenceBlock = evidence
    .map((e) => `--- COMPETITOR (ref: ${e.ref}, kind: ${e.kind})\nname: ${e.name}${e.url ? `\nurl: ${e.url}` : ''}\n${e.text}`)
    .join('\n\n');
  parts.push(`COMPETITOR EVIDENCE (score ONLY these; cite each by its ref):\n${evidenceBlock}`);
  parts.push('Now produce the IDEA-scored competitor read and the strategic angle. Return ONLY the JSON object.');
  return parts.join('\n\n');
}

// ── VoC prompt + parse + grounding (P5 reviews modality) ─────────────────────

/**
 * System prompt for mining S1 vocabulary + S4 objections from competitor
 * reviews. Both stages are EVIDENCE-only and the substring grounding is enforced
 * post-parse by `enforceVocGrounding` — this prompt mirrors the discipline in the
 * avatar-vocabulary / avatar-objections fns so the output drops into the same
 * avatar_s1_vocab / avatar_s4_objections shape.
 */
export function buildVocSystemPrompt(): string {
  return `<persona>
You are a voice-of-customer analyst inside the IDEA Brand Coach. From a corpus of competitor product reviews you extract two things for our brand's avatar work: the customers' own vocabulary clustered by emotion (Stage 1), and their purchase hesitations and objections (Stage 4). These are the competitors' customers, but they are the same buyers we are trying to win, so their language and blockers are gold for our avatar.
</persona>

<critical-grounding-rule>
Every term in any "customer_words" array, and every "verbatim_signal", MUST be a word-for-word substring of the supplied reviews. Copy the customer's exact phrasing. Do NOT paraphrase, normalise, pluralise, correct spelling, translate, or invent. If a phrase does not appear literally in the reviews, you may not include it. Inventing vocabulary or quotes is the single worst failure here.
</critical-grounding-rule>

<vocab-clusters>
Group the customers' own words into emotion clusters (for example: protection / damage anxiety; capacity; quality; identity; ritual). For each cluster list the verbatim terms, a labeled "frequency_signal" band, and a one-sentence "why_it_matters". "frequency_signal" must be EXACTLY one of: "Very high", "High", "Medium-high", "Medium", "Low-medium", "Low". Never a number or percentage. Produce up to 6 clusters.
</vocab-clusters>

<objections>
Surface the purchase hesitations, leaning on low-star reviews. For each: "hesitation" (the blocker, your words), "verbatim_signal" (a REAL word-for-word quote from the reviews evidencing it), and "resolution" (what would resolve it in copy, image, or A+). Produce up to 6 objections. If the reviews carry no objection signal, return an empty objections array rather than inventing one.
</objections>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops, commas, or hyphens.
- Use UK English spelling for your own words (but quote customer words verbatim). No emojis, no hype.
</voice-rules>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"vocab_clusters":[{"cluster":"...","customer_words":["..."],"frequency_signal":"High","why_it_matters":"..."}],"objections":[{"hesitation":"...","verbatim_signal":"...","resolution":"..."}]}
Every customer_words term and every verbatim_signal must be verbatim from the reviews. No markdown inside any string. No trailing commentary outside the JSON.
</output-contract>`;
}

/** Build the VoC user turn from the review corpus. */
export function buildVocUserMessage(reviewCorpus: string): string {
  return [
    'COMPETITOR REVIEWS (mine ONLY these; every word you quote must be verbatim from here):',
    reviewCorpus,
    'Now produce the vocabulary clusters and objections. Return ONLY the JSON object.',
  ].join('\n\n');
}

/** Parse the model's `{vocab_clusters, objections}` object, tolerant of fences/prose. */
export function parseVoc(rawText: string): Record<string, unknown> | null {
  const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // fall through to brace-scan
  }
  for (const obj of extractBalancedObjects(rawText)) {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>;
        if (Array.isArray(p.vocab_clusters) || Array.isArray(p.objections)) return p;
      }
    } catch {
      // skip
    }
  }
  return null;
}

/**
 * Enforce VoC substring grounding (cloned from avatar-vocabulary /
 * avatar-objections): drop any customer word / verbatim quote that is NOT a
 * literal substring of the review corpus, and any cluster/objection left empty.
 * Returns null when there is nothing grounded to emit (so the caller omits VoC
 * rather than persisting a fabricated read).
 *
 * @param parsed     the parsed model output
 * @param haystack   the lowercased review corpus (see buildReviewCorpus)
 * @param refs       evidence refs of the review items the VoC was mined from
 */
export function enforceVocGrounding(
  parsed: Record<string, unknown>,
  haystack: string,
  refs: { kind: string; ref: string }[],
): VocSignals | null {
  const grounded = (term: unknown): term is string =>
    typeof term === 'string' && term.trim().length > 0 && haystack.includes(term.trim().toLowerCase());

  const rawClusters = Array.isArray(parsed.vocab_clusters) ? parsed.vocab_clusters : [];
  const vocab_clusters: VocCluster[] = [];
  for (const item of rawClusters) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const cluster = typeof c.cluster === 'string' ? c.cluster.trim() : '';
    const why = typeof c.why_it_matters === 'string' ? c.why_it_matters.trim() : '';
    const words = (Array.isArray(c.customer_words) ? c.customer_words : []).filter(grounded).map((w) => (w as string).trim());
    let band = typeof c.frequency_signal === 'string' ? c.frequency_signal.trim() : '';
    if (!VOC_FREQUENCY_BANDS.includes(band)) band = 'Medium';
    if (cluster && words.length > 0) {
      vocab_clusters.push({ cluster, customer_words: words, frequency_signal: band, why_it_matters: why });
    }
  }

  const rawObjections = Array.isArray(parsed.objections) ? parsed.objections : [];
  const objections: VocObjection[] = [];
  for (const item of rawObjections) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const hesitation = typeof o.hesitation === 'string' ? o.hesitation.trim() : '';
    const resolution = typeof o.resolution === 'string' ? o.resolution.trim() : '';
    // verbatim_signal MUST be a real quote — drop the objection otherwise.
    if (hesitation && grounded(o.verbatim_signal)) {
      objections.push({ hesitation, verbatim_signal: (o.verbatim_signal as string).trim(), resolution });
    }
  }

  if (vocab_clusters.length === 0 && objections.length === 0) return null;
  return { vocab_clusters, objections, grounding: 'evidence', evidence_refs: refs };
}
