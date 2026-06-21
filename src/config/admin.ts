/**
 * Internal admin allowlist.
 *
 * Admin-only surfaces (e.g. the Coach Evals dashboard) are gated on the authenticated
 * user's email. The allowlist is env-driven (VITE_ADMIN_EMAILS, comma-separated) with a
 * built-in fallback for the project owners so the gate is never accidentally open.
 *
 * This is intentionally lightweight — a proper `profiles.is_admin` role can replace it
 * later without changing call sites (keep using `isAdminEmail`).
 */

const FALLBACK_ADMINS = [
  'matthew@arisegroup.ai',
  'matthew@icodemybusiness.com',
  // Trevor Bradford (BrandVoice) — evaluates the coach via the admin Eval Bench.
  'trevor.bradford@brandvoice.co.uk',
];

export const ADMIN_EMAILS: string[] = Array.from(
  new Set(
    [...(import.meta.env.VITE_ADMIN_EMAILS ?? '').split(','), ...FALLBACK_ADMINS]
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ADMIN_EMAILS.includes(email!.trim().toLowerCase());
}
