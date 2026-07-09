import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getServiceClient, getAuthedUserId } from "../_shared/edge-auth.ts";
import { meterAndDebit } from "../_shared/meter.ts";

/**
 * avatar-triggers  (Avatar 2.0 — Stage 3: The Decision Trigger)
 *
 * From S1 vocabulary + the S2 job map, names the MOMENT that turns interest into a
 * search, the feeling at that moment, the terms they actually type, and a LABELED
 * search-volume BAND. The band is never a fabricated number.
 *
 * Cloned from reveal-signature (CORS, optional JWT->getUser, Anthropic SONNET call
 * with prompt caching, strict JSON contract + assistant prefill, defensive parse,
 * evidence-vs-inference branch).
 *
 * Output contract (Phase-0 `avatar_s3_triggers`):
 *   { triggers: [{ trigger_moment, what_they_feel, search_terms: string[], estimated_volume_band }],
 *     grounding: 'evidence'|'inference', evidence_refs: [{kind, ref}] }
 *
 * GROUNDING: S3 is SYNTHESIS + ESTIMATE grounded in S1/S2. The volume band is an
 * ESTIMATE and is therefore a free-text LABEL only (e.g. "High", "Very high",
 * "High and growing"); the function strips any band that is purely a number so a
 * fabricated exact figure can never leak through.
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
}

interface S2Row {
  functional_job?: string;
  emotional_job?: string;
  identity_job?: string;
  villain?: string;
}

function formatS1(s1: unknown): string {
  const clusters: S1Cluster[] = Array.isArray((s1 as { clusters?: unknown })?.clusters)
    ? (s1 as { clusters: S1Cluster[] }).clusters
    : Array.isArray(s1) ? (s1 as S1Cluster[]) : [];
  if (clusters.length === 0) return '';
  return clusters
    .map((c) => `- ${c.cluster ?? 'cluster'}: ${(c.customer_words ?? []).join(', ')}`)
    .join('\n');
}

function formatS2(s2: unknown): string {
  const rows: S2Row[] = Array.isArray((s2 as { job_map?: unknown })?.job_map)
    ? (s2 as { job_map: S2Row[] }).job_map
    : Array.isArray(s2) ? (s2 as S2Row[]) : [];
  if (rows.length === 0) return '';
  return rows
    .map((r) => `- functional: ${r.functional_job ?? ''}\n  emotional: ${r.emotional_job ?? ''}\n  identity: ${r.identity_job ?? ''}\n  villain: ${r.villain ?? ''}`)
    .join('\n');
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
 * Tolerant parse of the model's `triggers` array. Value-level prefill (`{"triggers":`)
 * lets Sonnet emit the array literal; this repairs the residual malformations:
 *  - clean: `[{...}]}`                          -> `{"triggers":` + raw
 *  - missing first object brace: `["trigger`    -> insert `{` after the leading `[`
 *  - truncated / spurious trailing brace        -> cut to the last `}` and re-close `]}`
 *  - bare object (no array wrapper)             -> brace-scan complete objects
 * Never throws; returns [] if nothing parses.
 */
