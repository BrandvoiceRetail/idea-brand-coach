import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * audit-idea-map  (gold Workbook A, sheet 7 — "Audit × IDEA")
 *
 * Maps each marketing-audit investment move onto the lift IDEA inputs (the Brand
 * Canvas + Export Brief + avatar evidence chain) provide. For every move it states the
 * WITHOUT-IDEA baseline, the WITH-IDEA upgrade (the concrete IDEA inputs feeding it),
 * and a LABELED lift multiplier band. The lift multiplier is an ESTIMATE and is
 * therefore a free-text LABEL only (e.g. "2-3x conversion lift", "Same budget, ~30-50%
 * better ROAS", "Marginal but reinforces brand"); it is NEVER a single precise
 * fabricated figure.
 *
 * Cloned from reveal-signature / avatar-triggers (CORS, optional JWT->getUser,
 * Anthropic SONNET call with prompt caching, value-level assistant prefill, tolerant
 * defensive parse, evidence-vs-inference branch, needs_input when grounding absent).
 *
 * Output contract (Phase-0 `audit_x_idea`):
 *   { rows: [{ audit_investment, without_idea, with_idea, estimated_lift }],
 *     grounding: 'evidence'|'inference', evidence_refs: [{kind, ref}] }
 *
 * GROUNDING: sheet 7 is SYNTHESIS over the canvas + brief + (optional) investment rows.
 *   - canvas + brief are REQUIRED. With neither present the fn returns `needs_input`
 *     (the chain is incomplete — the mapping has nothing to upgrade).
 *   - investments (the marketing-move rows) are OPTIONAL. When supplied, every row maps
 *     a real move; when absent the model uses the canonical IDEA-relevant move set.
 *   - estimated_lift is an ESTIMATE -> labeled band only; a purely-numeric lift is
 *     replaced with a band label so a fabricated exact figure can never leak through.
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** A marketing-move investment row (from Output B), as fed into the mapping. */
interface InvestmentRow {
  investment?: string;
  tier?: string;
  what_it_is?: string;
}

/**
 * Compact the supplied IDEA inputs into prompt text. The model is grounded ONLY in what
 * is passed — never a generic web mapping. Each pane is summarised at a level that lets
 * the model reason about lift without re-deriving the artifacts.
 */
function formatCanvas(canvas: unknown): string {
  if (!canvas || typeof canvas !== 'object') return '';
  const c = canvas as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof c.signature === 'string') lines.push(`- Signature: ${c.signature}`);
  const pos = c.positioning as Record<string, unknown> | undefined;
  if (pos && typeof pos === 'object') {
    if (typeof pos.position === 'string') lines.push(`- Position: ${pos.position}`);
    if (typeof pos.promise === 'string') lines.push(`- Promise: ${pos.promise}`);
    if (typeof pos.villain === 'string') lines.push(`- Villain: ${pos.villain}`);
    if (typeof pos.identity_payoff === 'string') lines.push(`- Identity payoff: ${pos.identity_payoff}`);
  }
  const voice = c.voice as Record<string, unknown> | undefined;
  if (voice && typeof voice === 'object' && Array.isArray(voice.words_we_use)) {
    lines.push(`- Vocabulary: ${(voice.words_we_use as unknown[]).filter((w) => typeof w === 'string').join(', ')}`);
  }
  if (typeof c.story_spine === 'string') lines.push(`- Brand story spine: ${c.story_spine}`);
  return lines.join('\n');
}

function formatBrief(brief: unknown): string {
  if (!brief || typeof brief !== 'object') return '';
  const b = brief as Record<string, unknown>;
  const lines: string[] = [];
  const title = b.title_formula as Record<string, unknown> | undefined;
  if (title && typeof title.example_output === 'string') lines.push(`- Title: ${title.example_output}`);
  if (Array.isArray(b.bullets)) {
    const bullets = (b.bullets as Array<Record<string, unknown>>)
      .map((bl) => (typeof bl?.example_output === 'string' ? bl.example_output : ''))
      .filter((s) => s.length > 0);
    if (bullets.length > 0) lines.push(`- Listing bullets: ${bullets.join(' | ')}`);
  }
  const ppc = b.ppc_keywords as Record<string, unknown> | undefined;
  if (ppc && Array.isArray(ppc.tier_a)) {
    lines.push(`- Tier A trigger keywords: ${(ppc.tier_a as unknown[]).filter((k) => typeof k === 'string').join(', ')}`);
  }
  return lines.join('\n');
}

