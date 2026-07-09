# Data Retention Policy

Status date: 2026-07-08. Principle: Art. 5(1)(e) — keep personal data no longer
than the purpose requires. Enforcement is deterministic wherever possible
(Layer 3): cron jobs and cascade rules, not manual sweeps.

## Schedule

| Store | Retention | Enforcement |
|---|---|---|
| Account + all user content (tables in `gdprData.ts`) | Life of account | Self-service erasure (`gdpr-delete-account`) + `auth.users` CASCADE |
| Storage buckets (`documents`, `brand-assets`, `workbooks`) | Life of account | Deleted by `gdpr-delete-account` (objects do NOT cascade on their own) |
| `competitor_asin_cache` (scraped listing/review payloads) | Until `expires_at` | `gdpr-ttl-purge` pg_cron, nightly 03:17 UTC |
| `scrape_rate_usage` (pseudonymous rate buckets) | Until `expires_at` | `gdpr-ttl-purge` pg_cron, nightly 03:17 UTC |
| `figma_oauth_state` / `canva_oauth_states` | Minutes (CSRF window) | Inline delete on flow completion/next start |
| `leads` (lead magnet PII) | Until unsubscribe or erasure request | DSAR runbook (manual today — see below) |
| `user_consents` | Life of account (ledger) | CASCADE with auth user |
| `gdpr_requests` | Indefinite (accountability log; opaque UUID only after erasure) | By design |
| PostHog events (consent-gated) | PostHog project retention; person+events deleted on erasure when API key configured | `gdpr-delete-account` external step |
| Server/edge logs | Platform default rotation (Supabase/Caddy) | Platform |
| Stripe billing records | Statutory financial retention | Art. 17(3)(b) exemption — retained at Stripe |

## Review points

- **Leads aging**: no automatic expiry today (business decision pending —
  Trevor owns the lead-magnet funnel). Decide a max age (suggest 24 months
  from last contact) and add it to `gdpr-ttl-purge` once agreed.
- **Anonymous /v5 users** (when `feat/v5-alpha-surface` merges): anon
  `auth.users` rows that never convert should age out (suggest 90 days) —
  add a cron delete; erasure/export already cover them once they convert.
- When adding ANY new TTL column, wire it into `gdpr-ttl-purge` in the same PR.
