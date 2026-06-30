import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getServiceClient } from "../_shared/edge-auth.ts";
import { assertCredits, meterAndDebit } from "../_shared/meter.ts";

// Per-avatar messaging-perception (Phase 2 of the multi-avatar messaging-perception
// workbook; skill .claude/skills/multi-avatar-messaging-workbook).
//
// Given ONE planned strategic message and ONE avatar's real Avatar 2.0 forensics
// (S1 vocabulary, S2 job map, S3 decision trigger, S4 objections), this judges how THAT
// avatar perceives the message across four dimensions — vocabulary_fit, job_resonance,
// trigger_hit, objection_handling — each a verdict (lands | partial | misses) backed by a
// SHORT evidence string drawn from that avatar's OWN forensics. Perception is INFERRED from
// evidence, never invented: a missing forensic cannot judge its dimension, and an avatar
// with essentially no forensics returns `analysable:false` (the honest "not yet analysable")
// rather than a guessed score. The overall verdict is the WEAKEST of the four dimensions and
// is recomputed server-side. The output matches the `MessagingPerceptionContent` content
// shape (src/mcp/contracts/messagingPerception.ts) that the Phase-3 assembler consumes
// verbatim. Auth + reliability patterns cloned from identify-decision-trigger.

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const VERDICTS = ['lands', 'partial', 'misses'] as const;
type Verdict = typeof VERDICTS[number];

// Severity for the weakest-link rollup (higher = worse). Mirrors the contract's
// MESSAGING_VERDICT_SEVERITY so the server recompute matches the consumer's invariant.
const VERDICT_SEVERITY: Record<Verdict, number> = { lands: 0, partial: 1, misses: 2 };

/** The WORST verdict wins, so a message reads `lands` only when it lands on every dimension. */
function weakestVerdict(verdicts: Verdict[]): Verdict {
  let worst: Verdict = 'lands';
  for (const v of verdicts) {
    if (VERDICT_SEVERITY[v] > VERDICT_SEVERITY[worst]) worst = v;
  }
  return worst;
}

const DIMENSION_KEYS = ['vocabulary_fit', 'job_resonance', 'trigger_hit', 'objection_handling'] as const;
type DimensionKey = typeof DIMENSION_KEYS[number];

interface Forensics {
  s1_vocab?: unknown;
  s2_jobmap?: unknown;
  s3_triggers?: unknown;
  s4_objections?: unknown;
}

// Each dimension reads ONLY its matching forensic block; the gap note is the honest
// "cannot judge this dimension" line used when that forensic is absent (never invented).
const DIM_GAP_NOTE: Record<DimensionKey, string> = {
  vocabulary_fit: 'No S1 vocabulary forensic on file - this avatar\'s words cannot be matched.',
  job_resonance: 'No S2 job-map forensic on file - this avatar\'s jobs cannot be matched.',
  trigger_hit: 'No S3 decision-trigger forensic on file - the buying moment cannot be confirmed.',
  objection_handling: 'No S4 objections forensic on file - this avatar\'s hesitations cannot be checked.',
};

// Used when the forensic IS on file but the model cited no evidence from it — we say
// exactly that and NEVER claim the forensic is missing (claiming "not on file" when it
// is would be a fabrication).
const DIM_GAP_NOTE_UNEVIDENCED: Record<DimensionKey, string> = {
  vocabulary_fit: 'Could not match the message to this avatar\'s S1 vocabulary - no clear word overlap.',
  job_resonance: 'Could not tie the message to this avatar\'s S2 jobs - no clear job match.',
  trigger_hit: 'Could not confirm the message lands on this avatar\'s S3 decision trigger.',
  objection_handling: 'Could not confirm the message addresses this avatar\'s S4 objections.',
};

interface PerceptionRequest {
  avatar_id?: string | null;
  avatar_name?: string;
  message?: string;
  forensics?: Forensics;
}

interface PerceptionDim {
  verdict: Verdict;
  evidence: string;
}
interface MessagingPerceptionContent {
  avatar_id: string | null;
  avatar_name: string;
  message: string;
  dimensions: Record<DimensionKey, PerceptionDim>;
  overall_verdict: Verdict;
  provoked_objections: string[];
  adjustments: string[];
  analysable: boolean;
}

