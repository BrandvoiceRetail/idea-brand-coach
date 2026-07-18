/**
 * Layer 2 (tool) — `ensure_brand` (WRITE, gateWrite — brand bootstrap).
 *
 * Guarantees the authenticated caller has a brand row so the avatar / funnel / evidence / diagnostic
 * tools stop failing with "no brand found". Idempotent (create-if-missing) and brand-row-only: it does
 * NOT create the account (app signup owns auth — the JWT must already be valid to reach here) and does
 * NOT seed avatars or context. Instead it hands off into the coach's engaged, one-question-at-a-time
 * extraction (recognition before extraction — ONBOARDING_VOICE_TREVOR), or the "connect your data"
 * path (run_onboarding → Windsor). Call this FIRST for a brand-new caller, before create_avatar /
 * upsert_funnel_touchpoint. Identity-gated (gateWrite).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ensureBrand, BrandLifecycleError } from '../service/brandLifecycle.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  brand_name: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Optional brand name. If omitted, a provisional "My Brand" is created and can be renamed later. ' +
        'Nothing else is seeded — no avatars, no context; the coach captures those conversationally.',
    ),
};

export function registerEnsureBrandTool(server: McpServer): void {
  server.registerTool(
    'ensure_brand',
    {
      title: 'Ensure a brand exists',
      description:
        'Write tool: guarantee the authenticated caller has a brand (create-if-missing, idempotent) so ' +
        'create_avatar / upsert_funnel_touchpoint / ingest_evidence and the diagnostic can run. brand_name ' +
        'is optional (defaults to a provisional "My Brand", renamable later); nothing else is seeded — the ' +
        'coach captures the avatar and context conversationally. Does NOT create an account (app signup owns ' +
        'auth). Call this FIRST for a brand-new caller who has no brand yet, before any brand-scoped write. ' +
        'Requires an authenticated Supabase JWT; RLS-scoped to the caller.',
      inputSchema,
    },
    async ({ brand_name }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const { brand, created } = await ensureBrand(brand_name);

        // Recognition before extraction (ONBOARDING_VOICE_TREVOR): one warm ask, no jargon. On a
        // fresh brand, point at the first thing that unlocks everything — who the buyer actually is.
        const invite = created
          ? "You're set up — this is your workspace now. To make anything I hand you actually land, I need to " +
            'see who you\'re selling to. When someone lands on your page and does not buy, who did you picture ' +
            'them being — and what do you think stops them?'
          : `You're already set up${brand.name ? ` — “${brand.name}”` : ''}. Let's pick up where it counts: ` +
            'when a first-time shopper hits your listing, where do you think their confidence leaks first?';

        safeLog({ event: 'tool.ensure_brand', caller: userTag(identity), created });
        captureMcpEvent(identity.userId as string, 'mcp_brand_ensured', { created });

        return {
          content: [
            {
              type: 'text' as const,
              text: created
                ? `Created your brand workspace “${brand.name}”. ${invite}`
                : `Brand workspace ready (“${brand.name}”). ${invite}`,
            },
          ],
          structuredContent: {
            ok: true,
            brand,
            created,
            nextAction: { invite, options: ['extract_context', 'connect_data'] },
          },
        };
      } catch (err) {
        const note = err instanceof BrandLifecycleError ? err.message : 'failed to ensure brand';
        safeLog({ level: 'warn', event: 'tool.ensure_brand.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not set up your brand workspace: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
