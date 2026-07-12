# Review Summary: Coach review auto-pull (ingest_evidence asin → review-scraper)

PR: `mcp-oauth` — feature commit `c4ea117`, review hardening `<this commit>`.
Reviewers: security-auditor, technical-architect, exactly-right (parallel, read-only) + synthesis.
Scope: 4 files, +290/−57 (feature) — one coherent feature. Artifact test: **pass** (single arch/func/review story).

## Verdict

No correctness/architecture `[BLOCKER]`. Three security `[BLOCKER]`s — all rooted in one cause
(the MCP tool built the scrape URL from unvalidated `asin`/`marketplace`) — **fixed and verified
live**. The competitor-flow contract on the shared `review-scraper` edge fn is preserved.

## Findings & resolution (by severity)

| Sev | Finding | Location | Resolution |
|-----|---------|----------|------------|
| [BLOCKER] | `marketplace` interpolated unvalidated → `evil.com/x?=` scrapes an arbitrary host | `ingestEvidence.ts` | **FIXED** — `buildScrapeUrl` validates against a marketplace allowlist. Live: `evil.com/x?=` → refused, no scrape. |
| [BLOCKER] | `asin` interpolated into path → `B1/../../s?k=x` scrapes arbitrary Amazon pages | `ingestEvidence.ts` | **FIXED** — ASIN validated `^[A-Z0-9]{10}$`; URL form must be `amazon.*` host. Live: `B0XYZ` → refused. |
| [BLOCKER] | `isPublicHttpUrl` misses IPv6 → `::ffff:169.254.169.254` (metadata) passes | `review-scraper/index.ts` | **FIXED** — reject all IPv6 literals (strip brackets, `host.includes(':')`). Live: metadata literal → "No valid public URLs". |
| [ISSUE] | `maxReviewsPerUrl` caller-controlled, unbounded (response-size DoS) | `review-scraper/index.ts` | **FIXED** — `Math.min(…, 50)`. Live: `99` → capped. |
| [ISSUE] | Raw Firecrawl error body + raw response slice in `console.error` (key-leak risk) | `review-scraper/index.ts` | **FIXED** — `redactSecret()` strips key/bearer; missing-markdown logs keys only, not body. |
| [ISSUE] | No `.max()` on `asin`/`marketplace`/`source_label`/`reviews_text`/`listing_text` | `ingestEvidence.ts` | **FIXED** — Zod bounds added (12 / 2048 / 500 / 100k / 100k). |
| [ISSUE] | `/amazon\.[a-z.]+\//` unanchored → false-matches `notamazon.com/` | `review-scraper/index.ts` | **FIXED** — `isAmazonHost()` tests `new URL(url).hostname`. |
| [ISSUE] | Whitespace / leading-dot in `asin`/`marketplace` build malformed URLs | `ingestEvidence.ts` | **FIXED** — `buildScrapeUrl` trims + strips leading dots before validation. |
| [ISSUE] | Dead `if (!scraped)` branch + inaccurate `| null` return type | `review-scraper/index.ts` | **FIXED** — `scrapeUrl` returns non-null/throws; dead branch removed, type tightened. |
| [ISSUE] | Implicit `'Anonymous'`/`0` sentinel coupling across the layer boundary | `ingestEvidence.ts:toParsedReview` | **FIXED (documented)** — contract comment naming the sentinels. |
| [ISSUE] | Test gaps: full-URL passthrough, asin+product_id, validation rejection | `contextTools.test.ts` | **FIXED** — +3 tests (21 total, green). |
| [SUGGESTION] | "Found N reviews" log printed pre-slice count | `review-scraper/index.ts` | **FIXED** — logs `kept.length`. |
| [NITPICK] | File-header docstring still called `asin` a stub | `ingestEvidence.ts` | **FIXED** — updated. |
| [ISSUE] | No per-user Firecrawl credit rate limit / daily quota | `ingestEvidence.ts` / edge fn | **DEFERRED** → TICKET-1 |
| [ISSUE] | Redirect-follow SSRF (guard is pre-redirect only) | `review-scraper/index.ts` | **DEFERRED** → TICKET-2 |
| [ISSUE] | Markdown heading-fallback can mislabel non-review sections as reviews | `review-scraper/parseReviewsFromMarkdown` | **DEFERRED** → TICKET-3 |
| [QUESTION] | Octal/hex IP encodings | `review-scraper/index.ts` | **RESOLVED** — Deno WHATWG URL normalizes to dotted-decimal before the guard; caught by the existing IPv4 check. |
| [PRAISE] | `getUser()` closes anon-key bypass; JWT from AsyncLocalStorage not tool args; RLS + server-side `user_id`; never-fabricate on every failure path; `EdgeFnClient` seam; `toParsedReview` SRP | — | Kept. |

## SOLID / DRY

- **SRP** ✅ `buildScrapeUrl`, `toParsedReview`, `reviewsFromJson`, `isAmazonHost`, `redactSecret` are each single-purpose.
- **DIP** ✅ `ingest_evidence` depends on the `EdgeFnClient` abstraction (constructor-injected), not raw `fetch`.
- **DRY** ✅ `reviewsFromJson` (wire/`ScrapedReview`) vs `toParsedReview` (lean `ParsedReview`, title-folded) are genuinely different transforms across two layers — not duplication. Only shared concept (the sentinels) is now documented.

## Security review

Input validation ✅ (ASIN + marketplace allowlist at the boundary). Auth ✅ (`getUser()` + JWT-bound).
Secrets ✅ (redacted in logs). SSRF ✅ (IPv6 closed; arbitrary-host scrape closed at the tool layer;
redirect-follow deferred to TICKET-2). Tenant isolation ✅ (RLS + server-side `user_id`).

## Diff quality

Reviewable: ✅. Feature + hardening are two logical commits. Tests: 390/390 (1 pre-existing flake, re-ran green).
Edge fn + MCP both deployed and re-verified live (valid scrape works; injections refused).

## Follow-up tickets

- **TICKET-1 [ISSUE]** Per-user Firecrawl credit rate limit / daily quota (token bucket or Supabase counter) gating the scrape. Rationale: no customers yet; bigger infra; ship now, add before multi-tenant load.
- **TICKET-2 [ISSUE]** Redirect-follow SSRF: validate Firecrawl's final URL (or disable redirects) so a public host can't 302 to a metadata IP. Targets Firecrawl's infra; lower priority.
- **TICKET-3 [ISSUE]** Tighten `parseReviewsFromMarkdown` heading-fallback (require a rating signal / gate to review-site hosts) so non-review sections aren't mislabeled. Mitigated in practice by the JSON-primary path.

## Hand-off to DOCS

Code is clean and hardened, deployed, and live-verified. Ready for runbook/docs.