/** True when a forensic block carries real content (non-empty string / array / object). */
function hasContent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length > 0;
  return true; // number / boolean are present
}

/**
 * The canonical "not yet analysable" content for an avatar with essentially no forensics.
 * Mirrors the contract's notAnalysablePerception: conservative `misses` placeholders, all
 * evidence empty, no objections / adjustments. The assembler branches on `analysable`.
 */
function notAnalysable(avatarId: string | null, avatarName: string, message: string): MessagingPerceptionContent {
  const blank: PerceptionDim = { verdict: 'misses', evidence: '' };
  return {
    avatar_id: avatarId,
    avatar_name: avatarName,
    message,
    dimensions: {
      vocabulary_fit: { ...blank },
      job_resonance: { ...blank },
      trigger_hit: { ...blank },
      objection_handling: { ...blank },
    },
    overall_verdict: 'misses',
    provoked_objections: [],
    adjustments: [],
    analysable: false,
  };
}

const SYSTEM_PROMPT = `<persona>
You are the perception engine behind the IDEA Brand Coach multi-avatar messaging workbook. You judge how ONE customer avatar perceives a single planned strategic message, reading ONLY that avatar's real Avatar 2.0 forensics. You INFER perception from evidence. You never invent the avatar's words, jobs, decision trigger or objections, and you never let optimism stand in for evidence.
</persona>

<the-four-dimensions>
Score the message on four dimensions, each judged ONLY from the matching forensic block:
1. vocabulary_fit - does the message use words this avatar actually uses or would recognise? Judge ONLY from the S1 vocabulary forensic.
2. job_resonance - does the message hit this avatar's functional AND emotional jobs-to-be-done? Judge ONLY from the S2 job map.
3. trigger_hit - does the message land on or near this avatar's named Decision Trigger - the buying moment? Judge ONLY from the S3 decision trigger.
4. objection_handling - does the message pre-empt this avatar's known objections, stay silent on them, or accidentally PROVOKE one? Judge ONLY from the S4 objections.
</the-four-dimensions>

<verdict-scale>
Each dimension verdict is one of: lands (the message clearly serves this dimension for this avatar), partial (it serves it only weakly or in part), misses (it does not serve it, or provokes a problem). Best to worst: lands, then partial, then misses.
</verdict-scale>

<rules>
- Every verdict MUST be backed by a SHORT evidence string quoted or paraphrased from THIS avatar's own forensics. Never invent the avatar's language, jobs, trigger or objections.
- If a forensic block is missing or empty you CANNOT judge that dimension: return verdict 'misses' and an evidence string that states plainly the forensic is not on file. An unknown is never a pass.
- overall_verdict is the WEAKEST of the four dimensions, never an average that hides a miss. (The server recomputes it; report your own best read.)
- provoked_objections: the avatar's objections (S4) that this message accidentally provokes or leaves unanswered, in the avatar's own terms. Empty array if none.
- adjustments: 1 to 3 concrete message tweaks that would raise the weakest verdicts. Each is a HYPOTHESIS TO TEST, not a settled claim - phrase it as something to try and test. Use an empty array only when the message already lands on every dimension.
- analysable: set false ONLY when the avatar has essentially no forensics at all. When false, every dimension evidence MUST be an empty string and provoked_objections and adjustments MUST be empty. When true, every dimension MUST carry non-empty evidence.
- Never blend or borrow another avatar's evidence. You judge THIS avatar only.
</rules>

<voice>UK English. No markdown, asterisks, em dashes or emojis. Inside JSON string values, use SINGLE quotes for any quotation, never double quotes, so the JSON stays valid.</voice>

<output-format>
Respond with ONLY one JSON object, no code fences, exactly these keys:
{"dimensions":{"vocabulary_fit":{"verdict":"lands","evidence":"..."},"job_resonance":{"verdict":"partial","evidence":"..."},"trigger_hit":{"verdict":"misses","evidence":"..."},"objection_handling":{"verdict":"partial","evidence":"..."}},"overall_verdict":"misses","provoked_objections":["..."],"adjustments":["..."],"analysable":true}
</output-format>`;

