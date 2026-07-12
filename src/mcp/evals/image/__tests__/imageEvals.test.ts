// @vitest-environment node
/**
 * Image output-quality suite — deterministic guarantees.
 *
 * The vision judge itself is gated (needs a model + real images); these tests lock the
 * parts that MUST be deterministic and correct without any network: the opt-in provenance,
 * the rubric's hard-gate capping, per-deliverable dimension selection, the E2E cases'
 * pipeline assertions (our director → Higgsfield image tool), verdict parsing, and the
 * suite scorecard aggregation driven by a MOCK vision judge.
 */
import { describe, it, expect } from 'vitest';
import { INFINITY_VAULT, OPTED_IN_CORPORA, getCorpus } from '../corpus.js';
import {
  IMAGE_RUBRIC,
  dimensionsFor,
  scoreImage,
  DELIVERABLE_PASS,
  HARD_FAIL_CAP,
  PASS_THRESHOLD,
  type ImageVerdict,
} from '../rubric.js';
import { IMAGE_EVAL_CASES, HIGGSFIELD_IMAGE_TOOL, getImageEvalCase } from '../cases.js';
import { buildImageSuite, imageSessionSystem } from '../mcpjamImage.js';
import { parseImageVerdicts, imageContentBlock, type VisionJudge } from '../visionJudge.js';
import { scoreSuite, type ProducedImages } from '../scorecard.js';

/** Build a full set of verdicts for a deliverable, all at one score (with per-dim overrides). */
function verdicts(kind: Parameters<typeof dimensionsFor>[0], base: number, over: Record<string, number> = {}): ImageVerdict[] {
  return dimensionsFor(kind).map((d) => ({
    dimension: d.id,
    score: over[d.id] ?? base,
    pass: (over[d.id] ?? base) >= PASS_THRESHOLD,
    rationale: 'test',
  }));
}

describe('opted-in corpus', () => {
  it('carries owner opt-in provenance and the resolved positioning spine', () => {
    expect(INFINITY_VAULT.optIn.certifiedBy.toLowerCase()).toContain('infinityvaultcards.com');
    expect(INFINITY_VAULT.positioning.trustGapPillar).toBe('empathetic');
    expect(INFINITY_VAULT.positioning.decisionTrigger).toBe('recognition');
    expect(INFINITY_VAULT.positioning.anchor.toLowerCase()).toContain('dove');
    expect(INFINITY_VAULT.verifiedFacts.length).toBeGreaterThan(0);
    expect(INFINITY_VAULT.prohibitedClaims.length).toBeGreaterThan(0);
  });
  it('every case references a real corpus', () => {
    for (const c of IMAGE_EVAL_CASES) expect(getCorpus(c.corpusRef), c.id).toBeTruthy();
    expect(OPTED_IN_CORPORA.length).toBeGreaterThan(0);
  });
});

describe('rubric', () => {
  it('has the problem-fit driver and the three hard gates', () => {
    const ids = IMAGE_RUBRIC.map((d) => d.id);
    expect(ids).toContain('problem-fit');
    const hard = IMAGE_RUBRIC.filter((d) => d.hard).map((d) => d.id).sort();
    expect(hard).toEqual(['amazon-policy', 'evidence-honest', 'product-fidelity']);
  });

  it('main-image dimensions exclude the lifestyle-only empathetic-lead', () => {
    const main = dimensionsFor('main_image').map((d) => d.id);
    expect(main).toContain('amazon-policy');
    expect(main).not.toContain('empathetic-lead');
    expect(dimensionsFor('gallery_lifestyle').map((d) => d.id)).toContain('empathetic-lead');
  });

  it('an all-high deliverable passes', () => {
    const s = scoreImage('main_image', verdicts('main_image', 0.9));
    expect(s.helpsSolveProblem).toBe(true);
    expect(s.composite).toBeGreaterThanOrEqual(DELIVERABLE_PASS);
    expect(s.hardFailures).toEqual([]);
  });

  it('a hard-gate fail (policy) caps the composite and fails the deliverable even if everything else is perfect', () => {
    const s = scoreImage('main_image', verdicts('main_image', 1.0, { 'amazon-policy': 0.1 }));
    expect(s.hardFailures).toContain('amazon-policy');
    expect(s.composite).toBeLessThanOrEqual(HARD_FAIL_CAP);
    expect(s.helpsSolveProblem).toBe(false);
  });

  it('a fabricated-claim fail is a hard gate too', () => {
    const s = scoreImage('gallery_infographic', verdicts('gallery_infographic', 0.95, { 'evidence-honest': 0.0 }));
    expect(s.hardFailures).toContain('evidence-honest');
    expect(s.helpsSolveProblem).toBe(false);
  });

  it('a missing verdict defaults to a conservative fail', () => {
    const partial = verdicts('main_image', 0.9).filter((v) => v.dimension !== 'product-fidelity');
    const s = scoreImage('main_image', partial);
    expect(s.hardFailures).toContain('product-fidelity');
  });
});

