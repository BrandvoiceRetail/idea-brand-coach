/**
 * brand-defense-monitor — pure defense logic (Deno-free, unit-testable).
 *
 * Holds everything in the brand-defense monitor that does NOT touch
 * Deno/fetch/Supabase: the alert-source contract + the STUB Titan source, the
 * event→IDEA-dimension mapping, severity derivation, the IDEA-scored
 * interpretation builder, and the drafted-response payload shaper.
 * `index.ts` is the thin Deno edge entry that wires HTTP, auth, persistence
 * (brand_defense_alerts) and the asset-ledger write seam around these.
 *
 * Mirrors the competitor-analysis-asset / funnel-rewrite lib/index split so this
 * file imports cleanly under vitest.
 *
 * GROUNDING GATE (plan §3): the monitor NEVER invents competitors, prices, IDEA
 * scores, or quotes. The IDEA "score" here is a deterministic mapping of the
 * alert category to the threatened pillar (not an LLM read of evidence we do not
 * have); the interpretation is templated from the source event's own fields. The
 * Titan source is a STUB whose coverage is UNVERIFIED (per Trevor) — it returns
 * a clearly-marked fixture or empty, never fabricated live threats.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 * Manifest: docs/brand-funnel-builder/_BUILD_MANIFEST.md §3 P6
 */

// ── Canonical IDEA enum — single source of truth (supabase/functions/_shared/idea.ts) ─
// Imported for use in this module AND re-exported so existing importers keep working.
import { DIMENSION_LABELS } from "../_shared/idea.ts";
import type { Dimension } from "../_shared/idea.ts";
export { DIMENSION_LABELS };
export type { Dimension };

/**
 * Threat categories the monitor handles. `trademark` is PHASE 2 — intentionally
 * left out of this enum until the trademark-watch source lands.
 * TODO(competitor-agents:trademark-category): add 'trademark' + its mapping.
 */
export type BrandDefenseCategory =
  | 'listing-integrity'
  | 'buy-box'
  | 'compliance'
  | 'reputation';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A normalized brand-defense alert event, as an IAlertSource yields it. The
 * `evidence` block is whatever the source could ground (a URL, an ASIN, a quote);
 * the monitor never adds evidence the source did not supply.
 */
export interface AlertEvent {
  /** Stable id from the source (for de-dupe / linking back). */
  external_id: string;
  category: BrandDefenseCategory;
  /** Short human-readable headline from the source. */
  title: string;
  /** Source-supplied description of what happened (verbatim; not embellished). */
  description: string;
  /** Source-supplied severity hint, if any. */
  severity?: Severity;
  /** Whatever the source could ground — refs, urls, asins, quotes. */
  evidence?: Array<{ kind: string; ref: string }>;
}

/**
 * The alert-source contract. Each source (Titan, future: Amazon Brand Registry
 * feeds, review monitors) implements this; the monitor is source-agnostic.
 */
export interface IAlertSource {
  /** A stable name for logging/attribution (e.g. 'titan-stub'). */
  readonly name: string;
  /**
   * Whether this source's coverage is VERIFIED. Titan is UNVERIFIED (per Trevor)
   * so the monitor tags every Titan-derived alert `coverage:'unverified'`.
   */
  readonly coverageVerified: boolean;
  /**
   * Fetch current alerts for an avatar/brand. MUST NOT fabricate: return [] when
   * there is nothing real to report. Never throws (the monitor treats a throw as
   * "no alerts" so one bad source never breaks the run).
   */
  fetchAlerts(context: AlertSourceContext): Promise<AlertEvent[]>;
}

/** What a source needs to scope its fetch. */
export interface AlertSourceContext {
  avatarId?: string;
  /** Optional brand/marketplace identifiers a source may key on (e.g. ASINs). */
  asins?: string[];
  marketplace?: string;
}

/**
 * STUB Titan alert source. Titan integration is not built and its coverage is
 * UNVERIFIED (per Trevor) — this is a HALT, surfaced here in code. It returns
 * either a clearly-marked fixture (when TITAN_STUB_FIXTURE is enabled, for local
 * wiring tests) or an empty list. It NEVER returns a fabricated live threat.
 * TODO(competitor-agents:titan-source): replace with a real Titan adapter once
 * Titan coverage is verified and the integration is built.
 */
export class TitanAlertSource implements IAlertSource {
  readonly name = 'titan-stub';
  readonly coverageVerified = false;
  private readonly emitFixture: boolean;

