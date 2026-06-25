/**
 * Clerk auth — build/runtime configuration.
 *
 * Clerk sign-up/sign-in is an ADDITIVE, flag-gated path that replaces the custom
 * Supabase-Auth surfaces (`Auth.tsx`, `DiagnosticAuthModal.tsx`) only when
 * `VITE_ENABLE_CLERK_AUTH === 'true'`. With the flag off, every auth path is
 * byte-for-byte the existing Supabase-Auth behaviour — so this can ship dark and
 * be flipped on at cutover (and instantly rolled back by flipping it off).
 *
 * We use Clerk's NATIVE Supabase third-party-auth integration: Clerk issues the
 * session token, Supabase trusts the Clerk instance, and RLS reads the Clerk user
 * id via `auth.jwt()->>'sub'`. See docs/integrations/CLERK_SETUP.md.
 */

/** True when the Clerk auth path should replace the Supabase-Auth UI. */
export function isClerkAuthEnabled(): boolean {
  return (import.meta.env.VITE_ENABLE_CLERK_AUTH as string | undefined) === 'true';
}

/**
 * Clerk publishable key (safe to ship in the frontend bundle). Empty string when
 * unset — `isClerkConfigured()` is the guard that gates rendering the provider so
 * a missing key degrades gracefully instead of throwing at module load.
 */
export function getClerkPublishableKey(): string {
  return (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? '';
}

/** Clerk is both flag-enabled AND has a usable publishable key. */
export function isClerkConfigured(): boolean {
  return isClerkAuthEnabled() && getClerkPublishableKey().length > 0;
}
