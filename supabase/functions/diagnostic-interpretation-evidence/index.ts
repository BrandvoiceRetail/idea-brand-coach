import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * diagnostic-interpretation-evidence  (gold Workbook A, sheet 3 "Trust Gap™ Diagnostic")
 *
 * The EVIDENCE-GROUNDED sibling of the public `diagnostic-interpretation` fn. Same
 * persona, the same four IDEA pillars, the same /25 score bands — but where the public
 * fn carries a "do-not-fabricate, you have NOT seen their listing" clause, this fn
 * INVERTS that into a must-cite-evidence rule: every `where_it_shows_up` citation must
 * quote or directly describe the supplied evidence (listing copy / reviews / ad copy).
 *
 * Cloned from the reveal-signature / diagnostic-interpretation skeleton (CORS, optional
 * JWT->getUser, Anthropic SONNET with prompt caching, strict JSON contract, defensive parse,
 * evidence-vs-inference branch). NOTE: unlike reveal-signature this fn does NOT use an
 * assistant value-level prefill — the nested per-dimension citation shape made Sonnet drop the
 * array's opening brace on resumption and 500 ~67-80% of calls; see parseModel / the messages
 * array for the root cause and the no-prefill fix.
 *
 * GROUNDING DISCIPLINE — PER-DIMENSION EVIDENCE OR INFERENCE FLAG:
 * A dimension is graded in `evidence` mode only when there is supplied evidence its read
 * can cite. When a dimension has no evidence to cite, the model is told to SAY SO in
 * `where_it_shows_up` ("No listing copy or reviews supplied for this read") and that
 * dimension's `grounding` is `inference`. The function enforces this post-parse: a
 * dimension whose citations do not trace to the supplied evidence corpus is down-graded
 * to `grounding:'inference'` and its citations are replaced with the no-evidence note,
 * so a fabricated "where it shows up" can never leak (manifest §6 / guardrail #4).
 *
 * Output contract (Phase-0 `diagnostic_interpretation`, enriched citation shape):
 *   { overall_score, primary_gap, interpretation,
 *     dimensions: [{ dimension, score, what_it_measures, brand_read,
 *                    where_it_shows_up: [{ evidence_type, quote_or_observation }],
 *                    grounding: 'evidence'|'inference' }],
 *     primaryGapSummary, triage: { recommended_next_module, rationale },
 *     grounding: 'evidence'|'inference', evidence_refs: [{ kind, ref }] }
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Dimension = 'insight' | 'distinctive' | 'empathetic' | 'authentic';
const DIMENSIONS: Dimension[] = ['insight', 'distinctive', 'empathetic', 'authentic'];
const DIMENSION_LABELS: Record<Dimension, string> = {
  insight: 'Insight',
  distinctive: 'Distinctiveness',
  empathetic: 'Empathy',
  authentic: 'Authenticity',
};

/** Evidence-source labels the model may attach to a citation. */
const EVIDENCE_TYPES = ['listing_copy', 'reviews', 'ad_copy'] as const;
type EvidenceType = (typeof EVIDENCE_TYPES)[number];

const NO_EVIDENCE_NOTE =
  'No supplied evidence for this read. Graded from intake answers and the score band; treat as inference.';

interface InterpretationRequest {
  scores?: Partial<Record<Dimension, number>>;
  overall?: number;
  primaryGap?: Dimension;
  evidence?: {
    listing_copy?: string;
    reviews?: string;
    ad_copy?: string;
  };
  fields?: Record<string, unknown>;
  /** DERIVE MODE: when true, no scores are supplied — the model ASSIGNS 0-100 + confidence
   *  per pillar from the evidence. Powers the MCP `assess_idea_dimensions` keystone. */
  derive?: boolean;
}

/** A parsed model dimension row before grounding enforcement. */
interface RawDimension {
  dimension?: string;
  score?: number;
  what_it_measures?: string;
  brand_read?: string;
  where_it_shows_up?: Array<{ evidence_type?: string; quote_or_observation?: string }>;
  /** Derive mode only: the model's self-reported confidence in this pillar's read. */
  confidence?: string;
  read?: string;
}

/** Normalise an evidence block into the per-type corpora + a single lowercased haystack. */
function normaliseEvidence(evidence: InterpretationRequest['evidence']): {
  byType: Record<EvidenceType, string>;
  haystack: string;
  present: EvidenceType[];
} {
  const byType: Record<EvidenceType, string> = { listing_copy: '', reviews: '', ad_copy: '' };
  if (evidence && typeof evidence === 'object') {
    for (const t of EVIDENCE_TYPES) {
      const raw = (evidence as Record<string, unknown>)[t];
      if (typeof raw === 'string' && raw.trim()) byType[t] = raw.trim();
    }
  }
  const present = EVIDENCE_TYPES.filter((t) => byType[t].length > 0);
  const haystack = present.map((t) => byType[t]).join('\n\n').toLowerCase();
  return { byType, haystack, present };
}

/** Format extracted owner-intent fields into a labelled block (positioning, voice, etc.). */
function formatFields(fields: Record<string, unknown> | undefined): string {
  if (!fields || typeof fields !== 'object') return '';
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    if (!text.trim()) continue;
    lines.push(`- ${key}: ${text.trim()}`);
  }
  return lines.join('\n');
}

