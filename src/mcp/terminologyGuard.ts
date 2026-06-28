/**
 * Terminology-policy guard (IDEA-POLICY-TERM-001, the 3-tier rule).
 *
 * Tier C — engine internals that must NEVER reach a user-facing surface: the S1–S4
 * stage labels, the neuroanatomical framing, and academic citations. Tier B — the
 * classification architecture (the four buyer-state names + the CAPTURE element names):
 * allowed in opt-in panels, NEVER in primary tool output. This module is the single
 * shared assertion the conformance test (and, optionally, a runtime detector) uses to
 * prove no Tier-B/C string leaks into the text a customer sees.
 *
 * DELIBERATELY CONSERVATIVE to avoid false positives: it flags only the distinctive,
 * unambiguous engine tokens — never common English words. The CAPTURE element names
 * (Context, Attention, Pain, …) are common words, so they are NOT auto-flagged here;
 * the generating edge-fn prompts already forbid them (e.g. identify-decision-trigger).
 * The lowercase stage_ref *metadata* values (`s3_triggers`) are internal traceability,
 * not prose, and are intentionally not matched.
 */

/** One forbidden-string match, with the rule it violated. */
export interface TierViolation {
  term: string;
  rule: 'stage-label' | 'buyer-state' | 'neuroanatomy' | 'internal-field';
}

/** Patterns that must never appear in USER-FACING output (not in model-facing descriptions). */
const PATTERNS: Array<{ rule: TierViolation['rule']; re: RegExp }> = [
  // Tier C — engine stage labels used as a visible token: "S1".."S4", "Stage 3".
  { rule: 'stage-label', re: /\bS[1-4]\b/g },
  { rule: 'stage-label', re: /\bstage\s*[1-4]\b/gi },
  // Tier B — the four buyer states as a classification label (domain-distinctive words).
  { rule: 'buyer-state', re: /\b(Assessors?|Protectors?|Expressers?|Connectors?)\b/g },
  // Tier C — neuroanatomical framing / the source model.
  { rule: 'neuroanatomy', re: /\b(amygdala|limbic|prefrontal|hemispheres?|Bolte[ -]?Taylor|neuroanatom\w*)\b/gi },
  // Tier C — internal field tokens / the server-only confidence.
  { rule: 'internal-field', re: /\b(dominant_buyer_state|buyer_state|trigger_confidence)\b/g },
];

/** Scan one string for Tier-B/C leaks. Returns every violation found (empty = clean). */
export function findTierViolations(text: string): TierViolation[] {
  if (!text) return [];
  const out: TierViolation[] = [];
  for (const { rule, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push({ term: m[0], rule });
  }
  return out;
}

/** Recursively collect every user-facing string from a tool result's `content` text
 *  blocks + `structuredContent` (the two surfaces a client may render). */
export function collectUserFacingStrings(result: unknown): string[] {
  const strings: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  if (result && typeof result === 'object') {
    const r = result as { content?: unknown; structuredContent?: unknown };
    walk(r.content);
    walk(r.structuredContent);
  }
  return strings;
}

/** Scan a whole tool result; returns all Tier-B/C violations across its user-facing text. */
export function scanResultForViolations(result: unknown): TierViolation[] {
  return collectUserFacingStrings(result).flatMap(findTierViolations);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime detector — wraps every tool so a Tier-B/C leak in live output is logged.
// Detection only (never mutates the result); a leak is a bug to fix at the source,
// not something to silently strip mid-flight. Same registerTool seam as
// instrumentToolLatency / registerStructuredFallback.
// ─────────────────────────────────────────────────────────────────────────────
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { safeLog } from './logging/redact.js';

type ToolHandler = (...args: unknown[]) => unknown;

function guarded(tool: string, handler: ToolHandler): ToolHandler {
  return async (...callArgs: unknown[]): Promise<unknown> => {
    const result = await handler(...callArgs);
    const violations = scanResultForViolations(result);
    if (violations.length > 0) {
      // Log counts + rules + the offending tokens (our own internal vocabulary, not PII).
      const byRule: Record<string, number> = {};
      const terms = new Set<string>();
      for (const v of violations) {
        byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
        terms.add(v.term);
      }
      safeLog({ level: 'warn', event: 'terminology.leak', tool, count: violations.length, rules: byRule, terms: [...terms].slice(0, 10) });
    }
    return result;
  };
}

/** Monkey-patch `server.registerTool` so each tool's result is scanned for Tier-B/C
 *  leaks and any are logged. Call once after `new McpServer`, alongside the other seams. */
export function registerTerminologyGuard(server: McpServer): void {
  const original = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  const patched = (...args: unknown[]): unknown => {
    const name = typeof args[0] === 'string' ? args[0] : 'unknown';
    const last = args.length - 1;
    if (typeof args[last] === 'function') {
      args[last] = guarded(name, args[last] as ToolHandler);
    }
    return original(...args);
  };
  (server as unknown as { registerTool: typeof patched }).registerTool = patched;
}
