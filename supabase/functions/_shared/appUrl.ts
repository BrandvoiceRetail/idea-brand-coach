/**
 * Canonical public app origin for server-built links (email CTAs, Stripe return
 * URLs) — single source of truth for edge functions.
 *
 * Override per-deploy with the `APP_URL` secret (the legacy `LEAD_CTA_URL` secret
 * is still honoured for backward compatibility). No trailing slash. Keep the
 * default in sync with `src/config/urls.ts` (frontend) and `MCP_PUBLIC_URL`
 * (the MCP gateway).
 */
export const APP_URL = (
  Deno.env.get('APP_URL') ?? Deno.env.get('LEAD_CTA_URL') ?? 'https://ideabrandcoach.com'
).replace(/\/+$/, '');
