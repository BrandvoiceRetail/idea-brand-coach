/**
 * Layer 2 (tool) — `run_onboarding` (OWNED, READ + director).
 *
 * The coach calls this instead of asking the user to paste an onboarding prompt:
 *   • when the user has NOT onboarded yet (no funnel data), or
 *   • when the user explicitly asks to onboard / set up / re-run onboarding.
 * It reports the caller's onboarding state (RLS-scoped) and returns the ordered
 * playbook the host then executes (pull full Windsor history → create pieces →
 * ingest → Trust Gap). Idempotent: when already onboarded it returns the lighter
 * REFRESH path unless `force` is set. The server never reads Windsor itself — the
 * host does the pull + calls the ingest tools per the returned playbook.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runOnboarding, OnboardingError } from '../service/onboardingState.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  force: z
    .boolean()
    .optional()
    .describe('Re-run full onboarding from scratch even if the brand is already set up (e.g. the user explicitly asks to start over). Defaults to false → returns the lighter refresh path when already onboarded.'),
};

export function registerRunOnboardingTool(server: McpServer): void {
  server.registerTool(
    'run_onboarding',
    {
      title: 'Run onboarding (set up the brand + pull analytics)',
      description:
        'DIRECTOR — RUN the full onboarding sequence. CALL THIS — do not ask the user to paste a prompt — whenever the user has not onboarded yet (no funnel data) OR asks to onboard / set up / re-run onboarding. Returns the user\'s onboarding state plus an ordered PLAYBOOK to EXECUTE now: read brand context, create the funnel pieces, check Windsor get_connectors (pull the FULL history each connected source allows at daily granularity, and prompt the user to enable registered-but-off connectors), ingest the metrics against each piece (mark "—" never fabricate), then run the Trust Gap and name the weakest piece. Idempotent: already-onboarded returns a lighter refresh path unless force=true. RLS-scoped; requires a Supabase bearer token. NOTE: this is the heavyweight director that runs the whole sequence — if you only need a quick read of where the user stands and their single warm next step (no analytics pull, no playbook), call `onboard_status` instead.',
      inputSchema,
    },
    async ({ force }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: onboarding works on your own brand data. Sign in (send a Supabase bearer token) and try again.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const result = await runOnboarding(force ?? false);
        safeLog({
          event: 'tool.run_onboarding',
          caller: userTag(identity),
          already_onboarded: result.already_onboarded,
          next: result.next,
          force: force ?? false,
        });
        return {
          content: [{ type: 'text' as const, text: `${result.summary}\n\n${result.playbook}` }],
          structuredContent: { ...result },
        };
      } catch (err) {
        const message = err instanceof OnboardingError ? err.message : 'onboarding could not start';
        safeLog({ event: 'tool.run_onboarding.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not start onboarding: ${message}. Please try again.` }],
          structuredContent: { ok: false, note: 'onboarding error' },
          isError: true,
        };
      }
    },
  );
}
