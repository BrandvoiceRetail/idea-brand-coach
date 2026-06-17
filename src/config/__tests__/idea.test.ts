import { describe, it, expect } from 'vitest';
import {
  IDEA_DIMENSIONS,
  IDEA_DIMENSION_LABELS,
  IDEA_SCORE_KEY_BY_DIMENSION,
  IDEA_SCORE_ROWS,
} from '@/config/idea';

describe('canonical IDEA enum (src/config/idea.ts)', () => {
  it('is the corrected Insight/Distinctive/Empathetic/Authentic set', () => {
    expect(IDEA_DIMENSIONS).toEqual(['insight', 'distinctive', 'empathetic', 'authentic']);
  });

  it('maps each dimension to its compact {i,d,e,a} score key', () => {
    expect(IDEA_SCORE_KEY_BY_DIMENSION).toEqual({
      insight: 'i',
      distinctive: 'd',
      empathetic: 'e',
      authentic: 'a',
    });
  });

  it('builds ordered score rows (key + label) in canonical order', () => {
    expect(IDEA_SCORE_ROWS).toEqual([
      { key: 'i', label: 'Insight' },
      { key: 'd', label: 'Distinctive' },
      { key: 'e', label: 'Empathetic' },
      { key: 'a', label: 'Authentic' },
    ]);
  });

  it('labels every dimension', () => {
    for (const dim of IDEA_DIMENSIONS) {
      expect(IDEA_DIMENSION_LABELS[dim]).toBeTruthy();
    }
  });
});
