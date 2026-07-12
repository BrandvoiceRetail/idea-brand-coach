/**
 * Problem-Solver flow — scoped palette (aliased to v23 SEMANTIC TOKENS) + flow types.
 *
 * Originally these were hardcoded hex (Demo-v2 navy, then v23 black/gold). They now
 * resolve to the app's CSS custom properties via `hsl(var(--…))`, so every screen
 * that still uses `style={{ color: PS_COLORS.x }}` follows the active light/dark
 * theme and matches the /v4 shell — no more hardcoded dark island. The `navy*` keys
 * are kept (every screen references them) but now mean "foreground/muted ink".
 *
 * Note: a single key can't be both ink and surface, so the few screens that used a
 * key as a *background* (e.g. UnlockScreen) are being migrated to glass/token
 * surfaces directly; the dominant inline use is text/border, which maps cleanly.
 */

export const PS_COLORS = {
  navy: 'hsl(var(--foreground))', // primary ink (was #111111)
  navyMid: 'hsl(var(--muted-foreground))', // secondary ink
  navyLight: 'hsl(var(--muted))', // subtle panel surface
  gold: 'hsl(var(--gold-warm))', // v23 gold
  goldLight: 'hsl(var(--gld-lt))', // v23 gold-light fill
  warm: 'hsl(var(--background))', // page surface
  line: 'hsl(var(--border))',
  g100: 'hsl(var(--muted))',
  g500: 'hsl(var(--muted-foreground))',
  g900: 'hsl(var(--foreground))',
  green: '#12B76A',
  greenLight: 'hsl(var(--muted))',
  red: '#F04438',
  redLight: 'hsl(var(--muted))',
  warn: '#F79009',
  warnLight: 'hsl(var(--muted))',
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
  // "Earn the ask": the full diagnostic + the first fix are FREE; the membership
  // ask (free trial = one funnel piece to iterate on; paid = whole funnel + ongoing
  // monitoring) lands AFTER the fix, never before value.
  { step: 1, label: 'Diagnose', tag: 'FREE', name: 'diagnose' },
  { step: 2, label: 'Upload', name: 'upload' },
  { step: 3, label: 'Analyse', name: 'analyse' },
  { step: 4, label: 'Customer', name: 'customer' },
  { step: 5, label: 'Your fix', name: 'fix' },
  { step: 6, label: 'Keep going', name: 'membership' },
  { step: 7, label: 'Stay ahead', tag: 'BETA', name: 'stay_ahead' },
  { step: 8, label: 'In Claude', name: 'in_claude' },
];

export const PS_STEP_NAME: Record<ProblemSolverStep, string> = {
  1: 'diagnose',
  2: 'upload',
  3: 'analyse',
  4: 'customer',
  5: 'fix',
  6: 'membership',
  7: 'stay_ahead',
  8: 'in_claude',
};
