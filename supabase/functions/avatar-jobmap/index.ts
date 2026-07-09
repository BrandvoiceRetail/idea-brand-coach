import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getServiceClient, getAuthedUserId } from "../_shared/edge-auth.ts";
import { meterAndDebit } from "../_shared/meter.ts";

/**
 * avatar-jobmap  (Avatar 2.0 — Stage 2: The Change They Are Seeking)
 *
 * Synthesises, from the Stage-1 vocabulary clusters, the change the customer is
 * seeking across three layers (functional / emotional / identity) plus
 * the VILLAIN they are moving away from.
 *
 * Cloned from reveal-signature (CORS, optional JWT->getUser, Anthropic SONNET call
 * with prompt caching, strict JSON contract + assistant prefill, defensive parse,
 * evidence-vs-inference branch).
 *
 * Output contract (Phase-0 `avatar_s2_jobmap`):
 *   { job_map: [{ functional_job, emotional_job, identity_job, villain }],
 *     grounding: 'evidence'|'inference', evidence_refs: [{kind, ref}] }
 *
 * GROUNDING: S2 is SYNTHESIS grounded in S1. When S1 was evidence-filled (clusters
 * supplied via `prior.s1`) the map is grounded='evidence' and cites the s1 artifact.
 * Without S1 it returns needs_input (S1 is the spine of the map).
 *
 * Note: While the JSON wire format retains field names like "job_map" and "functional_job"
 * for compatibility, these now carry DESIRED STATE content, not JTBD framing.
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface S1Cluster {
  cluster?: string;
  customer_words?: string[];
  frequency_signal?: string;
  why_it_matters?: string;
}

/** Format the Stage-1 clusters into a labelled block for the prompt. */
function formatS1(s1: unknown): string {
  const clusters: S1Cluster[] = Array.isArray((s1 as { clusters?: unknown })?.clusters)
    ? (s1 as { clusters: S1Cluster[] }).clusters
    : Array.isArray(s1)
      ? (s1 as S1Cluster[])
      : [];
  if (clusters.length === 0) return '';
  return clusters
    .map((c) => {
      const words = Array.isArray(c.customer_words) ? c.customer_words.join(', ') : '';
      return `- ${c.cluster ?? 'cluster'} (${c.frequency_signal ?? 'band'}): ${words}\n  why: ${c.why_it_matters ?? ''}`;
    })
    .join('\n');
}

/**
 * Extract complete brace-balanced top-level `{...}` objects from text, string-aware.
 * Last-resort fallback when the model emits a bare object (common for S2, which
 * usually returns one row) instead of the array wrapper.
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
 * Tolerant parse of the model's `job_map` array. Value-level prefill (`{"job_map":`)
 * lets Sonnet emit the array literal; this repairs the residual malformations:
 *  - clean: `[{...}]}`                          -> `{"job_map":` + raw
 *  - missing first object brace: `["functional` -> insert `{` after the leading `[`
 *  - truncated / spurious trailing brace        -> cut to the last `}` and re-close `]}`
 *  - bare object (no array wrapper)             -> brace-scan complete objects
 * Never throws; returns [] if nothing parses.
 */