describe('E2E cases prove the pipeline (our director → Higgsfield image tool)', () => {
  it('every case ends its expected calls with the Higgsfield image tool', () => {
    for (const c of IMAGE_EVAL_CASES) {
      expect(c.expectedToolCalls.at(-1), c.id).toBe(HIGGSFIELD_IMAGE_TOOL);
      // and includes one of our creative-plan directors before it
      expect(c.expectedToolCalls.some((t) => t.startsWith('generate_')), c.id).toBe(true);
      expect(c.expectedToolCalls.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('includes a fabrication red-team case', () => {
    const rt = getImageEvalCase('iv-fabrication-red-team');
    expect(rt?.focusDimensions).toContain('evidence-honest');
    expect(rt?.query).toMatch(/#1|99%/);
  });
});

describe('mcpjam image suite', () => {
  it('emits one E2E test per case with both-connector system context and the image tool asserted', () => {
    const suite = buildImageSuite();
    expect(suite.tests.length).toBe(IMAGE_EVAL_CASES.length);
    for (const t of suite.tests) {
      expect(t.expectedToolCalls).toContain(HIGGSFIELD_IMAGE_TOOL);
      expect(t.advancedConfig.system.toLowerCase()).toContain('higgsfield');
      expect(t.meta.imageTool).toBe(HIGGSFIELD_IMAGE_TOOL);
    }
  });
  it('the session system carries the corpus core problem + the claim-gate instruction', () => {
    const sys = imageSessionSystem('iv-main-image-recognition');
    expect(sys.toLowerCase()).toContain('conversion');
    expect(sys.toLowerCase()).toMatch(/never render a fabricated|claim gate/);
    expect(sys).toContain('B0CARD0001');
  });
});

describe('vision judge plumbing', () => {
  it('parses verdicts and defaults missing dimensions to a conservative fail', () => {
    const dims = dimensionsFor('main_image');
    const text = `[{"dimension":"amazon-policy","score":0.9,"pass":true,"rationale":"clean"}]`;
    const parsed = parseImageVerdicts(text, dims);
    expect(parsed.find((v) => v.dimension === 'amazon-policy')?.score).toBe(0.9);
    const missing = parsed.find((v) => v.dimension === 'product-fidelity');
    expect(missing?.score).toBe(0);
    expect(missing?.pass).toBe(false);
  });
  it('builds url and base64 image content blocks; throws on empty', () => {
    expect(imageContentBlock({ url: 'https://x/y.png' }).source?.type).toBe('url');
    expect(imageContentBlock({ base64: 'AAA' }).source?.media_type).toBe('image/png');
    expect(() => imageContentBlock({})).toThrow();
  });
});

describe('suite scorecard (mock vision judge)', () => {
  // A judge that scores by the case id: main = perfect, lifestyle = policy hard-fail,
  // aplus = missing verdicts (all fail), red-team = fabrication hard-fail.
  const mockJudge: VisionJudge = {
    async judgeImage({ evalCase, dimensions }) {
      const perfect = () => dimensions.map((d) => ({ dimension: d.id, score: 0.9, pass: true, rationale: 'ok' }));
      if (evalCase.id === 'iv-main-image-recognition') return perfect();
      if (evalCase.id === 'iv-lifestyle-empathetic')
        return dimensions.map((d) => ({ dimension: d.id, score: d.id === 'amazon-policy' ? 0.1 : 0.9, pass: d.id !== 'amazon-policy', rationale: 'x' }));
      if (evalCase.id === 'iv-fabrication-red-team')
        return dimensions.map((d) => ({ dimension: d.id, score: d.id === 'evidence-honest' ? 0.0 : 0.9, pass: d.id !== 'evidence-honest', rationale: 'x' }));
      return []; // aplus → all missing → conservative fails
    },
  };

  it('scores produced images, caps hard-fails, and records missing pipelines', async () => {
    const images: ProducedImages = {
      'iv-main-image-recognition': { url: 'https://x/main.png' },
      'iv-lifestyle-empathetic': { url: 'https://x/life.png' },
      'iv-aplus-hero-story': { url: 'https://x/aplus.png' },
      // red-team image intentionally absent → missing
    };
    const sc = await scoreSuite(images, mockJudge);
    expect(sc.total).toBe(IMAGE_EVAL_CASES.length);
    expect(sc.scored).toBe(3);
    expect(sc.missing).toBe(1);

    const main = sc.results.find((r) => r.caseId === 'iv-main-image-recognition');
    expect(main?.score?.helpsSolveProblem).toBe(true);

    const life = sc.results.find((r) => r.caseId === 'iv-lifestyle-empathetic');
    expect(life?.score?.hardFailures).toContain('amazon-policy');
    expect(life?.score?.helpsSolveProblem).toBe(false);

    const rt = sc.results.find((r) => r.caseId === 'iv-fabrication-red-team');
    expect(rt?.missing).toBe(true);

    expect(sc.passed).toBe(1);
    expect(sc.failed).toBe(2); // lifestyle + aplus scored-but-failed
  });
});
