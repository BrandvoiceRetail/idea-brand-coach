/**
 * Focus surface — the single-focus "what needs you" workspace for the busy brand owner.
 *
 * The coach uses the Trust Gap™ / Decision Trigger™ to decide the ONE highest-leverage thing
 * the owner should act on now, surfaces it, takes the owner's reaction/ideas, and produces a
 * stage-adaptive deliverable. These types are the contract between the engine (pure logic) and
 * the UI; the engine is seeded today and seams to the live coach (edge fns / MCP) later.
 */

export type Pillar = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

export type DecisionTriggerName =
  | 'Permission'
  | 'Recognition'
  | 'Identity'
  | 'Belonging'
  | 'Momentum'
  | 'Fear-of-Loss';

/** The deliverable the surface produces — adapts to where the owner is. */
export type DeliverableMode = 'diy-listing' | 'designer-brief' | 'canvas' | 'competitor';

export interface BrandSnapshot {
  brand: string;
  product?: string;
  /** Trust Gap™ state (pillars out of 25; overall out of 100). Drives prioritisation. */
  trustGap?: {
    overall: number;
    pillars: Record<Pillar, number>;
    primaryGap: Pillar;
  };
  /** Avatar 2.0 forensic portrait (plain language; what the coach already knows). */
  avatar?: {
    howTheyTalk: string;
    whyBuyingToday: string;
    trustSignals: string;
    topObjection: string;
  };
  /** Verbatim review evidence the coach grounds findings in. */
  evidence: string[];
  /** A pending competitor move, if any (drives a competitor focus). */
  competitorMove?: string;
  /** The owner's stage / preferred deliverable. */
  ownerMode: DeliverableMode;
}

export type FocusKind = 'fix' | 'foundation' | 'competitor';

export interface FocusItem {
  id: string;
  kind: FocusKind;
  /** Plain-language headline of the one thing to do. */
  title: string;
  /** Evidence-led commercial rationale (no framework jargon, no buyer-state names). */
  why: string;
  pillar?: Pillar;
  trigger?: DecisionTriggerName;
  /** Fixed brand anchor for the trigger (e.g. Dove for Recognition). */
  anchor?: string;
  /** Verbatim review snippets that justify the focus. */
  evidence: string[];
  /** Higher = more leverage; the queue is sorted by this. */
  priorityScore: number;
  /** Deliverable modes this focus can produce. */
  modes: DeliverableMode[];
}

export interface Deliverable {
  mode: DeliverableMode;
  title: string;
  /** The produced content the owner can use/hand off. */
  body: string;
  /** Paste-ready image-generation prompt (designer-brief mode). */
  pasteablePrompt?: string;
  /** Compliance flags the owner must confirm before publishing (e.g. a guarantee claim). */
  claimFlags?: string[];
}

export const DELIVERABLE_LABELS: Record<DeliverableMode, string> = {
  'diy-listing': 'Listing copy (I’ll do it myself)',
  'designer-brief': 'Design brief + image prompt (for my designer)',
  canvas: 'Brand canvas',
  competitor: 'Competitor response',
};
