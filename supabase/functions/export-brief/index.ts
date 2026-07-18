import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { captureServerException } from "../_shared/posthog.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * export-brief  (gold Workbook A, sheet 6 "Export Brief")
 *
 * Compiles the listing-copy brief (title formula + 5 bullets), the 7-slot image brief,
 * and the PPC keyword tiers from the Brand Canvas + the Avatar 2.0 S1-S4 artifacts.
 * This is the brief that makes any execution tool (Helium 10, Pixii, a freelancer)
 * produce on-brand work.
 *
 * Cloned from reveal-signature / avatar-jobmap (CORS, optional JWT->getUser, Anthropic
 * SONNET with prompt caching, strict JSON contract + value-level assistant prefill,
 * tolerant defensive parse, evidence-vs-inference branch, needs_input on missing input).
 *
 * Output contract (Phase-0 `export_brief`):
 *   { title_formula:{brief,example_output,product_truth_claims[]},
 *     bullets:[{element,brief,example_output,stage_ref,product_truth_claims[]}] (5),
 *     image_brief:[{slot,intent,brief}] (7),
 *     ppc_keywords:{tier_a[],tier_b[],tier_c[]},
 *     grounding, evidence_refs:[{kind,ref}] }
 *
 * FABRICATION GATE (manifest §6 — the gold "30-DAY GUARANTEE" hazard):
 * Copy may ONLY assert a PRODUCT-TRUTH/policy claim (capacity number, compatibility noun,
 * guarantee/warranty/return policy, material claim) that is present in `confirmed_claims`.
 * The prompt instructs the model to draw product facts ONLY from the supplied claims and
 * to echo which claim each element used in a `claims_used` field. Creative / emotional copy
 * (the decision-trigger lead, the villain framing, identity framing) is free. The
 * host-side deterministic claimGate (src/mcp/service/claimGate.ts) re-scans this output;
 * any ungated claim makes the generate_brief tool return needs_input rather than persist.
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_REFS = ['s1_vocab', 's2_jobmap', 's3_triggers', 's4_objections', 'signature', 'canvas', 'decision_trigger'];

interface ConfirmedClaim {
  claim?: string;
  source?: string;
}

/** Render a forensic / canvas artifact's content into a compact labelled block. */
function formatArtifact(label: string, content: unknown): string {
  if (content == null) return '';
  try {
    return `${label}:\n${JSON.stringify(content, null, 1)}`;
  } catch {
    return '';
  }
}

/** Render the confirmed-claims allowlist into a labelled block for the prompt. */
function formatClaims(claims: ConfirmedClaim[]): string {
  if (claims.length === 0) {
    return 'NONE. No product-truth or policy claims are confirmed. You may NOT state any capacity number, compatibility, material claim, guarantee, warranty, or return policy in the copy. Write benefit/emotion copy only.';
  }
  return claims
    .map((c, i) => `${i + 1}. "${(c.claim ?? '').trim()}" (source: ${(c.source ?? 'owner-confirmed').trim()})`)
    .join('\n');
}

/**
 * Tolerant parse of the brief object. The assistant turn is prefilled value-level
 * (`{"title_formula":`); reconstruct the wrapper and repair residual truncation, with a
 * brace-scan fallback. Never throws; null when nothing parses into an object with bullets.
 */
