import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * brand-canvas  (gold Workbook A, sheet 5 "Brand Canvas")
 *
 * Synthesises the one-page Brand Canvas from the chosen Signature + the Avatar 2.0
 * S1-S4 forensic artifacts + owner-intent (positioning intent, voice preferences,
 * brand story). The canvas is the source of truth every downstream copy artifact
 * (the Export Brief) is written against.
 *
 * Cloned from reveal-signature / avatar-jobmap (CORS, optional JWT->getUser, Anthropic
 * SONNET with prompt caching, strict JSON contract + value-level assistant prefill,
 * tolerant defensive parse, evidence-vs-inference branch, needs_input on missing input).
 *
 * Output contract (Phase-0 `brand_canvas`):
 *   { signature, positioning:{category,position,promise,villain,identity_payoff},
 *     voice:{voice_attributes,tone_dos,tone_donts,words_we_use[],words_we_dont[]},
 *     story_spine, grounding:'evidence'|'inference', evidence_refs:[{kind,ref}] }
 *
 * GROUNDING: the canvas is SYNTHESIS over the chosen Signature + S1-S4. When those
 * artifacts are supplied (the chain has run on evidence) the canvas is grounding='evidence'
 * and cites the chain artifacts. Without a Signature it returns needs_input (the canvas
 * is built around the Signature line). The voice/positioning are FREE creative synthesis
 * grounded in the customer vocabulary; no PRODUCT-TRUTH claims live in the canvas (those
 * are gated downstream in the Export Brief), so there is no substring grounding gate here.
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Render the chosen Signature (string or {options, chosen_option} artifact) into a line. */
function formatSignature(signature: unknown): string {
  if (typeof signature === 'string') return signature.trim();
  if (signature && typeof signature === 'object') {
    const sig = signature as { options?: unknown; chosen_option?: number };
    if (Array.isArray(sig.options)) {
      const opts = sig.options as Array<{ option?: number; sentence?: string }>;
      const chosen = typeof sig.chosen_option === 'number'
        ? opts.find((o) => o.option === sig.chosen_option)
        : undefined;
      if (chosen?.sentence) return chosen.sentence.trim();
      // No explicit pick: present the candidates so the model can anchor on them.
      return opts.map((o) => (typeof o.sentence === 'string' ? o.sentence.trim() : '')).filter(Boolean).join('\n');
    }
  }
  return '';
}

/** Render a forensic artifact's content into a compact labelled block. */
function formatArtifact(label: string, content: unknown): string {
  if (content == null) return '';
  try {
    return `${label}:\n${JSON.stringify(content, null, 1)}`;
  } catch {
    return '';
  }
}

/** Render the owner-intent fields into a labelled block (positioning, voice, story). */
function formatOwnerIntent(intent: Record<string, unknown> | undefined): string {
  if (!intent || typeof intent !== 'object') return '';
  const lines: string[] = [];
  for (const [key, value] of Object.entries(intent)) {
    if (value == null) continue;
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    if (!text.trim()) continue;
    lines.push(`- ${key}: ${text.trim()}`);
  }
  return lines.join('\n');
}

/**
 * Tolerant parse of the canvas object. The assistant turn is prefilled value-level
 * (`{"signature":`), so the model emits the rest of the object; reconstruct the wrapper
 * and repair the residual truncation/trailing-brace quirks, with a brace-scan fallback.
 * Never throws; returns null when nothing parses into an object with a signature.
 */
function parseCanvas(rawText: string): Record<string, unknown> | null {
  const candidates: string[] = [
    // Without the prefill (Sonnet 4.6 rejects it) the model returns the full
    // object — try the raw text (fences stripped) before the fragment repairs.
    rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    `{"signature":${rawText}`,
  ];
  const lastBrace = rawText.lastIndexOf('}');
  if (lastBrace !== -1) {
    candidates.push(`{"signature":${rawText.slice(0, lastBrace + 1)}`);
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'signature' in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next reconstruction
    }
  }
  // Fallback: brace-scan the largest complete object (string-aware).
  for (const obj of extractBalancedObjects(`{"signature":${rawText}`)) {
    try {
      const parsed = JSON.parse(obj);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'signature' in parsed) {
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

/** Coerce a value into a non-empty trimmed string, or '' if not a usable string. */
function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Coerce a value into a string[] of non-empty trimmed terms. */
function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => s.length > 0);
}

