/**
 * Layer 1 (service) — who counts as an EXPERT for the Expert Intelligence Loop.
 *
 * The expert designation is DELIBERATELY narrower than `profiles.is_admin`: admin governs Studio /
 * admin-surface access (Matthew AND Trevor), but only the domain EXPERT (Trevor) should be a
 * training source — otherwise a developer's "corrections" pollute the signal. So capture (Feeder 1)
 * and the in-app harvest (Feeder 2) both gate on THIS allowlist, not on is_admin.
 *
 * Default is Trevor's accounts; override with the EXPERT_EMAILS env var (comma-separated) to add or
 * change experts without a code change. Keep this the single source of truth for the expert set.
 */
const DEFAULT_EXPERT_EMAILS = ['trevor@brandvoice.co.uk', 'trevor.bradford@brandvoice.co.uk'];

/** The current expert-email allowlist (lowercased, de-duped). */
export function expertEmails(): string[] {
  const raw = process.env.EXPERT_EMAILS;
  const list = raw && raw.trim() ? raw.split(',') : DEFAULT_EXPERT_EMAILS;
  return Array.from(new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean)));
}

/** Is this email a designated expert? Case-insensitive. */
export function isExpertEmail(email: string | null | undefined): boolean {
  return Boolean(email) && expertEmails().includes(email!.trim().toLowerCase());
}
