# DSAR Runbook — handling data-subject requests

Clock: **one month** from receipt (Art. 12(3)); extendable +2 months for
complex requests with notice inside the first month. Every request and outcome
gets a row in `gdpr_requests` (self-service does this automatically; log
manual ones with `execute_sql` service-role insert).

## Self-service paths (no operator involvement)

| Right | Path |
|---|---|
| Access / portability | Settings → Privacy → "Download my data" (full JSON, instant) |
| Erasure | Settings → Privacy → "Delete my account and data" (typed DELETE confirm) |
| Consent withdrawal (analytics) | Settings → Privacy toggle, or decline banner |
| Rectification of content | Edit in app (all coach/brand content is user-editable) |

## Manual requests (privacy@ideabrandconsultancy.com)

1. **Verify identity**: reply-to-same-address for account holders; for
   leads-only subjects (never registered), match the email in `leads`.
   Never disclose to a third address.
2. **Locate**: registered user → have them use self-service, or run the same
   edge fns on their behalf; lead-only subject → `select * from leads where
   email = …` (service role; RLS hides this table from clients).
3. **Erasure for lead-only subjects**: delete their `leads` rows; confirm.
4. **Rectification of account fields** (email change etc.): Supabase Auth
   admin update.
5. **Objection/restriction (Art. 18/21)**: no marketing sends exist today, so
   objection scope is analytics (point to withdrawal) and legitimate-interest
   telemetry (assess individually; document the balancing decision here).
6. **Log it**: insert into `gdpr_requests` (request_type, status, detail).

## Edge cases

- **Third-party reviewer data** (`user_product_reviews`, scrape caches): if an
  Amazon reviewer requests erasure, delete matching rows across those stores;
  note Art. 14(5)(b) applies to sourcing but erasure still honoured.
- **Export shows `unavailable` entries**: live schema drifted from
  `gdprData.ts` — fix the registry, redeploy both GDPR fns, re-run.
- **Erasure returns failures**: account is intentionally NOT deleted; the
  tally names the failing table. Fix, have the user retry (or run the fn with
  their consent recorded). Never delete the auth user manually first.
- **MCP-connector users**: their claude.ai conversation history is Anthropic's
  controllership; our side (tool-call data in the same tables) is covered by
  the standard flows above.
