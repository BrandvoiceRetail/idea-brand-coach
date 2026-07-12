/**
 * Eval metrics — all deterministic, all normalised to [0,1].
 *
 * Two families:
 *  - CONFIG metrics: differ by skill/tool grounding set → power the config comparison.
 *  - COACH-VALUE KPIs: corpus-derived → the current coach's user-value scorecard.
 * Plus static GUARDRAIL checks of the App Skill Architecture hard rules, and operator FLAGS.
 */
import {
  appArchitecture,
  loadAppSkills,
  internalOnlySkills,
  tier1AlwaysInContext,
  appSkillsByTier,
  appSkillContent,
} from '../skills/appSkills.js';
import {
  CONFIGS,
  type ConfigDef,
  groundedToolMap,
  configSkillPaths,
  injectsGuardrails,
} from './configs.js';
import { corpusSkillPaths, corpusToolLabels, type CorpusFixture } from './corpus.js';
import { triggerAccuracy, anchorAccuracy, loopReadiness, trustGapAccuracy } from './oracles.js';
import type {
  ConfigScore,
  CoachValueKpi,
  GuardrailResult,
  MetricResult,
  CorpusSummary,
} from './types.js';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const pct = (n: number): string => `${Math.round(n * 100)}%`;
const INTERNAL_ONLY_EXPECTED = ['05', '15', '16', '17', '18', '19', '20'];
const DENSITY_CAP = 6; // grounding skills per tool that counts as "fully grounded"

// ── Config comparison metrics ────────────────────────────────────────────────

/** Max grounded-tool count across all configs (the "both" config) — the normaliser. */
function maxGroundedTools(): number {
  return Math.max(...CONFIGS.map((c) => Object.keys(groundedToolMap(c.groundingSource)).length), 1);
}

/** Structural integrity of the App Skill Architecture (0 for a config with no app layer). */
function architectureChecks(source: ConfigDef['groundingSource']): { passed: number; total: number } {
  if (source === 'book') return { passed: 0, total: 5 };
  const arch = appArchitecture();
  const skills = loadAppSkills();
  const internal = internalOnlySkills().map((s) => s.number).sort();
  const tierSizes = [1, 2, 3, 4].map((t) => appSkillsByTier(t).length);
  const depsOk = skills.every((s) =>
    s.dependsOn.every((d) => skills.some((x) => x.number === d)),
  );
  const checks = [
    arch?.totals.skills === 21 && arch?.totals.tiers === 4,
    tier1AlwaysInContext().length === 3,
    JSON.stringify(internal) === JSON.stringify(INTERNAL_ONLY_EXPECTED),
    JSON.stringify(tierSizes) === JSON.stringify([3, 5, 7, 6]), // Tier 3 gained Skill 21 (PPC audit)
    depsOk,
  ];
  return { passed: checks.filter(Boolean).length, total: checks.length };
}

export function scoreConfig(def: ConfigDef, corpus: CorpusFixture[]): ConfigScore {
  const toolMap = groundedToolMap(def.groundingSource);
  const grounded = Object.keys(toolMap).length;
  const totalSkillRefs = Object.values(toolMap).reduce((a, b) => a + b, 0);
  const density = grounded ? totalSkillRefs / grounded : 0;

  const cited = [...corpusSkillPaths(corpus)];
  const have = configSkillPaths(def.groundingSource);
  const resolved = cited.filter((p) => have.has(p)).length;

  const arch = architectureChecks(def.groundingSource);
  const guardrails = injectsGuardrails(def.groundingSource);

  const metrics: MetricResult[] = [
    {
      id: 'tool-grounding-coverage',
      label: 'Tool grounding coverage',
      description: 'How many coach tools this config grounds in authored skills.',
      value: clamp01(grounded / maxGroundedTools()),
      display: `${grounded} tool${grounded === 1 ? '' : 's'}`,
      weight: 0.2,
      detail: Object.keys(toolMap).sort().join(', ') || '—',
    },
    {
      id: 'grounding-density',
      label: 'Grounding density',
      description: 'Average number of grounding skills per grounded tool.',
      value: clamp01(density / DENSITY_CAP),
      display: density ? `${density.toFixed(1)} skills/tool` : '—',
      weight: 0.15,
    },
    {
      id: 'skill-resolution',
      label: 'Corpus skill resolution',
      description: 'Share of skills the golden corpus cites that resolve in this config.',
      value: cited.length ? clamp01(resolved / cited.length) : 0,
      display: `${resolved} / ${cited.length}`,
      weight: 0.3,
      detail:
        def.groundingSource === 'app'
          ? 'App-skills alone do not cover the book paths the corpus cites — they are the operational layer, not the knowledge corpus.'
          : undefined,
    },
    {
      id: 'guardrail-strength',
      label: 'Guardrail enforcement',
      description:
        'Whether the config injects the hard-rule guardrail (no buyer-state leak) into grounded tool descriptions.',
      value: guardrails ? 1 : 0,
      display: guardrails ? 'Enforced' : 'Not enforced',
      weight: 0.2,
    },
    {
      id: 'architecture-integrity',
      label: 'Architecture integrity',
      description: 'Tier completeness, always-in-context set, internal-only set, dependency + tier sizes.',
      value: arch.total ? clamp01(arch.passed / arch.total) : 0,
      display: `${arch.passed} / ${arch.total} checks`,
      weight: 0.15,
    },
  ];

  const composite = clamp01(metrics.reduce((a, m) => a + m.weight * m.value, 0));
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    groundingSource: def.groundingSource,
    current: def.current,
    metrics,
    composite,
    grade: gradeFor(composite),
  };
}

