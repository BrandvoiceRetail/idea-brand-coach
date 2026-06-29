/**
 * Layer 1 (service) — onboarding front door.
 *
 * Pure: builds the branded IDEA Brand Coach welcome surface, the two-choice fork
 * (Simple Diagnostic vs Full Contextual Upload), and the per-path stub
 * acknowledgement. NO identity, NO I/O — this is the anonymous front door rendered
 * before any account exists. The two paths are STUBS (walking skeleton): they name
 * what's coming next; the diagnostic/upload engines are not wired here.
 *
 * Voice: Trevor Bradford — clear, warm, direct (skills/02-trevor-voice-philosophy.md).
 */
import { ONBOARD_PANEL_CLIENT_JS } from '../panel/onboardPanelClient.generated.js';

export type OnboardPath = 'diagnostic' | 'upload';

export interface OnboardChoice {
  id: OnboardPath;
  label: string;
  description: string;
}

export interface OnboardSurface {
  markdown: string;
  choices: OnboardChoice[];
}

export interface PathStub {
  path: OnboardPath;
  title: string;
  markdown: string;
}

/** The signature line — same truth that runs through everything Trevor coaches. */
const TAGLINE = 'What captures the heart goes in the cart.';

/** MCP Apps (io.modelcontextprotocol/ui) resource URI for the interactive panel. */
export const ONBOARD_UI_URI = 'ui://brand-coach/onboard';

/** Single source of truth for the fork, so the surface and the stubs never drift. */
const CHOICES: readonly OnboardChoice[] = [
  {
    id: 'diagnostic',
    label: 'Simple Diagnostic',
    description:
      "A guided conversation about your customer and your brand — we talk through the four parts of trust together, then I reflect back where your Trust Gap is. No forms, no ratings to fill in.",
  },
  {
    id: 'upload',
    label: 'Full Contextual Upload',
    description:
      'Bring your listings, reviews, and brand materials so every bit of coaching is grounded in your real business.',
  },
];

/** The branded welcome + the two-choice fork, ready to render in Claude. */
export function buildOnboardSurface(): OnboardSurface {
  const choices = CHOICES.map((c) => ({ ...c }));
  const markdown = [
    '# IDEA Brand Coach',
    `*${TAGLINE}*`,
    '',
    "I'm your IDEA Brand Coach — here to help you build an authentically human brand that wins the heart, and the sale.",
    '',
    "Most brand problems come down to one thing: trust, or the lack of it. Let's find yours. Pick how you'd like to start:",
    '',
    `**1. ${CHOICES[0].label}** — ${CHOICES[0].description}`,
    '',
    `**2. ${CHOICES[1].label}** — ${CHOICES[1].description}`,
    '',
    "Tell me which one — or run `onboard_choose` with `diagnostic` or `upload` and I'll take it from there.",
  ].join('\n');

  return { markdown, choices };
}

/** Distinct next-step acknowledgement for the chosen path (stub — engine not built yet). */
export function buildPathStub(path: OnboardPath): PathStub {
  if (path === 'diagnostic') {
    return {
      path,
      title: 'Simple Diagnostic',
      markdown: [
        '# Simple Diagnostic — let\'s talk it through',
        '',
        "Good choice. This is a conversation, not a quiz. I'll walk you through the four parts of trust in the IDEA framework — **Insight, Distinctive, Empathetic, Authentic** — **one at a time**, starting with your customer and the heart of your brand.",
        '',
        "For each one I'll ask an open question and listen to your actual words. No ratings, no numbers from you. Only once you've genuinely spoken to all four will I reflect back where your **Trust Gap** is — as a mirror of what you shared, never a verdict from nowhere.",
        '',
        "Let's start with **Insight**: who is your customer, really — and what do they most want that they can't quite get anywhere else?",
        '',
        "_Posture guardrail: I gather all four dimensions in your own words **before any scoring**; I will never invent your answers. (Walking skeleton: the story→score mapping is the next build — for now I hold the line and ask rather than fabricate.)_",
      ].join('\n'),
    };
  }

  return {
    path,
    title: 'Full Contextual Upload',
    markdown: [
      '# Full Contextual Upload — your next step',
      '',
      'Smart move. The Full Contextual Upload lets you bring your listings, reviews, and brand materials so I can coach against your **real business** — not generic advice.',
      '',
      "_Front door only: the upload pipeline isn't wired up yet. You're seeing the install → invoke → render → choose pipe work end to end._",
    ].join('\n'),
  };
}

