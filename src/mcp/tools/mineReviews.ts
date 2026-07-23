/**
 * Layer 2 (tool) — `mine_reviews` (deterministic review counting; Trevor's Review Mining skill).
 *
 * Turns a review corpus + a role-tagged keyword set into COUNTS: per-term theme table, an exact
 * de-duplicated hypothesis share, a validation verdict, and verbatim voice-of-customer fragments.
 * The counting is pure/deterministic (`service/reviewCounting.ts`, Calculation-Parity-safe); the
 * KEYWORD-SET DESIGN stays with the caller (the coach), per the skill — the LLM builds the 6-9
 * spoken-variant keywords, this tool does the arithmetic the LLM must never improvise.
 *
 * The corpus is supplied by the caller from evidence WE already fetched for the seller (Tier-0 /dp
 * enrichment today) — it is never the customer's homework to paste. Resolving the corpus from the
 * caller's stored evidence by ASIN/avatar is the follow-up once the contextResolver parity work
 * lands; today the caller passes the reviews it already holds in context.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { keywordRoleSchema } from '../contracts/reviewMining.js';
import { mineReviews } from '../service/reviewCounting.js';
import {
  MCP_RESPONSE_MINE_REVIEWS_MAX_KEYWORDS,
  MCP_RESPONSE_MINE_REVIEWS_MAX_INPUT_REVIEWS,
} from '../service/contextBudgets.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  hypothesis: z.string().min(1).describe('The positioning claim being tested, e.g. "customers experience this as thickening".'),
  keywords: z
    .array(z.object({ term: z.string().min(1), role: keywordRoleSchema }))
    .min(1)
    .max(MCP_RESPONSE_MINE_REVIEWS_MAX_KEYWORDS)
    .describe(
      'The 6-9 keyword set YOU design from the hypothesis (per the Review Mining skill): hypothesis terms in their spoken variants (thicker, thick, fuller — each tested separately), adjacent near-synonyms (volume), comparison/positioning terms (growth), secondary experience words (soft), and problem words (falling). Tag each with its role.',
    ),
  reviews: z
    .array(
      z.object({
        body: z.string(),
        rating: z.number().nullable().optional(),
        reviewer: z.string().nullable().optional(),
      }),
    )
    .describe('The review corpus to count over — reviews already fetched for this listing. The customer never pastes these.'),
  product_title: z.string().optional().describe('The listing title; any keyword appearing here is flagged name-inflated.'),
  written_reviews_total: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .describe('The true written-review base if known. When the corpus is smaller, shares are reported as a sample of this.'),
};

export function registerMineReviewsTool(server: McpServer): void {
  server.registerTool(
    'mine_reviews',
    {
      title: 'Mine reviews (count what customers say)',
      description:
        'Quantify what customers actually say in their reviews to VALIDATE or KILL a positioning hypothesis. You design a 6-9 keyword set from the hypothesis (spoken variants, near-synonyms, comparison/secondary/problem terms); this tool counts — distinct reviews per term (thick and thicker counted separately), the exact de-duplicated share of reviews using the hypothesis language, a verdict (>=20% validated / 10-20% supportive / <10% real-but-not-felt / 0 absent), and 3-5 VERBATIM voice-of-customer fragments. Counts and quotes trace only to the supplied reviews — nothing is invented. Reports shares honestly as "of the reviews we read" when the corpus is a sample of a larger base.',
      inputSchema,
    },
    async ({ hypothesis, keywords, reviews, product_title, written_reviews_total }) => {
      // Clamp the corpus to the per-call ceiling (caller input, never trusted unclamped).
      const corpus = reviews.slice(0, MCP_RESPONSE_MINE_REVIEWS_MAX_INPUT_REVIEWS);
      const result = mineReviews({
        hypothesis,
        keywords,
        reviews: corpus.map((r) => ({ body: r.body, rating: r.rating ?? null, reviewer: r.reviewer ?? null })),
        productTitle: product_title,
        writtenReviewsTotal: written_reviews_total ?? null,
      });
      const truncated = reviews.length > corpus.length;
      safeLog({
        event: 'tool.mine_reviews',
        caller: userTag(getIdentity()),
        keywords: keywords.length,
        reviews_in: reviews.length,
        reviews_scanned: corpus.length,
        verdict: result.verdict.level,
      });
      if (truncated) {
        result.cautions.push(
          `Only the first ${corpus.length} of ${reviews.length} supplied reviews were counted (per-call cap).`,
        );
      }
      const text =
        `${result.verdict.statement}\n\n` +
        JSON.stringify(result, null, 2);
      return {
        content: [{ type: 'text' as const, text }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
