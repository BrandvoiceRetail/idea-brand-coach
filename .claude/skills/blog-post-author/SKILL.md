---
name: blog-post-author
description: >
  Create or curate IDEA Brand Coach blog posts the correct way — cluster-aware
  SEO (primary/secondary keywords, reverse-silo internal links), the content
  quality bar, diagrams for visual/kinetic learners, Trevor's voice with an
  AI-foible scan, and LLM/AI-search discoverability. Use whenever writing a new
  blog post, editing/upgrading an existing post, adding a diagram, planning a
  new keyword cluster, or reviewing blog content quality. Triggers: "write a
  blog post", "new post about X", "upgrade this post", "add a diagram",
  "blog SEO", "new cluster", "content pruning".
---

# Blog Post Author & Curator — IDEA Brand Coach

The blog is a **keyword-cluster machine**: 9 clusters, each with one pillar
guide plus supporting posts. Supporting posts earn external backlinks and pass
authority up to their pillar (reverse-silo); the pillar links out to every
member. Every post exists to rank for exactly ONE primary keyword and to move
an Amazon-first brand owner toward the free diagnostic.

## The four contracts (read before writing anything)

| File | What it governs |
|---|---|
| `content/_specs/CONTENT_BRIEF.md` | Product truth, exact tool names, funnel taxonomy, voice, honesty rails, markdown subset, formats |
| `content/_specs/SEO_PLAYBOOK.md` | Every SEO tactic (on-page, build, infra, roadmap) — SSOT; when a post conflicts with it, the post is wrong |
| `content/_specs/DIAGRAM_SYSTEM.md` | The SVG design system: validated palette, archetypes, animation rules, boilerplate |
| `content/_specs/keyword-clusters.json` | The cluster map: pillars, every post's primary/secondary keywords — keep it in sync with frontmatter |

Deterministic gates (run both before calling anything done):

```bash
node scripts/validate-content.mjs   # quality bar — must exit 0
node scripts/build-blog.mjs         # must build; output in public/blog/
```

## Creating a NEW post

1. **Pick the cluster and the primary keyword first, not the topic.**
   - The post must join an existing cluster in `keyword-clusters.json` (or you
     are proposing a new cluster — see below).
   - Primary keyword: long-tail, winnable at low domain authority — question
     form or specific problem phrasing ("why is my amazon ctr low"), never a
     head term. Check it is UNIQUE across the whole corpus (`grep -r
     "primary_keyword:" content/blog/` — a duplicate is cannibalization, and
     the validator hard-fails it).
   - Validate volume/difficulty in SEMrush/Ahrefs when available; the
     cluster's `keyword_alternates` list holds pre-picked fallbacks.
2. **Match search intent.** Google the keyword; classify the top 10
   (informational / investigative / comparison / transactional). Write to that
   intent — no on-page tactic rescues an intent mismatch.
3. **Write the post** per CONTENT_BRIEF §5a plus these SEO/NLP rules:
   - Frontmatter adds: `cluster`, `role: supporting`, `primary_keyword`,
     `secondary_keywords` (comma-separated semantic variants). Title ≤60 chars
     with the primary keyword verbatim; description 50–160 chars.
   - **Answer-first**: sentence one contains the primary keyword and the
     direct answer/diagnosis (this is what featured snippets and AI answer
     engines lift). Name the audience explicitly ("Amazon brand owners").
     The narrative-spine story follows the answer.
   - Primary keyword in the LAST paragraph too; first H2 contains it or a
     close variation; H1→H2→H3 order, no skipped levels.
   - NLP clarity: unambiguous subject-verb-object sentences; ONE consistent
     name per entity; secondary keywords woven as natural variants.
   - `## FAQ` with 3–5 `### question` entries (People-Also-Ask style, 2–4
     standalone sentences each) — the build turns this into FAQPage schema.
   - **Internal links (reverse-silo)**: ≥5 links to real `/blog/<slug>/`
     paths; ALWAYS link your cluster's pillar with a descriptive
     keyword-bearing anchor (vary the wording post-to-post — identical
     exact-match anchors everywhere is an over-optimization signal). Then add
     the new post to the pillar's body links and to
     `keyword-clusters.json` members.
   - Honesty rails: illustrative numbers only ("say your CTR is 0.31%"),
     composite founders, exact backticked tool names, the coach PLANS /
     Higgsfield RENDERS. No fabricated stats, results, or testimonials.
