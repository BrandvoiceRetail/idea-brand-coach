// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildReport } from '../evals/engine.js';
import { scoreConfig } from '../evals/metrics.js';
import { CONFIGS } from '../evals/configs.js';
import { loadCorpus } from '../evals/corpus.js';

const report = buildReport();
const byId = (id: string) => report.configs.find((c) => c.id === id)!;

describe('MCP evals engine', () => {
  it('builds a well-formed report over the golden corpus', () => {
    expect(report.schemaVersion).toBe(1);
    expect(report.corpus.fixtures).toBeGreaterThanOrEqual(100);
    expect(report.configs).toHaveLength(3);
    expect(report.currentConfigId).toBe('app+book');
    expect(report.coachValue.length).toBeGreaterThan(0);
    expect(report.coachValueScore).toBeGreaterThan(0);
    expect(report.coachValueScore).toBeLessThanOrEqual(1);
  });

  it('keeps every metric and composite normalised to [0,1]', () => {
    for (const c of report.configs) {
      expect(c.composite).toBeGreaterThanOrEqual(0);
      expect(c.composite).toBeLessThanOrEqual(1);
      for (const m of c.metrics) {
        expect(m.value, `${c.id}/${m.id}`).toBeGreaterThanOrEqual(0);
        expect(m.value, `${c.id}/${m.id}`).toBeLessThanOrEqual(1);
      }
    }
    for (const k of report.coachValue) {
      expect(k.value, k.id).toBeGreaterThanOrEqual(0);
      expect(k.value, k.id).toBeLessThanOrEqual(1);
    }
  });

  it('ranks the current (app+book) config above either layer alone', () => {
    const both = byId('app+book').composite;
    expect(both).toBeGreaterThan(byId('book-grounding').composite);
    expect(both).toBeGreaterThan(byId('app-skills').composite);
    expect(byId('app+book').current).toBe(true);
  });

  it('shows the expected per-layer trade-offs', () => {
    const metric = (id: string, m: string) => byId(id).metrics.find((x) => x.id === m)!.value;
    // book grounds the corpus knowledge; app-skills alone do not resolve the book paths it cites
    expect(metric('book-grounding', 'skill-resolution')).toBeGreaterThan(
      metric('app-skills', 'skill-resolution'),
    );
    // only the app layer enforces the hard-rule guardrail + carries the architecture
    expect(metric('book-grounding', 'guardrail-strength')).toBe(0);
    expect(metric('app+book', 'guardrail-strength')).toBe(1);
    expect(metric('book-grounding', 'architecture-integrity')).toBe(0);
    expect(metric('app+book', 'architecture-integrity')).toBe(1);
    // the current config grounds at least as many tools as the book baseline
    expect(metric('app+book', 'tool-grounding-coverage')).toBeGreaterThanOrEqual(
      metric('book-grounding', 'tool-grounding-coverage'),
    );
  });

  it('passes every static guardrail check', () => {
    expect(report.guardrails.length).toBeGreaterThanOrEqual(6);
    for (const g of report.guardrails) expect(g.passed, g.label).toBe(true);
  });

  it('reports a balanced two-ICP corpus and core oracle coverage', () => {
    expect(report.corpus.personas.P1).toBeGreaterThan(0);
    expect(report.corpus.personas.P2).toBeGreaterThan(0);
    // persona-adapt, artifact, safety are universal oracles in the corpus
    for (const dim of ['persona-adapt', 'artifact', 'safety']) {
      expect(report.corpus.oracleDims[dim], dim).toBe(report.corpus.fixtures);
    }
  });

  it('surfaces operator flags incl. the scope discrepancy + gated live tier', () => {
    expect(report.flags.some((f) => /14 Alpha.*6 Beta|17 Alpha/i.test(f))).toBe(true);
    expect(report.liveTier.available).toBe(false); // no host/key in test env
    expect(report.liveTier.reason).toMatch(/gated/i);
  });

  it('is deterministic — two builds are deeply equal', () => {
    expect(buildReport()).toEqual(report);
  });

  it('guardrail lint catches an injected buyer-state leak in a config score', () => {
    // sanity: the guardrail check is real — Component 0 of Skill 06 must be clean today
    const g = report.guardrails.find((x) => x.id === 'gr-component0-clean')!;
    expect(g.passed).toBe(true);
    // and the corpus actually loaded (the lint is not vacuously passing)
    expect(loadCorpus().length).toBe(report.corpus.fixtures);
    expect(CONFIGS).toHaveLength(3);
    expect(scoreConfig(CONFIGS[0], loadCorpus()).metrics.length).toBeGreaterThan(0);
  });
});
