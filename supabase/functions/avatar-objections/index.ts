import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { INTERNAL_PROMPT_AVATAR_CORPUS_CHARS } from "../_shared/contextBudgets.ts";

/**
 * avatar-objections  (Avatar 2.0 — Stage 4: Hesitations & Objections)
 *
 * Surfaces the purchase blockers from real (especially low-star) reviews and Q&A,
 * each anchored by a VERBATIM customer quote, plus what resolves it in copy / image
 * / A+.
 *
 * Cloned from reveal-positioning-statement (CORS, optional JWT->getUser, Anthropic SONNET call
 * with prompt caching, strict JSON contract + assistant prefill, defensive parse,
 * evidence-vs-inference branch).
 *
 * Output contract (Phase-0 `avatar_s4_objections`):
 *   { objections: [{ hesitation, verbatim_signal, resolution }],
 *     grounding: 'evidence'|'inference', evidence_refs: [{kind, ref}] }
 *
 * GROUNDING DISCIPLINE — VERBATIM MUST BE REAL:
 * Every `verbatim_signal` MUST be a literal substring of the supplied reviews. The
 * model is instructed to quote, AND the function enforces it post-parse: objections
 * whose verbatim_signal is not found in the corpus are dropped. If more than 30% of
 * objections are dropped, the function returns 'insufficient grounding'. Without
 * reviews S4 returns needs_input (it cannot invent customer quotes).
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewObject {
  body?: string;
  reviewText?: string;
  text?: string;
  content?: string;
  rating?: number;
  reviewer?: string;
}

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

interface S1Cluster {
  cluster?: string;
  customer_words?: string[];
}

function formatS1(s1: unknown): string {
  const clusters: S1Cluster[] = Array.isArray((s1 as { clusters?: unknown })?.clusters)
    ? (s1 as { clusters: S1Cluster[] }).clusters
    : Array.isArray(s1) ? (s1 as S1Cluster[]) : [];
  if (clusters.length === 0) return '';
  return clusters.map((c) => `- ${c.cluster ?? 'cluster'}: ${(c.customer_words ?? []).join(', ')}`).join('\n');
}

/**
 * Extract complete brace-balanced top-level `{...}` objects from text, string-aware.
 * Last-resort fallback when the model emits a bare object instead of the array wrapper.
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
 * Tolerant parse of the model's `objections` array. Value-level prefill
 * (`{"objections":`) lets Sonnet emit the array literal; this repairs the residual
 * malformations:
 *  - clean: `[{...}]}`                            -> `{"objections":` + raw
 *  - missing first object brace: `["hesitation`  -> insert `{` after the leading `[`
 *  - truncated / spurious trailing brace          -> cut to the last `}` and re-close `]}`
 *  - bare object (no array wrapper)               -> brace-scan complete objects
 * Never throws; returns [] if nothing parses.
 */