export function gradeFor(composite: number): string {
  if (composite >= 0.85) return 'A';
  if (composite >= 0.7) return 'B';
  if (composite >= 0.5) return 'C';
  if (composite >= 0.3) return 'D';
  return 'F';
}

// ── Current-coach value KPIs (corpus-derived) ────────────────────────────────

const CORE_ORACLES = ['skill-faithful', 'tool-call', 'schema', 'persona-adapt', 'artifact', 'safety'];

export function buildCoachValue(corpus: CorpusFixture[]): CoachValueKpi[] {
  const n = corpus.length || 1;
  const withDim = (d: string) => corpus.filter((f) => f.oracleDims.includes(d)).length;
  const p1 = corpus.filter((f) => f.persona === 'P1').length;
  const p2 = corpus.filter((f) => f.persona === 'P2').length;
  const journeys = corpus.filter((f) => f.type === 'journey');
  const hardening = corpus.filter((f) => ['edge', 'negative', 'isolation'].includes(f.type)).length;
  const journeyDirs = [...new Set(journeys.map((f) => f.journey))];
  const journeysBothPersona = journeyDirs.filter((j) => {
    const inJ = corpus.filter((f) => f.journey === j);
    return inJ.some((f) => f.persona === 'P1') && inJ.some((f) => f.persona === 'P2');
  }).length;

  // tool-surface reach: corpus tool labels that map (via alias) to a grounded "both" tool
  const grounded = new Set(Object.keys(groundedToolMap('both')));
  const labels = [...corpusToolLabels(corpus)];
  const aliasFor = (label: string): string =>
    ({
      build_avatar: 'build_avatar_stage',
      run_diagnostic: 'run_diagnostic_evidence',
      export_strategy_doc: 'generate_brief',
    })[label] ?? label;
  const reached = labels.filter((l) => grounded.has(aliasFor(l))).length;

  const kpi = (
    id: string,
    label: string,
    description: string,
    value: number,
    display: string,
    category: CoachValueKpi['category'],
    detail?: string,
  ): CoachValueKpi => ({ id, label, description, value: clamp01(value), display, category, detail });

  return [
    kpi('skill-faithfulness', 'Skill faithfulness', 'Fixtures whose claims are traced to a cited skill.', withDim('skill-faithful') / n, pct(withDim('skill-faithful') / n), 'grounding'),
    kpi('tool-call-coverage', 'Tool-call coverage', 'Fixtures asserting the exact tool sequence invoked.', withDim('tool-call') / n, pct(withDim('tool-call') / n), 'grounding'),
    kpi('persona-adaptation', 'Persona adaptation', 'Fixtures asserting persona-specific coaching behaviour.', withDim('persona-adapt') / n, pct(withDim('persona-adapt') / n), 'persona'),
    kpi('persona-balance', 'Persona balance', 'Balance of the two ICPs across the corpus (P1 vs P2).', 1 - Math.abs(p1 - p2) / n, `P1 ${p1} · P2 ${p2}`, 'persona'),
    kpi('safety-coverage', 'Safety coverage', 'Fixtures carrying a safety/isolation oracle.', withDim('safety') / n, pct(withDim('safety') / n), 'safety'),
    kpi('hardening-cases', 'Hardening cases', 'Edge / negative / isolation scenarios present (target 10).', Math.min(1, hardening / 10), `${hardening} cases`, 'safety'),
    kpi('actionability', 'Actionability', 'Journey fixtures ending on an actionable deliverable (score / trigger / brief / test).', journeys.filter((f) => f.hasActionableArtifact).length / (journeys.length || 1), pct(journeys.filter((f) => f.hasActionableArtifact).length / (journeys.length || 1)), 'actionability', 'Trevor’s governing promise: every session ends with something to act on.'),
    kpi('artifact-coverage', 'Artifact coverage', 'Fixtures that produce a concrete artifact.', withDim('artifact') / n, pct(withDim('artifact') / n), 'actionability'),
    kpi('journey-coverage', 'Journey coverage', 'Journeys exercised with both ICPs present.', journeyDirs.length ? journeysBothPersona / journeyDirs.length : 0, `${journeysBothPersona} / ${journeyDirs.length} journeys`, 'coverage'),
    kpi('tool-surface-reach', 'Tool-surface reach', 'Corpus-exercised tools that are skill-grounded in the live coach.', labels.length ? reached / labels.length : 0, `${reached} / ${labels.length} tools`, 'coverage', 'Remaining labels are planned/aliased tools not yet grounded.'),
  ];
}

