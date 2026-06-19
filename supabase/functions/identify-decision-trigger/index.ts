import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Decision Trigger™ derivation (Alpha — dominant trigger only).
//
// Given the four Trust Gap pillar scores and the seller's imported listing +
// reviews, this derives the single dominant psychological trigger that makes
// their customer act, with 2-3 VERBATIM evidence phrases and one placement
// instruction. The trigger is DERIVED, never chosen. Two stages:
//   Stage 1 — a deterministic prior from the score->trigger correlation (§5.2).
//   Stage 2 — one Sonnet call reads the review corpus, confirms or overrides the
//             prior (Momentum / Fear-of-Loss can win on review-text evidence),
//             and extracts evidence + placement.
// Confidence is kept server-side and NEVER returned to the client panel ("the
// output should feel like a finding, not a calculation", brief §1.2/§3.4).
// Spec: Decision Trigger Developer Brief v2.20. Auth + reliability patterns
// cloned from import-product-data / diagnostic-interpretation.

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

type Dim = 'insight' | 'distinctive' | 'empathetic' | 'authentic';
const DIMS: Dim[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

const TRIGGER_TYPES = ['Identity', 'Belonging', 'Permission', 'Fear-of-Loss', 'Recognition', 'Momentum'] as const;
type TriggerType = typeof TRIGGER_TYPES[number];

// Brief §5.2 — the LOW pillar predicts the trigger.
const PILLAR_TRIGGER: Record<Dim, TriggerType> = {
  empathetic: 'Recognition',
  distinctive: 'Identity',
  insight: 'Permission',
  authentic: 'Belonging',
};

interface TrustGapListing {
  asin?: string;
  title?: string;
  bullets?: string[];
  description?: string;
}
interface TrustGapEvidence {
  listings: TrustGapListing[];
  topReviews: string[];
}

interface DecisionTriggerRequest {
  sessionId?: string;
  avatarId?: string | null;
  scores?: Partial<Record<Dim, number>>;
  evidence?: TrustGapEvidence;
}

/** Stage 1 — deterministic prior. Weakest pillar first; that ranking is the
 *  starting hypothesis for Identity/Belonging/Permission/Recognition. Pure and
 *  unit-testable; no LLM. Momentum/Fear-of-Loss are not score-predicted and are
 *  surfaced only by Stage 2 from review text. */
export function derivePrior(scores: Record<Dim, number>): Array<{ trigger: TriggerType; pillar: Dim; score: number }> {
  return DIMS
    .map((d) => ({ trigger: PILLAR_TRIGGER[d], pillar: d, score: scores[d] }))
    .sort((a, b) => a.score - b.score);
}

const SYSTEM_PROMPT = `<persona>
You are the derivation engine behind the IDEA Brand Coach Decision Trigger module. You identify the single dominant psychological trigger that makes a customer act now, from the seller's Trust Gap scores and their real customer reviews. You DERIVE it from evidence. You never guess and you never let the seller choose.
</persona>

<the-six-triggers>
1. Identity - 'I am this person'. Anchor: Apple. Signal: review language of self-assertion, personal standards, the purchase as a statement of who they are. Predicted by a LOW Distinctive score.
2. Belonging - 'People like me buy this'. Anchor: Nike. Signal: community, tribe or group-identity language ('as a serious runner', 'other parents like us'). Predicted by a LOW Authentic score.
3. Permission - 'Now I have reason to believe'. Anchor: Authority. Signal: research-before-buying, relief at finding something credible, clinical data, certifications, expert endorsements. Predicted by a LOW Insight score. Never the lead trigger; it belongs mid-funnel.
4. Fear-of-Loss - 'What am I losing by waiting'. Anchor: Gymshark. Signal: regret or delay language ('wish I had found this sooner', 'months wasted on other products'). Derived from REVIEW TEXT, not a pillar score.
5. Recognition - 'That is exactly me'. Anchor: Lego. Signal: high-specificity first-person language where the customer feels precisely seen ('my treasured collection', 'quietly anxious about this for years'). Predicted by a LOW Empathetic score.
6. Momentum - 'I am already most of the way there'. Anchor: Netflix. Signal: high review count plus comparison or research language ('after trying three other brands'); the final nudge that removes the last objection. Derived from REVIEW TEXT, not a pillar score.
</the-six-triggers>

<derivation-rules>
- You are given a deterministic prior, the triggers ranked from the Trust Gap scores. Treat it as a strong starting hypothesis for Identity, Belonging, Permission and Recognition.
- Momentum and Fear-of-Loss are NOT in the score prior. Choose either as dominant ONLY if the review text strongly and specifically supports it.
- Choose exactly ONE dominant trigger. (Supporting triggers are out of scope here; do not return one.)
- evidence_phrases MUST be quoted VERBATIM from the provided reviews or listing. Never paraphrase, never invent. Two to three phrases. If the corpus is thin, return fewer rather than inventing.
- brand_anchor is one short line in the form 'like Lego, your customer buys ...' using the anchor that matches the chosen dominant trigger (Apple, Nike, Authority, Gymshark, Lego, Netflix).
- placement_instruction is at most two sentences and must name a CAPTURE element (Contextual, Attention, Pain/Problem, Transformation, Uniqueness, Reassurance, Emotional CTA).
- confidence is your own 0.0 to 1.0 certainty in the dominant choice.
- why_this_trigger is one short plain-language paragraph a seller could read; refer to their evidence and their weak pillar in plain terms, never to scores, stages or models.
</derivation-rules>

<voice>UK English. No markdown, asterisks, em dashes or emojis. Inside JSON string values, use SINGLE quotes for any quotation, never double quotes, so the JSON stays valid.</voice>

<output-format>
Respond with ONLY one JSON object, no code fences, exactly these keys:
{"dominant_type":"Recognition","brand_anchor":"like Lego, ...","evidence_phrases":["...","..."],"placement_instruction":"...","confidence":0.0,"why_this_trigger":"..."}
</output-format>`;

function normaliseEvidence(raw: unknown): TrustGapEvidence {
  const c = (raw && typeof raw === 'object') ? raw as { listings?: unknown; topReviews?: unknown } : {};
  const listings: TrustGapListing[] = Array.isArray(c.listings)
    ? c.listings
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
        .map((l) => ({
          asin: typeof l.asin === 'string' ? l.asin : undefined,
          title: typeof l.title === 'string' ? l.title : undefined,
          bullets: Array.isArray(l.bullets) ? l.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0) : [],
          description: typeof l.description === 'string' ? l.description : undefined,
        }))
    : [];
  const topReviews: string[] = Array.isArray(c.topReviews)
    ? c.topReviews.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 12)
    : [];
  return { listings, topReviews };
}

