import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * marketing-audit  (gold Workbook B — "Investment Matrix" + "Recommended Phasing")
 *
 * PROSE-ONLY enrichment of an ALREADY-COMPUTED audit. The host
 * (src/mcp/service/auditCalibration.ts) does ALL the numbers deterministically:
 * tiering, the 1/3/6/12-mo benefit bands (calibrated to the user's monthly revenue),
 * cash-cost cells, and the cumulative-impact grid. This function NEVER sees a raw
 * business fact and NEVER returns a number — it receives the computed rows + phases and
 * returns only contextualised PROSE for two fields:
 *   - per investment row: a `what_it_is` line, rewritten to the user's business context
 *     (its tier, its benefit band, its SKUs) without changing any figure.
 *   - per rollout phase: a `why_now` line, the cash-timing rationale for that phase.
 *
 * Because the request carries no numbers to alter and the response schema has no numeric
 * field, the model is structurally incapable of fabricating or mutating a figure. The
 * host additionally re-asserts (numbers-in == numbers-out) post-parse and discards any
 * prose that reintroduces a contradictory dollar figure.
 *
 * Cloned from reveal-signature / brand-canvas (CORS, optional JWT->getUser, Anthropic
 * SONNET with prompt caching, strict JSON contract + value-level assistant prefill,
 * tolerant defensive parse). On any failure it returns the inputs' verbatim prose so the
 * audit still renders (the deterministic numbers stand on their own).
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRow {
  tier?: string;
  investment?: string;
  what_it_is?: string;
  cash_cost?: string;
  benefit_1mo?: string;
  benefit_12mo?: string;
}
interface AuditPhase {
  phase?: string;
  window?: string;
  action?: string;
  cash_needed?: string;
  why_now?: string;
}

/** Coerce a value into a trimmed string, or '' if not a usable string. */
function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Coerce a value into a string[] of trimmed entries (index-aligned; '' for non-strings). */
function asStrArray(v: unknown, length: number): string[] {
  const out: string[] = [];
  const arr = Array.isArray(v) ? v : [];
  for (let i = 0; i < length; i++) out.push(asStr(arr[i]));
  return out;
}

/** Render the investment rows into a compact, NUMBER-FREE-INSTRUCTION block. */
function formatRows(rows: AuditRow[]): string {
  return rows
    .map((r, i) => {
      const parts = [
        `[#${i}] ${asStr(r.investment)} (tier ${asStr(r.tier)})`,
        `current description: ${asStr(r.what_it_is)}`,
      ];
      return parts.join('\n  ');
    })
    .join('\n\n');
}

/** Render the rollout phases into a compact block for the why-now rewrite. */
function formatPhases(phases: AuditPhase[]): string {
  return phases
    .map((p, i) => {
      return [
        `[#${i}] ${asStr(p.phase).replace(/\n/g, ' ')} — window: ${asStr(p.window)}`,
        `actions: ${asStr(p.action).replace(/\n/g, '; ')}`,
        `cash needed: ${asStr(p.cash_needed)}`,
        `current rationale: ${asStr(p.why_now)}`,
      ].join('\n  ');
    })
    .join('\n\n');
}

/**
 * Tolerant parse of the prose object. The assistant turn is prefilled value-level
 * (`{"row_descriptions":`); reconstruct the wrapper and repair residual truncation, with
 * a brace-scan fallback. Never throws; null when nothing parses into an object with
 * `row_descriptions`.
 */
function parseProse(rawText: string): Record<string, unknown> | null {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"row_descriptions":${rawText}`,
  ];
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    candidates.push(`{"row_descriptions":${rawText.slice(0, lastBrace + 1)}`);
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'row_descriptions' in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next reconstruction
    }
  }
  for (const obj of extractBalancedObjects(`{"row_descriptions":${rawText}`)) {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'row_descriptions' in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // skip
    }
  }
  return null;
}

/** Extract complete brace-balanced top-level `{...}` objects from text, string-aware. */
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

function buildSystemPrompt(): string {
  return `<persona>
You are an Amazon brand marketing strategist inside a BMAD brand coach. A deterministic engine has ALREADY scored a marketing-investment audit for a specific seller — it has fixed every tier, every cash cost, every benefit dollar band, and the rollout windows. Your ONLY job is to rewrite two PROSE fields so they read like advice written for THIS seller, given what the engine already decided.
</persona>

<critical-failure-mode>
You must NEVER state, change, invent, or contradict a number. No dollar figures, no percentages, no hours, no timeframes. The engine owns every figure. If you write any number into a description, you have FAILED. Describe what a move IS and WHY a phase comes when it does — in words only. The benefit dollars, cash costs, and windows are rendered by the engine, not by you.
</critical-failure-mode>

<what-to-write>
- row_descriptions[i]: a one-or-two-sentence rewrite of investment #i's "what it is", grounded in the supplied current description. Keep it concrete and specific to the move. Do NOT restate its tier or its dollar benefit (the matrix shows those). No numbers.
- phase_why_now[i]: a one-or-two-sentence "why now" rationale for phase #i, grounded in the supplied current rationale and the phase's actions. Explain the SEQUENCING logic (free wins first, paid moves wait for cash to free up, new channels last). No numbers.
</what-to-write>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings.
- NEVER use em dashes. Use full stops or commas.
- Plain, direct, peer-to-peer. No hype, no exclamation marks, no emojis.
- Each string is one or two sentences. Keep it tight.
</voice-rules>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"row_descriptions":["...","..."],"phase_why_now":["...","..."]}
row_descriptions MUST have exactly one entry per investment row, in order. phase_why_now MUST have exactly one entry per phase, in order. Every entry is a non-empty string with NO numbers. No trailing commentary outside the JSON.</output-contract>`;
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

  // Parse the request body up front so the fallback can echo verbatim prose on any error.
  let rows: AuditRow[] = [];
  let phases: AuditPhase[] = [];
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
        if (user) console.log('[marketing-audit] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[marketing-audit] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    rows = Array.isArray(body?.rows) ? (body.rows as AuditRow[]) : [];
    phases = Array.isArray(body?.phases) ? (body.phases as AuditPhase[]) : [];

    if (rows.length === 0 || phases.length === 0) {
      return new Response(
        JSON.stringify({
          needs_input: [
            {
              slot: 8,
              question:
                'Provide the computed marketing-audit rows and rollout phases. The marketing-audit prose engine enriches an already-scored audit; it does not score one.',
              why: 'The host computes the audit numbers deterministically and passes them here only for prose enrichment.',
            },
          ],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userParts: string[] = [
      `INVESTMENT ROWS (rewrite each "what it is", words only, no numbers):\n${formatRows(rows)}`,
      `ROLLOUT PHASES (rewrite each "why now", words only, no numbers):\n${formatPhases(phases)}`,
      'Now return ONLY the JSON object with row_descriptions (one per investment row, in order) and phase_why_now (one per phase, in order).',
    ];

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
        max_tokens: 3000,
        system: [{ type: 'text', text: buildSystemPrompt(), cache_control: { type: 'ephemeral' } }],
        messages: [
          // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
          { role: 'user', content: userParts.join('\n\n') },
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[marketing-audit] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const parsed = parseProse(rawText);

    // Build the prose arrays, defaulting any missing/empty entry to the verbatim input.
    const rowDescriptions = asStrArray(parsed?.row_descriptions, rows.length).map(
      (s, i) => s || asStr(rows[i]?.what_it_is),
    );
    const phaseWhyNow = asStrArray(parsed?.phase_why_now, phases.length).map(
      (s, i) => s || asStr(phases[i]?.why_now),
    );

    console.log(`[marketing-audit] Returning prose (rows=${rowDescriptions.length}, phases=${phaseWhyNow.length}).`);
    return new Response(
      JSON.stringify({ row_descriptions: rowDescriptions, phase_why_now: phaseWhyNow }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    // Never-fail: the deterministic numbers stand on their own. Echo the verbatim input
    // prose so the audit still renders even if the enrichment leg is unavailable.
    console.error('Error in marketing-audit function:', error);
    return new Response(
      JSON.stringify({
        row_descriptions: rows.map((r) => asStr(r.what_it_is)),
        phase_why_now: phases.map((p) => asStr(p.why_now)),
        degraded: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
