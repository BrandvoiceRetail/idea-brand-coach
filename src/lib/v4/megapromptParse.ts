/**
 * Deterministic megaprompt parser — the HONEST core of the read-it-back theatre.
 *
 * This does NOT invent brand facts. It echoes the user's OWN words back: every
 * extracted slot value is a verbatim snippet lifted from the paste, so the
 * "read-it-back" run is grounded by construction. A slot we can't confidently
 * locate is simply left absent (the Context Card asks for it) — never guessed.
 *
 * Layer-3 determinism: pure, synchronous, fully unit-testable. No network, no LLM.
 */
import type { AvatarPortrait } from '@/types/onboardingReflection';

/** A single verbatim extraction mapped to a V4 context slot. */
export interface ExtractedSlot {
  /** V4_SLOTS key this maps to. */
  key: string;
  /** The verbatim snippet from the user's paste (trimmed, never synthesised). */
  value: string;
}

/** One regex probe → slot key. First capture group is the verbatim value. */
interface Probe {
  key: string;
  re: RegExp;
}

/**
 * Conservative probes. Each captures a verbatim clause from the paste. Order
 * matters only for which sentence wins per key (first match kept).
 */
const PROBES: readonly Probe[] = [
  { key: 'brand_name', re: /(?:brand(?:\s+is)?|company|we(?:'|’)?re|called|named)\s+["']?([A-Z][\w&'’ ]{1,38}\w)/ },
  // Stop the product capture at the customer/problem boundary (" for … / who … / to …")
  // so "we sell X for Y" yields product=X, not "X for Y…" (which then duplicates the customer clause).
  { key: 'product', re: /(?:we\s+sell|sells?|we\s+make|we\s+offer|product\s+is|selling)\s+(.{3,80}?)(?=\s+(?:for|to|who|that|which|aimed|targeting)\b|[.,;!?\n]|$)/i },
  { key: 'customer', re: /(?:\bfor\b|aimed\s+at|targeting|customers?\s+are|who\s+are|sold\s+to)\s+([^.,;!?\n]{3,60})/i },
  { key: 'problem', re: /(?:problem|struggle\w*|can(?:'|’)?t|cannot|frustrat\w+|pain|help(?:s|ing)?(?:\s+them)?(?:\s+to)?)\s+([^.,;!?\n]{3,60})/i },
  { key: 'channel', re: /\b(Amazon|Shopify|TikTok|Instagram|Etsy|eBay|Walmart|our\s+website|retail|wholesale|DTC|direct[- ]to[- ]consumer)\b/i },
  { key: 'goal', re: /(?:want\s+to|goal\s+is|aim\s+to|hoping\s+to|trying\s+to|outcome\s+is|grow|increase|boost|scale)\s+([^.,;!?\n]{3,60})/i },
];

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Extract verbatim slot candidates from a megaprompt. Returns only slots that
 * matched — absent slots are intentionally omitted (asked later, never guessed).
 */
export function parseMegaprompt(text: string): ExtractedSlot[] {
  const source = text ?? '';
  const seen = new Set<string>();
  const out: ExtractedSlot[] = [];
  for (const { key, re } of PROBES) {
    if (seen.has(key)) continue;
    const m = re.exec(source);
    if (!m) continue;
    const raw = m[1] ?? m[0];
    const value = clean(raw);
    if (value.length < 2) continue;
    seen.add(key);
    out.push({ key, value });
  }
  return out;
}

/**
 * Build a four-field Avatar-2.0 portrait STRICTLY from extracted slots — a
 * restatement of the user's own words, never new facts. Returns null when the
 * paste lacks the minimum (a customer + a problem) to restate honestly.
 */
export function portraitFromSlots(slots: readonly ExtractedSlot[]): AvatarPortrait | null {
  const by = (k: string): string | undefined => slots.find((s) => s.key === k)?.value;
  const who = by('customer');
  const problem = by('problem');
  if (!who || !problem) return null;
  return {
    who,
    problem,
    desire: by('goal') ?? 'Not yet stated — we will fill this in together.',
    channel: by('channel') ?? 'Not yet stated.',
  };
}

// ── Frontend Tier-C guard (mirrors src/mcp/terminologyGuard.ts, conservative) ──

/** One forbidden-string match, with the rule it violated. */
export interface TierViolation {
  term: string;
  rule: 'stage-label' | 'buyer-state' | 'neuroanatomy' | 'internal-field';
}

const TIER_PATTERNS: ReadonlyArray<{ rule: TierViolation['rule']; re: RegExp }> = [
  { rule: 'stage-label', re: /\bS[1-4]\b/g },
  { rule: 'stage-label', re: /\bstage\s*[1-4]\b/gi },
  { rule: 'buyer-state', re: /\b(Assessors?|Protectors?|Expressers?|Connectors?)\b/g },
  { rule: 'neuroanatomy', re: /\b(amygdala|limbic|prefrontal|hemispheres?|Bolte[ -]?Taylor|neuroanatom\w*)\b/gi },
  { rule: 'internal-field', re: /\b(dominant_buyer_state|buyer_state|trigger_confidence)\b/g },
];

/**
 * Scan a user-facing string for Tier-B/C leaks. Conservative — flags only the
 * distinctive engine tokens, never common English. Empty array = clean.
 */
export function findTierViolations(text: string): TierViolation[] {
  if (!text) return [];
  const out: TierViolation[] = [];
  for (const { rule, re } of TIER_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push({ term: m[0], rule });
  }
  return out;
}
