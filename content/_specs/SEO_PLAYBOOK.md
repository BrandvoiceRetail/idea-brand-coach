# SEO Playbook — IDEA Brand Coach Blog

Distilled from a 12-doc agency SOP library, mapped to our actual stack: static
markdown → `scripts/build-blog.mjs` → `/blog/<slug>/index.html`, served by Caddy,
100 posts targeting Amazon-seller conversion queries. No CMS, no dev team for
heavy JS, no backlink program yet. This file is SSOT for the blog-authoring
skill and for editing existing posts — when a tactic below conflicts with a
post, the post is wrong, not this file.

## 1. Content-level tactics [writer]

**Match search intent before writing.** Google the target keyword; classify the
top 10 as Informational, Investigative, Comparison, Transactional/Commercial, or
Navigational. Our mapping: diagnosis queries ("why is my amazon ctr low") →
Informational/Investigative; tool-named queries → Investigative; "vs"/"best"
queries → Comparison. Writing to the wrong intent is why a page stalls at
#50+ forever — no on-page fix rescues an intent mismatch.

**Title tag: keyword + under 60 characters.** Include the exact target phrase,
stay under 60 characters end to end, never ALL CAPS, only use a year if the
query is genuinely time-bound (e.g. "amazon fee changes 2026"), never on
evergreen posts. Use one power word/number/bracket when it fits naturally
("7 Reasons...", "(2026 Update)") — Backlinko's CTR-by-position data says
position beats copywriting, but weak copywriting is the only lever we can pull
after publish.

**H1 = title, exactly once.** One `<h1>` per page (our build already renders
`post.title` as the sole H1). The keyword phrase must appear in it verbatim, not
just a variation.

**Answer-first intro, keyword in the first sentence.** Open with the direct
answer/diagnosis in sentence one, keyword included — this is what featured
snippets and AI answer engines (Perplexity, ChatGPT browsing, Google AI
Overviews) lift verbatim. Do not bury the answer under three paragraphs of
scene-setting; the narrative-spine story can follow the answer, not precede it.

**Keyword in the last sentence too.** A "Fail" in the source audit if missing;
cheap to satisfy, reinforces topical relevance for both classic ranking and
passage-retrieval AI systems.

**Heading structure: H1 → H2 → H3, no skipped levels.** First H2 must contain
the primary keyword or a close variation. `##`–`####` map to `<h2>`–`<h4>` in
the current renderer — never use headings for visual emphasis (that's what
`**bold**` is for).

**Word count = competitor median, not a fixed number.** Don't chase 2,000
words by default. Check what's actually ranking for the term and match or
modestly exceed its depth; thin content (<200 words) on a real query is a
liability, but padding a simple query past what the SERP rewards wastes writer
time.

**Depth techniques when a post needs more substance:** add an FAQ section
pulled from Google's People Also Ask, add one comparison table, add a
"handle the objection" section, add real (not fabricated) data/statistics with
a cited source. Per `CONTENT_BRIEF.md`'s honesty rails, never fabricate
statistics, testimonials, or case results — cite real external sources or omit.

**FAQ section, 3–5 questions.** Pull straight from People Also Ask for the
target keyword. This both improves depth/NLP coverage and becomes the source
for the `FAQPage` schema the build script should emit (see §2). Keep answers to
2–4 sentences; they need to stand alone as snippet answers.

