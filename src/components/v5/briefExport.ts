/**
 * briefExport — plain-text render of the design brief for the /v5 export
 * download. Artifact text only; unconfirmed claims travel flagged, never as
 * fact (the claim-gate verdict is printed with each claim).
 */
import type { BriefSlots } from '@/types/v4Fix';

export function briefToText(brief: BriefSlots, listingLabel: string): string {
  const lines: string[] = [
    `Design brief, ${listingLabel}`,
    '',
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
  ];
  return lines.join('\n');
}