/** Defensively extract the first balanced JSON object from text (string-aware). */
function extractFirstObject(text: string): string | null {
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
        if (depth === 0 && start !== -1) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

type ParsedModel = {
  dimensions: RawDimension[];
  interpretation: string;
  primaryGapSummary: string;
  triage: { recommended_next_module?: string; rationale?: string };
};

/** Keys at the top level that are NOT dimension rows (used to lift dimensions-as-object). */
const NON_DIMENSION_KEYS = new Set(['dimensions', 'interpretation', 'primaryGapSummary', 'triage', 'overall_score', 'primary_gap']);

type Meta = { interpretation: string; primaryGapSummary: string; triage: { recommended_next_module?: string; rationale?: string } };

/** Pull the three meta fields out of an object (empty strings / {} when absent). */
function readMeta(obj: Record<string, unknown>): Meta {
  return {
    interpretation: typeof obj.interpretation === 'string' ? obj.interpretation : '',
    primaryGapSummary: typeof obj.primaryGapSummary === 'string' ? obj.primaryGapSummary : '',
    triage:
      obj.triage && typeof obj.triage === 'object'
        ? (obj.triage as { recommended_next_module?: string; rationale?: string })
        : {},
  };
}

/** Prefer the primary meta; fall back to the secondary for any field the primary left empty. */
function mergeMeta(primary: Meta, secondary: Meta): Meta {
  return {
    interpretation: primary.interpretation || secondary.interpretation,
    primaryGapSummary: primary.primaryGapSummary || secondary.primaryGapSummary,
    triage:
      primary.triage.recommended_next_module || primary.triage.rationale ? primary.triage : secondary.triage,
  };
}

/**
 * Coerce a parsed top-level object into the ParsedModel shape, tolerating BOTH shapes Sonnet
 * emits as the full object:
 *  - ARRAY form: `parsed.dimensions` is `[{dimension, score, ...}]` (the contracted shape).
 *  - OBJECT form: the model keyed pillars by name (`{"insight":{...},"distinctive":{...},
 *    ...,"interpretation":...,"triage":{...}}`); every non-reserved key is a dimension row.
 * Returns null when neither yields any dimension rows.
 */
function coerceParsed(parsed: unknown): ParsedModel | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // ARRAY form.
  if (Array.isArray(obj.dimensions)) {
    if (obj.dimensions.length === 0) return null;
    return { dimensions: obj.dimensions as RawDimension[], ...readMeta(obj) };
  }

  // OBJECT form: dimensions keyed by name, either nested under `dimensions` or at top level.
  const nested = obj.dimensions && typeof obj.dimensions === 'object';
  const dimsSource = nested ? (obj.dimensions as Record<string, unknown>) : obj;
  // Meta lives at the true top level, but when dimensions were nested the model sometimes
  // tucked the meta inside that nested object too — read top-level first, nested as fallback.
  const meta = mergeMeta(readMeta(obj), readMeta(dimsSource));
  const rows: RawDimension[] = [];
  for (const [key, value] of Object.entries(dimsSource)) {
    if (NON_DIMENSION_KEYS.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const row = value as RawDimension;
      // Carry the key as the dimension name when the row didn't name itself.
      if (!row.dimension) row.dimension = key;
      rows.push(row);
    }
  }
  if (rows.length === 0) return null;
  // When dimensions were nested under `dimensions`, meta may live at the true top level —
  // already captured above from `obj`. Done.
  return { dimensions: rows, ...meta };
}