function forensicBlock(label: string, present: boolean, value: unknown): string {
  const inner = present ? JSON.stringify(value, null, 2) : 'not on file';
  return `<${label}>\n${inner}\n</${label}>`;
}

function buildUserMessage(
  avatarName: string,
  message: string,
  forensics: Forensics,
  present: Record<DimensionKey, boolean>,
): string {
  return `Avatar: ${avatarName}

Planned strategic message to judge (the ONE message, read through this avatar's eyes):
"${message}"

This avatar's Avatar 2.0 forensics. Judge each dimension ONLY from its matching block; a block shown as 'not on file' is missing and that dimension cannot be judged:

${forensicBlock('s1_vocabulary', present.vocabulary_fit, forensics.s1_vocab)}
${forensicBlock('s2_job_map', present.job_resonance, forensics.s2_jobmap)}
${forensicBlock('s3_decision_trigger', present.trigger_hit, forensics.s3_triggers)}
${forensicBlock('s4_objections', present.objection_handling, forensics.s4_objections)}

Judge how this avatar perceives the message now as the JSON object. Every evidence string must come from this avatar's forensics above; never invent it.`;
}

interface JudgedPerception {
  dimensions: Record<DimensionKey, PerceptionDim>;
  provoked_objections: string[];
  adjustments: string[];
}

function asVerdict(v: unknown): Verdict | null {
  return typeof v === 'string' && (VERDICTS as readonly string[]).includes(v) ? (v as Verdict) : null;
}

function parseJudged(text: string): JudgedPerception | null {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try {
    const p = JSON.parse(text.slice(s, e + 1));
    const rawDims = p?.dimensions;
    if (!rawDims || typeof rawDims !== 'object') return null;
    const dimensions = {} as Record<DimensionKey, PerceptionDim>;
    for (const k of DIMENSION_KEYS) {
      const d = (rawDims as Record<string, unknown>)[k] as { verdict?: unknown; evidence?: unknown } | undefined;
      const verdict = asVerdict(d?.verdict);
      if (!verdict) return null;
      dimensions[k] = { verdict, evidence: typeof d?.evidence === 'string' ? d.evidence.trim() : '' };
    }
    const provoked_objections = Array.isArray(p?.provoked_objections)
      ? p.provoked_objections.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim())
      : [];
    const adjustments = Array.isArray(p?.adjustments)
      ? p.adjustments.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim()).slice(0, 3)
      : [];
    return { dimensions, provoked_objections, adjustments };
  } catch {
    return null;
  }
}

/**
 * Reconcile the model's judgement into a contract-valid analysable content. Deterministic
 * enforcement (Layer 3): a dimension whose forensic is absent — or which the model left
 * unevidenced — is forced to a conservative `misses` with an honest gap note (so the
 * no-fabrication / non-empty-evidence bar holds), and overall_verdict is recomputed as the
 * weakest dimension. Guarantees the output passes messagingPerceptionContentSchema.
 */
function reconcile(
  judged: JudgedPerception,
  present: Record<DimensionKey, boolean>,
  avatarId: string | null,
  avatarName: string,
  message: string,
): MessagingPerceptionContent {
  const dimensions = {} as Record<DimensionKey, PerceptionDim>;
  for (const k of DIMENSION_KEYS) {
    let { verdict, evidence } = judged.dimensions[k];
    if (!present[k]) {
      // Forensic absent -> honestly say it is not on file.
      verdict = 'misses';
      evidence = DIM_GAP_NOTE[k];
    } else if (evidence.length === 0) {
      // Forensic present but the model cited nothing -> say THAT; never claim it is missing.
      verdict = 'misses';
      evidence = DIM_GAP_NOTE_UNEVIDENCED[k];
    }
    dimensions[k] = { verdict, evidence };
  }
  return {
    avatar_id: avatarId,
    avatar_name: avatarName,
    message,
    dimensions,
    overall_verdict: weakestVerdict(DIMENSION_KEYS.map((k) => dimensions[k].verdict)),
    provoked_objections: judged.provoked_objections,
    adjustments: judged.adjustments,
    analysable: true,
  };
}