**E-E-A-T signals every post needs:** speak in first person from the coach's
POV where the narrative spine calls for it (a founder's situation, traced by
the coach); cite real named tools only (never invented ones); link to a real
external source when citing a statistic or claim; never claim a fabricated
verified result. This is the site's actual line for AI-generated content
(<50% AI-detectable per the source SOP's warning) and Google's helpful-content
bar — both come down to the same test: does this read like someone actually
diagnosed a real situation.

**Internal linking: 5+ internal links per post, descriptive anchor text.**
Every post should link to at least 5 other posts/pages using anchor text that
describes the destination (not "click here", not raw exact-match spam).
Diversify anchor text across posts pointing at the same target — exact-match
anchor repeated everywhere is an over-optimization signal.

**Internal links flow toward money pages, sparingly.** Most links should
connect informational/diagnostic posts to each other (reverse-silo pattern);
link to `/diagnostic` in the body only where the narrative earns it — the CTA
box already guarantees one link per post, so body links to it should be
occasional, not redundant.

**Crawl depth ≤3 clicks from home.** Every post must be reachable from `/blog/`
in one click (already true) and `/blog/` from `/` in one click (already true).
If category hub pages are added (§2), keep posts one click from their hub.

**Freshness/upgrade cadence.** Re-visit a post's ranking-diagnosis-style
checklist (§4) any time a post has been live >6 months and isn't converting:
if it's stuck outside the top 15 for its target term with no intent mismatch,
upgrade depth/design; if it never ranked and >6 months old, rewrite or fold
into a hub. Bump the frontmatter `date` only when the change is substantive
(new data, restructured argument) — cosmetic edits shouldn't reset freshness
signals dishonestly.

**Pruning criteria.** Delete (remove the `.md`, let the route 404) any post
with the combination of: zero organic sessions, zero impressions in Search
Console, zero internal inlinks, zero backlinks, and content that's thin,
off-topic, or superseded by a better post. If the post has *any* traffic,
impressions, or backlinks, consolidate its unique value into the surviving
post and 301 instead of deleting outright (see §3).

## 2. Template/build-level tactics [build]

Implement once in `scripts/build-blog.mjs`; every post inherits it.

**Add `FAQPage` schema when a post has an FAQ section.** Parse `## FAQ` (or a
convention like an `faq:` frontmatter list of Q/A pairs) into a second
`<script type="application/ld+json">` block alongside the existing `Article`
block — multiple JSON-LD blocks per page are valid. This is the single highest-
leverage schema add: FAQPage is what actually earns rich results and is
heavily scraped by AI answer engines.

**Add `BreadcrumbList` schema.** Home → Blog → Category → Post, matching the
`byCategory` grouping already computed for the listing page. Cheap to derive
from data the build script already has in memory.

**Upgrade `Organization` schema with `logo`, `url`, and `sameAs`.** The
`Article.publisher` block currently has only a `name`. Add the real logo URL,
`https://ideabrandcoach.com`, and any owned social/profile URLs — this is what
makes a knowledge-panel eligible and is a trust signal AI crawlers use to
resolve entity identity.

**Enforce meta tag length at build time, not by convention.** Title ≤60 chars,
meta description 50–160 chars — the build already reads `title`/`description`
straight from frontmatter with no validation. Add a hard `throw` in `build()`
(same pattern as the existing date-format check) so a bad brief can't ship.

**Canonical tags: keep the current self-referencing pattern.** Already correct
— every post emits `<link rel="canonical" href="{BASE}/blog/{slug}/">`. No
change needed; just don't let a future refactor introduce parameterized URLs
without preserving this.

**Image SEO, once images are added to posts:** every `<img>` needs descriptive
`alt` text containing the keyword only when it's truly descriptive (never
stuffed), a keyword-bearing filename (`amazon-main-image-ctr-test.webp`, not
`IMG_4821.jpg`), explicit `width`/`height` attributes to prevent layout shift,
`loading="lazy"` on everything below the fold, and WebP format. Currently posts
are text-only — bake this into the markdown-image renderer before the first
image ships, not after 20 posts need retrofitting.

**Add `llms.txt` at the site root.** A plain-text file at `/llms.txt` listing
the blog index, top pillar posts, and `/diagnostic` with one-line descriptions
— the emerging convention AI crawlers (and increasingly agentic browsing tools)
check for a curated site map in natural language, distinct from `sitemap.xml`'s
machine format. Cheap, zero risk, directly serves an audience that increasingly
finds answers through AI chat rather than blue links.

**Reading time in the post-meta line.** The build already tokenizes
`post.body`; compute `Math.ceil(wordCount / 220)` and render "X min read" next
to the date and chips. Minor UX/dwell-time signal, near-zero implementation
cost given the data is already in memory.

