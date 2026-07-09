# Personal-Data Breach Runbook (Art. 33/34)

Clock: **72 hours** to the supervisory authority from *awareness* of a breach
likely to risk individuals' rights — awareness starts when anyone on the team
has reasonable certainty, not when investigation completes. Notify individuals
without undue delay when the risk is HIGH (Art. 34).

## Detection sources

- PostHog error monitoring (frontend `capture_exceptions`, MCP
  `enableExceptionAutocapture`), PostHog EU project 203641 dashboards.
- Supabase logs/advisors (`get_logs`, `get_advisors`), auth anomaly signs.
- Caddy access logs on the Lightsail box; Stripe radar/webhook anomalies.
- User reports via feedback widget or the privacy mailbox.

## Immediate response (first hours)

1. **Contain**: rotate the exposed credential first —
   service-role key / anon key (Supabase dashboard), function secrets
   (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, …), OAuth client secrets,
   PostHog keys. Kill switches: pause the offending edge fn (undeploy), or
   take the vhost out of the Caddyfile (mango box) for a full stop.
2. **Preserve evidence**: export relevant Supabase/Caddy logs before rotation
   truncates context; snapshot affected rows (service-role select into a
   timestamped file, stored privately).
3. **Scope**: which tables/buckets, which users (count + list), what
   categories (use ROPA.md storage map — conversations and `user_memories`
   are the highest-sensitivity stores), duration of exposure.

## Assess risk → decide notification

- Low risk (e.g. encrypted/unusable data, contained non-personal leak):
  document in the register; no authority notification (record WHY).
- Reportable: notify the supervisory authority within 72h — for a UK
  controller, the ICO (https://ico.org.uk/for-organisations/report-a-breach/);
  if EU users are materially affected, the relevant EU authority as well.
- High risk to individuals (credentials, private conversations, financial
  identifiers): also notify affected users directly (email via Resend), in
  plain language: what happened, what data, what we did, what they should do.

## Register

Keep every incident (reportable or not) in `docs/compliance/breach-register/`
as `YYYY-MM-DD-short-name.md`: timeline, scope, risk assessment, decisions,
notifications sent, remediation, lessons. Art. 33(5) requires the register
regardless of whether the authority was notified.

## Processor breaches

Processors (ROPA.md list) must inform us without undue delay; their breach is
our Art. 33 clock. Verify each DPA has the notification clause when confirming
DPAs (GDPR_COMPLIANCE.md Open Actions #2).