/**
 * Tolerant parse of the model's response object. The model is asked to return ONE complete
 * JSON object and is NOT prefilled (see the messages array below — the earlier value-level
 * `{"dimensions":` prefill forced Sonnet to resume mid-structure and it reliably dropped the
 * array's opening object brace, emitting an unparseable `["dimension":...` shape ~67-80% of
 * the time; a live capture confirmed every NO-prefill response parses directly, every prefill
 * response failed). Without the prefill Sonnet emits a complete, well-formed object, so the
 * parse is a clean direct attempt with a single defensive fallback. `coerceParsed` still
 * normalises the array-of-dimensions vs dimension-keyed-object shapes and merges meta. Never
 * throws; returns null only when no balanced object yields dimension rows.
 */
function parseModel(rawText: string): ParsedModel | null {
  const candidates: string[] = [rawText.trim()];
  // Defensive fallback: if the model wrapped the object in prose or a code fence, lift the
  // first balanced JSON object out of the text.
  const fallback = extractFirstObject(rawText);
  if (fallback && fallback !== rawText.trim()) candidates.push(fallback);

  for (const candidate of candidates) {
    try {
      const coerced = coerceParsed(JSON.parse(candidate));
      if (coerced) return coerced;
    } catch {
      // try the fallback
    }
  }
  return null;
}

/** Build the system prompt: persona + bands lifted from diagnostic-interpretation,
 *  do-not-fabricate INVERTED into must-cite-evidence, enriched JSON contract. */
