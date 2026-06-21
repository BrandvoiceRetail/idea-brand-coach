/**
 * Live tier — exercises the ACTUAL MCP server (not just the static registries).
 *
 *  - A1 (runs now, no model): connect the in-process MCP server, list its advertised tools,
 *    and validate the live surface — tool availability, grounding reach, guardrail-in-surface.
 *    Deterministic → baked into the committed report by `npm run evals`.
 *  - A2 (gated, needs ANTHROPIC_API_KEY): `runBehaviouralJudge` replays an eval case's practice
 *    conversation through the coach tool-use loop and LLM-judges actual-vs-expected
 *    (tool-call accuracy + skill-faithfulness + persona-adaptation + safety). Run via the
 *    `evals:live` CLI; gated off by default (cost + non-determinism + credentials).
 */
import { groundedToolMap } from './configs.js';
import { loadCorpus, corpusToolLabels } from './corpus.js';
import { listLiveTools } from './live/serverTools.js';
import { getEvalCase } from './cases/catalog.js';
import { runCaseWithDeps, type CaseScore, type ReplayDeps } from './live/replay.js';
import { defaultLiveDeps } from './live/anthropic.js';
import type { LiveTierStatus, MetricResult } from './types.js';

/** Corpus tool labels are planned names; map the known aliases to registered tool names. */
const TOOL_ALIAS: Record<string, string> = {
  build_avatar: 'build_avatar_stage',
  run_diagnostic: 'run_diagnostic_evidence',
  export_strategy_doc: 'generate_brief',
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** A1: deterministic checks of the live tool surface. */
export function contractMetrics(tools: { name: string; description: string }[]): MetricResult[] {
  const names = new Set(tools.map((t) => t.name));
  const desc = new Map(tools.map((t) => [t.name, t.description] as const));

  const labels = [...corpusToolLabels(loadCorpus())].map((l) => TOOL_ALIAS[l] ?? l);
  const present = labels.filter((n) => names.has(n));

  const grounded = Object.keys(groundedToolMap('both')).filter((n) => names.has(n));
  const groundedCited = grounded.filter((n) =>
    /App Skill Architecture|What Captures the Heart/i.test(desc.get(n) ?? ''),
  );
  const guarded = grounded.filter(
    (n) => /Assessor|Protector|Expresser|Connector/.test(desc.get(n) ?? '') && /internal/i.test(desc.get(n) ?? ''),
  );

  return [
    {
      id: 'live-tool-availability',
      label: 'Tool availability',
      description: 'Corpus-exercised tools the live server actually advertises.',
      value: labels.length ? clamp01(present.length / labels.length) : 0,
      display: `${present.length} / ${labels.length}`,
      weight: 0,
      detail: `Advertised tools: ${tools.length}.`,
    },
    {
      id: 'live-grounding-reach',
      label: 'Grounding reach (live)',
      description: 'Grounded tools whose live description carries a skill-grounding citation.',
      value: grounded.length ? clamp01(groundedCited.length / grounded.length) : 0,
      display: `${groundedCited.length} / ${grounded.length}`,
      weight: 0,
    },
    {
      id: 'live-guardrail-surface',
      label: 'Guardrail in tool surface (live)',
      description: 'Grounded tools whose live description carries the buyer-state internal-only rule.',
      value: grounded.length ? clamp01(guarded.length / grounded.length) : 0,
      display: `${guarded.length} / ${grounded.length}`,
      weight: 0,
      detail: 'Proves the App Skill Architecture hard rule reaches the model-facing tool surface.',
    },
  ];
}

/** Sync, boot-free default for `buildReport()` — keeps the engine deterministic. */
export function liveTierStatus(): LiveTierStatus {
  const hostOn = process.env.BRAND_COACH_MCP_HOST === '1';
  const keyOn = Boolean(process.env.ANTHROPIC_API_KEY);
  if (hostOn && keyOn) {
    return {
      available: true,
      reason: 'Host + model key present. Run the eval-bench live tier (npm run evals:live) for runtime behavioural metrics.',
    };
  }
  const missing = [hostOn ? null : 'BRAND_COACH_MCP_HOST=1', keyOn ? null : 'ANTHROPIC_API_KEY'].filter(Boolean);
  return {
    available: false,
    reason: `Gated — set ${missing.join(' + ')} to enable LLM-judged behavioural scoring (npm run evals:live) or an mcpjam runner.`,
  };
}

/** Full live tier: A1 server-contract checks (always) + A2 gating note for the report. */
export async function runLiveTier(): Promise<LiveTierStatus> {
  const keyOn = Boolean(process.env.ANTHROPIC_API_KEY);
  let metrics: MetricResult[];
  try {
    metrics = contractMetrics(await listLiveTools());
  } catch (e) {
    return {
      available: false,
      reason: `Live server-contract checks failed to run (${(e as Error).message}). LLM behavioural tier also gated.`,
    };
  }
  const behavioural = keyOn
    ? 'LLM behavioural tier ready — run `npm run evals:live` to replay the eval cases.'
    : 'LLM behavioural tier gated (set ANTHROPIC_API_KEY + BRAND_COACH_MCP_HOST=1, then `npm run evals:live`).';
  return {
    available: keyOn,
    reason: `Server-contract checks ran against the in-process MCP server. ${behavioural}`,
    metrics,
  };
}

/**
 * A2 — replay one eval case through the coach and LLM-judge actual-vs-expected.
 * Pass `depsOverride` (mock model+judge) for tests; otherwise the real Anthropic deps are
 * built from env and the call throws without ANTHROPIC_API_KEY.
 */
export async function runBehaviouralJudge(caseId: string, depsOverride?: ReplayDeps): Promise<CaseScore> {
  const evalCase = getEvalCase(caseId);
  if (!evalCase) throw new Error(`Unknown eval case "${caseId}".`);
  const deps = depsOverride ?? (await defaultLiveDeps());
  return runCaseWithDeps(evalCase, deps);
}
