/**
 * Problem-Solver flow — scoped navy/gold palette + shared flow types.
 *
 * The Demo v2 mockup (idea-brandcoach-DEMO-v2-trevor-spec.html) uses a fixed
 * navy #1A3557 / gold #C9A84C theme that does NOT match the app's CSS variable
 * theme. Rather than override the global tokens, the Problem-Solver screens use
 * these scoped colour constants directly (inline styles / Tailwind arbitrary
 * values), so the flow renders faithfully without touching the rest of the app.
 */

export const PS_COLORS = {
  navy: '#1A3557',
  navyMid: '#2A4E78',
  navyLight: '#EBF0F6',
  gold: '#C9A84C',
  goldLight: '#FDF8EE',
  warm: '#F3F2EE',
  line: '#E4E7EC',
  g100: '#F2F4F7',
  g500: '#667085',
  g900: '#101828',
  green: '#027A48',
  greenLight: '#ECFDF3',
  red: '#B42318',
  redLight: '#FEF3F2',
  warn: '#B54708',
  warnLight: '#FFFAEB',
} as const;

/** The eight screens of the flow, in order. */
export type ProblemSolverStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const PS_STEPS: ReadonlyArray<{
  step: ProblemSolverStep;
  label: string;
  tag?: 'FREE' | 'BETA';
  /** Analytics name for the step — stable, PII-free. */
  name: string;
}> = [
  { step: 1, label: 'Diagnose', tag: 'FREE', name: 'diagnose' },
  { step: 2, label: 'Unlock', name: 'unlock' },
  { step: 3, label: 'Upload', name: 'upload' },
  { step: 4, label: 'Analyse', name: 'analyse' },
  { step: 5, label: 'Customer', name: 'customer' },
  { step: 6, label: 'Your fix', name: 'fix' },
  { step: 7, label: 'Stay ahead', tag: 'BETA', name: 'stay_ahead' },
  { step: 8, label: 'In Claude', name: 'in_claude' },
];

export const PS_STEP_NAME: Record<ProblemSolverStep, string> = {
  1: 'diagnose',
  2: 'unlock',
  3: 'upload',
  4: 'analyse',
  5: 'customer',
  6: 'fix',
  7: 'stay_ahead',
  8: 'in_claude',
};
