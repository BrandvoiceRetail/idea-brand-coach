import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { INTERNAL_PROMPT_AVATAR_CORPUS_CHARS } from "../_shared/contextBudgets.ts";

/**
 * avatar-vocabulary  (Avatar 2.0 — Stage 1: Vocabulary Forensics)
 *
 * Mines pasted customer reviews for the unprompted emotional VOCABULARY collectors
 * actually use, clustered by emotion. Each cluster lists verbatim terms, a labeled
 * frequency band (never a fabricated number), and why it matters strategically.
 *
 * Cloned from reveal-signature (CORS, optional JWT->getUser, Anthropic SONNET call
 * with prompt caching, strict JSON contract + assistant prefill, defensive parse,
 * evidence-vs-inference branch).
 *
 * Output contract (Phase-0 `avatar_s1_vocab`):
 *   { clusters: [{ cluster, customer_words: string[], frequency_signal, why_it_matters }],
 *     grounding: 'evidence'|'inference', evidence_refs: [{kind, ref}] }
 *
 * GROUNDING DISCIPLINE — NO INVENTED VOCABULARY:
 * Every `customer_words` term MUST be a literal substring of the supplied reviews.
 * The model is instructed to only use verbatim terms, AND the function enforces this
 * post-parse: terms that are not substrings of the review corpus are filtered out.
 * If more than 30% of all emitted terms are filtered, the function returns an error
 * ('insufficient grounding') rather than shipping fabricated vocabulary.
 *
 * When no reviews are supplied the function returns needs_input (slot 1) — S1 is
 * pure EVIDENCE and cannot run in inference mode.
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREQUENCY_BANDS = ['Very high', 'High', 'Medium-high', 'Medium', 'Low-medium', 'Low'];

interface ReviewObject {
  body?: string;
  reviewText?: string;
  text?: string;
  content?: string;
  rating?: number;
  reviewer?: string;
}

/**
 * Normalise the `reviews` input (string OR object[]) into a single corpus string
 * for the prompt and a lowercased haystack for substring grounding checks.
 */
function normaliseReviews(reviews: unknown): { corpus: string; haystack: string } {
  let corpus = '';
  if (typeof reviews === 'string') {
    corpus = reviews;
  } else if (Array.isArray(reviews)) {
    corpus = reviews
      .map((r) => {
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object') {
          const o = r as ReviewObject;
          return o.body ?? o.reviewText ?? o.text ?? o.content ?? '';
        }
        return '';
      })
      .filter((s) => typeof s === 'string' && s.trim())
      .join('\n\n');
  }
  return { corpus: corpus.trim(), haystack: corpus.toLowerCase() };
}

/**
 * Extract complete brace-balanced top-level `{...}` objects from text, string-aware
 * (braces inside quoted strings are ignored). Used as the last-resort parse fallback
 * when the model emits a bare object, or an array the candidate reconstructions below
 * could not repair.
 */