function buildSystemPrompt(present: EvidenceType[]): string {
  const evidenceClause = present.length
    ? `<evidence-provided>
The founder has supplied real brand evidence: ${present.join(', ')}. This is the strongest source. For each pillar, your "where_it_shows_up" citations MUST quote or directly describe THIS supplied evidence — a verbatim phrase from the listing or a review, or a precise observation about it ("Bullet 1 opens with capacity, not feeling"). Do not invent quotes. Do not cite evidence you were not given.
</evidence-provided>`
    : `<no-evidence-provided>
No listing copy, reviews, or ad copy were supplied. You CANNOT cite evidence you do not have. For every pillar, set "where_it_shows_up" to a single entry stating that no evidence was supplied for this read, and grade from the intake and the score band only. Do NOT invent listing bullets, reviews, or specifics.
</no-evidence-provided>`;

  return `<persona>
You are Trevor Bradford, creator of the IDEA Strategic Brand Framework and a direct, experienced brand coach. You are reading a founder's brand diagnostic and giving them a straight, evidence-grounded assessment of where their brand builds trust and where it leaks it. You speak like a coach triaging, not like a report generator.
</persona>

<task>
You are given four trust pillar scores, each out of 25, an overall score out of 100, the named primary gap, and (where available) the founder's actual listing copy, reviews, and ad copy. For EACH of the four pillars write: what it measures, your brand-specific read at their score, and WHERE it shows up in their actual evidence. Then write one bridging summary for the primary gap and a triage recommendation.
</task>

<the-four-pillars>
- Insight: how well the brand understands what really drives the customer, their motivations and emotional triggers, and how clearly that turns into messaging.
- Distinctiveness: how much the brand stands out and owns a recognisable position and identity, instead of blending in with competitors.
- Empathy: how emotionally connected customers feel, whether the brand speaks to what the customer feels and not just what the product is.
- Authenticity: how genuine and transparent the brand is, whether its communication earns belief.
</the-four-pillars>

<score-bands>
- 0 to 9 out of 25: weak. This pillar is leaking trust.
- 10 to 17 out of 25: mixed. Partly working, real room to improve.
- 18 to 25 out of 25: strong. This pillar is building trust.
</score-bands>

<must-cite-evidence>
This is the inverted rule that separates this diagnostic from a generic one. Every "where_it_shows_up" entry must point at real evidence: a verbatim quote from the supplied listing copy, a verbatim phrase from a supplied review, a phrase from supplied ad copy, or a precise factual observation about that supplied evidence. NEVER fabricate a quote, a bullet, a review, or a specific the evidence does not contain. If a pillar has no evidence to cite, say exactly that — an honest "no evidence supplied" is correct; an invented citation is the worst failure of this stage.
</must-cite-evidence>

${evidenceClause}

<each-pillar>
For each pillar write:
- what_it_measures: the rubric question, in plain words.
- brand_read: 2 to 3 sentences, your read at their score for THIS brand (use the supplied evidence and any owner-intent fields).
- where_it_shows_up: an array of 1 to 3 citations, each { "evidence_type": one of "listing_copy" | "reviews" | "ad_copy", "quote_or_observation": a verbatim quote or precise observation about the supplied evidence }. When no evidence supports this pillar, return a single entry with evidence_type matching whatever was closest and a quote_or_observation that states no evidence was supplied.
</each-pillar>

<primary-gap-summary>
Write 2 to 3 sentences naming the primary gap as their single biggest opportunity right now, grounded in what the evidence shows, and why closing it matters most before the others.
</primary-gap-summary>

<triage>
Recommend the next module the diagnostic should route them into (recommended_next_module) and a short rationale. This is the bridge from score to action.
</triage>

<voice>
- Plain, direct, warm, experienced. Second person, talk to them as you.
- UK English spelling throughout.
- Do NOT use asterisks, markdown, bold, headings, bullet characters or emojis.
- Do NOT use em dashes or en dashes. Use commas, full stops, or the word and.
- Use CAPITAL LETTERS sparingly, only for genuine emphasis.
- Short sentences. No jargon dumps.
</voice>

<output-contract>
Respond with ONLY a single JSON object and nothing else. No commentary, no code fences. Use exactly this shape:
{"dimensions":[{"dimension":"Insight","score":<0-25>,"what_it_measures":"...","brand_read":"...","where_it_shows_up":[{"evidence_type":"listing_copy","quote_or_observation":"..."}]}, ...four pillars in order Insight, Distinctiveness, Empathy, Authenticity...],"interpretation":"...","primaryGapSummary":"...","triage":{"recommended_next_module":"...","rationale":"..."}}
Every string value must obey the voice rules above.
</output-contract>`;
}

/** Build the user message: scores + the supplied evidence corpora + owner-intent fields. */
function buildUserMessage(
  scores: Record<Dimension, number>,
  overall: number,
  primaryGap: Dimension,
  byType: Record<EvidenceType, string>,
  present: EvidenceType[],
  fieldsText: string,
): string {
  const scoreLines = DIMENSIONS.map((dim) => `- ${DIMENSION_LABELS[dim]}: ${scores[dim]} out of 25`);
  const parts: string[] = [
    `Here are the four trust pillar scores:\n${scoreLines.join('\n')}\nOverall trust score: ${overall} out of 100.\nThe primary gap, their weakest pillar, is: ${DIMENSION_LABELS[primaryGap]}.`,
  ];
  if (fieldsText) {
    parts.push(`OWNER INTENT AND BRAND CONTEXT (positioning, voice, story):\n${fieldsText}`);
  }
  if (present.length) {
    for (const t of present) {
      // Cap each corpus to keep the request within sane token limits.
      parts.push(`SUPPLIED ${t.toUpperCase()} (cite this verbatim):\n${byType[t].slice(0, 8000)}`);
    }
  } else {
    parts.push('NO listing copy, reviews, or ad copy were supplied. Mark every where_it_shows_up as no-evidence.');
  }
  parts.push('Write the diagnostic now as the JSON object.');
  return parts.join('\n\n');
}

