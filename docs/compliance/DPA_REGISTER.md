# Processor DPA Register

GDPR Art. 28 requires a written data-processing agreement (DPA) with every
processor that handles personal data on our behalf. This register makes signing
them a mechanical task: each row has the standard DPA location, how it's
accepted, and its current status. Work top-down — the highest-personal-data
processors (Supabase, Anthropic) first.

**Status key**
- `AUTO` — DPA is incorporated into the standard terms you already accepted; no separate signature needed. Keep a copy for the file.
- `SELF-SERVE` — a DPA exists; accept/sign it via the link (often a form or an in-dashboard toggle).
- `REQUEST` — no off-the-shelf DPA surfaced; email the vendor to request one (or assess whether a DPA is required given what we send them).
- `VERIFY` — a data-use caveat must be confirmed before we can rely on the privacy notice's claims.

> URLs are the standard DPA locations as of this writing — confirm the live URL
> when you action each one. Signer = whoever holds the account (Matthew for the
> infra/API accounts; note the account owner per row as you go).

## Tier 1 — highest personal-data exposure (do first)

| Processor | What they get | DPA location | Status | Action |
|---|---|---|---|---|
| **Supabase** | Everything (DB, auth, storage) | supabase.com/legal/dpa | SELF-SERVE | Accept the DPA in the dashboard / via the legal page; keep PDF. On a paid plan it's part of the Team/Enterprise terms. |
| **Anthropic (Claude API)** | Conversations, brand content, product context, memories | anthropic.com/legal/commercial-terms (+ DPA) | AUTO / SELF-SERVE | Commercial/API terms include the DPA and the "no training on your inputs/outputs" commitment for API traffic. Confirm we're on **Commercial** (not consumer) terms; save the DPA. |
| **OpenAI (embeddings)** | Brand/diagnostic text (embeddings only) | openai.com/policies/data-processing-addendum | SELF-SERVE | Complete the DPA form under the API-platform account. API data is not used for training by default. |
| **PostHog (EU)** | Analytics events, IP, device (consent-gated) | posthog.com/dpa | SELF-SERVE | Accept the DPA; confirm EU Cloud residency (we already pin the EU host). |
| **Stripe** | Email, customer/subscription IDs (card data direct-to-Stripe) | stripe.com/legal/dpa | AUTO | DPA is part of the Stripe Services Agreement — no separate signature. File the reference. |

## Tier 2 — moderate exposure

| Processor | What they get | DPA location | Status | Action |
|---|---|---|---|---|
| **Resend** | Recipient email + report content | resend.com/legal/dpa | SELF-SERVE | Accept the DPA. |
| **Google — Gemini + Custom Search** | Image prompts, **user product photos**, search terms | cloud.google.com/terms/data-processing-addendum | **VERIFY** | The Cloud DPA covers paid Google Cloud / Vertex usage. **Critical:** the *free* Gemini API / AI Studio tier permits Google to use prompts to improve its products (human review). We must be on a **paid, no-training** tier (Vertex AI or paid Gemini API) or the notice's "providers don't train on your data" is inaccurate for Google. Confirm the tier, then the Cloud DPA is AUTO. |
| **Slack** | Verbatim feedback text | slack.com/trust/compliance/data-processing-addendum | AUTO / VERIFY | Salesforce DPA auto-applies to paid workspaces. If we're on a **free** workspace, confirm the DPA still applies or move feedback routing off Slack. |
| **Figma** | OAuth identity, imported design metadata | figma.com/legal/dpa | SELF-SERVE | Only if the Figma integration is enabled for users (currently flag-gated off). Sign before enabling. |
| **Canva** | OAuth identity, imported designs | canva.com/policies/dpa | SELF-SERVE | Only relevant once the Canva integration ships (code-complete, not deployed). Sign before enabling. |
| **AWS (Lightsail)** | Web-server logs (IP, user agent) | aws.amazon.com/compliance/data-privacy | AUTO | AWS DPA is incorporated into the AWS Customer Agreement. File the reference. |

## Tier 3 — low exposure (no account PII sent), still needs assessment

| Processor | What they get | DPA location | Status | Action |
|---|---|---|---|---|
| **Firecrawl** | Amazon URLs/ASINs only | firecrawl.dev (check ToS/legal) | REQUEST | No account PII sent, but scraped pages return third-party reviewer data we then store. Request a DPA or document why one isn't required. |
| **DataForSEO** | Keywords/ASINs only | dataforseo.com (has a DPA on request) | REQUEST | Request the DPA; low personal-data exposure. |
| **fal.ai** | Prompts + product images | fal.ai (check ToS/legal) | REQUEST | Smaller vendor — request a DPA or assess; confirm no model-training on submitted media. |
| **Pixii** | Product image URLs + prompts | pixii.ai (check ToS/legal) | REQUEST | Same as fal.ai. |

## Not processors (no DPA needed)

- **esm.sh / deno.land** — server module fetches at build/runtime, no user data.
- **Let's Encrypt** — TLS cert issuance only.
- **34SP.com** — hosts the consultancy domain's email (Trevor's account), not a processor of app user data.

## How to close this out

1. Tier 1 first: accept/file the five DPAs (all AUTO or SELF-SERVE — no negotiation).
2. Resolve the two **VERIFY** flags — the Google Gemini tier is the important one; it directly affects a claim in the public privacy notice.
3. Tier 3: send the four REQUEST emails, or document a short assessment that a DPA isn't required (they receive no account PII).
4. Record each signed DPA (date + copy location) in this file so the register is the audit trail.