**Separate `datePublished` from `dateModified` in JSON-LD.** Add a frontmatter
`updated` field (optional); when present, emit `dateModified` in the `Article`
schema and show "Updated {date}" in the post-meta line alongside the original
publish date. This is what makes freshness edits (see §1) actually register
with search engines instead of just changing a display string.

**Turn category groupings into real hub pages.** The listing page currently
renders categories as `<h2>` sections on one long `/blog/` page. Promote each
category to its own `/blog/category/<slug>/index.html` with 2–3 sentences of
intro copy and links to every post in it — the "hub page" technique that
collapses crawl depth, builds topical relevance, and gives us linkable
category URLs for outreach instead of an anchor-less page section.

**Pagination: not yet, revisit at ~150 posts.** One flat `/blog/` index is
fine at 100 posts; don't add pagination complexity before the index page
itself becomes a UX or crawl-budget problem.

## 3. Site/technical tactics [infra]

**Add a `Sitemap:` directive to `robots.txt`.** The current file has no
sitemap reference at all despite `sitemap.xml` existing at the root — a
one-line miss. Add `Sitemap: https://ideabrandcoach.com/sitemap.xml`.

**Simplify `robots.txt` to one real rule, then explicitly allow AI crawlers.**
The current file repeats `Allow: /` per-bot for no functional reason (default
allow-all already covers them). Collapse to `User-agent: *` / `Allow: /` +
the `Sitemap:` line, and add explicit `GPTBot`, `ClaudeBot`, `PerplexityBot`,
`Google-Extended` blocks with `Allow: /` — an audience that increasingly finds
brand-diagnosis content through AI answer engines shouldn't get fenced out by
a future "block all AI scrapers" edit made without checking this file.

**301, never 302, for any pruned or renamed slug.** When a post is deleted or
its `slug` frontmatter changes, add a permanent redirect in the Caddyfile
(`redir old-path new-path 301`) rather than letting it 404 or relying on a
temporary redirect — 302s don't consolidate link equity and signal
impermanence to crawlers.

**Cache headers: short-TTL revalidate on blog HTML, long-TTL immutable on
static assets.** Confirm the Caddy config applies `Cache-Control: no-cache` (or
short max-age + must-revalidate) to `/blog/*/index.html` — content changes on
freshness updates — while fonts and any future image assets get long-lived
immutable caching. `docs/DEPLOYMENT.md` already documents this pattern for the
SPA shell; extend the same policy explicitly to blog HTML if it isn't covered.

**Core Web Vitals are already in a strong position — protect it.** Fully
static HTML with inline CSS and no render-blocking JS on blog pages is the
ideal LCP/CLS profile; the risk is regression, not deficiency. Any future
addition (embeds, client-side widgets, web fonts) must be justified against
this baseline — self-host fonts with `font-display: swap` (already in
`public/fonts/`), never add a third-party script to a blog post template.

**Noindex policy: none needed on posts; reserve it for category hubs that
thin out.** Every published post should be indexable. If category hub pages
(§2) end up with very few posts (1–2), either merge categories or `noindex`
that hub until it has enough posts to be a real page — don't let a near-empty
hub compete with the posts it contains.

**Crawl hygiene: no orphans, no cannibalization.** Before publishing a new
post, grep existing `content/blog/*.md` frontmatter `keywords` for near-
duplicate targets — two posts chasing the same primary keyword is
cannibalization, not coverage. Every post must be linked from at least one
other post or hub at publish time (see §1); the build already fails loudly on
duplicate slugs — extend that discipline to duplicate primary keywords.

## 4. Off-page & measurement [roadmap]

**Search Console + GA4, connected and verified.** If not already done: verify
the domain property in Google Search Console, submit `sitemap.xml`, connect
GA4 with organic-traffic segmentation by landing page. This is the baseline
every other measurement tactic below depends on.

