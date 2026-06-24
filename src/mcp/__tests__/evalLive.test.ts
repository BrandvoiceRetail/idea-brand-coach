// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  replayCase,
  scoreCase,
  runCaseWithDeps,
  systemPromptFor,
  type CoachModel,
  type Judge,
  type ReplayDeps,
  type AgentTool,
} from '../evals/live/replay.js';
import { parseVerdicts } from '../evals/live/anthropic.js';
import { runBehaviouralJudge } from '../evals/liveTier.js';
import type { EvalCase } from '../evals/cases/types.js';

const TOOLS: AgentTool[] = [{ name: 'run_trust_gap', description: '', inputSchema: { type: 'object' } }];

/** A model that emits a scripted set of tool calls per user turn (and exercises executeTool). */
function mockModel(perTurn: string[][]): CoachModel {
  let t = 0;
  return {
    async runTurn({ executeTool }) {
      const names = perTurn[t++] ?? [];
      const calls = names.map((n) => ({ name: n, input: {} as Record<string, unknown> }));
      for (const c of calls) await executeTool(c);
      return { toolCalls: calls, text: 'ok' };
    },
  };
}
const passJudge: Judge = {
  async judge({ dimensions }) {
    return dimensions.map((d) => ({ dimension: d, pass: true, score: 1, rationale: 'mock' }));
  },
};
const stubExec = async () => 'stub';

const sample: EvalCase = {
  id: 't',
  title: 't',
  persona: 'P1',
  category: 'x',
  description: 'd',
  context: { brand: 'BrandX', fields: [{ label: 'Category', value: 'CatY' }] },
  memory: [{ kind: 'brand-fact', note: 'MemoryNote' }],
  uploads: [{ name: 'u', kind: 'doc', description: 'd' }],
  conversation: [
    { role: 'user', text: 'turn1' },
    { role: 'coach', text: 'c' },
    { role: 'user', text: 'turn2' },
  ],
  expected: { tools: ['run_trust_gap', 'build_avatar_stage'], skills: ['06'], oracle: ['tool-call', 'skill-faithful', 'safety'], outcome: 'o' },
};

describe('A2 replay', () => {
  it('replays every user turn and captures tool calls across the loop', async () => {
    const deps: ReplayDeps = { model: mockModel([['run_trust_gap'], ['build_avatar_stage']]), judge: passJudge, tools: TOOLS, executeTool: stubExec };
    const r = await replayCase(sample, deps);
    expect(r.transcript.filter((m) => m.role === 'user').length).toBe(2);
    expect(r.toolCalls).toEqual(['run_trust_gap', 'build_avatar_stage']);
  });

  it('embeds supplied context + memory + persona in the system prompt', () => {
    const sp = systemPromptFor(sample);
    expect(sp).toContain('Brand: BrandX');
    expect(sp).toContain('MemoryNote');
    expect(sp).toContain('brand owner'); // P1 register
    expect(systemPromptFor({ ...sample, persona: 'P2' })).toContain('operations VA');
    expect(systemPromptFor({ ...sample, persona: 'edge' })).toContain('untrusted');
  });
});

describe('A2 scoring', () => {
  it('scores perfect tool selection at F1 = recall = 1 and includes judged dims', async () => {
    const s = await scoreCase(sample, { toolCalls: ['run_trust_gap', 'build_avatar_stage'], transcript: [], latencyMs: 0 }, passJudge);
    expect(s.metrics.find((m) => m.id === 'tool-call-f1')!.value).toBe(1);
    expect(s.metrics.find((m) => m.id === 'tool-recall')!.value).toBe(1);
    expect(s.metrics.some((m) => m.id === 'judge-safety')).toBe(true);
    expect(s.metrics.every((m) => m.value >= 0 && m.value <= 1)).toBe(true);
  });

  it('penalises a missed expected tool (recall < 1)', async () => {
    const s = await scoreCase(sample, { toolCalls: ['run_trust_gap'], transcript: [], latencyMs: 0 }, passJudge);
    expect(s.metrics.find((m) => m.id === 'tool-recall')!.value).toBeLessThan(1);
  });

  it('runCaseWithDeps end-to-end (mocks) yields a bounded composite', async () => {
    const deps: ReplayDeps = { model: mockModel([['run_trust_gap'], ['build_avatar_stage']]), judge: passJudge, tools: TOOLS, executeTool: stubExec };
    const s = await runCaseWithDeps(sample, deps);
    expect(s.composite).toBeGreaterThan(0);
    expect(s.composite).toBeLessThanOrEqual(1);
  });
});

describe('judge parsing + gating', () => {
  it('parseVerdicts reads JSON and defaults missing dimensions to a conservative fail', () => {
    const v = parseVerdicts('noise [{"dimension":"safety","pass":true,"score":0.9,"rationale":"ok"}] tail', ['safety', 'persona-adapt']);
    expect(v.find((x) => x.dimension === 'safety')!.pass).toBe(true);
    const pa = v.find((x) => x.dimension === 'persona-adapt')!;
    expect(pa.pass).toBe(false);
    expect(pa.score).toBe(0);
  });

  it('runBehaviouralJudge runs a real catalog case with injected mocks (no key)', async () => {
    const deps: ReplayDeps = { model: mockModel([['run_trust_gap']]), judge: passJudge, tools: TOOLS, executeTool: stubExec };
    const s = await runBehaviouralJudge('infinityvault-recognition', deps);
    expect(s.caseId).toBe('infinityvault-recognition');
    expect(s.metrics.length).toBeGreaterThan(0);
  });

  it('runBehaviouralJudge real path is gated without ANTHROPIC_API_KEY', async () => {
    const had = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(runBehaviouralJudge('infinityvault-recognition')).rejects.toThrow(/ANTHROPIC_API_KEY/);
    if (had !== undefined) process.env.ANTHROPIC_API_KEY = had;
  });
});