function parseObjections(rawText: string): Array<Record<string, unknown>> {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"objections":${rawText}`,
    `{"objections":[{${rawText}`,
    `{"objections":[${rawText}`,
  ];
  const stripped = rawText.replace(/^\s+/, '');
  if (stripped.startsWith('[')) {
    const bracketIdx = rawText.indexOf('[');
    const after = rawText.slice(bracketIdx + 1).replace(/^\s+/, '');
    if (after.startsWith('"')) {
      candidates.push(`{"objections":${rawText.slice(0, bracketIdx + 1)}{${rawText.slice(bracketIdx + 1)}`);
    }
  }
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    const body = rawText.slice(0, lastBrace + 1);
    candidates.push(`{"objections":${body}]}`);
    candidates.push(`{"objections":[{${body}]}`);
    const bstr = body.replace(/^\s+/, '');
    if (bstr.startsWith('[')) {
      const bi = body.indexOf('[');
      const ba = body.slice(bi + 1).replace(/^\s+/, '');
      if (ba.startsWith('"')) {
        candidates.push(`{"objections":${body.slice(0, bi + 1)}{${body.slice(bi + 1)}]}`);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.objections) && parsed.objections.length > 0) {
        return parsed.objections;
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

function buildSystemPrompt(hasCompetitorContext: boolean): string {
  return `<persona>
You are a forensic customer-research analyst inside a BMAD brand coach. This is Stage 4 of an Avatar 2.0 build: Hesitations & Objections. You find the reasons a customer almost did not buy, and how to dissolve them.
</persona>

<what-this-is>
Each objection has three parts:
- hesitation: the purchase blocker (the doubt, fear, or comparison that stalls the buy).
- verbatim_signal: a REAL, word-for-word quote from the supplied reviews that evidences this hesitation. Prefer low-star reviews and Q&A.
- resolution: what resolves it in the copy, image, or A+ content (concrete, specific).
</what-this-is>

<critical-grounding-rule>
"verbatim_signal" MUST be a verbatim, word-for-word substring of the supplied reviews. Quote the customer exactly. Do NOT paraphrase, summarise, fabricate, or stitch words together from different sentences. If you cannot find a real quote evidencing a hesitation, do not include that hesitation. Inventing a customer quote is the worst failure of this stage.
</critical-grounding-rule>

<voice-rules>
- "hesitation" and "resolution" are concise (one or two sentences each).
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling. No emojis, no hype.
</voice-rules>
${hasCompetitorContext ? '\n<competitor-context>\nThe resolution may reference competitor set and price points where the supplied context supports it.\n</competitor-context>\n' : ''}
<few-shot-example>
For premium trading card binders (illustrative shape only; quote must be real):
{"hesitation":"Doubt the binder is genuinely better than a cheaper one","verbatim_signal":"I was worried it would be just another overpriced binder","resolution":"A+ comparison panel showing the side-by-side build quality and the anti-scratch lining"}
</few-shot-example>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"objections":[{"hesitation":"...","verbatim_signal":"<real verbatim quote from the reviews>","resolution":"..."}]}
Produce 3 to 6 objections. Every verbatim_signal must be a real quote from the supplied reviews. No markdown inside any string. No trailing commentary outside the JSON.
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
        if (user) console.log('[avatar-objections] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[avatar-objections] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const { corpus, haystack } = normaliseReviews(body?.reviews);
    const s1 = body?.prior?.s1 ?? body?.s1 ?? null;
    const s1Text = formatS1(s1);
    const competitorContext = typeof body?.competitor_context === 'string' ? body.competitor_context.trim() : '';

    // S4 verbatims must be real quotes — without reviews it cannot run, it asks.
    if (corpus.length === 0) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Paste the customer reviews, especially low-star reviews and Q&A. Stage 4 anchors every objection to a real verbatim customer quote.',
            why: 'S4 verbatim_signal must be a real review quote; with no reviews there is nothing to quote.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reviewsForPrompt = corpus.slice(0, INTERNAL_PROMPT_AVATAR_CORPUS_CHARS);
    const parts: string[] = [
      `CUSTOMER REVIEWS (quote verbatim_signal word-for-word from here, prefer low-star and Q&A):\n\n${reviewsForPrompt}`,
    ];
    if (s1Text) parts.push(`STAGE 1 VOCABULARY CLUSTERS (for context):\n${s1Text}`);
    if (competitorContext) parts.push(`COMPETITOR SET / PRICE POINTS:\n${competitorContext}`);
    parts.push('Now surface the hesitations and objections. Every verbatim_signal must be a real quote from the reviews above. Return ONLY the JSON object.');

    const systemPrompt = buildSystemPrompt(competitorContext.length > 0);
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 2048,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [
          // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
          { role: 'user', content: parts.join('\n\n') },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[avatar-objections] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const objections = parseObjections(rawText);

    // Post-parse grounding enforcement: verbatim_signal must be a real substring.
    let total = 0;
    let dropped = 0;
    const cleaned = objections
      .map((o) => {
        const hesitation = typeof o?.hesitation === 'string' ? o.hesitation.trim() : '';
        const resolution = typeof o?.resolution === 'string' ? o.resolution.trim() : '';
        const verbatim = typeof o?.verbatim_signal === 'string' ? o.verbatim_signal.trim() : '';
        return { hesitation, verbatim_signal: verbatim, resolution };
      })
      .filter((o) => {
        if (!o.hesitation || !o.resolution || !o.verbatim_signal) return false;
        total += 1;
        if (haystack.includes(o.verbatim_signal.toLowerCase())) return true;
        dropped += 1;
        return false;
      });

    // Parse genuinely failed (nothing came back) -> 500.
    if (objections.length === 0) {
      console.error('[avatar-objections] No objections parsed from model output.');
      throw new Error('Could not parse objections from model output.');
    }

    // Objections parsed but every verbatim failed the substring check, or >30%
    // did -> structured 'insufficient grounding' (fail over fabricate, §6 gate).
    const dropRatio = total > 0 ? dropped / total : 0;
    if (cleaned.length === 0 || dropRatio > 0.3) {
      console.error(`[avatar-objections] insufficient grounding: ${dropped}/${total} verbatims non-substring.`);
      return new Response(
        JSON.stringify({ error: 'insufficient grounding', dropped, total }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = {
      objections: cleaned,
      grounding: 'evidence' as const,
      evidence_refs: [{ kind: 'review' as const, ref: 'pasted-review-corpus' }],
    };

    console.log(`[avatar-objections] Returning ${cleaned.length} objection(s) (dropped ${dropped}/${total}).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in avatar-objections function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to surface objections right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
