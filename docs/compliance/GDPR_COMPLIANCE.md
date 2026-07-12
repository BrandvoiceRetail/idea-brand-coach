# GDPR Compliance — Master Reference

Status date: 2026-07-08. This folder is the single home for data-protection
compliance. Companion docs: [ROPA.md](ROPA.md) (processing register + processor
list), [DPA_REGISTER.md](DPA_REGISTER.md) (Art. 28 processor-DPA checklist),
[DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md),
[DSAR_RUNBOOK.md](DSAR_RUNBOOK.md), [BREACH_RUNBOOK.md](BREACH_RUNBOOK.md).

Controller: **Brandvoice Retail Ltd** (IDEA Brand Consultancy) — confirm the
registered-company details and the `privacy@ideabrandconsultancy.com` mailbox
(see Open Actions).

## Obligation → implementation map

| GDPR obligation | Implementation | Where |
|---|---|---|
| Transparency (Art. 13/14) | Public privacy notice, linked from signup, consent banner, landing footer | `/privacy` route (`src/pages/PrivacyPolicy.tsx`), `public/landing.html` footer |
| Consent for analytics (Art. 6(1)(a), 7; ePrivacy) | PostHog CANNOT start without stored opt-in; banner with equal Accept/Decline; withdrawal toggle in Settings → Privacy | `src/lib/consent.ts`, `src/lib/posthogClient.ts` (`bindAnalyticsToConsent`), `src/components/consent/ConsentBanner.tsx`, `src/components/settings/PrivacySettings.tsx` |
| Demonstrable consent (Art. 7(1)) | Append-only `user_consents` ledger (signed-in) + signup metadata stamp (`accepted_policies_version/_at`) + localStorage record (anonymous) | migration `20260708000000_gdpr_user_consents.sql`, `src/services/consentService.ts`, `SupabaseAuthService.signUp` |
| Right of access + portability (Art. 15/20) | Self-service full JSON export, instant | `gdpr-export` edge fn + Settings → Privacy → "Download my data" |
| Right to erasure (Art. 17) | Self-service account deletion: storage objects + all 50+ user-data tables (incl. no-FK capture tables) + auth user; best-effort Stripe cancel + PostHog person deletion; auth user deleted ONLY if all else succeeded | `gdpr-delete-account` edge fn + Settings → Privacy (typed-DELETE confirm) |
| Request accounting (Art. 12(3)) | Every export/erasure logged with per-table tally | `gdpr_requests` table (survives erasure by design) |
| Rectification (Art. 16) | All content editable in-app; account fields via DSAR runbook | app + [DSAR_RUNBOOK.md](DSAR_RUNBOOK.md) |
| Storage limitation (Art. 5(1)(e)) | Retention schedule + nightly `gdpr-ttl-purge` pg_cron job for expired cache rows | [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md), migration `20260708000100_gdpr_ttl_purge_cron.sql` |
| Integrity/confidentiality (Art. 5(1)(f), 32) | RLS on all user tables (live-verified own-rows policies), JWT-gated edge fns, service-role isolation, 2026-06-21 cross-user-isolation hardening | live DB; `supabase/config.toml` verify_jwt pins |
| Breach notification (Art. 33/34) | 72-hour runbook + register | [BREACH_RUNBOOK.md](BREACH_RUNBOOK.md) |
| Records of processing (Art. 30) | ROPA with purposes, categories, recipients, transfers | [ROPA.md](ROPA.md) |
| No pre-consent third-party leaks (ePrivacy) | Google Fonts self-hosted (both HTML entry points); PostHog EU host pinned as CODE default; YouTube embeds → `youtube-nocookie.com`; Vimeo `dnt=1` | `public/fonts/`, `index.html`, `public/landing.html`, `src/components/VideoPlayer.tsx` |
| Automated decisions (Art. 22) | None with legal/similar effect; stated in the notice | `/privacy` |

## The one rule that keeps this true

**Every new user-data table MUST be added to
`supabase/functions/_shared/gdprData.ts`** (and both GDPR fns redeployed).
An unlisted table means incomplete exports and leaked rows after erasure.
The registry mirrors the 2026-07-08 inventory in [ROPA.md](ROPA.md).

## Consent versioning

`CONSENT_POLICY_VERSION` in `src/lib/consent.ts` names the privacy-notice
version every consent is recorded against. Material change to `/privacy` ⇒ bump
the version ⇒ stored banner decisions invalidate and users are re-prompted.

## Open actions (non-code / human)

1. **Privacy contact address** — the notice/DSAR runbook point at
   `privacy@ideabrandconsultancy.com`. It must be a monitored inbox that doesn't
   bounce (Art. 12/13). EITHER repoint the notice at an existing monitored inbox
   (one-line edit) OR create a `privacy@` forwarder in the **34SP** control panel
   (that domain's email host). Draft DM sent to Trevor 2026-07-08 to pick one.
2. **Add controller's registered details to the notice** — Brandvoice Retail
   Ltd's registered office address + company number belong in the "Who we are"
   section (Art. 13 identity). Not fabricated in code; supply the facts and I'll
   add them.
3. **DPO decision** — confirm no Data Protection Officer is required (Art. 37:
   likely not — no large-scale monitoring or special-category data at scale) and
   record that decision, or appoint one and name them in the notice.
4. **Work the DPA register** — see [DPA_REGISTER.md](DPA_REGISTER.md): Tier-1
   DPAs (Supabase, Anthropic, OpenAI, PostHog, Stripe) are AUTO/self-serve; then
   resolve the two **VERIFY** flags — most importantly the **Google Gemini tier**
   (free/AI-Studio tier CAN train on prompts, which would contradict the notice's
   "providers don't train on your data"), and the Slack free-vs-paid DPA.
5. **Set optional erasure env secrets** on Supabase functions so external
   deletion is automatic, not manual: `POSTHOG_PERSONAL_API_KEY`,
   `POSTHOG_PROJECT_ID` (203641), and confirm `STRIPE_SECRET_KEY` is present.
6. **Qualified legal review of `/privacy` text** — engineering has done a
   self-review against the Art. 13/14 checklist (2026-07-08: added the Art. 14
   third-party-reviewer-data section, transfer-safeguards-on-request line, EU
   supervisory-authority reference). A lawyer should still sign off, especially
   the processor-claim accuracy (item 4) and the registered details (item 2).
7. **UK GDPR**: if Brandvoice Retail Ltd is UK-established, ICO registration
   (data-protection fee) likely applies; confirm.

## Known residual risks (tracked, not blocking)

- `canva_connections` stores OAuth tokens in plaintext columns (service-role
  only; still: encrypt like the Figma connector does). P2 hardening.
- `run-forensic-analysis` emails a report to a caller-supplied address instead
  of the authed user's (`input.email`) — spam/PII-misdirection vector. Fix in
  that fn (respect repo↔live drift rule: reconcile from deployed first). P2.
- The unmerged `/v5` anon-first flow (feat/v5-alpha-surface) creates real rows
  under anonymous users — at merge time, confirm anon users age out (retention)
  and that `signInAnonymously` sessions land in the erasure registry the same way.
- Repo migrations for beta tables are stale vs live (live is already own-rows
  scoped); rely on live-DB policy checks, not repo SQL, when auditing RLS.
