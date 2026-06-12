/**
 * Layer 3 (service) — the deterministic fabrication gate for the Export Brief (manifest §6).
 *
 * The gold workbook's sheet 6 contained an invented "30-DAY GUARANTEE" bullet, an
 * unconfirmed "Holds 432 Cards" capacity claim, and "PSA-slab compatible" — exactly the
 * PRODUCT-TRUTH / policy claims that may never appear in generated copy unless they are
 * `filled-evidence` or owner-confirmed (manifest §6 gate rule). The edge fn is *told* to
 * only use confirmed claims, but an LLM instruction is not a guarantee; this module is the
 * deterministic backstop that re-scans the produced brief and BLOCKS any ungated claim.
 *
 * It is intentionally pattern-based and conservative: it scans the concrete copy
 * (`example_output` of the title formula + every bullet) for the high-risk claim families
 * (guarantees / warranties / return windows, capacity numbers, compatibility nouns,
 * material claims) and flags any match whose text is not covered by the confirmed-claims
 * allowlist. A flagged brief is NOT persisted; `generate_brief` turns each violation into a
 * `needs_input` question so the owner can confirm the claim (which writes it to evidence and
 * lets the next run pass).
 *
 * Coverage is the inverse of fabrication: a claim is "covered" when a confirmed claim's
 * text appears in (or contains) the flagged copy fragment, case-insensitively. This is the
 * same matching the edge fn uses for `claims_used`, applied independently so the gate does
 * not trust the model's self-report.
 */
import type { ExportBriefOutput } from '../contracts/index.js';

/** A confirmed PRODUCT-TRUTH / policy claim from a resolved evidence/owner-confirmed slot. */
export interface ConfirmedClaim {
  /** The exact claim text the owner confirmed (e.g. "Holds 432 cards", "30-day returns"). */
  claim: string;
  /** Where the confirmation came from (evidence snapshot id, owner-intent note, etc.). */
  source: string;
}

/** The claim family a flagged fragment belongs to (drives the clarification question). */
export type ClaimCategory = 'guarantee_policy' | 'capacity' | 'compatibility' | 'material';

/** One ungated PRODUCT-TRUTH / policy claim found in the brief copy. */
export interface ClaimViolation {
  /** Which family the claim belongs to. */
  category: ClaimCategory;
  /** The matched copy fragment (the phrase that asserts the claim). */
  fragment: string;
  /** Where in the brief the fragment appeared (for the clarification `why`). */
  location: string;
  /** Why this is a fabrication hazard (manifest §6). */
  reason: string;
}

/** The gate verdict: ok when no ungated claim was found, else the violations to surface. */
export interface ClaimGateVerdict {
  ok: boolean;
  violations: ClaimViolation[];
}

/**
 * High-risk claim patterns. Each family has a matcher that returns the offending fragments
 * found in a copy string. These are conservative: they target the phrasings that are both
 * fabrication-prone and (for guarantees/warranties) an Amazon Terms-of-Service hazard.
 */
interface ClaimPattern {
  category: ClaimCategory;
  reason: string;
  /** Returns every matched fragment in the copy (already trimmed). */
  find: (copy: string) => string[];
}

/** Collect unique regex matches (whole match) from a copy string. */
function matchAll(copy: string, re: RegExp): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of copy.matchAll(re)) {
    const frag = m[0].trim();
    const key = frag.toLowerCase();
    if (frag && !seen.has(key)) {
      seen.add(key);
      out.push(frag);
    }
  }
  return out;
}

