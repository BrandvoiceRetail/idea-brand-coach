import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Trust Gap™ diagnostic interpretation.
//
// Given the four IDEA trust-pillar scores (each /25), the overall (/100), and the
// named primary gap, this returns a short, plain-language Trevor-voice coaching
// read for each pillar plus a bridging summary for the primary gap. The scores
// arrive in the request body (computed client-side from diagnostic_submissions),
// so this function performs NO database read — it works for guests and is immune
// to the diagnostic-read path. Cloned from brand-ai-assistant (CORS, prompt
// caching, raw-fetch Anthropic call, try/catch). Anthropic key only, server-side.
//
// PUBLIC by design (verify_jwt = false): the free diagnostic is a top-of-funnel
// lead magnet that anonymous users run before signup. Because it calls a paid LLM
// unauthenticated, it carries lightweight abuse controls (below). Note: per-call
// cost is already bounded structurally — the only inputs that reach the model are
// the four scores (clamped 0-25), the overall (clamped 0-100) and the enum primary
// gap; NO free text from the request is ever placed in the prompt.

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// ── Abuse controls (public endpoint) ────────────────────────────────────────
// Tunable via env without a redeploy of logic.
const MAX_BODY_BYTES = Number(Deno.env.get('DIAGNOSTIC_MAX_BODY_BYTES') ?? '4096');
const RATE_LIMIT_MAX = Number(Deno.env.get('DIAGNOSTIC_RATE_LIMIT_MAX') ?? '20');          // requests...
const RATE_LIMIT_WINDOW_MS = Number(Deno.env.get('DIAGNOSTIC_RATE_LIMIT_WINDOW_MS') ?? '60000'); // ...per window (default 60s)
// Comma-separated allowlist of browser origins. If UNSET, origin is not enforced
// (kept permissive so an unconfigured prod deploy is not broken) — set this in the
// function's secrets to restrict the endpoint to the app's domain(s).
const ALLOWED_ORIGINS = (Deno.env.get('DIAGNOSTIC_ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean);

const BASE_CORS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Resolve CORS headers for this request. When an allowlist is configured, reflect
 *  the caller's origin only if allowed (else the first allowed origin, so browsers
 *  block it); when unset, stay permissive ('*'). */
function resolveCors(req: Request): Record<string, string> {
  if (ALLOWED_ORIGINS.length === 0) {
    return { 'Access-Control-Allow-Origin': '*', ...BASE_CORS };
  }
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Vary': 'Origin',
    ...BASE_CORS,
  };
}

/** Whether the request's Origin is allowed. Unset allowlist => allow (no enforcement).
 *  A request with no Origin header (e.g. a raw script) is allowed only when the
 *  allowlist is unset; with an allowlist configured, a missing/unknown origin is denied. */
function isOriginAllowed(req: Request): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true;
  return ALLOWED_ORIGINS.includes(req.headers.get('origin') ?? '');
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

// Best-effort, per-isolate sliding-window limiter keyed by client IP. It bounds
// rapid-fire abuse from a single IP hitting a warm instance. It is NOT a global
// limit (each edge isolate keeps its own map and it resets on cold start); for a
// hard cross-instance guarantee, back this with a shared store (Postgres/Upstash)
// or a CDN/WAF rate rule. Good enough as a first layer for a cheap Haiku endpoint
// whose per-call cost is already bounded.
const ipHits = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (ipHits.get(ip) ?? []).filter((t) => t > windowStart);
  recent.push(now);
  ipHits.set(ip, recent);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.length === 0 || v[v.length - 1] <= windowStart) ipHits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

type Dimension = 'insight' | 'distinctive' | 'empathetic' | 'authentic';
const DIMENSIONS: Dimension[] = ['insight', 'distinctive', 'empathetic', 'authentic'];
const DIMENSION_LABELS: Record<Dimension, string> = {
  insight: 'Insight',
  distinctive: 'Distinctive',
  empathetic: 'Empathetic',
  authentic: 'Authentic',
};

interface InterpretationRequest {
  scores?: Partial<Record<Dimension, number>>;
  overall?: number;
  primaryGap?: Dimension;
}

/** Trevor system prompt. Voice rules lifted from idea-framework-consultant-claude
 *  (no markdown, no asterisks, CAPS for emphasis) plus the goal's UK-English and
 *  no-em-dash rules. Tagged with XML because Claude follows tagged instructions
 *  more reliably. */
