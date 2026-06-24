/**
 * Problem-Solver S1 — the four evidence-based diagnostic questions + scoring math.
 *
 * MIRRORS src/pages/FreeDiagnostic.tsx exactly: one inspection question per IDEA
 * pillar, scored 1-5 on what the shopper actually sees. Each pillar % = score/5*100;
 * overall = mean of the four. Kept here as a self-contained module (the page owns a
 * full-page UI; this flow only needs the question set + the math), with the same
 * wording and scores so the two diagnostics stay calibration-identical.
 */

import type { TrustGapDimension, TrustGapInputScores } from '@/lib/trustGap';

export interface DiagnosticQuestion {
  id: string;
  category: TrustGapDimension;
  /** Pillar label + emoji icon for the demo's question header. */
  pillarLabel: string;
  icon: string;
  question: string;
  /** Caption row shown below the 1-5 scale (demo `.oscale`). */
  scaleLow: string;
  scaleHigh: string;
  options: Array<{ value: string; label: string; score: number }>;
}

export const PROBLEM_SOLVER_QUESTIONS: readonly DiagnosticQuestion[] = [
  {
    id: 'hero-headline',
    category: 'insight',
    pillarLabel: 'I — Insight',
    icon: '💡',
    question:
      'Look at your hero image headline and your first bullet point. Do they describe what the product does — or why the customer needs it right now?',
    scaleLow: '1 — All specs and claims',
    scaleHigh: '5 — Speaks to the emotional moment',
    options: [
      { value: '1', label: 'Only what it does', score: 1 },
      { value: '2', label: 'Mostly what it does', score: 2 },
      { value: '3', label: 'A bit of both', score: 3 },
      { value: '4', label: 'Mostly why they need it', score: 4 },
      { value: '5', label: 'Clearly why they need it now', score: 5 },
    ],
  },
  {
    id: 'name-removed',
    category: 'distinctive',
    pillarLabel: 'D — Distinctive',
    icon: '⚡',
    question:
      'Remove your brand name from your listing. Could it belong to any of your top three competitors?',
    scaleLow: '1 — Could be anyone in the category',
    scaleHigh: '5 — Impossible to confuse with anyone else',
    options: [
      { value: '1', label: 'Yes, it could be any of them', score: 1 },
      { value: '2', label: 'Probably, with small tweaks', score: 2 },
      { value: '3', label: 'Hard to say', score: 3 },
      { value: '4', label: 'Mostly no, it feels like ours', score: 4 },
      { value: '5', label: 'No, it is unmistakably ours', score: 5 },
    ],
  },
  {
    id: 'bullets-aloud',
    category: 'empathetic',
    pillarLabel: 'E — Empathetic',
    icon: '❤️',
    question:
      'Read your bullet points aloud. Do they describe what the product does — or how the customer feels when they need it?',
    scaleLow: '1 — Pure feature list',
    scaleHigh: '5 — Customer sees themselves in every line',
    options: [
      { value: '1', label: 'Only what it does', score: 1 },
      { value: '2', label: 'Mostly what it does', score: 2 },
      { value: '3', label: 'A bit of both', score: 3 },
      { value: '4', label: 'Mostly how they feel', score: 4 },
      { value: '5', label: 'Clearly how they feel when they need it', score: 5 },
    ],
  },
  {
    id: 'trust-signals',
    category: 'authentic',
    pillarLabel: 'A — Authentic',
    icon: '🔒',
    question:
      'Count the trust signals a first-time visitor can see in your hero image before they scroll or read a single review. How many are there?',
    scaleLow: '1 — No credibility signals visible',
    scaleHigh: '5 — Three or more strong trust anchors',
    options: [
      { value: '1', label: 'None', score: 1 },
      { value: '2', label: 'One', score: 2 },
      { value: '3', label: 'Two', score: 3 },
      { value: '4', label: 'Three', score: 4 },
      { value: '5', label: 'Four or more', score: 5 },
    ],
  },
];

/**
 * Compute the self-report Trust Gap from the four answers (FreeDiagnostic math):
 * each pillar % = (answer / 5) * 100; overall = mean of the four. Unanswered
 * pillars score 0.
 */
export function computeSelfReport(answers: Record<string, string>): TrustGapInputScores {
  const pillarScore = (category: TrustGapDimension): number => {
    const q = PROBLEM_SOLVER_QUESTIONS.find((x) => x.category === category);
    if (!q) return 0;
    const opt = q.options.find((o) => o.value === answers[q.id]);
    return opt ? Math.round((opt.score / 5) * 100) : 0;
  };
  const insight = pillarScore('insight');
  const distinctive = pillarScore('distinctive');
  const empathetic = pillarScore('empathetic');
  const authentic = pillarScore('authentic');
  const overall = Math.round((insight + distinctive + empathetic + authentic) / 4);
  return { insight, distinctive, empathetic, authentic, overall };
}
