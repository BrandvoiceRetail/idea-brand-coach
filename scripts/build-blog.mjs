#!/usr/bin/env node
/**
 * build-blog.mjs — content/blog/*.md → public/blog/<slug>/index.html
 * + public/blog/index.html (listing) + public/sitemap.xml
 *
 * Zero dependencies by design (Layer-3 deterministic build step; runs on the
 * CI runner and locally with plain node). Renders the constrained markdown
 * subset the content brief allows: #–#### headings, paragraphs, **bold**,
 * *italic*, `code`, [links](url), -/1. lists, > blockquotes, ``` fences, ---.
 *
 * Frontmatter (simple `key: value` strings between --- fences):
 *   title, description, date (YYYY-MM-DD), category, funnel, tools
 *   (comma-separated coach tool names), keywords, slug (optional — defaults
 *   to the filename without extension).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'blog');
const OUT = path.join(ROOT, 'public', 'blog');
const BASE = 'https://ideabrandcoach.com';

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
           !lines[i].startsWith('```') && !/^---+\s*$/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return html.join('\n');
}

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
.eyebrow{display:inline-block;font-size:.68rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gld);margin-top:34px}
.post-meta{font-size:.82rem;color:var(--ink-faint);margin-bottom:26px}
.chip{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.06em;padding:3px 10px;border:1px solid var(--hair-2);border-radius:999px;color:var(--ink-dim);margin-right:6px}
.cta-box{background:var(--glass);border:1px solid var(--hair-2);border-radius:var(--radius);padding:26px;margin:40px 0}
.cta-box h3{margin-top:0}
.btn{display:inline-block;background:var(--gld);color:#1a1206;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;margin-top:12px}
.card{display:block;background:var(--glass);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;margin:14px 0;text-decoration:none;transition:border-color .15s}
.card:hover{border-color:var(--gld)}
.card h3{margin:6px 0 8px;color:var(--ink)}
.card p{color:var(--ink-dim);font-size:.92rem;margin:0}
footer{border-top:1px solid var(--hair);margin-top:70px;padding:36px 24px;text-align:center;color:var(--ink-faint);font-size:.85rem}
footer a{color:var(--gld);text-decoration:none}
main{padding:14px 0 40px}
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

function pageShell({ title, description, canonical, body, jsonLd }) {
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
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
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

  for (const post of posts) {
    const canonical = `${BASE}/blog/${post.slug}/`;
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: { '@type': 'Organization', name: 'IDEA Brand Coach' },
      publisher: { '@type': 'Organization', name: 'IDEA Brand Consultancy' },
      mainEntityOfPage: canonical,
    });
    const chips = [post.category, post.funnel].filter(Boolean)
      .map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('');
    const body = `<span class="eyebrow">IDEA Brand Coach — Blog</span>
<article>
<h1>${inline(post.title)}</h1>
<div class="post-meta">${post.date} &nbsp; ${chips}</div>
${renderMarkdown(post.body)}
${CTA}
</article>
<p style="margin-top:8px"><a href="/blog/" style="color:var(--gld-mid);text-decoration:none">← All articles</a></p>`;
    const dir = path.join(OUT, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'),
      pageShell({ title: `${post.title} | IDEA Brand Coach`, description: post.description, canonical, body, jsonLd }));
  }

  // Listing page — newest first, grouped by category
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  const byCategory = new Map();
  for (const p of sorted) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }
  const sections = [...byCategory.entries()].map(([cat, list]) => `
<h2>${escapeHtml(cat)}</h2>
${list.map((p) => `<a class="card" href="/blog/${p.slug}/">
  <span class="chip">${escapeHtml(p.funnel || p.category)}</span><span class="chip">${p.date}</span>
  <h3>${inline(p.title)}</h3>
  <p>${inline(p.description)}</p>
</a>`).join('\n')}`).join('\n');
  const indexBody = `<span class="eyebrow">The conversion playbook</span>
<h1>Brand Coach Blog</h1>
<p style="color:var(--ink-dim);max-width:56ch">Real working sessions: how Amazon-first brand owners use the IDEA Brand Coach to find the trust gap, fix the funnel piece that's leaking, and ship creative that converts.</p>
${sections}
${CTA}`;
  fs.writeFileSync(path.join(OUT, 'index.html'), pageShell({
    title: 'Blog | IDEA Brand Coach — conversion playbooks for Amazon-first brands',
    description: 'Working sessions and playbooks: diagnose low CVR/CTR, close the trust gap, and direct high-converting creative with the IDEA Brand Coach.',
    canonical: `${BASE}/blog/`,
    body: indexBody,
  }));

  // sitemap.xml — landing + blog + posts
  const urls = [
    { loc: `${BASE}/`, lastmod: sorted[0]?.date },
    { loc: `${BASE}/blog/`, lastmod: sorted[0]?.date },
    ...sorted.map((p) => ({ loc: `${BASE}/blog/${p.slug}/`, lastmod: p.date })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'public', 'sitemap.xml'), sitemap);

  console.log(`build-blog: ${posts.length} posts → public/blog/ (+ index, sitemap.xml)`);
}

build();