// ── Deterministic correctness KPIs (case-derived, decision-table oracles) ─────

/**
 * Correctness KPIs that need no model — they verify the encoded decision table + corrected
 * anchors + the retention loop against the curated cases. These close the gap-analysis P0s
 * (trigger-accuracy / anchor-correctness / loop-readiness) deterministically; the behavioural
 * "did the live coach pick it" stays the A2 judge's job.
 */
export function buildCorrectnessKpis(): CoachValueKpi[] {
  const trig = triggerAccuracy();
  const anchor = anchorAccuracy();
  const loop = loopReadiness();
  const tgAcc = trustGapAccuracy();
  return [
    {
      id: 'trust-gap-accuracy',
      label: 'Trust Gap score accuracy',
      description: 'Diagnosed cases where the scored primary gap is the lowest pillar — the lead magnet points at the right dimension.',
      value: clamp01(tgAcc.value),
      display: `${tgAcc.matched} / ${tgAcc.total}`,
      category: 'grounding',
      detail: tgAcc.mismatches.length ? `Score↔fix disagreement: ${tgAcc.mismatches.map((m) => `${m.caseId}`).join(', ')}` : 'The scored primary gap and the recommended fix agree on every diagnosed case.',
    },
    {
      id: 'trigger-accuracy',
      label: 'Decision Trigger accuracy',
      description: 'Curated cases whose declared primary trigger matches the decision table derived from their Trust Gap pillars.',
      value: clamp01(trig.value),
      display: `${trig.matched} / ${trig.total}`,
      category: 'grounding',
      detail: trig.mismatches.length ? `Mismatches: ${trig.mismatches.map((m) => `${m.caseId}→${m.expected}`).join(', ')}` : 'The pillar→trigger decision table is consistent with every diagnosed case.',
    },
    {
      id: 'anchor-correctness',
      label: 'Brand-anchor correctness',
      description: 'Cases whose Decision Trigger maps to its fixed brand anchor (Recognition = Dove, never Lego).',
      value: clamp01(anchor.value),
      display: `${anchor.matched} / ${anchor.total}`,
      category: 'grounding',
    },
    {
      id: 'loop-readiness',
      label: 'Loop readiness',
      description: 'Bench cases exercising the Diagnose→Analyse→Fix→Re-measure→Defend retention loop.',
      value: clamp01(loop.value > 0 ? 1 : 0),
      display: `${loop.loopCases} loop case${loop.loopCases === 1 ? '' : 's'}`,
      category: 'coverage',
      detail: loop.loopCases ? 'A return-visit case verifies the coach re-scores on remembered context.' : 'No loop case yet — the retention loop is untested.',
    },
  ];
}

// ── Static guardrail checks (App Skill Architecture hard rules) ───────────────

