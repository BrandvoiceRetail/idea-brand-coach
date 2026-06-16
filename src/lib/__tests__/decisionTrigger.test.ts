import { describe, it, expect } from 'vitest';
import { derivePrior, PILLAR_TRIGGER, DECISION_TRIGGER_TYPES } from '../decisionTrigger';

describe('decisionTrigger — Stage 1 deterministic prior', () => {
  it('maps each low pillar to its §5.2 trigger', () => {
    expect(PILLAR_TRIGGER.empathetic).toBe('Recognition');
    expect(PILLAR_TRIGGER.distinctive).toBe('Identity');
    expect(PILLAR_TRIGGER.insight).toBe('Permission');
    expect(PILLAR_TRIGGER.authentic).toBe('Belonging');
  });

  it('does NOT score-predict Momentum or Fear-of-Loss (review-text only)', () => {
    const predicted = Object.values(PILLAR_TRIGGER);
    expect(predicted).not.toContain('Momentum');
    expect(predicted).not.toContain('Fear-of-Loss');
    // but both remain valid trigger types the model may surface
    expect(DECISION_TRIGGER_TYPES).toContain('Momentum');
    expect(DECISION_TRIGGER_TYPES).toContain('Fear-of-Loss');
  });

  it('ranks weakest pillar first — real InfinityVault binder profile lands Recognition', () => {
    // /25 scale: empathetic is the primary gap
    const prior = derivePrior({ insight: 15, distinctive: 10, empathetic: 5, authentic: 20 });
    expect(prior.map((p) => p.trigger)).toEqual(['Recognition', 'Identity', 'Permission', 'Belonging']);
    expect(prior[0]).toMatchObject({ trigger: 'Recognition', pillar: 'empathetic', score: 5 });
  });

  it('reproduces the Guyology prior — Recognition first', () => {
    const prior = derivePrior({ insight: 20, distinctive: 15, empathetic: 8, authentic: 20 });
    expect(prior[0].trigger).toBe('Recognition');
    // insight precedes authentic on a tie, so Permission ranks above Belonging
    expect(prior.map((p) => p.trigger)).toEqual(['Recognition', 'Identity', 'Permission', 'Belonging']);
  });

  it('is scale-independent (ranking identical on /100)', () => {
    const onTwentyFive = derivePrior({ insight: 15, distinctive: 10, empathetic: 5, authentic: 20 });
    const onHundred = derivePrior({ insight: 60, distinctive: 40, empathetic: 20, authentic: 80 });
    expect(onHundred.map((p) => p.trigger)).toEqual(onTwentyFive.map((p) => p.trigger));
  });
});