**Monthly benchmark, four numbers.** Track, monthly: total organic sessions,
total keywords ranking (any position), total referring domains, total
backlinks. Doesn't require Ahrefs — Search Console's Performance report plus a
free backlink checker covers this at our stage.

**Link-building approaches that fit a bootstrapped SaaS with content but no
outreach team:**
- **Statistics/data assets as link bait.** A genuinely well-sourced "Amazon
  conversion rate benchmarks" or "Amazon main-image CTR statistics" page is the
  single highest-leverage linkable asset type — it's what other Amazon-seller
  blogs and tool vendors cite. Build one, keep it current, promote it directly
  to the resource-page and guest-post targets below.
- **Resource-page link building.** Search `amazon seller resources`,
  `ecommerce tools intitle:resources`, `amazon seller "helpful links"` to find
  curated lists in our niche; pitch our statistics asset or the diagnostic tool
  for inclusion.
- **Respond to journalist/expert requests** (Qwoted, Featured, `#journorequests`
  on X/LinkedIn) as the brand's own subject-matter voice — low volume, but a
  numbers game with a real (if slow) payoff, and it doubles as brand-building.
- **Guest posts on adjacent Amazon-seller and ecommerce blogs**, pitching
  unique angles (not rehashes of our own posts) with one natural in-body link
  to a relevant post.
- **Niche edits** on existing Amazon-seller content that already links to a
  competitor's weaker resource — pitch our stronger, more current asset as a
  fair swap.
- **Skip:** donation link building, local chamber-of-commerce/business
  associations, GBP-adjacent tactics, and buying backlinks — see §5. Also skip
  the Merger Technique / expired-domain acquisition; too much manual due
  diligence risk for a one-person content operation.

**Ranking-diagnosis quick checklist — run quarterly on any post outside the
top 20 for its target term:**
1. Crawlable and indexed (no accidental noindex, no robots.txt block).
2. Keyword present in URL, title, meta description, H1, first H2, first
   sentence, last sentence.
3. Passes Core Web Vitals (should be automatic given the static template).
4. Has 5+ internal inlinks from other posts.
5. Actually satisfies the intent the top-10 SERP is satisfying (re-check —
   intent can drift as Google's understanding of a query shifts).
6. Fresh — no stale year references, no outdated screenshots/claims.
7. Cites real sources, no fabricated stats or testimonials.

## 5. Explicitly skipped

- **Local SEO (doc 12) — entirely skipped.** No physical address, no Google
  Business Profile, no local-pack relevance; the product is a SaaS diagnostic
  tool with no location.
- **International SEO / hreflang (doc 06) — skipped.** Single-market, English-
  only content today; revisit only if a non-English market becomes a real
  target.
- **Chamber of Commerce, niche business associations, donation link building
  (doc 11) — skipped.** These are local-business citation/relationship plays
  with no equivalent for a remote SaaS brand.
- **Buying backlinks / Loganix-style link marketplaces (doc 11) — skipped.**
  Against Google's guidelines, and a bootstrapped one-person content operation
  can't absorb the risk or the vetting overhead this requires to do "safely."
- **Screaming Frog / Siteliner / Copyscape paid-tool workflows (docs 03, 06) —
  skipped as described.** The audit techniques they support (broken links,
  duplicate content, redirect chains) matter, but at 100 static, generated-
  from-source-markdown pages, `grep`/the build script's own duplicate-slug and
  duplicate-keyword checks (§3) cover the same ground without a paid tool.
- **WordPress-specific plugin instructions (Yoast, All-in-One SEO, WP Rocket,
  Redirection plugin, etc.) throughout docs 06/08/09/10 — skipped.** We're not
  on WordPress; every one of those jobs (sitemap, schema, redirects, noindex)
  is handled directly in `build-blog.mjs` and the Caddy config instead.
- **"Backup the original content" via WordPress duplicate-post plugin (doc
  09) — skipped.** Git history on `content/blog/*.md` is the backup; no
  additional step needed.
- **GBP posting cadence, review-generation campaigns, NAP-W consistency (doc
  12) — skipped.** No physical listing to optimize.
