#!/usr/bin/env node
/**
 * build-blog.mjs — content/blog/*.md → public/blog/<slug>/index.html
 * + public/blog/index.html (listing) + public/sitemap.xml
 * + public/llms.txt / public/llms-full.txt (AI-engine discoverability)
 * + copies content/blog/_assets/** → public/blog/assets/** (diagrams, images)
 *
 * Zero dependencies by design (Layer-3 deterministic build step; runs on the
 * CI runner and locally with plain node). Renders the constrained markdown
 * subset the content brief allows: #–#### headings, paragraphs, **bold**,
 * *italic*, `code`, [links](url), -/1. lists, > blockquotes, ``` fences, ---,
 * and block images ![alt](/blog/assets/... "optional caption") → <figure>.
 *
 * Frontmatter (simple `key: value` strings between --- fences):
 *   title, description, date (YYYY-MM-DD), category, funnel, tools
 *   (comma-separated coach tool names), keywords, slug (optional — defaults
 *   to the filename without extension), updated (optional YYYY-MM-DD).
 *
 * SEO structures emitted per post (see content/_specs/SEO_PLAYBOOK.md):
 *   Article + BreadcrumbList JSON-LD always; FAQPage JSON-LD when the post
 *   has an "## FAQ" section of "### question" / answer pairs; author byline
 *   (E-E-A-T); reading time; related-posts block for crawl depth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'blog');
const ASSETS_SRC = path.join(SRC, '_assets');
const OUT = path.join(ROOT, 'public', 'blog');
const BASE = 'https://ideabrandcoach.com';

// Category hubs: each becomes /blog/category/<slug>/ with intro copy. Any
// category not listed here still gets a hub with a generic intro.
const catSlug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const CATEGORY_META = {
  Diagnose: 'Find the real reason a listing or funnel is leaking sales — before you rewrite a word. Trust Gap diagnosis, decision triggers, and reading the number that is telling you something is wrong.',
  Creative: 'Direct the images, titles, A+ content, and video that actually convert — grounded in the customer avatar, not guesswork. Where the brand coach plans and Higgsfield renders.',
  Funnel: 'Map the whole Amazon-first funnel, find the weakest link, and fix the touchpoint that is quietly costing you the most — from the search grid to the buy box.',
  Customer: 'Know the buyer well enough to sell to them: their exact words, the job they are hiring your product for, and the objection that stops the sale.',
  Retention: 'Turn one-time buyers into repeat customers with post-purchase email, packaging, and win-back flows that build a brand instead of chasing the next click.',
  Measure: 'Prove what actually worked. Before/after lift, structured tests, and the metrics that separate a real win from noise.',
};
const catIntro = (c) => CATEGORY_META[c] || `Conversion playbooks for Amazon-first brand owners, filed under ${c}.`;

/* ── frontmatter ─────────────────────────────────────────────────────────── */
function parseFrontmatter(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) throw new Error(`${file}: bad frontmatter line: ${line}`);
    meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  for (const req of ['title', 'description', 'date', 'category']) {
    if (!meta[req]) throw new Error(`${file}: frontmatter missing "${req}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
  if (meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) throw new Error(`${file}: updated must be YYYY-MM-DD`);
  return { meta, body: m[2] };
}

/* ── markdown subset → HTML ──────────────────────────────────────────────── */
const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
  return out;
}

// Block image → semantic figure. Animated SVGs (CSS/SMIL inside the file)
// still play inside <img>, which keeps the page script-free.
const IMG_RE = /^!\[([^\]]*)\]\((\/blog\/assets\/[^\s)"]+)(?:\s+"([^"]*)")?\)\s*$/;

function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let i = 0;
  const isListItem = (l) => /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; // closing fence
      html.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const img = line.match(IMG_RE);
    if (img) {
      const [, alt, src, caption] = img;
      html.push(`<figure><img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"/>${caption ? `<figcaption>${inline(caption)}</figcaption>` : ''}</figure>`);
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) { html.push('<hr/>'); i++; continue; }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${buf.map((l) => `<p>${inline(l)}</p>`).join('')}</blockquote>`);
      continue;
    }
    if (isListItem(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && isListItem(lines[i])) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isListItem(lines[i]) &&
           !lines[i].startsWith('#') && !lines[i].startsWith('>') &&
           !lines[i].startsWith('```') && !/^---+\s*$/.test(lines[i]) && !IMG_RE.test(lines[i])) {
      buf.push(lines[i++]);
    }
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return html.join('\n');
}

