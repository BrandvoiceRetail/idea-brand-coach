/**
 * beatModel — pure mapping from forensic stage artifacts to the /v5 theatre
 * beats (presentation order), plus the co-sign read.
 *
 * PRESENTATION ORDER ≠ compute order: the pipeline runs s1 → s2 → {s3 ∥ s4};
 * the theatre presents Vocabulary (s1) → Motivation (s3) → Trust signals (s2)
 * → Objection (s4). Every string shown comes from the persisted artifacts —
 * this module arranges, it never invents. Stage ids (s1–s4) stay internal and
 * NEVER appear in UI copy (Amendment v1.1).
 */

import type {
  ForensicStage,
  S1Vocab,
  S2Jobmap,
  S3Triggers,
  S4Objections,
} from '@/types/forensicBuild';

/** The distilled field a beat lands on (the panel at the bottom of the beat). */
export type BeatField =
  | { kind: 'chips'; chips: string[] }
  | { kind: 'text'; lines: Array<{ label: string; text: string }> }
  | { kind: 'list'; items: string[]; footnote?: string }
  | { kind: 'quote'; quote: string; heading: string; resolution?: string };

/** One theatre beat, ready to render. */
export interface TheatreBeatData {
  /** Stable id used for the rail + analytics slug. */
  id: 'vocabulary' | 'motivation' | 'trust' | 'objection';
  /** The stage whose artifact feeds this beat (internal only — never shown). */
  stage: ForensicStage;
  /** Rail label. */
  railLabel: string;
  index: number;
  title: string;
  description: string;
  evidenceLabel?: string;
  /** Verbatim evidence lines (quotes / moments) — shown mono with a gold rule. */
  evidence?: Array<{ text: string; note?: string }>;
  /** Chip groups shown inside the evidence panel (vocabulary clusters). */
  chipGroups?: Array<{ heading: string; chips: string[]; note?: string }>;
  /** The interpretation label for this beat (e.g. "WHAT THIS SUGGESTS", "IDEA INTERPRETATION"). */
  revealsLabel: string;
  /** The interpretation text — artifact text only. */
  reveals: string;
  panel?: { label: string; heading: string; field: BeatField };
}

/** Stage artifact bundle as the page accumulates it during a run. */
export interface StageContents {
  s1?: S1Vocab;
  s2?: S2Jobmap;
  s3?: S3Triggers;
  s4?: S4Objections;
}

const MAX_CLUSTERS = 3;
const MAX_EVIDENCE = 3;
const MAX_CHIPS = 14;

/** Beat order + which stage each presents (compute order is the hook's job). */
export const BEAT_ORDER: ReadonlyArray<{ id: TheatreBeatData['id']; stage: ForensicStage }> = [
  { id: 'vocabulary', stage: 's1' },
  { id: 'motivation', stage: 's3' },
  { id: 'trust', stage: 's2' },
  { id: 'objection', stage: 's4' },
];

/** Build the renderable beat for one slot, or null while its artifact is absent. */
export function buildBeat(
  id: TheatreBeatData['id'],
  index: number,
  contents: StageContents,
): TheatreBeatData | null {
  switch (id) {
    case 'vocabulary': {
      const s1 = contents.s1;
      if (!s1 || s1.clusters.length === 0) return null;
      const clusters = s1.clusters.slice(0, MAX_CLUSTERS);
      const allChips = [...new Set(s1.clusters.flatMap((c) => c.customer_words))].slice(0, MAX_CHIPS);
      return {
        id, stage: 's1', railLabel: 'Vocabulary', index,
        title: 'Reading how your customers talk',
        description: 'The vocabulary they use. Verbatim, not paraphrased.',
        evidenceLabel: 'From your review corpus',
        chipGroups: clusters.map((c) => ({
          heading: c.cluster,
          chips: c.customer_words.slice(0, MAX_CHIPS),
          note: c.frequency_signal,
        })),
        revealsLabel: 'What this suggests',
        reveals: clusters.map((c) => c.why_it_matters).filter(Boolean).slice(0, 2).join(' '),
        panel: {
          label: 'Customer vocabulary',
          heading: 'How your customer talks about this product',
          field: { kind: 'chips', chips: allChips },
        },
      };
    }
    case 'motivation': {
      const s3 = contents.s3;
      if (!s3 || s3.triggers.length === 0) return null;
      const triggers = s3.triggers.slice(0, MAX_EVIDENCE);
      const first = triggers[0];
      return {
        id, stage: 's3', railLabel: 'Motivation', index,
        title: 'Reconstructing what may have sent them searching',
        description: 'Not who they are. The likely moment the problem became active.',
        evidenceLabel: 'Likely purchase triggers',
        evidence: triggers.map((t) => ({ text: t.trigger_moment })),
        revealsLabel: 'Strategic interpretation',
        reveals: first.what_they_feel,
        panel: {
          label: 'Likely purchase motivation',
          heading: 'What may have made the problem urgent now',
          field: {
            kind: 'text',
            lines: [
              { label: 'Likely trigger', text: first.trigger_moment },
              { label: 'Inferred emotional state', text: first.what_they_feel },
            ],
          },
        },
      };
    }
    case 'trust': {
      const s2 = contents.s2;
      if (!s2 || s2.job_map.length === 0) return null;
      const rows = s2.job_map.slice(0, 4);
      const villain = rows.map((r) => r.villain).find(Boolean);
      return {
        id, stage: 's2', railLabel: 'Trust signals', index,
        title: 'Identifying what builds trust',
        description: 'The questions the listing may need to resolve before purchase.',
        evidenceLabel: 'The change they are seeking',
        evidence: rows
          .map((r) => ({ text: r.emotional_job || r.identity_job }))
          .filter((e) => e.text),
        revealsLabel: 'IDEA interpretation',
        reveals: villain
          ? `The villain in their story: ${villain}. Your listing earns trust by showing, plainly, that this villain has been dealt with.`
          : 'Trust is built by answering the goals below before any claim is made.',
        panel: {
          label: 'Likely trust signals needed',
          heading: 'What the listing may need to establish',
          field: {
            kind: 'list',
            items: rows.map((r) => r.functional_job).filter(Boolean),
            footnote: villain ? `The villain: ${villain}` : undefined,
          },
        },
      };
    }
    case 'objection': {
      const s4 = contents.s4;
      if (!s4 || s4.objections.length === 0) return null;
      const objections = s4.objections.slice(0, 2);
      const first = objections[0];
      return {
        id, stage: 's4', railLabel: 'Objection', index,
        title: 'Identifying the likely decision barrier',
        description: 'The unresolved concern most likely to create hesitation.',
        evidenceLabel: 'In their own words',
        evidence: objections.map((o) => ({ text: `"${o.verbatim_signal}"` })),
        revealsLabel: 'What the evidence suggests',
        reveals: first.hesitation,
        panel: {
          label: 'Likely top objection',
          heading: 'The concern most likely to create hesitation',
          field: {
            kind: 'quote',
            quote: first.verbatim_signal,
            heading: first.hesitation,
            resolution: first.resolution,
          },
        },
      };
    }
  }
}

/** The one-line co-sign read, drawn verbatim from the S4 + S3 artifacts. */
export interface CoSignRead {
  buyingBecause: string | null;
  stillAsking: string | null;
}

export function buildCoSignRead(contents: StageContents): CoSignRead {
  return {
    buyingBecause: contents.s3?.triggers[0]?.trigger_moment ?? null,
    stillAsking: contents.s4?.objections[0]?.hesitation ?? null,
  };
}