function parseJobMap(rawText: string): Array<Record<string, unknown>> {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"job_map":${rawText}`,
    `{"job_map":[{${rawText}`,
    `{"job_map":[${rawText}`,
  ];
  const stripped = rawText.replace(/^\s+/, '');
  if (stripped.startsWith('[')) {
    const bracketIdx = rawText.indexOf('[');
    const after = rawText.slice(bracketIdx + 1).replace(/^\s+/, '');
    if (after.startsWith('"')) {
      candidates.push(`{"job_map":${rawText.slice(0, bracketIdx + 1)}{${rawText.slice(bracketIdx + 1)}`);
    }
  }
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    const body = rawText.slice(0, lastBrace + 1);
    candidates.push(`{"job_map":${body}]}`);
    candidates.push(`{"job_map":[{${body}]}`);
    const bstr = body.replace(/^\s+/, '');
    if (bstr.startsWith('[')) {
      const bi = body.indexOf('[');
      const ba = body.slice(bi + 1).replace(/^\s+/, '');
      if (ba.startsWith('"')) {
        candidates.push(`{"job_map":${body.slice(0, bi + 1)}{${body.slice(bi + 1)}]}`);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.job_map) && parsed.job_map.length > 0) {
        return parsed.job_map;
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

function buildSystemPrompt(): string {
  return `<persona>
You are a forensic customer-research analyst inside a BMAD brand coach. This is Stage 2 of an Avatar 2.0 build: The Change They Are Seeking. You take the Stage-1 vocabulary clusters and identify the change the customer is likely seeking.
</persona>

<what-this-is>
This stage maps the customer's journey from their current state to their desired state. You identify:
- functional_job: the practical change the product enables (what it does in their life).
- emotional_job: the emotional transformation they are likely seeking (how they want to feel).
- identity_job: the identity shift the purchase may reinforce (who they become).
- villain: what they are moving away from. The problem state, the thing they refuse to tolerate.

These are interpretations based on patterns in the evidence, not direct customer quotes.
</what-this-is>

<evidence-discipline>
- Use ONLY patterns from the supplied Stage-1 clusters.
- Never present your interpretation as a customer quote.
- Use inference language: "likely", "suggests", "may", "appears" when describing what customers seek.
- The emotional and identity transformations must emerge from their actual vocabulary patterns.
- Do not introduce fears or desires the vocabulary evidence does not support.
</evidence-discipline>

<voice-rules>
- Each field is one clear phrase or sentence.
- Use inference language (likely, suggests, may) for all interpretations.
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling. No emojis, no hype.
</voice-rules>

<few-shot-example>
For premium trading card binders (illustrative shape only):
{"functional_job":"Store and organise a large card collection in one secure place","emotional_job":"Likely seeking relief from the anxiety that something irreplaceable will be damaged","identity_job":"May want to be seen as a serious collector who properly cares for their collection","villain":"The makeshift storage that suggests they do not value what they own"}
</few-shot-example>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"job_map":[{"functional_job":"...","emotional_job":"...","identity_job":"...","villain":"..."}]}
Produce 1 to 3 rows (one per genuinely distinct customer segment in the vocabulary; usually one).
All content represents INFERRED DESIRED STATES based on evidence patterns, not direct quotes.
No markdown inside any string. No trailing commentary outside the JSON.
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
        if (user) console.log('[avatar-jobmap] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[avatar-jobmap] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const s1 = body?.prior?.s1 ?? body?.s1 ?? null;
    const s1Text = formatS1(s1);

    // S2 is synthesis over S1 — without S1 it cannot build the map, it asks.
    if (!s1Text) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Run Stage 1 (vocabulary forensics) first, or supply its clusters. The change map is built from the Stage-1 emotion clusters.',
            why: 'S2 functional/emotional/identity changes and the villain are synthesised from the S1 vocabulary clusters.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userMessage = `STAGE 1 VOCABULARY CLUSTERS (the evidence basis for identifying the change they are seeking):\n\n${s1Text}\n\nNow identify the likely change they are seeking: the functional, emotional, and identity transformations, plus what they are moving away from (the villain). Return ONLY the JSON object.`;

    const systemPrompt = buildSystemPrompt();
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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[avatar-jobmap] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    // Meter the real token usage for this paid op (records always; debits; never throws).
    const meterUserId = await getAuthedUserId(req);
    if (meterUserId) await meterAndDebit(getServiceClient(), { userId: meterUserId, op: 'avatar_jobmap', model: SONNET_MODEL, usage: data.usage });
    const jobMap = parseJobMap(rawText);

    const cleaned = jobMap
      .map((r) => ({
        functional_job: typeof r?.functional_job === 'string' ? r.functional_job.trim() : '',
        emotional_job: typeof r?.emotional_job === 'string' ? r.emotional_job.trim() : '',
        identity_job: typeof r?.identity_job === 'string' ? r.identity_job.trim() : '',
        villain: typeof r?.villain === 'string' ? r.villain.trim() : '',
      }))
      .filter((r) => r.functional_job && r.emotional_job && r.identity_job && r.villain);

    if (cleaned.length === 0) {
      console.error('[avatar-jobmap] No complete change-map rows parsed.');
      throw new Error('Could not parse a complete change map from model output.');
    }

    const result = {
      job_map: cleaned,
      grounding: 'evidence' as const,
      evidence_refs: [{ kind: 'artifact' as const, ref: 'avatar_s1_vocab' }],
    };

    console.log(`[avatar-jobmap] Returning ${cleaned.length} change-map row(s).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in avatar-jobmap function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to build the change map right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});