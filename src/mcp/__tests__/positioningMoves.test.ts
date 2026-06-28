// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { ConceptCandidate } from '../service/concepts.js';
import {
  generatePositioningMoves,
  applyScores,
  parseScores,
  buildScoringPrompt,
  type PositioningMovesDeps,
  type RawCriterionScore,
} from '../service/positioningMoves.js';
import { enabledCriteria, DEFAULT_CRITERIA_SET } from '../evals/criteria/catalog.js';

const REQ = { avatar: 'A sceptical FBA brand owner burned by past suppliers', decisionTrigger: 'Recognition', brandContext: 'Premium card storage; 4.6 stars; protects collections', count: 2 };

const candidate = (n: number): ConceptCandidate => ({
  title: `Move ${n}`,
  hook: `Statement ${n}`,
  angle: `Angle ${n}`,
  rationale: `Rationale ${n}`,
});

describe('positioningMoves service', () => {
  it('scores each move against the criteria and computes the composite as a plain average', async () => {
    const criteria = enabledCriteria(DEFAULT_CRITERIA_SET);
    const deps: PositioningMovesDeps = {
      generate: async () => [candidate(1), candidate(2)],
      // Score every active criterion: move 1 -> all 1.0, move 2 -> all 0.4
      score: async (move) =>
        criteria.map((c) => ({ id: c.id, score: move.title === 'Move 1' ? 1 : 0.4, rationale: `because ${c.id}` })),
    };
    const out = await generatePositioningMoves(REQ, deps);
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.moves).toHaveLength(2);
    // Ranked highest-composite first.
    expect(out.moves[0].title).toBe('Move 1');
    expect(out.moves[0].composite).toBe(1);
    expect(out.moves[1].composite).toBe(0.4);
    expect(out.moves[0].criteria).toHaveLength(criteria.length);
    expect(out.moves[0].statement).toBe('Statement 1');
  });

  it('returns the move unscored (composite null) when the judge returns nothing — never fabricates', async () => {
    const deps: PositioningMovesDeps = {
      generate: async () => [candidate(1)],
      score: async () => null,
    };
    const out = await generatePositioningMoves(REQ, deps);
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.moves[0].scored).toBe(false);
    expect(out.moves[0].composite).toBeNull();
    expect(out.moves[0].criteria).toEqual([]);
    expect(out.moves[0].note).toMatch(/unavailable/);
  });

  it('degrades honestly to unavailable when generation is empty/unreachable', async () => {
    const deps: PositioningMovesDeps = { generate: async () => null, score: async () => null };
    const out = await generatePositioningMoves(REQ, deps);
    expect(out.status).toBe('unavailable');
  });

  it('averages only the criteria the judge actually returned (partial scoring is honest)', () => {
    const criteria = enabledCriteria(DEFAULT_CRITERIA_SET);
    const raw: RawCriterionScore[] = [
      { id: criteria[0].id, score: 1, rationale: 'a' },
      { id: criteria[1].id, score: 0, rationale: 'b' },
    ];
    const scored = applyScores(candidate(1), criteria, raw);
    expect(scored.criteria).toHaveLength(2);
    expect(scored.composite).toBe(0.5);
    expect(scored.note).toMatch(/partial/);
  });

  it('clamps out-of-range judge scores into 0..1', () => {
    const criteria = enabledCriteria(DEFAULT_CRITERIA_SET);
    const raw: RawCriterionScore[] = [{ id: criteria[0].id, score: 9, rationale: 'x' }];
    const scored = applyScores(candidate(1), criteria, raw);
    expect(scored.criteria[0].score).toBe(1);
  });

  it('parseScores extracts a JSON array from a chatty/fenced reply', () => {
    const reply = 'Here you go:\n```json\n[{"id":"trevor-voice","score":0.8,"rationale":"direct"}]\n```';
    expect(parseScores(reply)).toEqual([{ id: 'trevor-voice', score: 0.8, rationale: 'direct' }]);
  });

  it('buildScoringPrompt lists the criteria ids for the judge', () => {
    const criteria = enabledCriteria(DEFAULT_CRITERIA_SET);
    const prompt = buildScoringPrompt(candidate(1), criteria);
    expect(prompt).toContain(criteria[0].id);
    expect(prompt).toContain('JSON array');
  });
});