async function callSonnet(userMessage: string): Promise<{ text: string; status: number | string; usage?: { input_tokens?: number; output_tokens?: number } }> {
  const headers = { 'x-api-key': anthropicApiKey!, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31', 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    model: SONNET_MODEL,
    max_tokens: 1400,
    temperature: 0.4,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });
  // One retry on transient upstream failure (429/5xx/network).
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(CLAUDE_API_URL, { method: 'POST', headers, body });
    } catch (err) {
      console.error(`[analyze-message-perception] attempt ${attempt} network error:`, err);
    }
    if (res?.ok) {
      const data = await res.json();
      return { text: data?.content?.[0]?.text ?? '', status: res.status, usage: data?.usage };
    }
    const status = res?.status ?? 'network-error';
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 2) return { text: '', status };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { text: '', status: 'exhausted' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!anthropicApiKey) return jsonResponse({ error: 'Anthropic API key not configured' }, 500);

  // ── Auth (self-authenticate via caller's bearer token, mirrors identify-decision-trigger) ──
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseClient.auth.getUser(token);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  // Paid op: credit gate (no-op unless PAYWALL_ENFORCED) + metering after success (below).
  const credits = getServiceClient();
  const gate = await assertCredits(credits, user.id, 'message_perception');
  if (!gate.ok) return jsonResponse({ error: 'needs_upgrade', needs_upgrade: true, balance: gate.balance }, 402);

  try {
    const body = (await req.json()) as PerceptionRequest;

    const avatarName = typeof body?.avatar_name === 'string' ? body.avatar_name.trim() : '';
    if (!avatarName) return jsonResponse({ error: 'Missing avatar_name.' }, 400);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return jsonResponse({ error: 'Missing message.' }, 400);
    const avatarId = typeof body?.avatar_id === 'string' ? body.avatar_id : null;

    const forensics: Forensics = (body?.forensics && typeof body.forensics === 'object') ? body.forensics : {};
    const present = {
      vocabulary_fit: hasContent(forensics.s1_vocab),
      job_resonance: hasContent(forensics.s2_jobmap),
      trigger_hit: hasContent(forensics.s3_triggers),
      objection_handling: hasContent(forensics.s4_objections),
    } as Record<DimensionKey, boolean>;

    // Essentially no forensics -> honest "not yet analysable", deterministically (no model call,
    // no metering): an avatar with no Avatar 2.0 is an unknown, never a guessed score.
    if (!DIMENSION_KEYS.some((k) => present[k])) {
      return jsonResponse(notAnalysable(avatarId, avatarName, message));
    }

    const userMessage = buildUserMessage(avatarName, message, forensics, present);

    const first = await callSonnet(userMessage);
    let text = first.text;
    let status = first.status;
    let inTok = first.usage?.input_tokens ?? 0;
    let outTok = first.usage?.output_tokens ?? 0;
    let judged = parseJudged(text);
    if (!judged && text) {
      // One reroll: unescaped quotes inside evidence citations are the known JSON-breakage.
      // Re-ask with the single-quote rule restated.
      const reroll = await callSonnet(userMessage + '\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object and use single quotes for any quotation inside string values.');
      text = reroll.text; status = reroll.status;
      inTok += reroll.usage?.input_tokens ?? 0;
      outTok += reroll.usage?.output_tokens ?? 0;
      judged = parseJudged(text);
    }
    if (!judged) {
      console.error('[analyze-message-perception] unparseable | upstream=', status, '| raw=', text.slice(0, 400));
      return jsonResponse({ error: 'Unable to analyse this message right now. Please try again.', detail: typeof status === 'number' ? `upstream ${status}` : String(status) }, 500);
    }

    // Meter the real token usage for this paid op (sums both model calls; never throws).
    await meterAndDebit(credits, { userId: user.id, op: 'message_perception', model: SONNET_MODEL, usage: { input_tokens: inTok, output_tokens: outTok } });

    const content = reconcile(judged, present, avatarId, avatarName, message);

    console.log('[analyze-message-perception] judged', content.overall_verdict, 'avatar_id:', avatarId ?? 'null');

    // Output matches the MessagingPerceptionContent content shape the Phase-3 assembler consumes.
    return jsonResponse(content);
  } catch (error) {
    console.error('[analyze-message-perception] error:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: 'Unable to analyse this message right now. Please try again.' }, 500);
  }
});