export function buildGuardrails(): GuardrailResult[] {
  const arch = appArchitecture();
  const hardRules = arch?.hardRules ?? [];
  const internal = internalOnlySkills().map((s) => s.number).sort();
  const skill06 = appSkillContent('06');
  // Component 0 example rows in Skill 06 must not name a buyer state.
  const component0 = skill06.split(/Component 0/i)[1]?.split(/## /)[0] ?? skill06;
  const skill08 = appSkillContent('08');
  const tier1Internal = tier1AlwaysInContext().some((s) => s.internalOnly);

  return [
    {
      id: 'gr-buyer-state-rule',
      label: 'Buyer-state names (Tier B) kept out of primary panels',
      passed: hardRules.some((r) => /Assessor.*Protector.*Expresser.*Connector/i.test(r)),
      detail: 'Per IDEA-POLICY-TERM-001: buyer-state names are Tier B — opt-in expansion panels only, never the primary output.',
    },
    {
      id: 'gr-tier-a-commercial',
      label: 'Tier A commercial terms always present (terminology policy)',
      passed: hardRules.some((r) => /Tier A/i.test(r) && /(Trust Gap|Decision Trigger)/i.test(r)),
      detail: 'Trust Gap™ / Decision Trigger™ / pillar names appear across all surfaces incl. app UI — the Distinctive pillar applied to our own vocabulary.',
    },
    {
      id: 'gr-internal-only-set',
      label: 'Engine-only skills flagged internal (05 + Tier 4)',
      passed: JSON.stringify(internal) === JSON.stringify(INTERNAL_ONLY_EXPECTED),
      detail: `internal-only = ${internal.join(', ')}`,
    },
    {
      id: 'gr-grounding-injects-rule',
      label: 'Grounded tools carry the guardrail reminder',
      passed: injectsGuardrails('both'),
      detail: 'appGroundingPreamble reasserts the buyer-state internal rule in tool descriptions.',
    },
    {
      id: 'gr-component0-clean',
      label: 'Component 0 examples contain no buyer-state names',
      passed: component0.length > 0 && !/\b(Assessor|Protector|Expresser|Connector)\b/.test(component0),
      detail: 'Skill 06 primary-conversion-problem examples are plain-language only.',
    },
    {
      id: 'gr-jtbd-retired',
      label: 'Jobs-to-be-done retired in favour of Purchase Motivation',
      passed: /retired/i.test(skill08) && /purchase motivation/i.test(skill08),
      detail: 'Skill 08 explicitly retires JTBD.',
    },
    {
      id: 'gr-tier1-not-internal',
      label: 'Always-in-context (Tier 1) skills are not engine-only',
      passed: !tier1Internal,
      detail: 'Tier-1 foundation skills shape user-facing output; none are internal-only.',
    },
  ];
}

// ── Operator flags ───────────────────────────────────────────────────────────

export function buildFlags(corpus: CorpusFixture[]): string[] {
  const arch = appArchitecture();
  const pending = loadAppSkills().filter((s) => s.contentFidelity !== 'full').map((s) => s.number);
  const grounded = new Set(Object.keys(groundedToolMap('both')));
  const labels = [...corpusToolLabels(corpus)];
  const alias = (l: string) =>
    ({ build_avatar: 'build_avatar_stage', run_diagnostic: 'run_diagnostic_evidence', export_strategy_doc: 'generate_brief' })[l] ?? l;
  const ungrounded = labels.filter((l) => !grounded.has(alias(l)));

  return [
    arch?.scopeNote ?? '',
    `Corpus tool labels not yet skill-grounded (planned/aliased): ${ungrounded.sort().join(', ') || 'none'}.`,
    `App skills awaiting Trevor's detailed doc (content_fidelity ≠ full): ${pending.join(', ')}.`,
    'Live LLM tier is gated (BRAND_COACH_MCP_HOST=1 + ANTHROPIC_API_KEY). Deterministic core runs without it.',
  ].filter(Boolean);
}

export function corpusSummary(corpus: CorpusFixture[]): CorpusSummary {
  const count = (key: (f: CorpusFixture) => string) =>
    corpus.reduce<Record<string, number>>((acc, f) => ((acc[key(f)] = (acc[key(f)] ?? 0) + 1), acc), {});
  const oracleDims: Record<string, number> = {};
  for (const d of CORE_ORACLES) oracleDims[d] = corpus.filter((f) => f.oracleDims.includes(d)).length;
  return {
    fixtures: corpus.length,
    journeys: new Set(corpus.filter((f) => f.type === 'journey').map((f) => f.journey)).size,
    personas: count((f) => f.persona),
    types: count((f) => f.type),
    uniqueToolLabels: corpusToolLabels(corpus).size,
    uniqueSkillPaths: corpusSkillPaths(corpus).size,
    oracleDims,
  };
}