/**
 * Enforce grounding per dimension. A citation is "grounded" when its quote_or_observation
 * is a literal substring of the supplied evidence haystack, OR when it is an explicit
 * no-evidence note. A dimension with NO grounded citation is down-graded to inference and
 * its citations are replaced by the no-evidence note (no fabricated "where it shows up").
 */
function enforceDimensionGrounding(
  raw: RawDimension,
  fallbackDim: Dimension,
  haystack: string,
  hasEvidence: boolean,
): {
  dimension: string;
  score: number;
  what_it_measures: string;
  brand_read: string;
  where_it_shows_up: Array<{ evidence_type: EvidenceType; quote_or_observation: string }>;
  grounding: 'evidence' | 'inference';
} {
  // Always emit the canonical IDEA label for the position-mapped pillar (the contract's
  // ideaDimensionSchema requires exactly Insight|Distinctiveness|Empathy|Authenticity);
  // the model's raw `dimension` string may be a short key like "insight".
  const dimension = DIMENSION_LABELS[fallbackDim];
  const score = typeof raw.score === 'number' && Number.isFinite(raw.score) ? Math.max(0, Math.min(25, Math.round(raw.score))) : 0;
  const what_it_measures = typeof raw.what_it_measures === 'string' ? raw.what_it_measures.trim() : '';
  const brand_read = typeof raw.brand_read === 'string' ? raw.brand_read.trim() : '';

  const grounded: Array<{ evidence_type: EvidenceType; quote_or_observation: string }> = [];
  if (hasEvidence && Array.isArray(raw.where_it_shows_up)) {
    for (const c of raw.where_it_shows_up) {
      const quote = typeof c?.quote_or_observation === 'string' ? c.quote_or_observation.trim() : '';
      if (!quote) continue;
      const type: EvidenceType =
        typeof c?.evidence_type === 'string' && (EVIDENCE_TYPES as readonly string[]).includes(c.evidence_type)
          ? (c.evidence_type as EvidenceType)
          : 'listing_copy';
      // Grounded if the quote/observation appears in the corpus, or it is the honest note.
      if (haystack.includes(quote.toLowerCase()) || quote === NO_EVIDENCE_NOTE) {
        grounded.push({ evidence_type: type, quote_or_observation: quote });
      }
    }
  }

  if (grounded.length === 0) {
    // No grounded citation survived (or no evidence at all) -> inference, honest note.
    return {
      dimension,
      score,
      what_it_measures,
      brand_read,
      where_it_shows_up: [{ evidence_type: 'listing_copy', quote_or_observation: NO_EVIDENCE_NOTE }],
      grounding: 'inference',
    };
  }
  return { dimension, score, what_it_measures, brand_read, where_it_shows_up: grounded, grounding: 'evidence' };
}

// ── DERIVE MODE ────────────────────────────────────────────────────────────
// When the caller supplies evidence but NO scores, read the evidence and ASSIGN a
// 0-100 score + a confidence per pillar. This is the front-half the interpret path
// never had: it produces the scores the Trust Gap is computed from, grounded in the
// user's own words, so onboarding stops dead-ending on "give me four numbers".

/** Confidence the model self-reports; floored to 'low' when a read isn't evidence-grounded. */
type DeriveConfidence = 'high' | 'medium' | 'low';

