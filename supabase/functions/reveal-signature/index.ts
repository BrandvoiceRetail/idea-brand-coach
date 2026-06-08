import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * reveal-signature
 *
 * Synthesises 3-4 DISTINCT "Signature" options for the Brand Coach — the
 * recognition moment. A Signature names the deeper truth of what a customer is
 * REALLY buying, in Trevor's voice ("My customer isn't buying X. They're buying Y").
 *
 * Cloned from brand-ai-assistant (CORS, JWT->getUser, prompt caching, try/catch).
 * Uses Claude SONNET. Returns JSON: { options: string[], usedReviews, inference }.
 *
 * TOP-LEVEL FAILURE MODE — DO NOT PARROT:
 * The Signature reuses the customer's emotional VOCABULARY but must synthesise a
 * TRUTH they had NOT articulated. If every claim traces verbatim to the user's
 * own words, it has FAILED (that is a summary, not an insight).
 */

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
// Match the model used by the working idea-framework-consultant-claude function.
const SONNET_MODEL = 'claude-sonnet-4-20250514';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationTurn {
  role: string;
  content: string;
}

/**
 * Format the chat conversation into a readable transcript for the model.
 * Long transcripts are truncated to the most recent turns to control tokens.
 */
function formatConversation(conversation: ConversationTurn[]): string {
  if (!Array.isArray(conversation) || conversation.length === 0) return '';
  const recent = conversation.slice(-24);
  return recent
    .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim())
    .map((turn) => `${turn.role === 'user' ? 'USER' : 'TREVOR'}: ${turn.content.trim()}`)
    .join('\n\n');
}

/**
 * Format extracted brand fields into a labelled block.
 */
function formatFields(fields: Record<string, unknown> | undefined): string {
  if (!fields || typeof fields !== 'object') return '';
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    if (!text.trim()) continue;
    lines.push(`- ${key}: ${text.trim()}`);
  }
  return lines.join('\n');
}

/**
 * Build the system prompt. Includes Trevor voice rules, the no-parroting failure
 * mode, the four InfinityVault mockup Signatures as few-shot, and the JSON contract.
 */
