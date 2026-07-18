/**
 * Layer 2 (tool) — `generate_positioning_statement` (OWNED, convenience diagnostic).
 *
 * VERBATIM wrap of the existing `reveal-positioning-statement` edge fn (Calculation Parity):
 * the engine-facing fields ({conversation?, fields?, reviews?}) are passed through
 * untouched and the frozen no-parroting prompt does the synthesis, so MCP output is
 * identical to the in-app reveal. Requires an authenticated Supabase JWT (EdgeFnClient
 * is JWT-gated).
 *
 * The edge fn returns `{ options: string[], usedReviews, inference }`. We map the flat
 * string list into the `positioningStatementContract` row shape (`{option, sentence}[]`, 1-based)
 * and attach a grounding envelope: `usedReviews` ⇒ evidence, else inference (this is
 * exactly the engine's own `inference` discipline, surfaced to the artifact contract).
 *
 * CONTEXT-BUNDLE FALLBACK (D2 / R-015 — gated): if the caller supplies NONE of
 * conversation/fields/reviews, we read the current `evidence_snapshots` row for the
 * scope and feed its reviews to the engine. Per the manifest argument this preserves
 * no-parroting (customer review vocabulary ≠ the founder's own words); the OPERATOR
 * must sign off the R-015 reading before the avatar pipeline auto-feeds S5. This tool
 * exposes the seam but is read-only and never persists — persistence is `persist_positioning_statement`.
 *
 * HISTORY: formerly `generate_signature` wrapping the `reveal-signature` edge fn; renamed to
 * Positioning Statement in the 2026-07 taxonomy cleanup (the synthesis engine itself is unchanged).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import type { PositioningStatementOption } from '../contracts/index.js';
import { getUserSupabase, UnauthenticatedError } from '../supabaseUser.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const EVIDENCE_SNAPSHOTS_TABLE = 'evidence_snapshots';

interface RevealPositioningStatementResponse {
  options: string[];
  usedReviews: boolean;
  inference: boolean;
}

const conversationTurnSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const inputSchema = {
  conversation: z
    .array(conversationTurnSchema)
    .optional()
    .describe('Discovery conversation turns ({role, content}). Optional — the engine accepts conversation OR fields OR reviews.'),
  fields: z
    .record(z.unknown())
    .optional()
    .describe('Extracted brand/customer fields (key -> value) to ground the synthesis.'),
  reviews: z
    .string()
    .optional()
    .describe('Pasted real customer reviews — the strongest evidence; the engine mines the vocabulary.'),
  avatar_id: z
    .string()
    .optional()
    .describe('Avatar scope used only by the context-bundle fallback (reads the current evidence snapshot).'),
};

/** Pull plausible review text out of an evidence_snapshots `reviews` jsonb payload. */
function extractReviewText(reviews: unknown): string {
  if (typeof reviews === 'string') return reviews;
  if (!Array.isArray(reviews)) return '';
  const parts: string[] = [];
  for (const entry of reviews) {
    if (typeof entry === 'string') {
      parts.push(entry);
    } else if (entry && typeof entry === 'object') {
      const text = (entry as { text?: unknown; body?: unknown; review?: unknown }).text
        ?? (entry as { body?: unknown }).body
        ?? (entry as { review?: unknown }).review;
      if (typeof text === 'string' && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join('\n\n');
}

/**
 * Context-bundle fallback: read the current evidence snapshot for the scope and return
 * its reviews as pasteable text (empty string if no snapshot / no reviews / anonymous).
 */
async function fetchEvidenceReviews(avatarId: string | undefined): Promise<string> {
  let supabase;
  try {
    supabase = getUserSupabase();
  } catch (err) {
    if (err instanceof UnauthenticatedError) return '';
    throw err;
  }
  let query = supabase.from(EVIDENCE_SNAPSHOTS_TABLE).select('reviews');
  query = avatarId == null ? query.is('avatar_id', null) : query.eq('avatar_id', avatarId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return '';
  return extractReviewText((data as { reviews?: unknown }).reviews);
}

export function registerGeneratePositioningStatementTool(server: McpServer, edgeFn: EdgeFnClient): void {
  server.registerTool(
    'generate_positioning_statement',
    {
      title: 'Reveal Positioning Statement options',
      description:
        'Convenience diagnostic: reveal 3-4 distinct on-brand Positioning Statement options ("My customer isn\'t buying X, they\'re buying Y") via the existing reveal-positioning-statement engine, wrapped verbatim (Calculation Parity — the frozen no-parroting prompt is unchanged). Accepts conversation OR fields OR reviews; if all are empty it falls back to the current evidence snapshot for the scope (context-bundle grounding — D2/R-015 reading: customer review vocabulary is not the founder\'s own words; operator must sign off before the avatar pipeline auto-feeds this). Requires an authenticated Supabase JWT. Read-only — persist a chosen option with persist_positioning_statement.',
      inputSchema,
    },
    async ({ conversation, fields, reviews, avatar_id }) => {
      const conversationProvided = Array.isArray(conversation) && conversation.length > 0;
      const fieldsProvided = !!fields && Object.keys(fields).length > 0;
      const reviewsProvided = typeof reviews === 'string' && reviews.trim().length > 0;

      // D2 fallback: nothing supplied -> synthesize a context bundle from persisted evidence.
      let reviewsForEngine = reviewsProvided ? (reviews as string) : '';
      let usedContextBundle = false;
      if (!conversationProvided && !fieldsProvided && !reviewsProvided) {
        reviewsForEngine = await fetchEvidenceReviews(avatar_id);
        usedContextBundle = reviewsForEngine.trim().length > 0;
      }

      const res = await edgeFn.invoke<RevealPositioningStatementResponse>('reveal-positioning-statement', {
        conversation: conversationProvided ? conversation : [],
        fields: fieldsProvided ? fields : {},
        reviews: reviewsForEngine,
      });

      if (!res.ok || !Array.isArray(res.data?.options) || res.data.options.length === 0) {
        safeLog({ level: 'warn', event: 'tool.generate_positioning_statement.unavailable', caller: userTag(getIdentity()) });
        return {
          content: [{ type: 'text' as const, text: `generate_positioning_statement unavailable: ${res.note ?? 'empty engine reply'}` }],
          structuredContent: { ok: false, options: [], note: res.note ?? 'empty engine reply' },
        };
      }

      const options: PositioningStatementOption[] = res.data.options.map((sentence, index) => ({
        option: index + 1,
        sentence,
      }));
      const usedReviews = res.data.usedReviews === true;
      const grounding = usedReviews ? 'evidence' : 'inference';

      safeLog({
        event: 'tool.generate_positioning_statement',
        caller: userTag(getIdentity()),
        count: options.length,
        usedReviews,
        usedContextBundle,
      });
      captureMcpEvent(getIdentity().userId ?? 'anon', 'mcp_positioning_statement_generated', {
        options_count: options.length,
        grounding,
        used_reviews: usedReviews,
        used_context_bundle: usedContextBundle,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(options, null, 2) }],
        structuredContent: {
          ok: true,
          options,
          grounding,
          used_reviews: usedReviews,
          inference: res.data.inference === true,
          used_context_bundle: usedContextBundle,
        },
      };
    },
  );
}