function buildDeriveSystemPrompt(present: EvidenceType[]): string {
  const evidenceClause = present.length
    ? `<evidence-provided>
The founder has supplied real brand evidence: ${present.join(', ')}. Score each pillar from how well THIS evidence satisfies it, and cite verbatim phrases or precise observations about it. Never invent quotes or cite evidence you were not given.
</evidence-provided>`
    : `<no-evidence-provided>
No listing copy, reviews, or ad copy were supplied. You cannot read a pillar you have no evidence for: set its confidence to "low", say plainly that no evidence was supplied, and do not invent specifics.
</no-evidence-provided>`;

  return `<persona>
You are Trevor Bradford, creator of the IDEA Strategic Brand Framework, reading a founder's actual brand evidence and giving a straight, grounded read of where their brand builds trust and where it leaks it. You speak like a coach, not a report generator.
</persona>

<task>
You are given the founder's actual listing copy, reviews, and/or ad copy. There are NO pre-set scores. For EACH of the four trust pillars, ASSIGN a score from 0 to 100 reflecting how well their brand, as evidenced, satisfies that pillar, and a CONFIDENCE reflecting how much real evidence you had to judge it. For each pillar also write what it measures, your brand-specific read, and where it shows up in their evidence.
</task>

<the-four-pillars>
- Insight: how well the brand understands what really drives the customer and turns that into messaging.
- Distinctiveness: how much the brand owns a recognisable position and identity instead of blending in.
- Empathy: whether the brand speaks to what the customer feels, not just what the product is.
- Authenticity: how genuine and transparent the brand is, whether its communication earns belief.
</the-four-pillars>

<score-bands-0-100>
- 0 to 39: weak. This pillar is leaking trust.
- 40 to 69: mixed. Partly working, real room to improve.
- 70 to 100: strong. This pillar is building trust.
</score-bands-0-100>

<confidence>
- high: strong, direct evidence in the supplied material lets you read this pillar clearly.
- medium: some evidence plus reasonable inference; a defensible read, not a certain one.
- low: little or no evidence for this pillar; mostly guesswork. Be honest. Prefer "low" when unsure. Do NOT pad a confident-sounding read on thin evidence.
</confidence>

<must-cite-evidence>
Every "where_it_shows_up" entry must point at real supplied evidence: a verbatim quote or a precise observation about it. Never fabricate a quote, bullet, or review. If a pillar has no evidence, say so and set confidence "low".
</must-cite-evidence>

${evidenceClause}

<voice>
Plain, direct, warm. Second person. UK English. No asterisks, markdown, headings, bullets, emojis. No em or en dashes; use commas, full stops, or the word and. Short sentences.
</voice>

<output-contract>
Respond with ONLY a single JSON object, no commentary, no code fences. Exactly this shape:
{"dimensions":[{"dimension":"Insight","score":<0-100>,"confidence":"high|medium|low","read":"your 2-3 sentence brand read","where_it_shows_up":[{"evidence_type":"listing_copy","quote_or_observation":"..."}]}, ...four pillars in order Insight, Distinctiveness, Empathy, Authenticity...]}
Every string value must obey the voice rules.
</output-contract>`;
}

function buildDeriveUserMessage(byType: Record<EvidenceType, string>, present: EvidenceType[], fieldsText: string): string {
  const parts: string[] = [];
  if (fieldsText) parts.push(`OWNER INTENT AND BRAND CONTEXT (positioning, voice, story):\n${fieldsText}`);
  if (present.length) {
    for (const t of present) parts.push(`SUPPLIED ${t.toUpperCase()} (cite this verbatim):\n${byType[t].slice(0, 8000)}`);
  } else {
    parts.push('NO listing copy, reviews, or ad copy were supplied.');
  }
  parts.push('Assign the four pillar scores (0-100) and confidences now, as the JSON object.');
  return parts.join('\n\n');
}