function buildSystemPrompt(hasReviews: boolean): string {
  return `<persona>
You are Trevor, a BMAD brand coach. You have just guided a founder through a discovery conversation about their customer. Now you reveal the SIGNATURE: the single deeper truth of what their customer is REALLY buying.
</persona>

<what-a-signature-is>
A Signature is one sentence in the shape: "My customer isn't buying X. They're buying Y."
- X is the literal product or commodity (a card binder, storage, pages and sleeves).
- Y is the emotional or identity truth underneath the purchase — the thing they would never say out loud but would recognise instantly as true.
A Signature is the retention moment. It works ONLY if the founder reads it and thinks: "That is exactly right, and I had never put it that way myself."
</what-a-signature-is>

<critical-failure-mode>
DO NOT rephrase the user's own words back to them. Reuse the customer's emotional VOCABULARY, but synthesise a TRUTH they had NOT articulated.
If every claim in a Signature traces VERBATIM to what the user wrote or pasted, it has FAILED — that is a summary, not an insight.

BAD (parroting): user says "collections getting too big to manage" -> "they're buying a way to manage their growing collection". This just hands their words back. FORBIDDEN.
GOOD (insight): -> "they're buying the moment a chaotic, overflowing collection finally feels like a collection". The vocabulary is theirs; the truth is new.

Every option you produce must clear this bar: vocabulary borrowed, truth newly named.
</critical-failure-mode>

<voice-rules>
- Write in Trevor's voice: confident, collector-to-collector / peer-to-peer, never seller-to-buyer.
- NEVER use asterisks, markdown, bold, or headings.
- NEVER use em dashes. Use full stops or commas.
- Use UK English spelling.
- Use CAPITAL LETTERS only sparingly, for genuine emphasis.
- No emojis, no hype, no exclamation marks, no vague superlatives.
- Each option is two short sentences: the "isn't buying X" sentence, then the "they're buying Y" sentence. It may be a single flowing sentence if that lands harder.
</voice-rules>

<few-shot-example>
This is the worked InfinityVault example (premium trading card binders). The customer's own unprompted review vocabulary clustered into: protection / damage anxiety (scratch, dent, ding, slip out), capacity / consolidation (fits everything, one binder, finally, ran out of room), quality / dignity (premium, feels expensive, not cheap), display / pride (show off, proud, take to shows), identity / seriousness (serious collector, real collector), ritual / pleasure (love opening it, satisfying).

From that vocabulary, these four DISTINCT Signatures were synthesised. Notice each borrows the vocabulary but names a truth the customer never stated:

1. My customer isn't buying a card binder. They're buying the certainty that everything they've spent years building won't be lost in an instant.
2. My customer isn't buying storage. They're buying the dignity of being taken seriously as a collector, by themselves and by anyone who flips through.
3. My customer isn't buying a binder. They're buying the moment a chaotic, overflowing collection finally feels like a collection.
4. My customer isn't buying pages and sleeves. They're buying permission to keep collecting without the quiet guilt that they're not taking care of it properly.

Note how the four options come at the truth from DIFFERENT angles (loss/certainty, dignity/identity, order/relief, permission/guilt). They do not overlap. Produce options with that same spread.
</few-shot-example>

<distinctness-requirement>
Each option must come at a genuinely DIFFERENT emotional angle from the others. Do not produce four rewordings of the same idea. If the data only supports three genuinely distinct truths, return three. Only return four when a fourth is a real, non-redundant angle and not a stretch.
</distinctness-requirement>

${hasReviews
  ? `<reviews-provided>
The founder has pasted real customer reviews. Mine them for unprompted emotional vocabulary, recurring fears, and the language customers actually use. Borrow that vocabulary. Ground each Signature in what the evidence shows, then name the truth beneath it.
</reviews-provided>`
  : `<no-reviews-provided>
No customer reviews were pasted. You are working from the conversation and extracted fields alone, which means these Signatures are INFORMED INFERENCE, not evidence-backed. Keep them plausible and grounded in what was actually discussed. Do not invent specific customer quotes or fabricate review language.
</no-reviews-provided>`}

<output-contract>
Respond with ONLY a JSON object, no preamble and no code fences:
{"options": ["<signature 1>", "<signature 2>", "<signature 3>"]}
Provide 3 or 4 strings. Each string is one Signature in Trevor's voice. No markdown inside the strings. No trailing commentary outside the JSON.
</output-contract>`;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    // Authenticate user (optional — used for logging / RLS parity with siblings)
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseClient.auth.getUser(token);
        if (user) {
          console.log('[reveal-signature] Authenticated user:', user.id);
        }
      } catch (authErr) {
        console.log('[reveal-signature] Auth lookup failed (non-fatal):', authErr);
      }
    }

    const body = await req.json();
    const conversation: ConversationTurn[] = Array.isArray(body?.conversation) ? body.conversation : [];
    const fields: Record<string, unknown> = body?.fields ?? {};
    const reviews: string = typeof body?.reviews === 'string' ? body.reviews : '';

    const conversationText = formatConversation(conversation);
    const fieldsText = formatFields(fields);
    const reviewsText = reviews.trim();
    const hasReviews = reviewsText.length > 0;

    // Cap pasted reviews to keep the request within sane token limits.
    const reviewsForPrompt = reviewsText.slice(0, 12000);

    const userMessageParts: string[] = [];
    if (fieldsText) {
      userMessageParts.push(`WHAT WE HAVE LEARNED ABOUT THE BRAND AND CUSTOMER (extracted fields):\n${fieldsText}`);
    }
    if (conversationText) {
      userMessageParts.push(`THE DISCOVERY CONVERSATION SO FAR:\n${conversationText}`);
    }
    if (hasReviews) {
      userMessageParts.push(`CUSTOMER REVIEWS THE FOUNDER PASTED (the strongest evidence — mine the vocabulary):\n${reviewsForPrompt}`);
    }
    if (userMessageParts.length === 0) {
      userMessageParts.push('No discovery detail was provided. Decline gracefully.');
    }
    userMessageParts.push('Now reveal 3 to 4 DISTINCT Signature options. Return ONLY the JSON object.');

    const systemPrompt = buildSystemPrompt(hasReviews);

    const usePromptCaching = systemPrompt.length > 1000;
    const headers: Record<string, string> = {
      'x-api-key': anthropicApiKey!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
    if (usePromptCaching) {
      headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
    }

    const systemContent = usePromptCaching
      ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
      : systemPrompt;

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1024,
        system: systemContent,
        messages: [
          { role: 'user', content: userMessageParts.join('\n\n') },
          // Prefill forces a JSON object response and suppresses preamble.
          { role: 'assistant', content: '{"options":' },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[reveal-signature] Anthropic API error:', response.status, errorBody);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text ?? '';
    // Reconstruct the full JSON object (the prefill is not echoed back by the API).
    const reconstructed = `{"options":${rawText}`;

    let options: string[] = [];
    try {
      const parsed = JSON.parse(reconstructed);
      if (Array.isArray(parsed?.options)) {
        options = parsed.options;
      }
    } catch {
      // Fallback: salvage the first JSON object found in the raw text.
      const match = reconstructed.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed?.options)) options = parsed.options;
        } catch (innerErr) {
          console.error('[reveal-signature] JSON salvage failed:', innerErr);
        }
      }
    }

    // Normalise: strings only, trimmed, non-empty, max 4.
    options = options
      .filter((o): o is string => typeof o === 'string')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
      .slice(0, 4);

    if (options.length === 0) {
      console.error('[reveal-signature] No options parsed from model output:', rawText.slice(0, 500));
      throw new Error('Could not parse Signature options from model output.');
    }

    console.log(`[reveal-signature] Returning ${options.length} options (hasReviews=${hasReviews})`);

    return new Response(
      JSON.stringify({ options, usedReviews: hasReviews, inference: !hasReviews }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in reveal-signature function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to reveal your Signature right now. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
