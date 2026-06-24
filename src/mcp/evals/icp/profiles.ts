/**
 * Canonical Ideal Customer Profiles (ICPs) for the IDEA Brand Coach.
 *
 * The app serves Amazon ecommerce brand teams. There are two ICPs — the same brand, two
 * seats — and the coach must serve both with the same skill substance delivered differently:
 *   - busy-brand-owner ("Maya", persona P1): knowledgeable, time-poor, wants done-for-you.
 *   - operational-va    ("Rico",  persona P2): trainable, time-rich, wants the why + steps.
 *
 * Sources (kept in sync): mcp-coach-tests/00-test-foundations.md (persona oracle),
 * the 2026-06-19 Trevor call (problem-solver pivot), the 2026-06-18 Miko call
 * ("in-house AI software for Amazon sellers who lack the time or skill"), and docs/ICP.md.
 *
 * Pure data — no node/browser APIs — so the engine, the evals, the harvester, and the SPA
 * all import it. This is the single source of truth; grow it via the conversation-harvest
 * sweep (see ../harvest) rather than scattering persona facts across the codebase.
 */

export type PersonaCode = 'P1' | 'P2';

export interface ICP {
  id: string;
  codename: string;
  personaCode: PersonaCode;
  role: string;
  /** One-line who-they-are. */
  summary: string;
  /** Situation + constraints they operate under. */
  context: string;
  /** The Amazon-brand-management jobs they are trying to get done. */
  jobs: string[];
  /** The problems the app solves for them (their pain). */
  problems: string[];
  /** What brings them to the coach (entry triggers). */
  triggers: string[];
  /** How to detect this ICP from how they talk to the coach. */
  detectionSignals: string[];
  /** How the coach must adapt for this ICP. */
  coachAdapt: { do: string[]; avoid: string[] };
  /** Verbatim-style sample utterances. */
  voice: string[];
  /** What success looks like for this ICP (the value the coach must deliver). */
  successLooksLike: string[];
}

export const ICPS: ICP[] = [
  {
    id: 'busy-brand-owner',
    codename: 'Maya',
    personaCode: 'P1',
    role: 'Founder-operator of a 7-figure DTC + Amazon brand; tiny team',
    summary:
      'Knowledgeable, branding-literate, chronically time-starved owner who wants a fix she can ship today — not a worksheet.',
    context:
      'Deeply knows her product, margins, ad accounts, and customers. Knows positioning, value prop, and what an avatar is. Runs lean; every minute spent in a tool is a minute not spent on the business. Has already tried ChatGPT/Claude and has folders of generic brand strategy she could not implement.',
    jobs: [
      'Find out why a hero SKU\'s conversion is below category average and fix it',
      'Turn a diagnosis into a design/copy brief she can hand to a designer or VA today',
      'Keep the listing ahead of competitors without running a continuous research project herself',
      'Manage brand consistency across the Amazon catalogue with a tiny team',
    ],
    problems: [
      'Conversion is soft and she does not know the specific cause (traffic is fine)',
      'Generic AI output is not specific to her customer and is not implementable',
      'No time to do forensic review-corpus analysis by hand',
      'Brand work keeps losing to operational firefighting',
    ],
    triggers: [
      'Unit-session % dropped over recent weeks; CAC creeping',
      'A competitor moved (new claim, new imagery) and she needs to respond',
      'Launching/refreshing a listing and wants it right the first time',
    ],
    detectionSignals: [
      'Short, terse messages; "give me the 30-second version"',
      'Correct domain jargon; supplies her own data (repeat rate, CAC, unit-session %)',
      'Explicit time pressure; requests done-for-you drafts; skips offered explainers',
      '"I know what an avatar is — what should MINE say?"',
    ],
    coachAdapt: {
      do: [
        'Lead with the answer, then one line of why',
        'Produce done-for-you drafts she edits; fill the worksheet boxes FOR her from what she says',
        'Use HER data; batch questions; end with exactly one next action',
      ],
      avoid: ['Worksheets and homework', 'Teaching concepts she already knows', 'Menus of options instead of one recommendation'],
    },
    voice: [
      "Sessions flat but unit-session % dropped 19%→14% over 8 weeks. Don't tell me to A/B the main image — what's actually wrong?",
      "Don't make me fill in a worksheet, just draft it and I'll edit.",
    ],
    successLooksLike: [
      'Leaves with a Trust Gap™ Score, a primary Decision Trigger™, and a ready-to-hand-off brief in minutes',
      'The fix is specific to her customer and her listing — not generic',
      'She returns because the loop (re-measure, defend) keeps earning the visit',
    ],
  },
  {
    id: 'operational-va',
    codename: 'Rico',
    personaCode: 'P2',
    role: 'Operations VA executing brand / listing / marketing tasks for a busy owner',
    summary:
      'Conscientious, trainable, time-rich VA who is new to branding and behavioural science and wants to learn the why so he does it right for the owner.',
    context:
      'Hardworking and organised; executes for the owner. New to branding (does not yet know positioning vs value prop, or "distinctiveness"). Eager to learn. Has abundant time but lacks the technical skill to build automations himself — the exact gap the app fills with an in-house, pre-built AI capability (per the 2026-06-18 call).',
    jobs: [
      'Carry out a brand/listing task correctly on the owner\'s behalf',
      'Learn the underlying concept well enough to apply it consistently next time',
      'Produce a deliverable (avatar, canvas, brief) the owner will approve',
      'Build repeatable SOPs/checklists for recurring brand-management work',
    ],
    problems: [
      'Does not know where to start or the vocabulary of branding',
      'Risk of doing it "wrong" for the owner without guidance',
      'Needs structure (steps, templates, checklists) to be reliable',
      'Lacks the skill/time to assemble expert tooling himself',
    ],
    triggers: [
      'Owner delegated a branding/listing task he has not done before',
      'Wants a reusable template/checklist for a recurring task',
    ],
    detectionSignals: [
      'Definitional questions ("can you explain what that means?")',
      'Requests for examples and step-by-step walk-throughs',
      'Lower jargon density; no time pressure; confirms understanding',
      'Asks for reusable templates/checklists',
    ],
    coachAdapt: {
      do: [
        'Teach foundations and define terms before applying',
        'Give a worked example per concept; step-by-step instructions + fill-in templates + reusable checklists',
        'Check understanding; be patient and encouraging; use his abundant time with thorough multi-step exercises',
      ],
      avoid: ['Compression that skips the why', 'Assuming prior branding knowledge', 'One-line answers with no scaffolding'],
    },
    voice: [
      "Hi — I help run a supplements brand. I don't have a branding background. Can you walk me through it?",
      'Could you give me an example and a checklist I can reuse?',
    ],
    successLooksLike: [
      'Finishes with a correct deliverable AND understands why it works',
      'Has a reusable checklist/template for next time',
      'Becomes more capable each session (the app is his in-house brand-management trainer)',
    ],
  },
];

const BY_PERSONA: Record<PersonaCode, string> = { P1: 'busy-brand-owner', P2: 'operational-va' };

export function getICP(id: string): ICP | undefined {
  return ICPS.find((p) => p.id === id);
}

/** Map a fixture/case persona code (P1/P2) to its ICP id. 'edge' cases have no ICP. */
export function icpForPersona(persona: string): ICP | undefined {
  const id = BY_PERSONA[persona as PersonaCode];
  return id ? getICP(id) : undefined;
}