function buildSystemPrompt(): string {
  return `<persona>
You are a brand strategist inside a BMAD brand coach. You take a completed Avatar 2.0 forensic build (vocabulary clusters, desired state mapping, decision triggers, objections) and a chosen Signature, and you compile the one-page Brand Canvas. The canvas is the source of truth every downstream piece of content is written against.
</persona>

<what-this-is>
The Brand Canvas has two panes plus a Signature line and a story spine.
- The Signature line: the chosen "My customer isn't buying X, they're buying Y" sentence, carried through verbatim as the spine of everything.
- Positioning pane:
  - category: the literal product category.
  - position: the one sentence that says who this is for and when they reach for it.
  - promise: the concrete promise, phrased as the relief of the customer's stated fear.
  - villain: the enemy / failure state, drawn from the S2 desired state mapping's villain.
  - identity_payoff: the "from X to Y" identity shift the purchase delivers.
- Voice pane:
  - voice_attributes: how the brand sounds (collector-to-collector, peer-to-peer).
  - tone_dos: what the voice always does.
  - tone_donts: what the voice never does.
  - words_we_use: the specific words drawn from the customer's own vocabulary clusters.
  - words_we_dont: the words that break the positioning (cheap, basic, starter, etc.).
- story_spine: a short brand-story paragraph for A+ content, the About section, and ad lead-ins.
</what-this-is>

<grounding-rule>
Build the canvas ONLY from the supplied Signature, forensic artifacts, and owner intent. The promise must answer the objections; the villain must be the S2 desired-state villain; words_we_use must be drawn from the S1 vocabulary clusters. Do NOT invent product facts (capacity numbers, materials, compatibility, guarantees) here. The canvas is positioning and voice, not product claims. If owner voice/story preferences are supplied, honour them.
</grounding-rule>

<voice-rules>
- NEVER use asterisks, markdown, bold, or headings inside any string value.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling. No emojis, no hype, no exclamation marks.
- words_we_use and words_we_dont are arrays of single words or short phrases.
</voice-rules>

<few-shot-example>
For premium trading card binders (illustrative shape only, do not copy these words unless the inputs support them):
{"signature":"My customer isn't buying a binder. They're buying the certainty that everything they've built won't be lost in an instant.","positioning":{"category":"Premium trading card binders and accessories","position":"The binder serious collectors choose when their collection has outgrown anything from the gaming aisle.","promise":"No dimples. No slips. No second-guessing whether your grail card is safe.","villain":"The cheap big-box binder that dimples corners and the false economy that buys it.","identity_payoff":"From 'I'm not sure my cards are safe' to 'My collection is exactly where it should be.'"},"voice":{"voice_attributes":"Confident without bragging. Knows the hobby. Speaks collector-to-collector, not seller-to-buyer.","tone_dos":"Specific, warm, evidence-led. Name the situation, acknowledge the feeling, point to construction.","tone_donts":"Hype, fake scarcity, vague superlatives, influencer exclamation marks.","words_we_use":["collection","grail","chase","slab","sleeve","dignity","finally","serious","protect"],"words_we_dont":["cheap","basic","kids","simple","just","starter"]},"story_spine":"InfinityVault started because the binder a serious collection deserves did not exist on Amazon. We build for the collector whose hobby has outgrown the gaming aisle."}
</few-shot-example>

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"signature":"...","positioning":{"category":"...","position":"...","promise":"...","villain":"...","identity_payoff":"..."},"voice":{"voice_attributes":"...","tone_dos":"...","tone_donts":"...","words_we_use":["..."],"words_we_dont":["..."]},"story_spine":"..."}
Every field must be present and non-empty. words_we_use and words_we_dont must each have at least one entry. No markdown inside any string. No trailing commentary outside the JSON.
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
        if (user) console.log('[brand-canvas] Authenticated user:', user.id);
      } catch (authErr) {
        console.log('[brand-canvas] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const signatureText = formatSignature(body?.signature);

    // The canvas is built around the chosen Signature; without it, ask.
    if (!signatureText) {
      return new Response(
        JSON.stringify({
          needs_input: [{
            slot: 1,
            question: 'Choose a Signature first (run the Avatar chain through S5 and pick one), or supply the chosen Signature sentence. The Brand Canvas is built around the Signature line.',
            why: 'The canvas positioning, promise, and story spine all derive from the chosen Signature.',
          }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const s1Block = formatArtifact('STAGE 1 VOCABULARY CLUSTERS', body?.s1 ?? body?.prior?.s1);
    const s2Block = formatArtifact('STAGE 2 DESIRED STATE + VILLAIN', body?.s2 ?? body?.prior?.s2);
    const s3Block = formatArtifact('STAGE 3 DECISION TRIGGERS', body?.s3 ?? body?.prior?.s3);
    const s4Block = formatArtifact('STAGE 4 OBJECTIONS', body?.s4 ?? body?.prior?.s4);
    const intentBlock = formatOwnerIntent(body?.owner_intent);

    const userParts: string[] = [`THE CHOSEN SIGNATURE (the spine of the canvas):\n${signatureText}`];
    for (const block of [s1Block, s2Block, s3Block, s4Block]) {
      if (block) userParts.push(block);
    }
    if (intentBlock) {
      userParts.push(`OWNER INTENT (positioning, voice preferences, brand story — honour these):\n${intentBlock}`);
    }
    userParts.push('Now compile the Brand Canvas. Return ONLY the JSON object.');

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
          { role: 'user', content: userParts.join('\n\n') },
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[brand-canvas] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    const parsed = parseCanvas(rawText);

    if (!parsed) {
      console.error('[brand-canvas] No canvas parsed from model output.');
      throw new Error('Could not parse the Brand Canvas from model output.');
    }

    const positioning = (parsed.positioning ?? {}) as Record<string, unknown>;
    const voice = (parsed.voice ?? {}) as Record<string, unknown>;
    const cleaned = {
      signature: asStr(parsed.signature) || signatureText,
      positioning: {
        category: asStr(positioning.category),
        position: asStr(positioning.position),
        promise: asStr(positioning.promise),
        villain: asStr(positioning.villain),
        identity_payoff: asStr(positioning.identity_payoff),
      },
      voice: {
        voice_attributes: asStr(voice.voice_attributes),
        tone_dos: asStr(voice.tone_dos),
        tone_donts: asStr(voice.tone_donts),
        words_we_use: asStrArray(voice.words_we_use),
        words_we_dont: asStrArray(voice.words_we_dont),
      },
      story_spine: asStr(parsed.story_spine),
    };

    // Validate every required field is present (mirror the Phase-0 contract's min(1)).
    const positioningOk = Object.values(cleaned.positioning).every((v) => v.length > 0);
    const voiceOk =
      cleaned.voice.voice_attributes &&
      cleaned.voice.tone_dos &&
      cleaned.voice.tone_donts &&
      cleaned.voice.words_we_use.length > 0 &&
      cleaned.voice.words_we_dont.length > 0;
    if (!cleaned.signature || !cleaned.story_spine || !positioningOk || !voiceOk) {
      console.error('[brand-canvas] Canvas missing required fields after cleaning.');
      throw new Error('Brand Canvas output was incomplete.');
    }

    // EVIDENCE when the forensic chain grounded it; INFERENCE when working from the
    // Signature alone. evidence_refs cite whichever chain artifacts were supplied.
    const evidenceRefs: Array<{ kind: string; ref: string }> = [];
    if (body?.s1 ?? body?.prior?.s1) evidenceRefs.push({ kind: 'artifact', ref: 'avatar_s1_vocab' });
    if (body?.s2 ?? body?.prior?.s2) evidenceRefs.push({ kind: 'artifact', ref: 'avatar_s2_jobmap' });
    if (body?.s4 ?? body?.prior?.s4) evidenceRefs.push({ kind: 'artifact', ref: 'avatar_s4_objections' });
    if (evidenceRefs.length === 0) evidenceRefs.push({ kind: 'artifact', ref: 'signature' });
    const grounding = evidenceRefs.some((r) => r.ref !== 'signature') ? 'evidence' : 'inference';

    const result = { ...cleaned, grounding, evidence_refs: evidenceRefs };
    console.log(`[brand-canvas] Returning canvas (grounding=${grounding}, refs=${evidenceRefs.length}).`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in brand-canvas function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to compile the Brand Canvas right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
