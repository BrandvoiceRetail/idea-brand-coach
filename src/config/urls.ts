/**
 * Canonical public URLs for IDEA Brand Coach — single source of truth.
 *
 * Change the domain here and it propagates across the React app (connector setup,
 * any in-app link that needs the absolute origin). Keep it in sync with:
 *   - the MCP gateway's own URL: `MCP_PUBLIC_URL` env / fallback in `src/mcp/config.ts`
 *   - edge-function links: `APP_URL` in `supabase/functions/_shared/appUrl.ts`
 *   - the static HTML front doors, which can't import TS: `public/landing.html`,
 *     `public/onboard.html`, and `index.html` (og/twitter tags)
 */

/** The canonical app origin (no trailing slash). */
export const APP_ORIGIN = 'https://ideabrandcoach.com';

/** The MCP gateway URL a user pastes into Claude / ChatGPT as a custom connector. */
export const MCP_URL = `${APP_ORIGIN}/mcp`;

/** The Claude Code one-liner that adds the connector. */
export const MCP_ADD_COMMAND = `claude mcp add --transport http idea-brand-coach ${MCP_URL}`;
