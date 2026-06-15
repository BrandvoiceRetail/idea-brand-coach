/**
 * Write-tool authorization gate (D5 resolution, brand-coach side).
 *
 * IV-OS is single-tenant/no-auth (its ADR 0001), so accountability for consumed
 * ledger WRITES lives at this gateway: a write tool runs only for callers with a
 * verified Supabase identity, and every write is attributed to the caller's
 * non-reversible tag (`brand-coach-mcp:<userTag>`) as the ledger actor.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getIdentity, userTag, type Identity } from '../context/identity.js';

/** Ledger actor string for the current caller (never contains the raw user id). */
export function actorTag(identity: Identity): string {
  return `brand-coach-mcp:${userTag(identity)}`;
}

/**
 * Returns the current identity when writes are allowed, or a ready-to-return
 * denial result for anonymous callers.
 */
export function gateWrite(): { identity: Identity; denied: CallToolResult | null } {
  const identity = getIdentity();
  if (identity.authenticated) return { identity, denied: null };
  return {
    identity,
    denied: {
      content: [
        {
          type: 'text',
          text:
            'Denied: ledger write tools require an authenticated caller. ' +
            'Send a valid Supabase bearer token in the Authorization header.',
        },
      ],
      structuredContent: { available: false, ok: false, note: 'unauthenticated write denied' },
      isError: true,
    },
  };
}
