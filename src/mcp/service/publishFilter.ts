/**
 * Layer 1 (service) — publish-filter check (the compliance gate, chain link 2).
 *
 * D6 DECISION (taken 2026-06-02, hands-off default — revisit if the operator wants
 * LLM grading): v1 is a DETERMINISTIC rule engine. No existing engine to wrap
 * (brand-copy-generator is the inverse — it generates, never grades), so there is no
 * Calculation-Parity constraint; determinism gives reproducible verdicts and strong
 * tests. The IV-OS-grounded half (grade against `get_safe_claims` + canon) activates
 * BY CAPABILITY once IV-OS ships its knowledge reads — until then `checked_against`
 * marks it deferred. Pure: no network, no identity.
 */

export type FilterVerdict = 'pass' | 'warn' | 'fail';
export type ViolationSeverity = 'warn' | 'fail';

export interface FilterViolation {
  rule: string;
  severity: ViolationSeverity;
  excerpt: string;
  fix_hint: string;
}

export interface FilterReport {
  verdict: FilterVerdict;
  violations: FilterViolation[];
  checked_against: {
    deterministic_rules: true;
    ivos_safe_claims: string;
    ivos_brand_canon: string;
  };
}

interface Rule {
  rule: string;
  severity: ViolationSeverity;
  pattern: RegExp;
  fix_hint: string;
}

/** Claims/copy rules. Severity 'fail' = blocked outright; 'warn' = needs substantiation/review. */
const RULES: Rule[] = [
  {
    rule: 'medical-therapeutic-claim',
    severity: 'fail',
    pattern: /\b(cures?|treats?|heals?|clinically proven|prevents? (?:disease|illness|infection))\b/i,
    fix_hint: 'Remove or rewrite: medical/therapeutic claims require regulatory substantiation.',
  },
  {
    rule: 'unsubstantiated-superlative',
    severity: 'warn',
    pattern: /\b(best|#\s?1|number one|guaranteed|perfect|miracle|world.?class)\b/i,
    fix_hint: 'Superlatives/guarantees need substantiation on file — soften or cite the proof.',
  },
  {
    rule: 'environmental-claim',
    severity: 'warn',
    pattern: /\b(100%\s?(?:eco|green|sustainable|recyclable)|carbon.?neutral|biodegradable)\b/i,
    fix_hint: 'Environmental claims must meet FTC Green Guides — qualify or substantiate.',
  },
  {
    rule: 'false-urgency',
    severity: 'warn',
    pattern: /\b(today only|last chance|act now|limited time only)\b/i,
    fix_hint: 'Urgency must be literally true; remove or make the constraint real and specific.',
  },
];

/** Per-channel hard length caps (characters). */
const CHANNEL_LIMITS: Record<string, number> = {
  x: 280,
  twitter: 280,
  amazon_bullet: 250,
  email_subject: 80,
  instagram_caption: 2200,
};

const MIN_CONTENT_LENGTH = 20;
const SHOUTING_RATIO = 0.3;

function excerptAround(content: string, match: RegExpMatchArray): string {
  const idx = match.index ?? 0;
  return content.slice(Math.max(0, idx - 20), idx + match[0].length + 20).trim();
}

export function checkPublishFilter(content: string, channel?: string): FilterReport {
  const violations: FilterViolation[] = [];

  if (content.trim().length < MIN_CONTENT_LENGTH) {
    violations.push({
      rule: 'content-too-short',
      severity: 'fail',
      excerpt: content.trim(),
      fix_hint: `Content under ${MIN_CONTENT_LENGTH} characters is not a publishable asset.`,
    });
  }

  for (const r of RULES) {
    const m = content.match(r.pattern);
    if (m) violations.push({ rule: r.rule, severity: r.severity, excerpt: excerptAround(content, m), fix_hint: r.fix_hint });
  }

  const limit = channel ? CHANNEL_LIMITS[channel.toLowerCase()] : undefined;
  if (limit && content.length > limit) {
    violations.push({
      rule: 'channel-length-exceeded',
      severity: 'fail',
      excerpt: `${content.length} chars > ${limit} (${channel})`,
      fix_hint: `Cut to <= ${limit} characters for ${channel}.`,
    });
  }

  const words = content.split(/\s+/).filter((w) => w.length > 2);
  const caps = words.filter((w) => /^[A-Z0-9!?.,'-]+$/.test(w) && /[A-Z]/.test(w));
  if (words.length >= 5 && caps.length / words.length > SHOUTING_RATIO) {
    violations.push({
      rule: 'excessive-caps',
      severity: 'warn',
      excerpt: caps.slice(0, 5).join(' '),
      fix_hint: 'Reduce all-caps shouting; keep emphasis to one or two words.',
    });
  }

  const verdict: FilterVerdict = violations.some((v) => v.severity === 'fail')
    ? 'fail'
    : violations.length > 0
      ? 'warn'
      : 'pass';

  return {
    verdict,
    violations,
    checked_against: {
      deterministic_rules: true,
      ivos_safe_claims: 'deferred — IV-OS get_safe_claims not yet shipped (consume by capability)',
      ivos_brand_canon: 'deferred — IV-OS canon reads not yet shipped (consume by capability)',
    },
  };
}