4. **Add at least one diagram** (see below).
5. **Run the foible scan + voice pass** (see below).
6. **Gates**: validator exit 0, build green, then deploy per
   `docs/DEPLOYMENT.md` (staging first: rsync `dist/` to
   `/opt/ideabrandcoach-staging/`).

## Diagrams — visual and kinetic learners

Every post needs ≥1 diagram; pillars need 2. Follow
`content/_specs/DIAGRAM_SYSTEM.md` to the letter:

- File: `content/blog/_assets/<slug>--<short-name>.svg`, embedded as
  `![takeaway alt](/blog/assets/<file>.svg "caption in Trevor's voice")`.
- Copy the boilerplate SVG (fonts, ink tokens, reduced-motion guard) and draw
  inside it. Palette is validated — the four hexes in the doc, nothing else.
- Pick ONE archetype: funnel-position map, before/after split, working-session
  flow, IDEA scorecard, decision-trigger pick, metric trajectory.
- **Kinetic learners**: animation is allowed (dash-flow along a connector,
  breathing highlight) but the static frame must carry the full meaning and
  the `prefers-reduced-motion` guard is mandatory. At most one animated idea
  per diagram; never animate text.
- Alt text states the takeaway, not the picture. The validator checks the
  file exists, has a `<title>`, no external refs, and the motion guard.

## Trevor's voice + AI-foible scan

Direct, warm, forensic. Short sentences. Concrete. Diagnose-then-prescribe.
"You" = the founder. Would a sharp founder forward this?

Hard-banned (validator fails): "in today's", "game-changer", "unlock the",
"supercharge", "delve", "elevate your", "in the ever-", "landscape of",
"let's dive in", "dive into the world", "it's not just about"/"isn't just
about", "revolutionize", "seamlessly". Keep em-dashes ≤12 per post.
Soft-avoid: furthermore, moreover, additionally, in conclusion, ultimately.

## LLM / AI-search discoverability (mostly automatic)

The build emits: FAQPage + Article + BreadcrumbList JSON-LD, `llms.txt`
(pillars first) and `llms-full.txt`, canonical URLs, and `robots.txt`
explicitly allows GPTBot/ClaudeBot/PerplexityBot/Google-Extended. Your job as
a writer is the answer-first intro and standalone FAQ answers — those are what
AI engines quote. Don't add scripts/embeds to posts (protects Core Web Vitals).

## Curating EXISTING posts

- **Upgrade** (>6 months old, stuck outside top 15, intent still right): add
  depth (FAQ from current People-Also-Ask, a comparison, an objection
  section), refresh the diagram, re-check keyword placement; set `updated:`
  in frontmatter ONLY for substantive changes (it drives `dateModified`).
- **Prune** (zero sessions + zero impressions + zero inlinks/backlinks +
  thin): delete the `.md`; if it has ANY signal, consolidate into the best
  sibling and add a Caddy 301 (`redir` — never 302) for the old slug.
- **Never**: two posts on the same primary keyword; changing a slug without a
  301; bumping `date` for cosmetic edits.
- Quarterly: run the ranking-diagnosis checklist in SEO_PLAYBOOK §4 on any
  post outside the top 20 for its term.

## Proposing a NEW cluster

New cluster = a new pillar. Add the cluster object to
`keyword-clusters.json` (id, primary keyword + alternates, pillar slug/title/
description/brief, members), write the pillar per the pillar rules (1,800+
words, links OUT to every member, 2 diagrams), then wire every member's
frontmatter + pillar link. The blog index and llms.txt pick up `role: pillar`
automatically.
