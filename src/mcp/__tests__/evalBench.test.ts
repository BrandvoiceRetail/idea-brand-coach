// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { EVAL_CASES, getEvalCase } from '../evals/cases/catalog.js';
import { runLiveTier, liveTierStatus, contractMetrics } from '../evals/liveTier.js';
import { listLiveTools } from '../evals/live/serverTools.js';

const SKILL_RE = /^(0[1-9]|1[0-9]|20)$/;

describe('Eval Bench — curated case catalog', () => {
  it('has a diverse, well-formed set of cases', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length); // unique ids
    const personas = new Set(EVAL_CASES.map((c) => c.persona));
    for (const p of ['P1', 'P2', 'edge']) expect(personas.has(p as never), p).toBe(true);
  });

  it('every case bundles context, memory, uploads, a practice conversation, and expectations', () => {
    for (const c of EVAL_CASES) {
      expect(c.title.length, c.id).toBeGreaterThan(0);
      expect(c.context.brand.length, c.id).toBeGreaterThan(0);
      expect(c.context.fields.length, `${c.id} context`).toBeGreaterThan(0);
      expect(c.memory.length, `${c.id} memory`).toBeGreaterThan(0);
      expect(c.uploads.length, `${c.id} uploads`).toBeGreaterThan(0);
      expect(c.conversation.length, `${c.id} conversation`).toBeGreaterThanOrEqual(2);
      expect(c.conversation.some((t) => t.role === 'user'), `${c.id} has a user turn`).toBe(true);
      expect(c.conversation.some((t) => t.role === 'coach'), `${c.id} has a coach turn`).toBe(true);
      expect(c.expected.outcome.length, `${c.id} outcome`).toBeGreaterThan(0);
      expect(c.expected.oracle.length, `${c.id} oracle`).toBeGreaterThan(0);
      for (const s of c.expected.skills) expect(SKILL_RE.test(s), `${c.id} skill ${s}`).toBe(true);
    }
  });

  it('getEvalCase resolves by id', () => {
    expect(getEvalCase(EVAL_CASES[0].id)?.id).toBe(EVAL_CASES[0].id);
    expect(getEvalCase('nope')).toBeUndefined();
  });
});

describe('Eval Bench — live tier (A1 against the in-process MCP server)', () => {
  it('every expected tool a case uses is actually advertised by the live server', async () => {
    const names = new Set((await listLiveTools()).map((t) => t.name));
    for (const c of EVAL_CASES) {
      for (const tool of c.expected.tools) {
        expect(names.has(tool), `${c.id} expects unregistered tool "${tool}"`).toBe(true);
      }
    }
  });

  it('contract metrics report real coverage of the live tool surface', async () => {
    const metrics = contractMetrics(await listLiveTools());
    const byId = (id: string) => metrics.find((m) => m.id === id)!;
    expect(byId('live-tool-availability').value).toBeGreaterThan(0);
    // the 5 app-grounded tools carry the grounding citation + the buyer-state guardrail
    expect(byId('live-grounding-reach').value).toBe(1);
    expect(byId('live-guardrail-surface').value).toBe(1);
    for (const m of metrics) {
      expect(m.value).toBeGreaterThanOrEqual(0);
      expect(m.value).toBeLessThanOrEqual(1);
    }
  });

  it('runLiveTier runs A1 but keeps the A2 LLM tier gated without a key', async () => {
    const status = await runLiveTier();
    expect(status.metrics?.length).toBeGreaterThan(0);
    expect(status.available).toBe(false); // no ANTHROPIC_API_KEY in test env
    expect(status.reason).toMatch(/contract checks ran/i);
  });

  it('liveTierStatus is the boot-free gated default', () => {
    const s = liveTierStatus();
    expect(s.available).toBe(false);
    expect(s.metrics).toBeUndefined();
    expect(s.reason).toMatch(/gated/i);
  });
});