/* ── FAQ extraction: "## FAQ" section with "### question" + answer paras ── */
function extractFaq(body) {
  const m = body.match(/^## FAQ\s*$([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  if (!m) return [];
  const faqs = [];
  const re = /^### (.+)$\n([\s\S]*?)(?=^### |\s*$(?![\s\S]))/gm;
  let q;
  while ((q = re.exec(m[1])) !== null) {
    const answer = q[2].trim().replace(/\s+/g, ' ');
    if (q[1].trim() && answer) faqs.push({ q: q[1].trim(), a: answer });
  }
  return faqs;
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const readMins = (body) => Math.max(1, Math.round(words(body) / 200));

/* ── shared chrome (landing.html design tokens) ──────────────────────────── */
const CSS = `
:root{--blk:#0B0B0B;--ink:#F5F4F0;--ink-dim:rgba(245,244,240,.82);--ink-faint:rgba(245,244,240,.52);
--gld:#D4960A;--gld-mid:#E7A412;--hair:rgba(245,244,240,.10);--hair-2:rgba(245,244,240,.18);
--glass:linear-gradient(155deg,rgba(32,32,35,.68),rgba(11,11,13,.48));--radius:18px;--radius-sm:12px;
--maxw:760px;--f-body:'Inter',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--f-body);background:var(--blk);color:var(--ink);line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden;text-wrap:pretty}
body::before{content:"";position:fixed;inset:-20vmax;z-index:-2;pointer-events:none;background:radial-gradient(38vmax 38vmax at 12% 0%,rgba(212,150,10,.09),transparent 60%),radial-gradient(44vmax 44vmax at 90% 18%,rgba(212,150,10,.055),transparent 62%)}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:14px 28px;background:rgba(11,11,11,.78);backdrop-filter:blur(14px);border-bottom:1px solid var(--hair)}
.logo{display:flex;align-items:baseline;gap:10px;text-decoration:none;color:var(--ink)}
.logo-name{font-weight:800;font-size:1.15rem;letter-spacing:-.02em}
.logo-sub{font-size:.66rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}
.nav-links{display:flex;align-items:center;gap:22px}
.nav-links a{color:var(--ink-dim);text-decoration:none;font-size:.9rem;font-weight:600}
.nav-links a:hover{color:var(--ink)}
.nav-cta{background:var(--gld);color:#1a1206 !important;padding:9px 16px;border-radius:999px;font-weight:700}
h1,h2,h3,h4{font-weight:800;letter-spacing:-.025em;line-height:1.12;color:var(--ink);text-wrap:balance}
h1{font-size:clamp(1.7rem,4vw,2.5rem);margin:18px 0 10px}
h2{font-size:clamp(1.3rem,2.6vw,1.7rem);margin:38px 0 12px}
h3{font-size:1.12rem;margin:28px 0 10px}
article p{margin:0 0 16px;color:var(--ink-dim)}
article ul,article ol{margin:0 0 18px 22px;color:var(--ink-dim)}
article li{margin:6px 0}
article a{color:var(--gld-mid)}
article blockquote{border-left:3px solid var(--gld);padding:6px 18px;margin:18px 0;background:var(--glass);border-radius:0 var(--radius-sm) var(--radius-sm) 0}
article code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85em;background:rgba(212,150,10,.12);border:1px solid var(--hair);border-radius:6px;padding:1px 6px;color:var(--gld-mid)}
article pre{background:var(--glass);border:1px solid var(--hair);border-radius:var(--radius-sm);padding:16px;overflow-x:auto;margin:0 0 18px}
article pre code{background:none;border:none;padding:0;color:var(--ink-dim)}
article hr{border:none;border-top:1px solid var(--hair-2);margin:32px 0}
article figure{margin:26px 0;background:var(--glass);border:1px solid var(--hair);border-radius:var(--radius);padding:18px}
article figure img{display:block;width:100%;height:auto;border-radius:var(--radius-sm)}
article figcaption{margin-top:10px;font-size:.82rem;color:var(--ink-faint);text-align:center}
.eyebrow{display:inline-block;font-size:.68rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gld);margin-top:34px}
.post-meta{font-size:.82rem;color:var(--ink-faint);margin-bottom:26px}
.chip{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.06em;padding:3px 10px;border:1px solid var(--hair-2);border-radius:999px;color:var(--ink-dim);margin-right:6px}
.chip-link{text-decoration:none}
.chip-link:hover{border-color:var(--gld);color:var(--gld-mid)}
.crumb{font-size:.8rem;color:var(--ink-faint);margin:6px 0 2px}
.crumb a{color:var(--ink-dim);text-decoration:none}
.crumb a:hover{color:var(--gld-mid)}
.byline{display:flex;gap:14px;align-items:center;background:var(--glass);border:1px solid var(--hair);border-radius:var(--radius);padding:16px 18px;margin:36px 0 8px}
.byline .avatar{flex:none;width:44px;height:44px;border-radius:50%;background:var(--gld);color:#1a1206;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:1.05rem}
.byline p{margin:0;font-size:.85rem;color:var(--ink-dim)}
.byline strong{color:var(--ink)}
.cta-box{background:var(--glass);border:1px solid var(--hair-2);border-radius:var(--radius);padding:26px;margin:40px 0}
.cta-box h3{margin-top:0}
.btn{display:inline-block;background:var(--gld);color:#1a1206;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;margin-top:12px}
.card{display:block;background:var(--glass);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;margin:14px 0;text-decoration:none;transition:border-color .15s}
.card:hover{border-color:var(--gld)}
.card h3{margin:6px 0 8px;color:var(--ink)}
.card p{color:var(--ink-dim);font-size:.92rem;margin:0}
.related{margin-top:34px}
.related h2{font-size:1.15rem}
footer{border-top:1px solid var(--hair);margin-top:70px;padding:36px 24px;text-align:center;color:var(--ink-faint);font-size:.85rem}
footer a{color:var(--gld);text-decoration:none}
main{padding:14px 0 40px}
@media (prefers-reduced-motion: reduce){*{animation:none !important;transition:none !important}}
`;

const NAV = `<nav>
  <a href="/" class="logo"><span class="logo-name">IDEA<sup>™</sup></span><span class="logo-sub">Strategic Brand Creation</span></a>
  <div class="nav-links">
    <a href="/blog/">Blog</a>
    <a href="/auth">Log in</a>
    <a href="/diagnostic" class="nav-cta">Run the free diagnostic</a>
  </div>
</nav>`;

const FOOTER = `<footer>
  <p><strong style="color:var(--ink)">IDEA™ Brand Coach</strong> &middot; <a href="/">Home</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/diagnostic">Run the diagnostic</a> &middot; <a href="/privacy">Privacy</a></p>
  <p style="margin-top:8px;opacity:.7">Built on <em>What Captures the Heart Goes in the Cart</em> by Trevor Bradford &middot; IDEA Brand Consultancy &middot; Brandvoice Retail Ltd</p>
</footer>`;

const CTA = `<div class="cta-box">
  <h3>Find the Trust Gap costing you sales</h3>
  <p>The free IDEA Brand Coach diagnostic finds the one thing stopping your Amazon listing from converting — and gives you the brief to fix it. 6 questions, no account, instant result.</p>
  <a class="btn" href="/diagnostic">Run the free diagnostic →</a>
</div>`;

const BYLINE = `<div class="byline">
  <div class="avatar">TB</div>
  <p><strong>The IDEA Brand Coach team</strong>, built with Trevor Bradford — brand consultant and author of <em>What Captures the Heart Goes in the Cart</em>. The IDEA framework (Insight-Driven, Distinctive, Empathetic, Authentic) comes from twenty years of brand work, now applied to Amazon-first ecommerce brands.</p>
</div>`;

function pageShell({ title, description, canonical, body, jsonLd }) {
  const ld = (Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [])
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" type="image/x-icon" href="/favicon.ico"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${BASE}/idea-social-card.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="stylesheet" href="/fonts/inter.css"/>
${ld}
<style>${CSS}</style>
</head>
<body>
${NAV}
<main class="wrap">
${body}
</main>
${FOOTER}
</body>
</html>`;
}

/* ── build ───────────────────────────────────────────────────────────────── */
function copyAssets() {
  if (!fs.existsSync(ASSETS_SRC)) return 0;
  const dst = path.join(OUT, 'assets');
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(ASSETS_SRC)) {
    if (f.startsWith('.')) continue;
    fs.copyFileSync(path.join(ASSETS_SRC, f), path.join(dst, f));
    n++;
  }
  return n;
}

function build() {
  if (!fs.existsSync(SRC)) {
    console.log(`build-blog: no ${path.relative(ROOT, SRC)} directory — nothing to do.`);
    return;
  }
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md')).sort();
  const posts = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw, file);
    const slug = (meta.slug || file.replace(/\.md$/, '')).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${file}: bad slug "${slug}"`);
    posts.push({ ...meta, slug, body });
  }
  const dupes = posts.map((p) => p.slug).filter((s, i, a) => a.indexOf(s) !== i);
  if (dupes.length) throw new Error(`duplicate slugs: ${[...new Set(dupes)].join(', ')}`);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const nAssets = copyAssets();

  const byCategory = new Map();
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  for (const p of sorted) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }

  for (const post of posts) {
    const canonical = `${BASE}/blog/${post.slug}/`;
    const faqs = extractFaq(post.body);
    const jsonLd = [{
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      ...(post.updated ? { dateModified: post.updated } : {}),
      author: { '@type': 'Organization', name: 'IDEA Brand Coach', url: BASE },
      publisher: {
        '@type': 'Organization',
        name: 'IDEA Brand Consultancy',
        url: BASE,
        logo: { '@type': 'ImageObject', url: `${BASE}/apple-touch-icon.png` },
        sameAs: ['https://ideabrandconsultancy.com'],
      },
      mainEntityOfPage: canonical,
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog/` },
        { '@type': 'ListItem', position: 3, name: post.category, item: `${BASE}/blog/category/${catSlug(post.category)}/` },
        { '@type': 'ListItem', position: 4, name: post.title, item: canonical },
      ],
    }];
    if (faqs.length) {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    const catHub = `/blog/category/${catSlug(post.category)}/`;
    const chips = `<a class="chip chip-link" href="${catHub}">${escapeHtml(post.category)}</a>`
      + (post.funnel ? `<span class="chip">${escapeHtml(post.funnel)}</span>` : '');
    const crumb = `<nav class="crumb"><a href="/blog/">Blog</a> &rsaquo; <a href="${catHub}">${escapeHtml(post.category)}</a></nav>`;
    // Reverse-silo "Keep reading": supporting posts surface their cluster's
    // pillar first, then cluster siblings; pillars surface newest members;
    // posts without cluster metadata fall back to category siblings.
    const clusterMates = post.cluster ? posts.filter((p) => p.cluster === post.cluster && p.slug !== post.slug) : [];
    let sibs;
    if (post.role === 'supporting' && clusterMates.length) {
      const pillar = clusterMates.find((p) => p.role === 'pillar');
      const others = clusterMates.filter((p) => p.role !== 'pillar').slice(0, pillar ? 2 : 3);
      sibs = [...(pillar ? [pillar] : []), ...others];
    } else if (post.role === 'pillar' && clusterMates.length) {
      sibs = clusterMates.slice(0, 3);
    } else {
      sibs = (byCategory.get(post.category) || []).filter((p) => p.slug !== post.slug).slice(0, 3);
    }
    const related = sibs.length ? `<div class="related">
<h2>Keep reading</h2>
${sibs.map((p) => `<a class="card" href="/blog/${p.slug}/">${p.role === 'pillar' ? '<span class="chip">The complete guide</span>' : ''}<h3>${inline(p.title)}</h3><p>${inline(p.description)}</p></a>`).join('\n')}
</div>` : '';
    const dateLine = post.updated && post.updated !== post.date
      ? `${post.date} &middot; updated ${post.updated}` : post.date;
    const body = `<span class="eyebrow">IDEA Brand Coach — Blog</span>
${crumb}
<article>
<h1>${inline(post.title)}</h1>
<div class="post-meta">${dateLine} &nbsp; ${readMins(post.body)} min read &nbsp; ${chips}</div>
${renderMarkdown(post.body)}
${BYLINE}
${CTA}
</article>
${related}
<p style="margin-top:8px"><a href="/blog/" style="color:var(--gld-mid);text-decoration:none">← All articles</a></p>`;
    const dir = path.join(OUT, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'),
      pageShell({ title: `${post.title} | IDEA Brand Coach`, description: post.description, canonical, body, jsonLd }));
  }

  const card = (p, badge) => `<a class="card" href="/blog/${p.slug}/">
  ${badge || `<span class="chip">${escapeHtml(p.funnel || p.category)}</span>`}<span class="chip">${p.date}</span>
  <h3>${inline(p.title)}</h3>
  <p>${inline(p.description)}</p>
</a>`;
  const guideBadge = '<span class="chip">The complete guide</span>';

  // Category hub pages — /blog/category/<slug>/ — collapse the long index and
  // give each topic a linkable, crawlable URL (SEO hub-page pattern).
  const categoriesOrdered = [...byCategory.keys()];
  for (const [cat, list] of byCategory.entries()) {
    const slug = catSlug(cat);
    const hubUrl = `${BASE}/blog/category/${slug}/`;
    const catPillars = list.filter((p) => p.role === 'pillar');
    const catPosts = list.filter((p) => p.role !== 'pillar');
    const hubBody = `<span class="eyebrow">Brand Coach Blog</span>
<nav class="crumb"><a href="/blog/">Blog</a> &rsaquo; ${escapeHtml(cat)}</nav>
<h1>${escapeHtml(cat)}</h1>
<p style="color:var(--ink-dim);max-width:60ch">${escapeHtml(catIntro(cat))}</p>
${catPillars.length ? `<h2 id="guides">The complete guide${catPillars.length > 1 ? 's' : ''}</h2>\n${catPillars.map((p) => card(p, guideBadge)).join('\n')}` : ''}
<h2 id="articles">All ${escapeHtml(cat)} articles</h2>
${catPosts.map((p) => card(p)).join('\n')}
${CTA}
<p style="margin-top:8px"><a href="/blog/" style="color:var(--gld-mid);text-decoration:none">← All topics</a></p>`;
    const dir = path.join(OUT, 'category', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageShell({
      title: `${cat} — Brand Coach Blog | IDEA Brand Coach`,
      description: catIntro(cat).slice(0, 158),
      canonical: hubUrl,
      body: hubBody,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${cat} — IDEA Brand Coach Blog`,
        url: hubUrl,
        description: catIntro(cat),
      }, {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog/` },
          { '@type': 'ListItem', position: 3, name: cat, item: hubUrl },
        ],
      }],
    }));
  }

  // Main index — lean: guides, latest, then browse-by-topic hub cards.
  const pillars = sorted.filter((p) => p.role === 'pillar');
  const guides = pillars.length ? `
<h2 id="guides">Start here: the guides</h2>
<p style="color:var(--ink-faint);max-width:56ch;margin-top:-4px">Nine deep-dive guides, one per problem area. Each links out to every supporting playbook in its cluster.</p>
${pillars.map((p) => card(p, guideBadge)).join('\n')}` : '';
  const latest = sorted.filter((p) => p.role !== 'pillar').slice(0, 6);
  const latestSection = `
<h2 id="latest">Latest playbooks</h2>
${latest.map((p) => card(p)).join('\n')}`;
  const topics = `
<h2 id="topics">Browse by topic</h2>
${categoriesOrdered.map((cat) => {
    const list = byCategory.get(cat);
    return `<a class="card" href="/blog/category/${catSlug(cat)}/">
  <span class="chip">${list.length} article${list.length === 1 ? '' : 's'}</span>
  <h3>${escapeHtml(cat)}</h3>
  <p>${escapeHtml(catIntro(cat))}</p>
</a>`;
  }).join('\n')}`;
  const indexBody = `<span class="eyebrow">The conversion playbook</span>
<h1>Brand Coach Blog</h1>
<p style="color:var(--ink-dim);max-width:56ch">Real working sessions: how Amazon-first brand owners use the IDEA Brand Coach to find the trust gap, fix the funnel piece that's leaking, and ship creative that converts.</p>
${guides}
${topics}
${latestSection}
${CTA}`;
  fs.writeFileSync(path.join(OUT, 'index.html'), pageShell({
    title: 'Blog | IDEA Brand Coach — conversion playbooks for Amazon-first brands',
    description: 'Working sessions and playbooks: diagnose low CVR/CTR, close the trust gap, and direct high-converting creative with the IDEA Brand Coach.',
    canonical: `${BASE}/blog/`,
    body: indexBody,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'IDEA Brand Coach Blog',
      url: `${BASE}/blog/`,
      description: 'Conversion playbooks for Amazon-first brand owners.',
    },
  }));

  // sitemap.xml — landing + blog + category hubs + posts
  const urls = [
    { loc: `${BASE}/`, lastmod: sorted[0]?.date },
    { loc: `${BASE}/blog/`, lastmod: sorted[0]?.date },
    ...categoriesOrdered.map((cat) => ({
      loc: `${BASE}/blog/category/${catSlug(cat)}/`,
      lastmod: byCategory.get(cat).map((p) => p.updated || p.date).sort().reverse()[0],
    })),
    ...sorted.map((p) => ({ loc: `${BASE}/blog/${p.slug}/`, lastmod: p.updated || p.date })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'public', 'sitemap.xml'), sitemap);

  // llms.txt — the AI-engine front door (llmstxt.org convention): what the
  // product is, then every post as a markdown link with its description.
  const llmsIndex = `# IDEA Brand Coach

> AI brand coach for Amazon-first ecommerce brand owners. It diagnoses why a
> listing or funnel isn't converting (the Trust Gap across the IDEA framework:
> Insight-Driven, Distinctive, Empathetic, Authentic) and directs the fix —
> from the free 6-question diagnostic at ${BASE}/diagnostic to creative plans
> executed on Higgsfield. Built on "What Captures the Heart Goes in the Cart"
> by Trevor Bradford.

## Guides (pillar pages)

${sorted.filter((p) => p.role === 'pillar').map((p) => `- [${p.title}](${BASE}/blog/${p.slug}/): ${p.description}`).join('\n') || '- (none yet)'}

## Blog

${sorted.filter((p) => p.role !== 'pillar').map((p) => `- [${p.title}](${BASE}/blog/${p.slug}/): ${p.description}`).join('\n')}
`;
  fs.writeFileSync(path.join(ROOT, 'public', 'llms.txt'), llmsIndex);

  // llms-full.txt — full post text for AI engines that read one file.
  const llmsFull = sorted.map((p) =>
    `# ${p.title}\nURL: ${BASE}/blog/${p.slug}/\nPublished: ${p.date}${p.updated ? ` (updated ${p.updated})` : ''}\nCategory: ${p.category}\n\n${p.body.trim()}`
  ).join('\n\n---\n\n');
  fs.writeFileSync(path.join(ROOT, 'public', 'llms-full.txt'), llmsFull);

  console.log(`build-blog: ${posts.length} posts + ${byCategory.size} category hubs → public/blog/ (+ index, sitemap.xml, llms.txt, llms-full.txt, ${nAssets} assets)`);
}

build();