function parseBrief(rawText: string): Record<string, unknown> | null {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"title_formula":${rawText}`,
  ];
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    candidates.push(`{"title_formula":${rawText.slice(0, lastBrace + 1)}`);
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'bullets' in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next reconstruction
    }
  }
  for (const obj of extractBalancedObjects(`{"title_formula":${rawText}`)) {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'bullets' in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // skip unparseable fragment
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

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => s.length > 0);
}

/**
 * Map a model-emitted `claims_used` list to the contract's product_truth_claims shape.
 * Each entry is matched against the confirmed-claims allowlist by case-insensitive
 * substring; `confirmed` reflects whether a backing claim exists. The deterministic
 * claimGate re-verifies this host-side, so an over-claiming model cannot smuggle a
 * claim through (it is caught and surfaced as needs_input).
 */
function toProductTruthClaims(claimsUsed: unknown, confirmed: ConfirmedClaim[]): Array<{ claim: string; slot: 6; confirmed: boolean }> {
  const list = asStrArray(claimsUsed);
  const confirmedTexts = confirmed.map((c) => (c.claim ?? '').toLowerCase().trim()).filter(Boolean);
  return list.map((claim) => {
    const lc = claim.toLowerCase();
    const isConfirmed = confirmedTexts.some((ct) => lc.includes(ct) || ct.includes(lc));
    return { claim, slot: 6 as const, confirmed: isConfirmed };
  });
}

function buildSystemPrompt(): string {
  return `<persona>
You are a senior Amazon listing strategist inside a BMAD brand coach. You take a finished Brand Canvas and the Avatar 2.0 forensic artifacts and compile the Export Brief: the listing copy brief, the image brief, and the PPC keyword brief that any execution tool or freelancer can run with.
</persona>

<what-this-is>
- title_formula: the title template plus a concrete example title. The example_output MUST open with the brand name as its literal first word(s) (Amazon SEO convention, and brand-name search is itself a trust signal for this owner's category), immediately followed by the hero feature. Never lead with a generic category phrase (e.g. "Hair Growth Serum for Men & Women...") with the brand name buried later or omitted.
- bullets: EXACTLY 5 listing bullets, each with: element (the role, e.g. "BULLET 1 — Lead with Decision Trigger"), brief (the instruction), example_output (the concrete copy), stage_ref (which avatar/canvas stage drove it: one of s1_vocab, s2_jobmap, s3_triggers, s4_objections, signature, canvas), and claims_used (the product facts this bullet asserts, drawn ONLY from the confirmed claims).
  - Bullet 1 leads with the decision trigger (the moment the customer is in). stage_ref s3_triggers.
  - Bullet 2 names the villain. stage_ref s2_jobmap.
  - Bullet 3 frames capacity/dignity. stage_ref s1_vocab or canvas.
  - Bullet 4 establishes authority/trust without bragging. stage_ref canvas.
  - Bullet 5 is risk reversal. stage_ref canvas.
- image_brief: EXACTLY 7 slots (Hero, Image 2..7), each with slot, intent, brief.
- ppc_keywords: three tiers. tier_a = decision-trigger / problem-state keywords (from S3). tier_b = identity-state keywords. tier_c = category / defensive keywords. Each tier has at least one keyword.
</what-this-is>

<critical-fabrication-gate>
PRODUCT-TRUTH and POLICY claims (capacity numbers, compatibility nouns like PSA slab, materials like archival-grade, and ANY guarantee, warranty, or return policy) may ONLY appear in the copy if they are in the CONFIRMED CLAIMS list supplied in the user message. This is the single worst failure of this stage: inventing a "30-DAY GUARANTEE" or a "Holds 432 Cards" or "PSA-slab compatible" that the owner has not confirmed is forbidden, both because it is a fabrication and because false guarantee/warranty phrasing is an Amazon Terms-of-Service hazard.
- If a fact you want to use is NOT in the confirmed claims, DO NOT state it. Write the copy around the emotion and benefit instead.
- When a confirmed claim names a specific branded, trademarked, or proprietary ingredient/material (e.g. "AnaGain™"), use that EXACT name, spelling, and trademark/registered symbol (™/®) verbatim wherever it appears in the copy. NEVER substitute a "more natural-sounding" generic, scientific, or botanical synonym (e.g. do not write "pea sprout" or "pea sprout extract" in place of a confirmed "AnaGain™") — the specific name is a searched, recognised term and a trust signal; smoothing it into a generic descriptor is a fabrication-adjacent failure, not a style choice.
- For every element, list in claims_used the EXACT confirmed-claim text(s) that element relies on. If an element makes no product-truth claim, claims_used is an empty array.
- Creative and emotional copy (decision-trigger leads, villain framing, identity framing, the feeling) is FREE and not gated. Only product facts and policies are gated.
</critical-fabrication-gate>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling in the briefs. The example_output copy may use the brand's own conventions.
- No emojis. No invented review quotes.
</voice-rules>

<trigger-brief-direction>
The DOMINANT Decision Trigger named in Stage 3 sets the emotional through-line of the brief. Use it to tune the HERO image intent and the angle of Bullet 1 (the decision-trigger lead). It does NOT change the fixed roles or stage_ref of Bullets 2 to 5, and it does NOT replace the title_formula rule (brand name first, then hero feature); carry the trigger as the emotional angle, not as a new headline.
Hero image intent and Bullet 1 angle by trigger:
- Recognition: hero mirrors the customer's emotional reality before the product, showing the struggle or the moment of recognition, not the product benefit. Bullet 1 acknowledges the failure state in the customer's own words.
- Identity: hero signals cultural belonging and aspiration, the product shown in the context of who the customer wants to be. Bullet 1 is an identity signal.
- Belonging: hero shows community and brand purpose (people, mission, story), not just product. Bullet 1 carries the brand's story or values.
- Momentum: hero leads with social-proof volume ONLY when a real number is present in the confirmed inputs; never invent a review count. Bullet 1 frames the final-nudge, last-objection-removed angle.
- Fear-of-Loss: hero communicates the cost of inaction (the before state, a time-sensitive outcome, or the consequence of delay). Bullet 1 frames the cost of waiting, not the benefit of buying. Never invent a customer quote; write around the emotion unless a real quote is in the supplied evidence.
- Permission: a SUPPORTING trigger, NEVER the lead. If the prior points to Permission, lead Bullet 1 with the strongest evidence-backed trigger present in Stage 3 and let authority or credentials carry a later bullet, not the hero or Bullet 1.
If Stage 3 names no single dominant trigger, infer it from the weakest pillar (Empathetic to Recognition, Distinctive to Identity, Authentic to Belonging; Insight maps to Permission, which never leads, so lead with the next strongest evidence-backed trigger) and note which you used in the title_formula brief.
</trigger-brief-direction>

<decision-trigger-root>
When the DECISION TRIGGER is supplied as the positioning root (no Brand Canvas or Signature present):
- This is a PARTIAL root containing only the emotional lever and verbatim evidence phrases, not full voice/positioning language
- Use the trigger's dominant_type, brand_anchor (brand-free line, NOT raw internal names), evidence_phrases (verbatim), placement_instruction, and why_this_trigger
- The brief will be more emotionally focused but less brand-articulated than a Canvas or Signature root
- For elements that would normally cite canvas positioning, adapt using the trigger's emotional angle and evidence
- Use stage_ref "decision_trigger" for any element that draws from this root
</decision-trigger-root>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"title_formula":{"brief":"...","example_output":"...","claims_used":["..."]},"bullets":[{"element":"...","brief":"...","example_output":"...","stage_ref":"s3_triggers","claims_used":["..."]}],"image_brief":[{"slot":"Hero","intent":"...","brief":"..."}],"ppc_keywords":{"tier_a":["..."],"tier_b":["..."],"tier_c":["..."]}}
bullets MUST have exactly 5 entries; image_brief MUST have exactly 7 entries; each ppc tier at least one. stage_ref must be one of: s1_vocab, s2_jobmap, s3_triggers, s4_objections, signature, canvas, decision_trigger. No markdown inside any string. No trailing commentary outside the JSON.
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
        if (user) console.log('[export-brief] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[export-brief] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const canvas = body?.canvas ?? null;
    const trigger = body?.trigger ?? null;
    const confirmedClaims: ConfirmedClaim[] = Array.isArray(body?.confirmed_claims) ? body.confirmed_claims : [];

    // The brief is written against the brand positioning. Priority: Canvas > Decision Trigger.
    // Signature is NOT a root (dropped from the chain per Matthew, 2026-07-08): with neither
    // Canvas nor Trigger we ask honestly rather than lean on a legacy signature row.
    if (canvas == null && trigger == null) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Create a Brand Canvas (generate_canvas) or identify a Decision Trigger (identify_decision_trigger) first, then run the Export Brief.',
            why: 'The title formula, bullets, image brief, and PPC tiers all derive from your brand positioning — held in the Brand Canvas or the Decision Trigger.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Root positioning block: canvas if present, else trigger.
    let canvasBlock: string;
    if (canvas != null) {
      canvasBlock = formatArtifact('BRAND CANVAS (the source of truth for voice and positioning)', canvas);
    } else {
      // Decision trigger is a partial root with only emotional lever + evidence, no full voice/positioning
      canvasBlock = formatArtifact('DECISION TRIGGER (partial positioning root — emotional lever and evidence phrases only; use stage_ref "decision_trigger" for elements citing this)', trigger);
    }
    const s1Block = formatArtifact('STAGE 1 VOCABULARY CLUSTERS', body?.s1 ?? body?.prior?.s1);
    const s3Block = formatArtifact('STAGE 3 DECISION TRIGGERS (for PPC tier A and bullet 1)', body?.s3 ?? body?.prior?.s3);
    const s4Block = formatArtifact('STAGE 4 OBJECTIONS (for risk reversal and bullet 2)', body?.s4 ?? body?.prior?.s4);
    const claimsBlock = formatClaims(confirmedClaims);

    const userParts: string[] = [canvasBlock];
    for (const block of [s1Block, s3Block, s4Block]) {
      if (block) userParts.push(block);
    }
    userParts.push(`CONFIRMED PRODUCT-TRUTH / POLICY CLAIMS (the ONLY product facts you may state — anything else is forbidden):\n${claimsBlock}`);
    userParts.push('Now compile the Export Brief. Return ONLY the JSON object.');

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
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [
          // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
          { role: 'user', content: userParts.join('\n\n') },
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[export-brief] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const parsed = parseBrief(rawText);

    if (!parsed) {
      console.error('[export-brief] No brief parsed from model output.');
      throw new Error('Could not parse the Export Brief from model output.');
    }

    const tf = (parsed.title_formula ?? {}) as Record<string, unknown>;
    const titleFormula = {
      brief: asStr(tf.brief),
      example_output: asStr(tf.example_output),
      product_truth_claims: toProductTruthClaims(tf.claims_used, confirmedClaims),
    };

    const rawBullets = Array.isArray(parsed.bullets) ? parsed.bullets : [];
    const bullets = rawBullets
      .map((b) => {
        const bb = (b ?? {}) as Record<string, unknown>;
        let stageRef = asStr(bb.stage_ref);
        if (!STAGE_REFS.includes(stageRef)) stageRef = 'canvas';
        return {
          element: asStr(bb.element),
          brief: asStr(bb.brief),
          example_output: asStr(bb.example_output),
          stage_ref: stageRef,
          product_truth_claims: toProductTruthClaims(bb.claims_used, confirmedClaims),
        };
      })
      .filter((b) => b.element && b.brief && b.example_output);

    const rawImages = Array.isArray(parsed.image_brief) ? parsed.image_brief : [];
    const imageBrief = rawImages
      .map((s) => {
        const ss = (s ?? {}) as Record<string, unknown>;
        return { slot: asStr(ss.slot), intent: asStr(ss.intent), brief: asStr(ss.brief) };
      })
      .filter((s) => s.slot && s.intent && s.brief);

    const ppc = (parsed.ppc_keywords ?? {}) as Record<string, unknown>;
    const ppcKeywords = {
      tier_a: asStrArray(ppc.tier_a),
      tier_b: asStrArray(ppc.tier_b),
      tier_c: asStrArray(ppc.tier_c),
    };

    // Shape enforcement mirroring the Phase-0 contract (5 bullets, 7 images, non-empty tiers).
    if (
      !titleFormula.brief ||
      !titleFormula.example_output ||
      bullets.length !== 5 ||
      imageBrief.length !== 7 ||
      ppcKeywords.tier_a.length === 0 ||
      ppcKeywords.tier_b.length === 0 ||
      ppcKeywords.tier_c.length === 0
    ) {
      console.error(
        `[export-brief] Incomplete brief: bullets=${bullets.length}, images=${imageBrief.length}, ` +
          `tiers=${ppcKeywords.tier_a.length}/${ppcKeywords.tier_b.length}/${ppcKeywords.tier_c.length}.`
      );
      throw new Error('Export Brief output was incomplete (expected 5 bullets, 7 image slots, 3 keyword tiers).');
    }

    // Root ref priority: canvas > trigger (signature is no longer a root).
    const rootRef = canvas != null ? 'brand_canvas' : 'decision_trigger';
    const evidenceRefs: Array<{ kind: string; ref: string }> = [
      { kind: 'artifact', ref: rootRef },
    ];
    if (body?.s3 ?? body?.prior?.s3) evidenceRefs.push({ kind: 'artifact', ref: 'avatar_s3_triggers' });
    if (body?.s4 ?? body?.prior?.s4) evidenceRefs.push({ kind: 'artifact', ref: 'avatar_s4_objections' });
    // Decision trigger contains verbatim evidence, so trigger-only should be 'evidence'
    const grounding = (evidenceRefs.length > 1 || trigger != null) ? 'evidence' : 'inference';

    const result = {
      title_formula: titleFormula,
      bullets,
      image_brief: imageBrief,
      ppc_keywords: ppcKeywords,
      grounding,
      evidence_refs: evidenceRefs,
    };

    console.log(`[export-brief] Returning brief (5 bullets, 7 images, grounding=${grounding}).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in export-brief function:', error);
    captureServerException('export-brief', error, { status_code: 500 });
    return new Response(
      JSON.stringify({ error: 'Unable to compile the Export Brief right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