function extractBalancedObjects(text: string): string[] {
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

/**
 * Tolerant parse of the model's `clusters` array.
 *
 * The assistant turn is prefilled with `{"clusters":` (value-level), so the model
 * emits the array literal. Sonnet occasionally malforms it; each malformation is
 * repaired by a distinct reconstruction candidate, with a brace-scan fallback:
 *  - clean: `[{...}]}`                          -> `{"clusters":` + raw
 *  - missing first object brace: `["cluster":`  -> insert `{` after the leading `[`
 *  - truncated / spurious trailing brace        -> cut to the last `}` and re-close `]}`
 *  - bare object / unrepairable wrapper         -> brace-scan complete objects
 * The first candidate that parses into a non-empty `clusters` array wins. Never throws.
 */
function parseClusters(rawText: string): Array<Record<string, unknown>> {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"clusters":${rawText}`,
    `{"clusters":[{${rawText}`,
    `{"clusters":[${rawText}`,
  ];
  // Missing first object brace: raw begins `[` then a bare key quote.
  const stripped = rawText.replace(/^\s+/, '');
  if (stripped.startsWith('[')) {
    const bracketIdx = rawText.indexOf('[');
    const after = rawText.slice(bracketIdx + 1).replace(/^\s+/, '');
    if (after.startsWith('"')) {
      candidates.push(`{"clusters":${rawText.slice(0, bracketIdx + 1)}{${rawText.slice(bracketIdx + 1)}`);
    }
  }
  // Trailing salvage: cut to the last complete object, re-close the array.
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    const body = rawText.slice(0, lastBrace + 1);
    candidates.push(`{"clusters":${body}]}`);
    candidates.push(`{"clusters":[{${body}]}`);
    const bstr = body.replace(/^\s+/, '');
    if (bstr.startsWith('[')) {
      const bi = body.indexOf('[');
      const ba = body.slice(bi + 1).replace(/^\s+/, '');
      if (ba.startsWith('"')) {
        candidates.push(`{"clusters":${body.slice(0, bi + 1)}{${body.slice(bi + 1)}]}`);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.clusters) && parsed.clusters.length > 0) {
        return parsed.clusters;
      }
    } catch {
      // try the next reconstruction
    }
  }
  // Fallback: brace-scan complete objects (handles a bare object emitted without
  // the array wrapper, or a wrapper the candidates above could not repair).
  const scanned: Array<Record<string, unknown>> = [];
  for (const obj of extractBalancedObjects(rawText)) {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        scanned.push(parsed as Record<string, unknown>);
      }
    } catch {
      // skip unparseable fragment
    }
  }
  return scanned;
}

/** Build the S1 system prompt. */
function buildSystemPrompt(): string {
  return `<persona>
You are a forensic customer-research analyst working inside a BMAD brand coach. You read raw customer reviews and surface the unprompted emotional VOCABULARY the customers actually use, clustered by the emotion underneath it. This is Stage 1 of an Avatar 2.0 build: Vocabulary Forensics.
</persona>

<what-this-is>
You group the customer's own words into emotion clusters (for example: protection / damage anxiety; capacity / consolidation; quality / dignity; display / pride; identity / seriousness; ritual / pleasure). For each cluster you list the verbatim terms the customers used, a labeled frequency band, and why the cluster matters strategically.
</what-this-is>

<critical-grounding-rule>
Every term in "customer_words" MUST be a verbatim, word-for-word substring of the supplied reviews. Copy the customer's exact phrasing. Do NOT paraphrase, normalise, pluralise, correct spelling, or invent terms. If a phrase does not appear literally in the reviews, you may not include it. Inventing vocabulary is the single worst failure of this stage.
</critical-grounding-rule>

<frequency-band-rule>
"frequency_signal" is a labeled band reflecting how often the cluster's language recurs across the reviews. It must be EXACTLY one of: "Very high", "High", "Medium-high", "Medium", "Low-medium", "Low". Never output a number, a percentage, or a count. It is an estimate of prevalence, never a fabricated statistic.
</frequency-band-rule>

<voice-rules>
- "why_it_matters" is a concise strategic read (one or two sentences).
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling.
- No emojis, no hype, no exclamation marks.
</voice-rules>

<few-shot-example>
For premium trading card binders, real review vocabulary clustered like this (illustrative shape only, do not copy these words unless they appear in the supplied reviews):
{"cluster":"Protection / damage anxiety","customer_words":["scratch","slip out","dinged corners"],"frequency_signal":"Very high","why_it_matters":"Loss aversion is the dominant emotion. Lead with certainty, not features."}
</few-shot-example>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"clusters":[{"cluster":"<emotion name>","customer_words":["<verbatim term>", "..."],"frequency_signal":"<one of the six bands>","why_it_matters":"<strategic read>"}]}
Produce between 3 and 8 clusters. Every customer_words term must be verbatim from the reviews. No markdown inside any string. No trailing commentary outside the JSON.
</output-contract>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          { global: { headers: { Authorization: authHeader } } }
        );
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) console.log('[avatar-vocabulary] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[avatar-vocabulary] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const { corpus, haystack } = normaliseReviews(body?.reviews);

    // S1 is pure EVIDENCE — without reviews it cannot run, it asks.
    if (corpus.length === 0) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Paste the verbatim customer reviews (your own, and competitors if you have them). Stage 1 vocabulary forensics derives every cluster from real review language.',
            why: 'S1 vocabulary clusters must trace to real review quotes; with no reviews there is no evidence to mine.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reviewsForPrompt = corpus.slice(0, INTERNAL_PROMPT_AVATAR_CORPUS_CHARS);

    const userMessage = `CUSTOMER REVIEWS (the only source of vocabulary — every term you cluster must appear verbatim here):\n\n${reviewsForPrompt}\n\nNow produce the emotion-clustered vocabulary forensics. Return ONLY the JSON object.`;

    const systemPrompt = buildSystemPrompt();
    const headers: Record<string, string> = {
      'x-api-key': anthropicApiKey!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    };

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [
          // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[avatar-vocabulary] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const clusters = parseClusters(rawText);

    // Post-parse grounding enforcement: every customer_words term must be a literal
    // substring of the review corpus. Filter non-substrings; if >30% filtered, fail.
    let totalTerms = 0;
    let droppedTerms = 0;
    const cleanedClusters = clusters
      .map((c) => {
        const cluster = typeof c?.cluster === 'string' ? c.cluster.trim() : '';
        const why = typeof c?.why_it_matters === 'string' ? c.why_it_matters.trim() : '';
        let band = typeof c?.frequency_signal === 'string' ? c.frequency_signal.trim() : '';
        if (!FREQUENCY_BANDS.includes(band)) band = 'Medium';
        const rawWords = Array.isArray(c?.customer_words) ? c.customer_words : [];
        const words: string[] = [];
        for (const w of rawWords) {
          if (typeof w !== 'string') continue;
          const term = w.trim();
          if (!term) continue;
          totalTerms += 1;
          if (haystack.includes(term.toLowerCase())) {
            words.push(term);
          } else {
            droppedTerms += 1;
          }
        }
        return { cluster, customer_words: words, frequency_signal: band, why_it_matters: why };
      })
      .filter((c) => c.cluster && c.customer_words.length > 0 && c.why_it_matters);

    // Parse genuinely failed (no clusters came back at all) -> 500.
    if (clusters.length === 0) {
      console.error('[avatar-vocabulary] No clusters parsed from model output.');
      throw new Error('Could not parse vocabulary clusters from model output.');
    }

    // Clusters parsed but grounding filtering removed everything, or removed >30%
    // of terms -> structured 'insufficient grounding' (fail over fabricate, §6 gate).
    const dropRatio = totalTerms > 0 ? droppedTerms / totalTerms : 0;
    if (cleanedClusters.length === 0 || dropRatio > 0.3) {
      console.error(`[avatar-vocabulary] insufficient grounding: ${droppedTerms}/${totalTerms} terms non-verbatim.`);
      return new Response(
        JSON.stringify({ error: 'insufficient grounding', dropped: droppedTerms, total: totalTerms }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = {
      clusters: cleanedClusters,
      grounding: 'evidence' as const,
      evidence_refs: [{ kind: 'review' as const, ref: 'pasted-review-corpus' }],
    };

    console.log(`[avatar-vocabulary] Returning ${cleanedClusters.length} clusters (dropped ${droppedTerms}/${totalTerms}).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in avatar-vocabulary function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to run vocabulary forensics right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
