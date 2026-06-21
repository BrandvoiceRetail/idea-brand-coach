// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  validateTriggerOutput,
  FIXED_ANCHORS,
  TRIGGER_TYPES,
  type TriggerOutput,
} from '../evals/triggerOutput.js';

/** A clean Recognition output: Dove anchor, plain-English placement, quoted evidence. */
const validRecognition: TriggerOutput = {
  dominant_type: 'Recognition',
  brand_anchor: 'like Dove, signal warmth and care over clinical perfection',
  evidence_phrases: ['"feels good on my skin"', '"gentle enough for every day"'],
  placement_instruction: 'Lead the first product image with the care promise, in plain words.',
  why_this_trigger: 'Reviews repeatedly praise gentleness and everyday comfort.',
};

describe('validateTriggerOutput', () => {
  it('accepts a correct Recognition output (Dove anchor, plain placement, quoted evidence)', () => {
    const r = validateTriggerOutput(validRecognition);
    expect(r.valid).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('flags a Recognition output anchored on Lego as INVALID', () => {
    const r = validateTriggerOutput({
      ...validRecognition,
      brand_anchor: 'like Lego, build a system people collect',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /Lego/i.test(v))).toBe(true);
  });

  it('flags placement text that leaks a CAPTURE element name as INVALID', () => {
    const r = validateTriggerOutput({
      ...validRecognition,
      placement_instruction: 'Put the care promise in bullet 1 (Attention).',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /CAPTURE element name/i.test(v))).toBe(true);
  });

  it('flags empty evidence_phrases as INVALID', () => {
    const r = validateTriggerOutput({ ...validRecognition, evidence_phrases: [] });
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /evidence_phrases/i.test(v))).toBe(true);
  });

  it('flags an unknown dominant_type as INVALID', () => {
    const r = validateTriggerOutput({ ...validRecognition, dominant_type: 'Curiosity' });
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /not a recognised trigger/i.test(v))).toBe(true);
  });

  it('exposes Dove (not Lego) as the canonical Recognition anchor', () => {
    expect(FIXED_ANCHORS.Recognition).toBe('Dove');
    expect(TRIGGER_TYPES).toContain('Recognition');
  });
});