function formatInvestments(investments: unknown): string {
  const rows: InvestmentRow[] = Array.isArray((investments as { rows?: unknown })?.rows)
    ? (investments as { rows: InvestmentRow[] }).rows
    : Array.isArray(investments)
      ? (investments as InvestmentRow[])
      : [];
  if (rows.length === 0) return '';
  return rows
    .map((r) => `- ${r.investment ?? 'investment'}${r.tier ? ` (${r.tier})` : ''}: ${r.what_it_is ?? ''}`)
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
 * Tolerant parse of the model's `rows` array. Value-level prefill (`{"rows":`) lets
 * Sonnet emit the array literal; this repairs the residual malformations:
 *  - clean: `[{...}]}`                        -> `{"rows":` + raw
 *  - missing first object brace: `["audit`    -> insert `{` after the leading `[`
 *  - truncated / spurious trailing brace      -> cut to the last `}` and re-close `]}`
 *  - bare object (no array wrapper)           -> brace-scan complete objects
 * Never throws; returns [] if nothing parses.
 */
function parseRows(rawText: string): Array<Record<string, unknown>> {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"rows":${rawText}`,
    `{"rows":[{${rawText}`,
    `{"rows":[${rawText}`,
  ];
  const stripped = rawText.replace(/^\s+/, '');
  if (stripped.startsWith('[')) {
    const bracketIdx = rawText.indexOf('[');
    const after = rawText.slice(bracketIdx + 1).replace(/^\s+/, '');
    if (after.startsWith('"')) {
      candidates.push(`{"rows":${rawText.slice(0, bracketIdx + 1)}{${rawText.slice(bracketIdx + 1)}`);
    }
  }
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    const body = rawText.slice(0, lastBrace + 1);
    candidates.push(`{"rows":${body}]}`);
    candidates.push(`{"rows":[{${body}]}`);
    const bstr = body.replace(/^\s+/, '');
    if (bstr.startsWith('[')) {
      const bi = body.indexOf('[');
      const ba = body.slice(bi + 1).replace(/^\s+/, '');
      if (ba.startsWith('"')) {
        candidates.push(`{"rows":${body.slice(0, bi + 1)}{${body.slice(bi + 1)}]}`);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
        return parsed.rows;
      }
    } catch {
      // try the next reconstruction
    }
  }
  // Fallback: brace-scan complete objects (handles a bare object or a wrapper the
  // candidates above could not repair).
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
You are a brand strategist inside a BMAD brand coach. This is the "Audit x IDEA" map: it shows, move by move, how much MORE a marketing investment returns when it is fed by IDEA brand inputs (a forensic customer Avatar, a chosen Signature, a Brand Canvas, and an Export Brief) versus run generically without them.
</persona>

<what-this-is>
Each row maps one marketing move to its lift from IDEA. Four parts:
- audit_investment: the marketing move (for example: Listing copy refresh, A+ Content overhaul, PPC restructure, Photography reshoot, Sponsored Brands Video, Influencer seeding).
- without_idea: what the move achieves run generically, without the IDEA inputs. Honest and concrete, not a strawman.
- with_idea: the SAME move fed by the supplied IDEA inputs. Name the specific inputs it now uses (the Signature, forensic vocabulary clusters, Tier A trigger keywords, the villain, the identity payoff). This must reference the actual canvas/brief supplied, not generic advice.
- estimated_lift: a LABELED lift band. NEVER a single precise number.
</what-this-is>

<lift-multiplier-rule>
"estimated_lift" is a labeled estimate, never a fabricated precise statistic. Acceptable shapes are RANGES and qualitative bands, such as "2-3x conversion lift on the refresh", "1.5-2.5x lift vs generic A+", "Same budget, ~30-50% better ROAS", "Lower ACoS, higher click-through", "Marginal but reinforces brand". Do NOT output a single exact multiplier ("3.2x"), a single exact percentage ("47%"), or any precise count presented as fact. When in doubt, widen to a range or use a qualitative band. Some moves genuinely lift little from IDEA; say so plainly ("Marginal") rather than inventing a figure.
</lift-multiplier-rule>

<grounding-rule>
Derive every with_idea cell ONLY from the supplied Brand Canvas, Export Brief, and (when present) the investment-move list. The lift you claim must be justified by the specific IDEA inputs that move would now use. Do not invent product facts, policies, or numbers. If a move would not plausibly use the supplied IDEA inputs, its lift is Marginal.
</grounding-rule>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops, commas, or hyphens.
- Use UK English spelling. No emojis, no hype.
</voice-rules>

<few-shot-example>
For a premium trading card binder brand (illustrative shape only):
{"audit_investment":"PPC restructure","without_idea":"Better ACoS on category keywords through bid discipline.","with_idea":"Tier A trigger-state keywords added, high-intent and low-competition. Sponsored Brands Video uses the Signature as the hook.","estimated_lift":"Same budget, ~30-50% better ROAS"}
</few-shot-example>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"rows":[{"audit_investment":"...","without_idea":"...","with_idea":"...","estimated_lift":"<labeled band, never a single precise number>"}]}
Produce 6 to 12 rows. estimated_lift must be a labeled band or range, never a single exact figure. No markdown inside any string. No trailing commentary outside the JSON.
</output-contract>`;
}

/**
 * True when a lift string is a single precise figure presented as fact (rejected as a
 * fabricated statistic). A RANGE (contains a separating dash/"to") or any string with
 * qualitative words is allowed; a lone "3.2x" / "47%" / "1200" is not.
 */
function isFabricatedPreciseLift(lift: string): boolean {
  const trimmed = lift.trim();
  // Ranges and qualitative bands always contain a connector or extra words -> allowed.
  // A single token that is purely one figure (multiplier / percent / count) is rejected.
  return /^[~≈]?\s*\d+(?:[.,]\d+)?\s*(?:x|%)?$/i.test(trimmed);
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
        if (user) console.log('[audit-idea-map] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[audit-idea-map] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const canvas = body?.canvas ?? null;
    const brief = body?.brief ?? null;
    const investments = body?.investments ?? null;

    const canvasText = formatCanvas(canvas);
    const briefText = formatBrief(brief);
    const investmentsText = formatInvestments(investments);

    // Chain-incomplete gate: the map upgrades IDEA inputs into lift. Without the canvas
    // AND the brief there is nothing to map -> needs_input (never a fabricated mapping).
    if (!canvasText && !briefText) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Build the Brand Canvas and Export Brief first. The Audit x IDEA map shows how IDEA inputs (canvas, brief, avatar evidence) upgrade each marketing move, so it needs those artifacts to exist.',
            why: 'Every with_idea cell and its lift estimate must reference the actual Signature, vocabulary clusters, and Tier A keywords from the canvas/brief. Without them the mapping has nothing to upgrade.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parts: string[] = [];
    if (canvasText) parts.push(`BRAND CANVAS:\n${canvasText}`);
    if (briefText) parts.push(`EXPORT BRIEF:\n${briefText}`);
    if (investmentsText) {
      parts.push(`MARKETING AUDIT MOVES (map each of these):\n${investmentsText}`);
    } else {
      parts.push('No explicit marketing-move list was supplied. Use the canonical IDEA-relevant move set (listing copy refresh, A+ Content overhaul, PPC restructure, photography reshoot, Amazon Vine, influencer seeding, Sponsored Brands Video, Subscribe & Save, and a later-phase channel launch).');
    }
    parts.push('Now produce the Audit x IDEA map. estimated_lift must be a labeled band or range, never a single exact figure. Return ONLY the JSON object.');

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
        max_tokens: 3072,
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
      console.error('[audit-idea-map] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const rows = parseRows(rawText);

    const cleaned = rows
      .map((r) => {
        let lift = typeof r?.estimated_lift === 'string' ? r.estimated_lift.trim() : '';
        // Lift must be a labeled band; a single precise figure is a fabricated statistic.
        if (!lift || isFabricatedPreciseLift(lift)) lift = 'Meaningful lift, range depends on starting point';
        return {
          audit_investment: typeof r?.audit_investment === 'string' ? r.audit_investment.trim() : '',
          without_idea: typeof r?.without_idea === 'string' ? r.without_idea.trim() : '',
          with_idea: typeof r?.with_idea === 'string' ? r.with_idea.trim() : '',
          estimated_lift: lift,
        };
      })
      .filter((r) => r.audit_investment && r.without_idea && r.with_idea);

    if (cleaned.length === 0) {
      console.error('[audit-idea-map] No complete rows parsed.');
      throw new Error('Could not parse the Audit x IDEA map from model output.');
    }

    // Grounding: evidence when the brief (which is built on the avatar evidence chain) is
    // present; otherwise inference (canvas-only synthesis). evidence_refs cite the inputs.
    const grounding = briefText ? ('evidence' as const) : ('inference' as const);
    const evidence_refs = [
      ...(canvasText ? [{ kind: 'artifact' as const, ref: 'brand_canvas' }] : []),
      ...(briefText ? [{ kind: 'artifact' as const, ref: 'export_brief' }] : []),
    ];

    const result = {
      rows: cleaned,
      grounding,
      evidence_refs,
    };

    console.log(`[audit-idea-map] Returning ${cleaned.length} row(s) (grounding ${grounding}).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in audit-idea-map function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to build the Audit x IDEA map right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
