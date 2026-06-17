import { describe, it, expect } from 'vitest';
import { DIMENSIONS, DIMENSION_LABELS } from '../idea';

describe('canonical IDEA enum (_shared/idea.ts)', () => {
  it('is the corrected Insight/Distinctive/Empathetic/Authentic set (not the legacy I/D/E/A loop)', () => {
    expect(DIMENSIONS).toEqual(['insight', 'distinctive', 'empathetic', 'authentic']);
  });

  it('labels every dimension', () => {
    expect(DIMENSION_LABELS).toEqual({
      insight: 'Insight',
      distinctive: 'Distinctive',
      empathetic: 'Empathetic',
      authentic: 'Authentic',
    });
    for (const dim of DIMENSIONS) {
      expect(DIMENSION_LABELS[dim]).toBeTruthy();
    }
  });
});