const CLAIM_PATTERNS: ClaimPattern[] = [
  {
    category: 'guarantee_policy',
    reason:
      'Guarantee / warranty / return-policy phrasing is a PRODUCT-TRUTH policy claim and an Amazon Terms-of-Service hazard; it may never be stated unless the owner has confirmed the exact policy.',
    // "30-day guarantee", "money-back guarantee", "lifetime warranty", "30 day returns",
    // "satisfaction guaranteed", "100% guarantee", standalone guarantee/warranty.
    find: (copy) =>
      matchAll(
        copy,
        /\b(\d+[-\s]?day(?:s)?(?:\s+(?:money[-\s]?back\s+)?(?:guarantee|warranty|returns?|refund))?|money[-\s]?back\s+guarantee|lifetime\s+(?:guarantee|warranty)|satisfaction\s+guaranteed|100%\s+(?:guarantee|satisfaction|money[-\s]?back)|guarantee[d]?|warrant(?:y|ied))\b/gi,
      ),
  },
  {
    category: 'capacity',
    reason:
      'A specific capacity number is a PRODUCT-TRUTH claim; an unconfirmed figure (e.g. "Holds 432 Cards") is a fabrication.',
    // "holds 432 cards", "432-card capacity", "216 cards", "432 cards", "holds 432".
    find: (copy) =>
      matchAll(
        copy,
        /\b(?:holds?\s+)?\d{1,4}[-\s]?(?:card(?:s)?(?:\s+capacity)?|capacity)\b|\bcapacity\s+(?:of\s+)?\d{1,4}\b|\bholds?\s+\d{1,4}\b/gi,
      ),
  },
  {
    category: 'compatibility',
    reason:
      'A compatibility claim (PSA / BGS / slab / graded-case fit) is a PRODUCT-TRUTH claim; it may never be stated unless the owner has confirmed the product actually fits.',
    // "PSA-slab compatible", "PSA slab", "BGS slab", "graded slab", "slab compatible".
    find: (copy) =>
      matchAll(
        copy,
        /\b(?:psa|bgs|cgc|sgc)\b[-\s]?(?:graded\s+)?(?:slab|case)?(?:[-\s]?(?:compatible|compatibility|fits?|ready))?|\bgraded[-\s]?(?:slab|case)\b|\bslab[-\s]?(?:compatible|compatibility|ready)\b/gi,
      ),
  },
  {
    category: 'material',
    reason:
      'A specific material / construction claim (e.g. "archival-grade pages", "acid-free", "reinforced") is a PRODUCT-TRUTH claim; it may never be stated unless the owner has confirmed the material.',
    // "archival-grade", "acid-free", "archival quality", "reinforced pages", "premium leather".
    find: (copy) =>
      matchAll(
        copy,
        /\b(?:archival[-\s]?(?:grade|quality)|acid[-\s]?free|reinforced\s+(?:pages?|spine|cover)|genuine\s+leather|real\s+leather|premium\s+leather|leather[-\s]?bound|waterproof|tear[-\s]?proof)\b/gi,
      ),
  },
];

/** Normalise a string for case-insensitive substring coverage checks. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A flagged fragment is covered when a confirmed claim's text appears in the fragment, OR
 * the fragment appears in a confirmed claim's text (so "Holds 432 cards" is covered by a
 * confirmed "432-card capacity" and vice versa). Case- and whitespace-insensitive.
 */
function isCovered(fragment: string, confirmed: ConfirmedClaim[]): boolean {
  const f = norm(fragment);
  if (!f) return true; // empty fragment cannot be a claim
  return confirmed.some((c) => {
    const cc = norm(c.claim);
    return cc.length > 0 && (f.includes(cc) || cc.includes(f));
  });
}

/** One copy field to scan: the human-readable location + the concrete example copy. */
interface ScanTarget {
  location: string;
  copy: string;
}

/** Enumerate the concrete copy fields of a brief (only example_output is shipped to listings). */
function scanTargets(brief: ExportBriefOutput): ScanTarget[] {
  const targets: ScanTarget[] = [
    { location: 'title_formula.example_output', copy: brief.title_formula.example_output },
  ];
  brief.bullets.forEach((b, i) => {
    targets.push({ location: `bullets[${i}] (${b.element}).example_output`, copy: b.example_output });
  });
  return targets;
}

/**
 * Scan a produced Export Brief for PRODUCT-TRUTH / policy claims not covered by the
 * confirmed-claims allowlist (manifest §6). Returns a verdict; `ok:false` lists every
 * ungated claim so the caller can surface them as `needs_input` instead of persisting.
 *
 * Deterministic and side-effect-free — safe to unit test and to run on every brief before
 * persistence.
 */
export function scanBrief(brief: ExportBriefOutput, confirmedClaims: ConfirmedClaim[]): ClaimGateVerdict {
  const violations: ClaimViolation[] = [];
  const seen = new Set<string>();

  for (const target of scanTargets(brief)) {
    if (!target.copy) continue;
    for (const pattern of CLAIM_PATTERNS) {
      for (const fragment of pattern.find(target.copy)) {
        if (isCovered(fragment, confirmedClaims)) continue;
        // De-duplicate identical (category, fragment) across locations; keep first location.
        const key = `${pattern.category}::${norm(fragment)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push({
          category: pattern.category,
          fragment,
          location: target.location,
          reason: pattern.reason,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
