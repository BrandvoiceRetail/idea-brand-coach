/**
 * OAuth 2.1 resource-server surface (MCP authorization, spec rev 2025-06-18).
 *
 * This gateway is the OAuth 2.0 **protected resource**; Supabase Auth is the
 * **authorization server** (it owns /authorize, /token, DCR, PKCE, consent + refresh).
 * So all this module does is:
 *   1. advertise the AS via RFC 9728 protected-resource metadata, and
 *   2. build the RFC 9728 §5.1 `WWW-Authenticate` challenge returned on a 401.
 * Token *validation* stays in `context/identity.ts` (`auth.getUser` against the same
 * Supabase project) — the only tokens accepted are this project's own, so the audience
 * boundary the spec requires is the project itself.
 */
import type { HostConfig } from './config.js';

/** RFC 9728 well-known path for protected-resource metadata. */
export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';

/** Origin (scheme + host) of the canonical MCP URL — where the well-known docs live. */
export function publicOrigin(config: HostConfig): string {
  try {
    return new URL(config.mcpPublicUrl).origin;
  } catch {
    return 'https://ideabrandcoach.com';
  }
}

/** Path component of the canonical MCP URL (e.g. `/mcp`), for the path-suffixed metadata variant. */
function resourcePathSuffix(config: HostConfig): string {
  try {
    const p = new URL(config.mcpPublicUrl).pathname.replace(/\/$/, '');
    return p && p !== '/' ? p : '';
  } catch {
    return '';
  }
}

/** Supabase OAuth 2.1 authorization-server issuer, derived from the project URL. */
export function authorizationServerIssuer(config: HostConfig): string {
  return `${config.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
}

/**
 * The two well-known paths we answer with the metadata document. Clients (Claude)
 * probe the path-suffixed form first (`…/oauth-protected-resource/mcp`) then the bare
 * form — we serve both so discovery never depends on which the client tries.
 */
export function protectedResourceMetadataPaths(config: HostConfig): string[] {
  const suffix = resourcePathSuffix(config);
  return suffix ? [`${PROTECTED_RESOURCE_PATH}${suffix}`, PROTECTED_RESOURCE_PATH] : [PROTECTED_RESOURCE_PATH];
}

/** Canonical URL advertised in `WWW-Authenticate: resource_metadata=…` (most specific variant). */
export function resourceMetadataUrl(config: HostConfig): string {
  return `${publicOrigin(config)}${protectedResourceMetadataPaths(config)[0]}`;
}

/** Scope advertised to clients; steers them to a scope the Supabase AS can issue. */
export function advertisedScope(config: HostConfig): string {
  return config.oauthScope ?? 'email';
}

/** RFC 9728 §2 protected-resource metadata document. */
export function protectedResourceMetadata(config: HostConfig): Record<string, unknown> {
  return {
    resource: config.mcpPublicUrl,
    authorization_servers: [authorizationServerIssuer(config)],
    bearer_methods_supported: ['header'],
    scopes_supported: [advertisedScope(config)],
    resource_documentation: publicOrigin(config),
  };
}

/** RFC 9728 §5.1 `WWW-Authenticate` value returned on an unauthenticated/invalid-token 401. */
export function wwwAuthenticateChallenge(config: HostConfig, error?: 'invalid_token'): string {
  const parts = [
    `Bearer resource_metadata="${resourceMetadataUrl(config)}"`,
    `scope="${advertisedScope(config)}"`,
  ];
  if (error) parts.push(`error="${error}"`);
  return parts.join(', ');
}