function buildUserMessage(scores: Record<Dim, number>, prior: ReturnType<typeof derivePrior>, evidence: TrustGapEvidence): string {
  const priorLine = prior.map((p, i) => `${i + 1}. ${p.trigger} (from ${p.pillar} = ${p.score} out of 25)`).join('\n');
  const listingXml = evidence.listings.map((l) => {
    const bullets = (l.bullets ?? []).map((b) => `    <bullet>${b}</bullet>`).join('\n');
    return `  <listing>\n    <title>${l.title ?? ''}</title>\n${bullets}\n  </listing>`;
  }).join('\n');
  const reviewsXml = evidence.topReviews.map((r) => `  <review>${r}</review>`).join('\n');
  return `Trust Gap scores (each out of 25):
${DIMS.map((d) => `- ${d}: ${scores[d]}`).join('\n')}

Deterministic score prior (weakest pillar first):
${priorLine}

<listings>
${listingXml}
</listings>
<reviews>
${reviewsXml}
</reviews>

Derive the dominant Decision Trigger now as the JSON object. Every evidence phrase must be copied verbatim from the listings or reviews above.`;
}

interface DerivedTrigger {
  dominant_type: TriggerType;
  brand_anchor: string;
  evidence_phrases: string[];
  placement_instruction: string;
  confidence: number;
  why_this_trigger: string;
}

function parseDerived(text: string): DerivedTrigger | null {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try {
    const p = JSON.parse(text.slice(s, e + 1));
    if (!TRIGGER_TYPES.includes(p?.dominant_type)) return null;
    if (typeof p?.brand_anchor !== 'string' || typeof p?.placement_instruction !== 'string') return null;
    const phrases = Array.isArray(p?.evidence_phrases) ? p.evidence_phrases.filter((x: unknown): x is string => typeof x === 'string') : [];
    return {
      dominant_type: p.dominant_type,
      brand_anchor: p.brand_anchor.trim(),
      evidence_phrases: phrases.slice(0, 3),
      placement_instruction: p.placement_instruction.trim(),
      confidence: typeof p?.confidence === 'number' ? p.confidence : 0.5,
      why_this_trigger: typeof p?.why_this_trigger === 'string' ? p.why_this_trigger.trim() : '',
    };
  } catch {
    return null;
  }
}

