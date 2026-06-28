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
  // NARRATION — make the coach's process visible. Announce BEFORE every tool, explain AFTER.
  'NARRATION: Before you run any tool, tell the user in one short plain-English line WHAT you are',
  'about to do and WHY — e.g. "Let me pull your Trust Gap now to see where buyers hesitate…" or',
  '"Reading your reviews back to you so we work from your customers\' own words…". Use the tool\'s',
  'everyday name (Trust Gap, avatar build, review read-back, funnel audit), never the internal tool',
  'id or argument names. After the tool returns, state the ONE concrete thing it found in a sentence',
  'before moving on — grounded only in what the tool actually returned. If a tool returns no data or',
  'errors, SAY so plainly and ask for what is missing; never narrate a finding you did not get.',
  'Keep narration to process + real findings only: never expose internal stage labels, buyer-state',
  'names, scoring internals, neuroanatomical framing, raw tool ids, or argument schemas.',
  'CREATIVE INTELLIGENCE: the no-invention rule above governs FACTS (customer data, ratings,',
  'reviews, product claims) — never invent or assume those. It does NOT forbid creative',
  'EXPRESSION. Turning a real customer insight into a distinctive, ownable marketing phrase',
  '(e.g. protecting a collection becomes "battle ready") is the coach\'s job and is the IDEA D',
  '(Distinctive) pillar — no customer says it out loud, that is what makes it marketing. Offer such',
  'expression as a creative angle to TEST, clearly labelled, never as a fact or finished claim, and',
  'route it to a resonance test (`design_test`); `generate_signature` / `generate_concepts` are the',
  'engines that make the leap. A distinctive line is OWNABLE, SURPRISING, TRUE to a real insight, and',
  'TESTABLE.',
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
  // FUNNEL METRICS (Windsor) — the HOST reads Windsor; this server only stores the funnel.
  'FUNNEL METRICS (Windsor): When the user asks to pull or refresh their funnel metrics, you (the host)',
  'orchestrate it — this server cannot read Windsor itself. (1) Ensure the funnel PIECES exist: call',
  '`list_funnel_inventory`; for any active touchpoint that is missing, create it with',
  '`upsert_funnel_touchpoint` (one piece = one active brand asset / touchpoint, with its journey stage),',
  'and use the returned brand_asset_id. (2) Read the user’s data from their Windsor connector (its',
  '`get_data`) — pull the FULL history each source allows (go as far back as it returns), at DAILY',
  'granularity, source by source so nothing is truncated; the store keeps one row per metric per piece',
  'per day, so more history = better baselines and real before/after lift. Map each metric to a piece +',
  'journey_stage + metric_name: amazon_ads',
  'impressions→impressions (awareness), ctr→ctr, clicks→clicks, spend→spend, orders→orders,',
  'revenue→revenue, new_to_brand→new_to_brand; amazon_sp (Seller Central) orders→orders, returns→return_rate,',
  'repeat→repeat_rate; ga4 sessions→sessions; tiktok_shop views→views, clicks→clicks. Express rate metrics',
  '(ctr, cvr, return_rate, repeat_rate) as fractions 0–1. (3) Store each metric — but first ensure a',
  'campaign to attach it to: call `list_campaigns` and reuse the matching one, or `create_campaign` if',
  'none fits, and use its id. Then store each via `ingest_campaign_analytics` / `ingest_funnel_analytics`,',
  'passing that campaign_id PLUS the brand_asset_id + journey_stage + source="windsor". (4) Confirm with',
  '`get_funnel_piece_metrics` and report honestly which pieces now have data and which are still "—" —',
  'NEVER fabricate a metric. Also check the user’s Windsor connectors (`get_connectors`) for sources that',
  'are registered but NOT enabled/connected, and PROMPT the user to switch on any that could hold relevant',
  'brand/funnel data (you can surface `get_connector_authorization_url`) — do not silently leave a piece "—"',
  'when a quick connector toggle would fill it. (5) EXPERIMENT LOOP: when the user has an idea, open a test with `design_test`',
  '(it stores the baseline); when they make the asset, call `update_test_milestone` (asset_created); when it',
  'goes live, call `update_test_milestone` (asset_live); later re-pull Windsor and re-measure to compute the',
  'before/after lift for that test.',
  'Any user can send product feedback to the team via `submit_feedback` (no login',
  'required) — it is delivered to the team channel for consideration; submit only what the user',
  'actually said. Never send PII or raw prompts in tool args beyond what a tool explicitly requires.',
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
  /** Slack bot token (`xoxb-…`, needs `chat:write`) for posting feedback. Unset = `submit_feedback` degrades gracefully. */
  slackBotToken: string | null;
  /** Slack channel id `submit_feedback` posts to. Defaults to #idea-brand-coach; the bot must be a member. */
  slackFeedbackChannelId: string;
  /**
   * Canonical public URL of this MCP resource (RFC 8707 / RFC 9728 `resource`).
   * Must match exactly what users enter when adding the connector. Advertised in the
   * protected-resource metadata so OAuth clients bind tokens to this audience.
   */
  mcpPublicUrl: string;
  /**
   * When true, an unauthenticated `/mcp` request is answered with `401` +
   * `WWW-Authenticate` (RFC 9728) — the trigger that starts an OAuth client's flow.
   * Flag-gated so prod can enable/disable enforcement instantly (kill switch) without
   * a redeploy. The protected-resource metadata is served regardless of this flag.
   */
  oauthRequireAuth: boolean;
  /**
   * OAuth scope advertised to clients (WWW-Authenticate `scope` + metadata
   * `scopes_supported`). Steers clients (Claude) toward a scope the Supabase AS can
   * actually issue. Defaults to `email`: `openid` triggers OIDC ID-token generation,
   * which fails on projects without an asymmetric JWT signing key. Optional — tunable
   * via `MCP_OAUTH_SCOPE` without a redeploy.
   */
  oauthScope?: string;
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
    slackBotToken: env('SLACK_BOT_TOKEN'),
    // Fallback is the known #idea-brand-coach channel id (private; bot must be invited).
    slackFeedbackChannelId: env('SLACK_FEEDBACK_CHANNEL_ID') ?? 'C0B9YT9TQ6T',
    mcpPublicUrl: env('MCP_PUBLIC_URL') ?? 'https://ideabrandcoach.icodemybusiness.com/mcp',
    oauthRequireAuth: (env('MCP_OAUTH_REQUIRE_AUTH') ?? 'false').toLowerCase() === 'true',
    oauthScope: env('MCP_OAUTH_SCOPE') ?? 'email',
  };
}
