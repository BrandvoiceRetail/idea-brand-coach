# Records of Processing Activities (GDPR Art. 30)

Controller: Brandvoice Retail Ltd (IDEA Brand Consultancy) · Contact:
privacy@ideabrandconsultancy.com · Status date: 2026-07-08.

## Processing activities

| # | Activity | Data subjects | Categories | Lawful basis | Retention |
|---|---|---|---|---|---|
| 1 | Account management (Supabase Auth) | Registered users | Name, email, password hash, policy-acceptance stamp | Contract | Life of account |
| 2 | Brand coaching service | Registered users | User-authored brand content: brands, avatars, coach conversations (`chat_messages`), diagnostics, uploaded documents, generated artifacts, coach memory (`user_memories`) | Contract | Life of account |
| 3 | Product/listing analysis | Registered users; **third-party Amazon reviewers** (names + review text in `user_product_reviews`, scrape caches) | Product data, scraped reviews | Contract (user); legitimate interest (reviewer quotes for analysis the user requests) | Life of account; caches purge nightly at TTL |
| 4 | Billing & credits (Stripe) | Paying users | Email, Stripe customer/subscription ids, tier, usage ledger | Contract; legal obligation | Life of account; financial records per statutory retention (Stripe holds invoices) |
| 5 | Product analytics (PostHog EU) | Consenting visitors/users | Usage events, device info, IP; identity = Supabase UUID (no email pushed by code) | **Consent only** | Until consent withdrawn / person deleted on erasure |
| 6 | Server telemetry & abuse control | All users | Error logs, per-tool counters, rate buckets | Legitimate interest (security/ops) | Short rotation; rate buckets purge at TTL |
| 7 | Lead magnet (free Trust Gap diagnostic) | Anonymous leads | Name, email, company, answers, scores, UTM, user agent, consent flag (`leads`) | Consent (checkbox is server-enforced) | Until unsubscribe/erasure request |
| 8 | Transactional email (Resend) | Users/leads who request reports | Email + report content | Contract / consent (leads) | Not stored beyond provider logs |
| 9 | In-app feedback | Users/testers | Feedback text, ratings, contact email (`beta_*`, `feedback_events`), Slack relay of the text | Legitimate interest / consent | Life of account (deleted on erasure) |
| 10 | Design-tool imports (Figma/Canva, opt-in connect) | Connecting users | OAuth tokens, imported design metadata | Contract (feature the user invokes) | Until disconnect or erasure |

## Processors / recipients

| Processor | Role | Data | Region | Transfer mechanism |
|---|---|---|---|---|
| Supabase | DB, auth, storage, edge functions | Everything above | Project region | DPA (Supabase standard) |
| Anthropic (Claude API) | AI generation | Conversations, brand content, product context, memories | US | DPA + SCC/DPF; no training on API data |
| OpenAI | Embeddings only | Brand/diagnostic text chunks | US | DPA + SCC/DPF |
| PostHog | Analytics (consent-gated) + server telemetry/error tracking | Events, IP, UA | **EU (Frankfurt)** — host pinned in code | EU processing (no transfer) |
| Stripe | Payments | Email, user id metadata; card data direct-to-Stripe | US/EU | DPA + SCC/DPF |
| Resend | Transactional email | Recipient email, report body | US | DPA + SCC |
| Firecrawl | Page scraping | Amazon URLs/ASINs only | US | ToS/DPA — no personal data of ours sent |
| DataForSEO | Competitor research | Keywords/ASINs only | US | ToS — no personal data of ours sent |
| Google — Gemini | Image generation | Prompts + **user product photos** | US | DPA + SCC/DPF |
| Google — Custom Search | Competitor discovery | Brand/product search terms | US | ToS |
| fal.ai / Pixii | Video/image generation | Prompts, product image URLs | US | ToS/DPA |
| Slack | Feedback relay to private channel | Verbatim feedback text | US | DPA + SCC/DPF |
| Figma / Canva | Design import (user-connected) | OAuth identity, file metadata | US | DPA (their standard) |
| AWS Lightsail (us-east-1) | Hosting (SPA + MCP gateway behind Caddy) | Web logs (IP, UA) | US | AWS DPA + SCC |

Not processors: esm.sh/deno.land (server module fetches, no user data);
Let's Encrypt (cert issuance only). Google Fonts was REMOVED 2026-07-08
(self-hosted); YouTube embeds use nocookie domain, Vimeo uses dnt=1.

## Storage map (authoritative table inventory)

56 live tables; 52 hold personal data. The machine-readable registry that the
export/erasure functions execute against is
`supabase/functions/_shared/gdprData.ts` — grouped as:

- **Direct `user_id` tables** (43 incl. `profiles` by `id`): chat, coach
  assets/events, scrape jobs, brands/avatars, KB + chunks + memories, products,
  diagnostics, billing (`credit_*`, `user_subscriptions`), integrations
  (figma/canva), feedback, consent ledger, GDPR log.
- **Avatar-linked** (7): `avatar_field_values`, `brand_assets`,
  `brand_asset_competitive_insights`, `brand_defense_alerts`, `brand_tests`,
  `competitor_assets`, `trust_gap_snapshots`.
- **Product-linked** (1): `user_product_reviews` (third-party reviewer data).
- **Email-keyed, no user FK** (2): `leads`, `beta_testers`.
- **Storage buckets** (3): `documents`, `brand-assets`, `workbooks` under
  `{userId}/…` prefixes.
- **Non-personal / pseudonymous caches**: `model_rates`,
  `competitor_asin_cache`, `scrape_rate_usage` (TTL-purged nightly).

Erasure-hardening notes encoded in the registry: `feedback_events` (FK SET
NULL) and `beta_comments`/`beta_feedback`/`scrape_*` (no FK) are deleted
explicitly because CASCADE alone would leave them behind; `gdpr_requests`
survives erasure as the Art. 5(2) accountability record (opaque UUID only).

## Client-side storage (visitor's own device)

Strictly necessary: Supabase session token, theme/version prefs, work-in-progress
field caches (cleared on sign-out — includes `diagnosticUserData`,
`idea-brand-coach:*`, `idea.v4.context.*` since 2026-07-08). Consent-gated:
PostHog `ph_*` keys (only after opt-in). Functional: `alpha_fallback_distinct_id`
(threads explicitly-submitted feedback when analytics are off).

## Technical & organisational measures (Art. 32 summary)

RLS own-rows policies on all user tables (live-verified 2026-07-08); JWT
verification pinned at platform level for sensitive fns (`supabase/config.toml`);
service-role confined to edge functions; cross-user isolation hardening
(2026-06-21); IP rate-limit + body caps on public endpoints; secrets in
function env only; TLS via Caddy/Let's Encrypt; MCP gateway OAuth 2.1.
