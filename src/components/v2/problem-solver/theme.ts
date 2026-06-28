/**
 * Problem-Solver flow — scoped v23 black/gold palette + shared flow types.
 *
 * Originally the Demo v2 mockup used a navy #1A3557 / gold #C9A84C theme, but the
 * app's SSOT is the Trevor v23 black/gold palette (blk #111111 · wrm #F5F4F0 ·
 * gld #D4960A · gld-lt #FEF5DC) used across the /v4 surface. These scoped constants
 * now carry the v23 values so the diagnostic matches the dark surface it lives in.
 * The `navy*` keys are kept (every screen references them) but resolve to black/
 * charcoal — renaming would touch all eight screens for no behavioural gain.
 */

export const PS_COLORS = {
  navy: '#111111', // v23 black (was Demo-v2 navy #1A3557)
  navyMid: '#3A3A3A', // charcoal mid (was #2A4E78)
  navyLight: '#F5F4F0', // warm light panel (was pale blue #EBF0F6)
  gold: '#D4960A', // v23 gold (was #C9A84C)
  goldLight: '#FEF5DC', // v23 gold-light (was #FDF8EE)
  warm: '#F5F4F0', // v23 warm (was #F3F2EE)
  line: '#E4E7EC',
  g100: '#F2F4F7',
  g500: '#667085',
  g900: '#111111', // near-black (was slate #101828, slight blue tint)
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