function parseTriggers(rawText: string): Array<Record<string, unknown>> {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"triggers":${rawText}`,
    `{"triggers":[{${rawText}`,
    `{"triggers":[${rawText}`,
  ];
  const stripped = rawText.replace(/^\s+/, '');
  if (stripped.startsWith('[')) {
    const bracketIdx = rawText.indexOf('[');
    const after = rawText.slice(bracketIdx + 1).replace(/^\s+/, '');
    if (after.startsWith('"')) {
      candidates.push(`{"triggers":${rawText.slice(0, bracketIdx + 1)}{${rawText.slice(bracketIdx + 1)}`);
    }
  }
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    const body = rawText.slice(0, lastBrace + 1);
    candidates.push(`{"triggers":${body}]}`);
    candidates.push(`{"triggers":[{${body}]}`);
    const bstr = body.replace(/^\s+/, '');
    if (bstr.startsWith('[')) {
      const bi = body.indexOf('[');
      const ba = body.slice(bi + 1).replace(/^\s+/, '');
      if (ba.startsWith('"')) {
        candidates.push(`{"triggers":${body.slice(0, bi + 1)}{${body.slice(bi + 1)}]}`);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.triggers) && parsed.triggers.length > 0) {
        return parsed.triggers;
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
You are a forensic customer-research analyst inside a BMAD brand coach. This is Stage 3 of an Avatar 2.0 build: Trust Signals. You identify what evidence customers need to see before they believe the product can deliver the change they seek.
</persona>

<what-this-is>
Stage 3 identifies the trust signals customers need to believe the product will work. The required chain:
1. CURRENT STATE: Where the customer is now (drawn from evidence)
2. DESIRED STATE: Where they want to be (the change they seek)
3. BELIEF REQUIRED: What they must believe to make the purchase
4. TRUST SIGNAL: The evidence/cue/proof that makes the belief acceptable

Each output has four parts:
- trigger_moment: the concrete moment or event that creates the urge to buy (inferred from the pattern).
- what_they_feel: the likely emotional state at that moment (use inference language).
- search_terms: phrases they may type into search (an array of several).
- estimated_volume_band: a LABELED prevalence band. NEVER a number.
</what-this-is>

<trust-signal-logic>
CRITICAL: A Trust Signal is the evidence/cue/proof that makes a belief acceptable. It is NEVER a promise, benefit, or outcome.

Before emitting any trust signal, test: Is this a promise/benefit/outcome? If yes, replace it with the evidence/cue/proof that makes the promise believable.

Example:
- Current state: "Hair is thinning and breakage is visible"
- Desired state: "Thicker, stronger hair"
- Belief required: "This product will actually strengthen my hair"
- WRONG (promise): "Stops further hair loss"
- RIGHT (trust signal): "Credible mechanism evidence, realistic progress milestones, visible proof over a defined timeline"
</trust-signal-logic>

<evidence-classes>
Every statement must be internally classed as one of:
- CUSTOMER EVIDENCE: Verbatim only (no synthetic quotes)
- PATTERN DETECTED: Observed patterns (ranking words like "dominant" require supporting counts)
- IDEA INTERPRETATION: Model analysis (never voiced as customer statement)
- RECOMMENDED RESPONSE: Tactical execution following from evidence + interpretation

Use inference language ("suggests", "likely", "may", "appears") wherever the content is model inference, not direct observation.
</evidence-classes>

<volume-band-rule>
"estimated_volume_band" is a labeled estimate, never a fabricated statistic. Use word labels only, such as "Very high", "High", "High and growing", "Medium", "Low and seasonal". Do NOT output a number, a count, a range of numbers, or a percentage. If you are tempted to write a figure, write the band label instead.
</volume-band-rule>

<grounding-rule>
Derive triggers ONLY from the supplied S1 vocabulary and S2 job map. The feelings must match the emotional vocabulary already surfaced; the search terms should reflect how these specific customers talk, not generic keyword-tool output.
</grounding-rule>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling. No emojis, no hype.
</voice-rules>

<few-shot-example>
For premium trading card binders (illustrative shape only):
{"trigger_moment":"A long-chased card finally arrives and there appears to be nowhere safe to put it","what_they_feel":"Likely protective, slightly anxious, unwilling to risk it","search_terms":["premium card binder","binder that won't scratch cards","best binder for valuable cards"],"estimated_volume_band":"High and growing"}
</few-shot-example>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"triggers":[{"trigger_moment":"...","what_they_feel":"...","search_terms":["...","..."],"estimated_volume_band":"<word label only>"}]}
Produce 2 to 5 triggers. estimated_volume_band must be a word label, never a number. No markdown inside any string. No trailing commentary outside the JSON.
</output-contract>`;
}

/** True when a band string is purely numeric / a figure (rejected as fabricated). */
function isFabricatedNumberBand(band: string): boolean {
  // Reject if it has no letters at all (pure number, percentage, or numeric range).
  return !/[a-z]/i.test(band);
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
        if (user) console.log('[avatar-triggers] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[avatar-triggers] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const s1 = body?.prior?.s1 ?? body?.s1 ?? null;
    const s2 = body?.prior?.s2 ?? body?.s2 ?? null;
    const s1Text = formatS1(s1);
    const s2Text = formatS2(s2);

    if (!s1Text) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Run Stage 1 (vocabulary forensics) first. Decision triggers are derived from the S1 vocabulary clusters (and the S2 job map).',
            why: 'S3 trigger feelings and search terms must reflect the customer vocabulary surfaced in S1.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parts: string[] = [`STAGE 1 VOCABULARY CLUSTERS:\n${s1Text}`];
    if (s2Text) parts.push(`STAGE 2 JOB MAP:\n${s2Text}`);
    parts.push('Now identify the decision triggers. estimated_volume_band must be a word label, never a number. Return ONLY the JSON object.');

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
          { role: 'user', content: parts.join('\n\n') },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[avatar-triggers] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    // Meter the real token usage for this paid op (records always; debits; never throws).
    const meterUserId = await getAuthedUserId(req);
    if (meterUserId) await meterAndDebit(getServiceClient(), { userId: meterUserId, op: 'avatar_triggers', model: SONNET_MODEL, usage: data.usage });
    const triggers = parseTriggers(rawText);

    const cleaned = triggers
      .map((t) => {
        const rawTerms = Array.isArray(t?.search_terms) ? t.search_terms : [];
        const search_terms = rawTerms
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        let band = typeof t?.estimated_volume_band === 'string' ? t.estimated_volume_band.trim() : '';
        // Bands must be word labels; a purely-numeric band is a fabricated figure.
        if (!band || isFabricatedNumberBand(band)) band = 'Medium';
        return {
          trigger_moment: typeof t?.trigger_moment === 'string' ? t.trigger_moment.trim() : '',
          what_they_feel: typeof t?.what_they_feel === 'string' ? t.what_they_feel.trim() : '',
          search_terms,
          estimated_volume_band: band,
        };
      })
      .filter((t) => t.trigger_moment && t.what_they_feel && t.search_terms.length > 0);

    if (cleaned.length === 0) {
      console.error('[avatar-triggers] No complete triggers parsed.');
      throw new Error('Could not parse decision triggers from model output.');
    }

    const result = {
      triggers: cleaned,
      grounding: 'evidence' as const,
      evidence_refs: [{ kind: 'artifact' as const, ref: 'avatar_s1_vocab' }],
    };

    console.log(`[avatar-triggers] Returning ${cleaned.length} trigger(s).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in avatar-triggers function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to find decision triggers right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
