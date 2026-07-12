import { describe, it, expect } from 'vitest';
import {
  assessIdeaDimensions,
  type DeriveEngine,
  type DerivedDimension,
  type Confidence,
} from '../service/assessIdeaDimensions.js';
import type { TrustGapDimension } from '../../lib/trustGap.js';

function dim(dimension: TrustGapDimension, score: number, confidence: Confidence = 'high'): DerivedDimension {
  return {
    dimension,
    score,
    confidence,
    grounding: 'evidence',
    citations: [`evidence for ${dimension}`],
    read: `plain-language read of ${dimension}`,
  };
}

/** Engine that returns the supplied dimensions. */
function engineWith(dimensions: DerivedDimension[]): DeriveEngine {
  return async () => ({ ok: true, dimensions });
}

const EVIDENCE = { listing_copy: 'Premium toploader binder…', reviews: 'Fits cards back to back…' };

describe('assessIdeaDimensions', () => {
  it('no evidence → not ok, every dimension needs input (never fabricates)', async () => {
    const r = await assessIdeaDimensions({}, engineWith([]));
    expect(r.ok).toBe(false);
    expect(r.trustGap).toBeUndefined();
    expect(r.needsInput.map((n) => n.dimension).sort()).toEqual(['authentic', 'distinctive', 'empathetic', 'insight']);
  });

  it('engine unavailable → not ok, no scores', async () => {
    const r = await assessIdeaDimensions(EVIDENCE, async () => ({ ok: false, note: 'engine down' }));
    expect(r.ok).toBe(false);
    expect(r.scores).toBeUndefined();
    expect(r.note).toBe('engine down');
  });

  it('all four clear the floor → provisional Trust Gap via parity engine', async () => {
    const r = await assessIdeaDimensions(
      EVIDENCE,
      engineWith([dim('insight', 80), dim('distinctive', 70), dim('empathetic', 40), dim('authentic', 65)]),
    );
    expect(r.ok).toBe(true);
    expect(r.provisional).toBe(true);
    expect(r.needsInput).toEqual([]);
    expect(r.scores).toEqual({ insight: 80, distinctive: 70, empathetic: 40, authentic: 65 });
    // Parity: buildTrustGap picks the lowest dimension as the primary gap.
    expect(r.trustGap?.primaryGap).toBe('empathetic');
    expect(r.trustGap?.overall).toBe(64); // (80+70+40+65)/4 rounded
  });

  it('a low-confidence dimension is NOT scored — needs_input, no overall Trust Gap (honesty floor)', async () => {
    const r = await assessIdeaDimensions(
      EVIDENCE,
      engineWith([dim('insight', 80), dim('distinctive', 70), dim('empathetic', 40, 'low'), dim('authentic', 65)]),
    );
    expect(r.ok).toBe(true);
    expect(r.trustGap).toBeUndefined();
    expect(r.scores).toBeUndefined();
    expect(r.needsInput.map((n) => n.dimension)).toEqual(['empathetic']);
    // The three confident reads are still returned (useful), just no fabricated overall.
    expect(r.dimensions.length).toBe(4);
  });

  it('a dimension missing from the engine output → needs_input for it, no Trust Gap', async () => {
    const r = await assessIdeaDimensions(
      EVIDENCE,
      engineWith([dim('insight', 80), dim('distinctive', 70), dim('authentic', 65)]),
    );
    expect(r.trustGap).toBeUndefined();
    expect(r.needsInput.map((n) => n.dimension)).toEqual(['empathetic']);
  });

  it('medium confidence clears the floor; clamps out-of-range scores', async () => {
    const r = await assessIdeaDimensions(
      EVIDENCE,
      engineWith([dim('insight', 120, 'medium'), dim('distinctive', -5, 'medium'), dim('empathetic', 50), dim('authentic', 50)]),
    );
    expect(r.scores).toEqual({ insight: 100, distinctive: 0, empathetic: 50, authentic: 50 });
    expect(r.trustGap?.primaryGap).toBe('distinctive');
  });
});
