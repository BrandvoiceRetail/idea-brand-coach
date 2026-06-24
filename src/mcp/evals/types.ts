/**
 * MCP evals — report contract.
 *
 * The eval suite scores and COMPARES coach *configurations* (a configuration =
 * a skill set × tool-grounding map that powers the brand-coach MCP) across a set
 * of metrics, and produces a "current coach value" scorecard from the golden
 * conversation corpus. The admin dashboard imports the generated report literal.
 *
 * Everything here is deterministic (no clock, no network, no model) so the report
 * is reproducible and CI-friendly. The optional live LLM tier (see liveTier) layers
 * runtime behavioural scores on top when explicitly enabled.
 */

/** A single normalised metric (value always in [0,1]). */
export interface MetricResult {
  id: string;
  label: string;
  description: string;
  /** Normalised score, 0..1. */
  value: number;
  /** Human-readable rendering, e.g. "5 / 6 tools" or "92%". */
  display: string;
  /** Weight in the composite score. */
  weight: number;
  detail?: string;
}

export type GroundingSource = 'book' | 'app' | 'both';

/** A scored coach configuration (one column in the comparison). */
export interface ConfigScore {
  id: string;
  label: string;
  description: string;
  groundingSource: GroundingSource;
  /** True for the configuration the live coach currently runs. */
  current: boolean;
  /** Config-comparison metrics (differ by skill/tool set). */
  metrics: MetricResult[];
  /** Weighted composite, 0..1. */
  composite: number;
  /** Letter grade derived from the composite. */
  grade: string;
}

export type KpiCategory = 'grounding' | 'safety' | 'persona' | 'actionability' | 'coverage';

/** A user-value KPI for the current coach (corpus-derived). */
export interface CoachValueKpi {
  id: string;
  label: string;
  description: string;
  value: number; // 0..1
  display: string;
  category: KpiCategory;
  detail?: string;
}

/** A static hard-rule guardrail check. */
export interface GuardrailResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface CorpusSummary {
  fixtures: number;
  journeys: number;
  personas: Record<string, number>;
  types: Record<string, number>;
  uniqueToolLabels: number;
  uniqueSkillPaths: number;
  /** Count of fixtures asserting each oracle dimension. */
  oracleDims: Record<string, number>;
}

export interface LiveTierStatus {
  available: boolean;
  reason: string;
  /** Populated only when the live tier actually ran. */
  metrics?: MetricResult[];
}

export interface EvalReport {
  schemaVersion: number;
  generatedNote: string;
  corpus: CorpusSummary;
  /** Comparison across configurations. */
  configs: ConfigScore[];
  currentConfigId: string;
  /** Headline scorecard for the current coach. */
  coachValue: CoachValueKpi[];
  /** Composite of the coach-value KPIs (0..1) — the dashboard's hero number. */
  coachValueScore: number;
  guardrails: GuardrailResult[];
  /** Open items / discrepancies surfaced for the operator. */
  flags: string[];
  liveTier: LiveTierStatus;
}