  constructor(emitFixture = false) {
    this.emitFixture = emitFixture;
  }

  async fetchAlerts(context: AlertSourceContext): Promise<AlertEvent[]> {
    if (!this.emitFixture) return [];
    // A clearly-marked, obviously-synthetic fixture for wiring tests only.
    return [
      {
        external_id: 'titan-stub-fixture-1',
        category: 'listing-integrity',
        title: '[STUB] Unauthorized listing change detected',
        description:
          'FIXTURE (not a real Titan alert): a competitor or hijacker edited the listing copy/imagery. Titan coverage is UNVERIFIED — do not treat as live.',
        severity: 'high',
        evidence: context.asins && context.asins.length > 0
          ? [{ kind: 'asin', ref: context.asins[0] }]
          : [],
      },
    ];
  }
}

/**
 * Map an alert category to the IDEA pillar it most threatens. Deterministic —
 * this is NOT an LLM score, so it cannot be fabricated. Rationale:
 *  - listing-integrity → distinctive (a hijacked/altered listing erodes the
 *    distinct brand expression buyers recognize).
 *  - buy-box           → authentic (losing the Buy Box / ownership puts an
 *    unauthorized seller in front of the customer — breaks authenticity).
 *  - compliance        → authentic (compliance/claims violations undermine the
 *    brand's trustworthy, authentic standing).
 *  - reputation        → empathetic (review/reputation attacks hit how the brand
 *    is felt and trusted by customers).
 */
export function mapCategoryToDimension(category: BrandDefenseCategory): Dimension {
  switch (category) {
    case 'listing-integrity':
      return 'distinctive';
    case 'buy-box':
      return 'authentic';
    case 'compliance':
      return 'authentic';
    case 'reputation':
      return 'empathetic';
    default:
      return 'authentic';
  }
}

/** Default severity per category when the source does not supply one. */
export function deriveSeverity(event: AlertEvent): Severity {
  if (event.severity) return event.severity;
  switch (event.category) {
    case 'buy-box':
      return 'critical';
    case 'compliance':
      return 'high';
    case 'listing-integrity':
      return 'high';
    case 'reputation':
      return 'medium';
    default:
      return 'medium';
  }
}

/**
 * Build the IDEA-scored interpretation: a templated, GROUNDED read of the event.
 * It names the threatened pillar and restates the source's own description — it
 * does NOT invent specifics the source did not supply.
 */
export function buildInterpretation(event: AlertEvent, dimension: Dimension): string {
  const pillar = DIMENSION_LABELS[dimension];
  const desc = event.description.trim();
  return (
    `This ${event.category} alert threatens your ${pillar} pillar. ` +
    `Reported by the alert source: ${desc} ` +
    `Closing this gap protects how your brand reads on the ${pillar} dimension.`
  );
}

/**
 * Shape the drafted-response payload. The actual generation (concept → draft →
 * publish-filter) happens in the edge entry via the existing capabilities; this
 * builds the brief those capabilities consume and the response envelope stored
 * on the alert. When the chain could not run (capabilities not callable from the
 * edge fn), `status:'pending-generation'` flags that a human/agent must complete
 * it — never a fabricated response.
 */
export interface DraftedResponse {
  status: 'drafted' | 'pending-generation';
  /** The brief handed to the generate→draft→publish-filter chain. */
  brief: string;
  /** The drafted copy, when the chain ran; null when pending. */
  copy: string | null;
  /** Publish-filter verdict, when the chain ran; null when pending. */
  publish_filter: { passed: boolean; notes: string } | null;
  /** Which threatened dimension the response is built to defend. */
  threatened_dimension: Dimension;
}

export function buildResponseBrief(event: AlertEvent, dimension: Dimension): string {
  const pillar = DIMENSION_LABELS[dimension];
  return (
    `Draft a defensive on-brand response to a ${event.category} threat ("${event.title}"). ` +
    `Reinforce the ${pillar} pillar. Source detail: ${event.description.trim()} ` +
    `Do not reference competitors by name; do not invent facts beyond the source detail.`
  );
}

/** A pending (not-yet-generated) drafted response — the grounded default. */
export function pendingDraftedResponse(event: AlertEvent, dimension: Dimension): DraftedResponse {
  return {
    status: 'pending-generation',
    brief: buildResponseBrief(event, dimension),
    copy: null,
    publish_filter: null,
    threatened_dimension: dimension,
  };
}