const SYSTEM_PROMPT = `<persona>
You are Trevor Bradford, creator of the IDEA Strategic Brand Framework and a direct, experienced brand coach. You are reading a founder's brand diagnostic and giving them a straight, encouraging, plain-language assessment of where their brand builds trust and where it leaks it. You speak like a coach triaging, not like a report generator.
</persona>

<task>
You are given four trust pillar scores, each out of 25, an overall score out of 100, and the named primary gap (their weakest pillar). Write a short coaching interpretation for EACH of the four pillars, and one bridging summary for the primary gap.
</task>

<the-four-pillars>
- Insight: how well the brand understands what really drives the customer, their motivations and emotional triggers, and how clearly that turns into messaging.
- Distinctive: how much the brand stands out and owns a recognisable position and identity, instead of blending in with competitors.
- Empathetic: how emotionally connected customers feel, whether the brand speaks to what the customer feels and not just what the product is.
- Authentic: how genuine and transparent the brand is, whether its communication earns belief.
</the-four-pillars>

<score-bands>
- 0 to 9 out of 25: weak. This pillar is leaking trust.
- 10 to 17 out of 25: mixed. Partly working, real room to improve.
- 18 to 25 out of 25: strong. This pillar is building trust.
</score-bands>

<each-interpretation>
For each pillar, write 2 to 3 sentences that cover, in this order:
1. What this pillar measures, in plain words.
2. Your likely read at their score, what is probably happening for a brand at this level.
3. One concrete recommended next move they can act on.
Match the tone to the band. Be honest about weak pillars and genuinely affirming about strong ones.
</each-interpretation>

<primary-gap-summary>
Write 2 to 3 sentences. Name the primary gap as their single biggest opportunity right now, explain in coach voice why closing this gap matters most before the others, and point them to go deeper on it. This is the bridge from score to action. Triage, do not just restate the number.
</primary-gap-summary>

<do-not-fabricate>
You have NOT seen their actual products, listings, prices, reviews or customers. Do NOT invent specific details about them. Speak to the likely pattern at their score level, not fabricated specifics. It is fine to say what TENDS to be true at a given score.
</do-not-fabricate>

<voice>
- Plain, direct, warm, experienced. Write in the second person, talk to them as you.
- UK English spelling throughout.
- Do NOT use asterisks, markdown, bold, headings, bullet characters or emojis.
- Do NOT use em dashes or en dashes. Use commas, full stops, or the word and.
- Use CAPITAL LETTERS sparingly, only for genuine emphasis.
- Short sentences. No jargon dumps.
</voice>

<output-format>
Respond with ONLY a single JSON object and nothing else. No commentary, no code fences. Use exactly this shape and these keys:
{"interpretations":{"insight":"...","distinctive":"...","empathetic":"...","authentic":"..."},"primaryGapSummary":"..."}
Every string value must obey the voice rules above.
</output-format>`;

function buildUserMessage(scores: Record<Dimension, number>, overall: number, primaryGap: Dimension): string {
  const lines = DIMENSIONS.map((dim) => `- ${DIMENSION_LABELS[dim]}: ${scores[dim]} out of 25`);
  return `Here are the four trust pillar scores:
${lines.join('\n')}
Overall trust score: ${overall} out of 100.
The primary gap, their weakest pillar, is: ${DIMENSION_LABELS[primaryGap]}.

Write the interpretations and the primary gap summary now as the JSON object.`;
}

/** Defensively parse the model's JSON, tolerating stray prose or code fences. */
function parseModelJson(text: string): { interpretations: Record<string, string>; primaryGapSummary: string } | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const interpretations = parsed?.interpretations;
    const primaryGapSummary = parsed?.primaryGapSummary;
    if (!interpretations || typeof primaryGapSummary !== 'string') return null;
    const hasAll = DIMENSIONS.every((dim) => typeof interpretations[dim] === 'string' && interpretations[dim].trim().length > 0);
    if (!hasAll || primaryGapSummary.trim().length === 0) return null;
    return { interpretations, primaryGapSummary };
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = resolveCors(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // ── Abuse controls ────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  if (!isOriginAllowed(req)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down and try again shortly.' }),
      {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      },
    );
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Bound the request body before parsing (the legitimate payload is ~100 bytes).
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    let body: InterpretationRequest;
    try {
      body = JSON.parse(rawBody) as InterpretationRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // Normalise and validate the incoming scores (each clamped to 0-25).
    const scores = {} as Record<Dimension, number>;
    for (const dim of DIMENSIONS) {
      const raw = body?.scores?.[dim];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return new Response(
          JSON.stringify({ error: `Missing or invalid score for "${dim}".` }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      scores[dim] = Math.max(0, Math.min(25, Math.round(raw)));
    }

    const overall = typeof body?.overall === 'number' && Number.isFinite(body.overall)
      ? Math.max(0, Math.min(100, Math.round(body.overall)))
      : Math.round(DIMENSIONS.reduce((acc, dim) => acc + scores[dim], 0)); // four /25 sum to /100

    const primaryGap: Dimension = body?.primaryGap && DIMENSIONS.includes(body.primaryGap)
      ? body.primaryGap
      : DIMENSIONS.reduce((lowest, dim) => (scores[dim] < scores[lowest] ? dim : lowest), DIMENSIONS[0]);

    const userMessage = buildUserMessage(scores, overall, primaryGap);

    // System prompt is large and identical across calls, so cache it.
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
        model: HAIKU_MODEL,
        max_tokens: 1200,
        temperature: 0.6,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[diagnostic-interpretation] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text ?? '';
    const parsed = parseModelJson(rawText);

    if (!parsed) {
      console.error('[diagnostic-interpretation] Could not parse model JSON:', rawText.slice(0, 500));
      throw new Error('Interpretation response was not valid JSON');
    }

    console.log('[diagnostic-interpretation] Generated interpretation for primary gap:', primaryGap);

    return new Response(
      JSON.stringify({
        interpretations: {
          insight: parsed.interpretations.insight.trim(),
          distinctive: parsed.interpretations.distinctive.trim(),
          empathetic: parsed.interpretations.empathetic.trim(),
          authentic: parsed.interpretations.authentic.trim(),
        },
        primaryGap,
        primaryGapSummary: parsed.primaryGapSummary.trim(),
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in diagnostic-interpretation function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to generate your interpretation right now. Please try again.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
