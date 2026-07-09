/**
 * Image suite scorecard — pure aggregation over a set of cases, their produced images, and
 * an injected vision judge. This is the deliverable-quality verdict: per case, an ImageScore
 * (hard-gate-capped composite + helpsSolveProblem), and a suite roll-up.
 *
 * Pure/injected so it is unit-tested with a mock judge; the CLI (runImage.ts) supplies the
 * real Anthropic-vision judge and the produced image refs.
 */
import type { ImageEvalCase } from './cases.js';
import { IMAGE_EVAL_CASES } from './cases.js';
import { dimensionsFor, scoreImage, DELIVERABLE_PASS, type ImageScore } from './rubric.js';
import { judgeCaseImage, type ImageRef, type VisionJudge } from './visionJudge.js';

export interface CaseImageResult {
  caseId: string;
  title: string;
  deliverable: string;
  /** Present when an image was produced + scored. */
  score?: ImageScore;
  /** Set when the case had no produced image to score (pipeline didn't render one). */
  missing?: boolean;
  error?: string;
}

export interface SuiteScorecard {
  generatedNote: string;
  passThreshold: number;
  total: number;
  scored: number;
  /** Cases whose image cleared DELIVERABLE_PASS with no hard failure. */
  passed: number;
  /** Cases with a produced image that failed (hard gate or below threshold). */
  failed: number;
  /** Cases where the pipeline produced no image to score. */
  missing: number;
  /** Mean capped composite across SCORED cases (0..1). */
  meanComposite: number;
  results: CaseImageResult[];
}

/** Artifacts produced by an E2E run: caseId → the image the session rendered. */
export type ProducedImages = Record<string, ImageRef | undefined>;

/**
 * Score a set of image cases against their produced images with an injected vision judge.
 * A case with no produced image is recorded as `missing` (a pipeline failure, not a quality
 * failure) and excluded from the mean.
 */
export async function scoreSuite(
  images: ProducedImages,
  judge: VisionJudge,
  cases: readonly ImageEvalCase[] = IMAGE_EVAL_CASES,
): Promise<SuiteScorecard> {
  const results: CaseImageResult[] = [];
  for (const c of cases) {
    const base = { caseId: c.id, title: c.title, deliverable: c.deliverable };
    const image = images[c.id];
    if (!image || (!image.url && !image.base64)) {
      results.push({ ...base, missing: true });
      continue;
    }
    try {
      const verdicts = await judgeCaseImage(c, image, judge);
      const score = scoreImage(c.deliverable, verdicts.map((v) => ({ ...v })));
      // Keep only applicable-dimension verdicts on the score (scoreImage already filters).
      void dimensionsFor(c.deliverable);
      results.push({ ...base, score });
    } catch (e) {
      results.push({ ...base, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const scored = results.filter((r) => r.score);
  const passed = scored.filter((r) => r.score!.helpsSolveProblem).length;
  const missing = results.filter((r) => r.missing).length;
  const meanComposite = scored.length ? scored.reduce((a, r) => a + r.score!.composite, 0) / scored.length : 0;

  return {
    generatedNote: 'Image output-quality scorecard — deliverables scored against the opted-in corpus rubric.',
    passThreshold: DELIVERABLE_PASS,
    total: cases.length,
    scored: scored.length,
    passed,
    failed: scored.length - passed,
    missing,
    meanComposite,
    results,
  };
}

/** Render a compact human-readable scorecard for the CLI. */
export function formatScorecard(sc: SuiteScorecard): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines: string[] = [
    'IMAGE OUTPUT-QUALITY SCORECARD',
    `  cases: ${sc.total} · scored: ${sc.scored} · passed: ${sc.passed} · failed: ${sc.failed} · missing: ${sc.missing}`,
    `  mean composite (scored): ${pct(sc.meanComposite)} · pass line: ${pct(sc.passThreshold)}`,
    '',
  ];
  for (const r of sc.results) {
    if (r.missing) {
      lines.push(`  ✗ ${r.caseId} — NO IMAGE PRODUCED (pipeline did not render a deliverable)`);
      continue;
    }
    if (r.error) {
      lines.push(`  ! ${r.caseId} — judge error: ${r.error}`);
      continue;
    }
    const s = r.score!;
    const mark = s.helpsSolveProblem ? '✓' : '✗';
    const hard = s.hardFailures.length ? ` · HARD FAIL: ${s.hardFailures.join(', ')}` : '';
    lines.push(`  ${mark} ${r.caseId} — ${pct(s.composite)}${hard}`);
  }
  return lines.join('\n');
}