/**
 * Branded interactive panel for MCP Apps-capable hosts (mimeType
 * `text/html;profile=mcp-app`). Self-contained HTML rendered by the host in a
 * sandboxed iframe.
 *
 * The interactive client is the official `@modelcontextprotocol/ext-apps` `App`,
 * bundled to an inlined IIFE (`npm run build:panel`). It performs the sandbox-proxy
 * + `ui/initialize` handshake and auto-resize that Claude Desktop requires — the
 * pieces a hand-rolled postMessage client got wrong, which is why earlier panels
 * fetched but never rendered. Each `.choice` button calls the `onboard_choose`
 * tool via `app.callServerTool` and renders the returned stub.
 *
 * Buttons are built from the same CHOICES source as the markdown surface, so the
 * panel and the prompt can never drift.
 */
export function buildOnboardPanelHtml(): string {
  const buttons = CHOICES.map(
    (c) =>
      `<button class="choice" data-path="${c.id}">` +
      `<span class="choice-label">${c.label}</span>` +
      `<span class="choice-desc">${c.description}</span>` +
      `</button>`,
  ).join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<title>IDEA Brand Coach</title>',
    '<style>',
    ':root{--blk:#111111;--wht:#fff;--wrm:#F5F4F0;--gld:#D4960A;--gld-lt:#FEF5DC;--ink:#1c1c1c;--mut:#5f5d57;--line:rgba(17,17,17,.12)}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;background:var(--wrm);color:var(--ink);line-height:1.5;padding:24px;-webkit-font-smoothing:antialiased}',
    '.card{max-width:620px;margin:0 auto;background:var(--wht);border:1px solid var(--line);border-radius:14px;overflow:hidden}',
    '.hd{background:var(--blk);color:var(--wht);padding:22px 24px}',
    '.hd h1{font-size:22px;font-weight:900;letter-spacing:-.4px}',
    '.hd .tag{color:var(--gld);font-size:13px;font-weight:700;font-style:italic;margin-top:4px}',
    '.bd{padding:22px 24px}',
    '.lede{font-size:15px;color:var(--mut);margin-bottom:18px}',
    '.choices{display:flex;flex-direction:column;gap:12px}',
    '.choice{text-align:left;cursor:pointer;background:var(--wrm);border:1.5px solid var(--line);border-radius:10px;padding:14px 16px;transition:border-color .15s,transform .05s;display:flex;flex-direction:column;gap:4px}',
    '.choice:hover{border-color:var(--gld)}',
    '.choice:active{transform:translateY(1px)}',
    '.choice:disabled{cursor:default}',
    '.choice:disabled:not(.chosen){opacity:.45}',
    '.choice.chosen{border-color:var(--gld);background:var(--gld-lt);box-shadow:inset 0 0 0 1px var(--gld)}',
    '.choice-label{font-size:16px;font-weight:800;color:var(--blk)}',
    '.choice-desc{font-size:13px;color:var(--mut)}',
    '#st{margin-top:16px;font-size:12px;color:var(--mut);font-weight:600}',
    '</style></head><body>',
    '<div class="card">',
    '<div class="hd"><h1>IDEA Brand Coach</h1><div class="tag">' + TAGLINE + '</div></div>',
    '<div class="bd">',
    '<p class="lede">Most brand problems come down to one thing: trust, or the lack of it. Pick how you\'d like to start.</p>',
    '<div class="choices">',
    buttons,
    '</div>',
    '<div id="st">Connecting&hellip;</div>',
    '</div></div>',
    `<script>${ONBOARD_PANEL_CLIENT_JS}</script>`,
    '</body></html>',
  ].join('\n');
}
