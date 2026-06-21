/**
 * Conversation-harvest redaction — mask PII/secrets before candidates/exports.
 *
 * Real harvested conversations carry customer names, ASINs, margins, brand names. The sweep
 * mines candidate cases + feature ideas from raw turn text, so we redact each conversation
 * BEFORE classification (see harvest.ts). Pure + deterministic — no clock/network/model — so
 * the markers it leaves ([email], [asin], [amount], …) are stable inputs the classifier reads.
 *
 * Percentages are KEPT: they are diagnostic signal (CAC/ROAS/conversion deltas drive P1
 * detection), not PII. Currency figures ARE masked — they reveal margins.
 */
import type { Conversation } from './types.js';

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Phone: 7+ digit runs allowing spaces, dashes, dots, parens, and a leading +/country code.
const PHONE = /(?:\+?\d[\d ().-]{7,}\d)/g;
const ASIN = /\bB0[A-Z0-9]{8}\b/g;
// Money: a $ figure (optionally with thousands separators / decimals). Percentages are left alone.
const MONEY = /\$\d[\d,.]*/g;
// Person name after a self-introduction cue: "I'm Jane", "my name is John Smith".
const NAME = /\b(I'?m|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g;

/** Mask emails, phones, ASINs, currency figures, and self-introduced person names. */
export function redactText(s: string): string {
  return s
    .replace(EMAIL, '[email]')
    .replace(ASIN, '[asin]')
    .replace(MONEY, '[amount]')
    .replace(PHONE, '[phone]')
    .replace(NAME, (_m, cue: string) => `${cue} [name]`);
}

/** Deep-clone a conversation with every turn's text redacted — never mutates the input. */
export function redactConversation(c: Conversation): Conversation {
  return {
    ...c,
    toolCalls: c.toolCalls ? [...c.toolCalls] : c.toolCalls,
    turns: c.turns.map((t) => ({
      ...t,
      text: redactText(t.text),
      tools: t.tools ? [...t.tools] : t.tools,
    })),
  };
}
