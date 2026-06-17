/**
 * Brand-Coach MCP host — configuration & server identity.
 *
 * Server-side only (Node). Reads `process.env` — never `import.meta.env`/`localStorage`
 * (those are browser-only and used by the SPA's Supabase client).
 */

export const SERVER_NAME = 'brand-coach-mcp';
export const SERVER_VERSION = '0.1.0';

/**
 * Instructions surfaced to any agent that connects. Kept deliberately small and
 * always-on. The asset-chain tools (concept → publish-filter → draft → test-design)
 * and the diagnostic wrappers are NOT part of this host yet — they are the next
 * initiatives. This host is the gateway + the consumed IV-OS asset-tracking surface.
 */
export const SERVER_INSTRUCTIONS = [
  // POSTURE — leads everything: this gateway coaches, it does not auto-evaluate.
  'POSTURE: This is a coach, not a form. Invite the user in and gather their brand story ONE',
  'PIECE AT A TIME, conversationally — lead with the customer and the heart of the brand. NEVER',
  'evaluate, score, or generate before the user has shared real context. NEVER call a',
  'diagnostic/scoring/generation tool with values the user did not explicitly provide — do not',
  'infer, default, or invent inputs (e.g. never assume dimension ratings). If a tool errors or',
  "lacks inputs, ASK for what's missing; never fabricate or hand-compute a result to avoid stalling.",
  'Brand-Coach MCP gateway. Brand-coach OWNS the generative/strategy front (diagnostics,',
  'concept generation, publish-filter, asset drafting, test design); IV-OS OWNS the asset/test',
  'ledger + knowledge reads. This host currently exposes: `health`; the IV-OS ledger reads',
  '(`list_assets`, `get_asset`, and `get_asset_history` — the append-only change log of',
  'logged / status_change / assessment events); and the identity-gated IV-OS ledger writes',
  '(`log_asset`, `update_asset_status`, `record_assessment` — each requires an authenticated',
  'Supabase caller and is attributed to the caller tag). Full asset-assessment loop: read the',
  'asset via `get_asset`, judge it against brand canon, record the verdict with',
  '`record_assessment`, drive approval via `update_asset_status`, audit anytime via',
  '`get_asset_history`. Treat the IV-OS test-ledger and knowledge tools as provisional — not',
  'bound here. The authenticated caller can review their own Brand-Coach chat threads per avatar:',
  '`list_coach_conversations` indexes their threads (each with its avatar_id + avatar_name; null =',
  'brand-level — pass avatar_id to scope to one avatar) and `get_coach_conversation` returns one',
  'thread’s full transcript by session_id (both RLS-scoped reads; anonymous callers are refused).',
  'Avatars are managed via `create_avatar` (brand_id is stamped server-side — never supply it),',
  '`list_avatars`, `get_avatar`, `record_avatar_build`, `set_current_avatar` (the avatar-switch:',
  'it sets the coach current-avatar server-side; pass an avatar_id you own), and `set_primary_avatar`',
  '(pins the brand’s primary avatar — the default the funnel-audit tools use, distinct from the coach',
  'current-avatar). The funnel is brand-level:',
  '`list_funnel_inventory` / `upsert_funnel_touchpoint` carry NO avatar_id, while `run_funnel_audit` /',
  '`get_funnel_audit` default to the brand’s primary avatar when avatar_id is omitted (set it with',
  '`set_primary_avatar`). Any tool that',
  'takes an avatar_id refuses one you do not own.',
  'Never send PII or raw prompts in tool args beyond what a tool explicitly requires.',
].join(' ');

/**
 * Guard: the server MUST advertise non-empty instructions. Called at server build
 * so a misconfigured/empty instruction block fails fast rather than shipping a
 * silent, contextless surface to agents.
 */
export function assertServerInstructions(instructions: string): string {
  if (!instructions || instructions.trim().length === 0) {
    throw new Error('SERVER_INSTRUCTIONS must be a non-empty string');
  }
  return instructions;
}

export interface HostConfig {
  port: number;
  /** IV-OS Marketing MCP streamable-HTTP endpoint. Unset = ledger unavailable (graceful). */
  ivosMcpUrl: string | null;
  /** Optional bearer for the IV-OS endpoint (IV-OS chose single-tenant/no-auth per ADR 0001; kept for forward-compat). */
  ivosMcpToken: string | null;
  /** Supabase project URL used server-side for JWT verification. */
  supabaseUrl: string;
  /** Supabase anon/publishable key — sufficient for `auth.getUser(token)` verification. */
  supabaseAnonKey: string;
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
}

export function loadConfig(): HostConfig {
  return {
    port: Number(env('MCP_PORT') ?? '8787'),
    ivosMcpUrl: env('IVOS_MCP_URL'),
    ivosMcpToken: env('IVOS_MCP_TOKEN'),
    // Fallbacks mirror the SPA client's known project so local boots work without env.
    supabaseUrl: env('SUPABASE_URL') ?? 'https://ecdrxtbclxfpkknasmrw.supabase.co',
    supabaseAnonKey:
      env('SUPABASE_ANON_KEY') ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHJ4dGJjbHhmcGtrbmFzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODE5ODYsImV4cCI6MjA2OTU1Nzk4Nn0.yPlOSq4l4PMD9RlchTBeXs5EBmzggGQGp7A8B3qGAAk',
  };
}