async function callSonnet(userMessage: string): Promise<{ text: string; status: number | string }> {
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
      console.error(`[identify-decision-trigger] attempt ${attempt} network error:`, err);
    }
    if (res?.ok) {
      const data = await res.json();
      return { text: data?.content?.[0]?.text ?? '', status: res.status };
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

  // ── Auth (self-authenticate via caller's bearer token, mirrors import-product-data) ──
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

  try {
    const body = (await req.json()) as DecisionTriggerRequest;

    const sessionId = typeof body?.sessionId === 'string' && body.sessionId.trim().length > 0 ? body.sessionId.trim() : null;
    if (!sessionId) return jsonResponse({ error: 'Missing sessionId.' }, 400);

    // Normalise scores to /25 (tolerate a /100 payload by detecting max > 25).
    const rawScores = {} as Record<Dim, number>;
    for (const dim of DIMS) {
      const v = body?.scores?.[dim];
      if (typeof v !== 'number' || !Number.isFinite(v)) return jsonResponse({ error: `Missing or invalid score for "${dim}".` }, 400);
      rawScores[dim] = v;
    }
    const onHundredScale = Math.max(...DIMS.map((d) => rawScores[d])) > 25;
    const scores = {} as Record<Dim, number>;
    for (const dim of DIMS) scores[dim] = Math.max(0, Math.min(25, Math.round(onHundredScale ? rawScores[dim] / 4 : rawScores[dim])));

    const evidence = normaliseEvidence(body?.evidence);
    if (evidence.listings.length === 0 && evidence.topReviews.length === 0) {
      return jsonResponse({ error: 'Decision Trigger needs an imported listing or reviews to ground the derivation.' }, 422);
    }

    const prior = derivePrior(scores);
    const userMessage = buildUserMessage(scores, prior, evidence);

    let { text, status } = await callSonnet(userMessage);
    let derived = parseDerived(text);
    if (!derived && text) {
      // One reroll: unescaped quotes inside evidence citations are the known JSON-breakage (the
      // diagnostic-interpretation 500 class). Re-ask with the single-quote rule restated.
      const reroll = await callSonnet(userMessage + '\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object and use single quotes for any quotation inside string values.');
      text = reroll.text; status = reroll.status;
      derived = parseDerived(text);
    }
    if (!derived) {
      console.error('[identify-decision-trigger] underivable | upstream=', status, '| raw=', text.slice(0, 400));
      return jsonResponse({ error: 'Unable to derive your Decision Trigger right now. Please try again.', detail: typeof status === 'number' ? `upstream ${status}` : String(status) }, 500);
    }

    // Persist (RLS: auth.uid() = user_id). Supporting trigger is Beta -> left null.
    const { data: row, error: dbError } = await supabaseClient
      .from('decision_triggers')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        avatar_id: typeof body?.avatarId === 'string' ? body.avatarId : null,
        dominant_type: derived.dominant_type,
        brand_anchor: derived.brand_anchor,
        evidence_phrases: derived.evidence_phrases,
        placement_instruction: derived.placement_instruction,
        dominant_confidence: derived.confidence,
        why_this_trigger: derived.why_this_trigger,
        model_version: SONNET_MODEL,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[identify-decision-trigger] persist failed:', dbError.message);
      // Still return the derivation so the panel can render; persistence is not user-facing.
    }

    console.log('[identify-decision-trigger] derived', derived.dominant_type, 'for session', sessionId);

    // Client-safe payload — NO confidence, NO prior, NO model internals.
    return jsonResponse({
      id: row?.id ?? null,
      dominantType: derived.dominant_type,
      brandAnchor: derived.brand_anchor,
      evidencePhrases: derived.evidence_phrases,
      placementInstruction: derived.placement_instruction,
      whyThisTrigger: derived.why_this_trigger,
    });
  } catch (error) {
    console.error('[identify-decision-trigger] error:', error);
    return jsonResponse({ error: 'Unable to derive your Decision Trigger right now. Please try again.' }, 500);
  }
});
