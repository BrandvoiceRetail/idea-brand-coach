/**
 * briefExport — plain-text render of the design brief for the /v5 export
 * download. Artifact text only; unconfirmed claims travel flagged, never as
 * fact (the claim-gate verdict is printed with each claim).
 *
 * Also composes the two Skill-10 frame components the engine does not emit
 * (IDEA-APP-SKILLS-001 §1): Component A, a context paragraph addressed to the
 * designer, and Component D, the where-to-start placement instruction. Both
 * are assembled deterministically from fields the diagnostic already produced;
 * nothing is generated, and when the run has no forensic report (pasted-voice
 * cold start) both are null and simply omitted.
 */
import type { BriefSlots } from '@/types/v4Fix';
import type { V5CustomerProfile, V5DecisionTrigger } from './forensicReport';

export interface DesignerBriefFrames {
  /** Component A — one plain-language paragraph addressed to the designer. */
  context: string | null;
  /** Component D — the do-this-first placement instruction. */
  placement: string | null;
}

const PLACEMENT_CODA =
  'Do this first. Everything else in this brief can follow in a second iteration once this change is tested.';

export function composeDesignerFrames(
  profile: V5CustomerProfile | null,
  trigger: V5DecisionTrigger | undefined,
): DesignerBriefFrames {
  const context =
    profile && profile.why_buying_now && profile.what_stops_them
      ? `Who you are designing for: ${profile.why_buying_now} What nearly stops them buying: ${profile.what_stops_them} This brief is written to answer that hesitation, and the moment that brings them to the listing, before anything else is said about the product.`
      : null;
  const placement = trigger?.placement ? `${trigger.placement} ${PLACEMENT_CODA}` : null;
  return { context, placement };
}

export function briefToText(
  brief: BriefSlots,
  listingLabel: string,
  frames?: DesignerBriefFrames,
): string {
  const lines: string[] = [
    `Design brief, ${listingLabel}`,
    '',
    ...(frames?.context ? ['FOR YOUR DESIGNER', frames.context, ''] : []),
    'TITLE FORMULA',
    brief.titleFormula.brief,
    `e.g. ${brief.titleFormula.exampleOutput}`,
    '',
    'LISTING BULLETS',
    ...brief.bullets.flatMap((b) => [`- ${b.element}: ${b.brief}`, `  e.g. ${b.exampleOutput}`]),
    '',
    'IMAGE BRIEF',
    ...brief.imageBrief.map((s) => `- ${s.slot}: ${s.intent}. ${s.brief}`),
    '',
    'PPC KEYWORDS',
    `Tier A: ${brief.ppcKeywords.tierA.join(', ') || '(none)'}`,
    `Tier B: ${brief.ppcKeywords.tierB.join(', ') || '(none)'}`,
    `Tier C: ${brief.ppcKeywords.tierC.join(', ') || '(none)'}`,
    '',
    'CLAIM GATE',
    ...brief.claimGate.map(
      (c) => `- [${c.status === 'confirmed' ? 'CONFIRMED' : 'NOT SHIPPED AS FACT'}] ${c.claim}`,
    ),
    ...(frames?.placement ? ['', 'WHERE TO START', frames.placement] : []),
  ];
  return lines.join('\n');
}