/** Run the derive flow and return { dimensions:[{dimension,score(0-100),confidence,grounding,read,where_it_shows_up}] }. */
async function handleDerive(body: InterpretationRequest): Promise<Response> {
  const { byType, haystack, present } = normaliseEvidence(body?.evidence);
  const hasEvidence = present.length > 0;
  const fieldsText = formatFields(body?.fields);

  const systemPrompt = buildDeriveSystemPrompt(present);
  const userMessage = buildDeriveUserMessage(byType, present, fieldsText);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey as string,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 3000,
      temperature: 0.4,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[diagnostic-interpretation-evidence/derive] Anthropic error:', response.status, errorBody);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = parseModel(data?.content?.[0]?.text ?? '');
  if (!parsed || parsed.dimensions.length === 0) {
    console.error('[diagnostic-interpretation-evidence/derive] unparseable:', (data?.content?.[0]?.text ?? '').slice(0, 400));
    throw new Error('Derive response was not valid JSON');
  }

  const labelToDim = new Map<string, Dimension>(DIMENSIONS.map((d) => [DIMENSION_LABELS[d].toLowerCase(), d]));
  const byDimension = new Map<Dimension, RawDimension>();
  for (const rd of parsed.dimensions) {
    const key = typeof rd?.dimension === 'string' ? rd.dimension.trim().toLowerCase() : '';
    const dim = labelToDim.get(key);
    if (dim && !byDimension.has(dim)) byDimension.set(dim, rd);
  }
  DIMENSIONS.forEach((dim, i) => {
    if (!byDimension.has(dim) && parsed.dimensions[i]) byDimension.set(dim, parsed.dimensions[i]);
  });

  const dimensions = DIMENSIONS.map((dim) => {
    const rd = byDimension.get(dim);
    const citations = (rd?.where_it_shows_up ?? [])
      .filter((c) => c && typeof c.quote_or_observation === 'string' && c.quote_or_observation.trim())
      .map((c) => ({
        evidence_type: (EVIDENCE_TYPES as readonly string[]).includes(c.evidence_type ?? '') ? c.evidence_type! : 'listing_copy',
        quote_or_observation: c.quote_or_observation!.trim(),
      }));
    // Grounded only when a citation literally traces to the supplied evidence corpus.
    const grounded = hasEvidence && citations.some((c) => haystack.includes(c.quote_or_observation.toLowerCase().slice(0, 40)));
    const grounding: 'evidence' | 'inference' = grounded ? 'evidence' : 'inference';
    // Honesty floor: a read that isn't evidence-grounded can be at most low confidence.
    let confidence: DeriveConfidence = ['high', 'medium', 'low'].includes((rd?.confidence ?? '').toLowerCase())
      ? ((rd!.confidence as string).toLowerCase() as DeriveConfidence)
      : 'low';
    if (!grounded && confidence !== 'low') confidence = grounding === 'inference' ? 'low' : confidence;
    const score = Math.max(0, Math.min(100, Math.round(typeof rd?.score === 'number' ? rd.score : 0)));
    return {
      dimension: DIMENSION_LABELS[dim],
      score,
      confidence,
      grounding,
      read: (rd?.read ?? rd?.brand_read ?? '').trim(),
      where_it_shows_up: grounded ? citations : [{ evidence_type: 'listing_copy', quote_or_observation: NO_EVIDENCE_NOTE }],
    };
  });

  console.log(`[diagnostic-interpretation-evidence/derive] evidence=${present.join(',') || 'none'} scores=${dimensions.map((d) => `${d.dimension}:${d.score}/${d.confidence}`).join(' ')}`);
  return new Response(JSON.stringify({ derived: true, dimensions }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Optional auth (parity with reveal-signature; platform verify_jwt also gates).
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } },
        );
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) console.log('[diagnostic-interpretation-evidence] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[diagnostic-interpretation-evidence] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = (await req.json()) as InterpretationRequest;

    // DERIVE MODE: evidence in, scores out (no scores supplied). Front-half for the Trust Gap.
    if (body?.derive === true) {
      return await handleDerive(body);
    }

    // Normalise + validate scores (each clamped 0-25), like the public fn.
    const scores = {} as Record<Dimension, number>;
    for (const dim of DIMENSIONS) {
      const raw = body?.scores?.[dim];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return new Response(
          JSON.stringify({ error: `Missing or invalid score for "${dim}".` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      scores[dim] = Math.max(0, Math.min(25, Math.round(raw)));
    }

    const overall = typeof body?.overall === 'number' && Number.isFinite(body.overall)
      ? Math.max(0, Math.min(100, Math.round(body.overall)))
      : Math.round(DIMENSIONS.reduce((acc, dim) => acc + scores[dim], 0));

    const primaryGap: Dimension = body?.primaryGap && DIMENSIONS.includes(body.primaryGap)
      ? body.primaryGap
      : DIMENSIONS.reduce((lowest, dim) => (scores[dim] < scores[lowest] ? dim : lowest), DIMENSIONS[0]);

    const { byType, haystack, present } = normaliseEvidence(body?.evidence);
    const hasEvidence = present.length > 0;
    const fieldsText = formatFields(body?.fields);

    const systemPrompt = buildSystemPrompt(present);
    const userMessage = buildUserMessage(scores, overall, primaryGap, byType, present, fieldsText);

    const headers: Record<string, string> = {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'Content-Type': 'application/json',
    };

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 3000,
        temperature: 0.5,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        // NO assistant prefill: a `{"dimensions":` value-level prefill makes Sonnet resume
        // mid-structure and drop the array's opening object brace (`["dimension":...`),
        // failing the parse ~67-80% of live calls. Letting it emit a complete object from
        // scratch yields valid JSON every time (verified with a live A/B capture). The richly
        // nested per-dimension citation shape here is too complex for safe mid-structure
        // resumption, unlike reveal-signature's flat `{options:[...]}` where prefill is fine.
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[diagnostic-interpretation-evidence] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text ?? '';
    const parsed = parseModel(rawText);

    if (!parsed || parsed.dimensions.length === 0) {
      console.error(
        '[diagnostic-interpretation-evidence] Could not parse model JSON (stop_reason=',
        data?.stop_reason,
        '):',
        rawText.slice(0, 500),
      );
      throw new Error('Interpretation response was not valid JSON');
    }

    // Map the model's dimensions onto the four fixed IDEA pillars in canonical order,
    // enforcing grounding per dimension.
    const labelToDim = new Map<string, Dimension>(
      DIMENSIONS.map((d) => [DIMENSION_LABELS[d].toLowerCase(), d]),
    );
    const byDimension = new Map<Dimension, RawDimension>();
    for (const rd of parsed.dimensions) {
      const key = typeof rd?.dimension === 'string' ? rd.dimension.trim().toLowerCase() : '';
      const dim = labelToDim.get(key);
      if (dim && !byDimension.has(dim)) byDimension.set(dim, rd);
    }
    // Fall back positionally for any unmatched pillar.
    DIMENSIONS.forEach((dim, i) => {
      if (!byDimension.has(dim) && parsed.dimensions[i]) byDimension.set(dim, parsed.dimensions[i]);
    });

    const dimensions = DIMENSIONS.map((dim) =>
      enforceDimensionGrounding(byDimension.get(dim) ?? { dimension: DIMENSION_LABELS[dim], score: scores[dim] }, dim, haystack, hasEvidence),
    );

    // Top-level grounding: evidence if ANY dimension is evidence-grounded, else inference.
    const anyEvidence = dimensions.some((d) => d.grounding === 'evidence');
    const grounding: 'evidence' | 'inference' = anyEvidence ? 'evidence' : 'inference';
    const evidenceRefs = anyEvidence
      ? present.map((t) => ({ kind: t === 'reviews' ? ('review' as const) : t === 'ad_copy' ? ('ad_copy' as const) : ('listing_copy' as const), ref: `supplied-${t}` }))
      : [];

    const result = {
      overall_score: overall,
      primary_gap: DIMENSION_LABELS[primaryGap],
      interpretation: parsed.interpretation.trim() || `Your overall trust score is ${overall} out of 100. Your weakest pillar is ${DIMENSION_LABELS[primaryGap]}.`,
      dimensions,
      primaryGapSummary: parsed.primaryGapSummary.trim(),
      triage: {
        recommended_next_module: (parsed.triage.recommended_next_module ?? '').trim() || `Close the ${DIMENSION_LABELS[primaryGap]} gap`,
        rationale: (parsed.triage.rationale ?? '').trim() || `${DIMENSION_LABELS[primaryGap]} is the lowest-scoring pillar and the fastest trust win.`,
      },
      grounding,
      evidence_refs: evidenceRefs,
    };

    console.log(
      `[diagnostic-interpretation-evidence] grounding=${grounding} (evidence present: ${present.join(',') || 'none'}); primary gap ${DIMENSION_LABELS[primaryGap]}.`,
    );

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in diagnostic-interpretation-evidence function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to generate your evidence-grounded interpretation right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
