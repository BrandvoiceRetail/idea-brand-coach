/**
 * Eval case — one curated test for the admin Eval Bench.
 *
 * Each case bundles everything Trevor needs to evaluate the coach against a realistic
 * scenario: the supplied brand CONTEXT, seeded cross-session MEMORY, sample UPLOADS, a
 * scripted practice CONVERSATION, and the EXPECTED tools/skills/oracle/outcome. The bench
 * presents these; the (gated) live tier executes the conversation against the real coach
 * and scores actual vs expected.
 *
 * Pure data — no node/browser APIs — so both the node engine and the SPA import it.
 */

export type Persona = 'P1' | 'P2' | 'edge';

/** Pillar key for a structured Trust Gap diagnostic (drives the deterministic trigger oracle). */
export type Pillar = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

/** A structured Trust Gap diagnostic the deterministic oracles score against (pillars out of 25). */
export interface CaseDiagnostic {
  pillars: Record<Pillar, number>;
}

/** What this case exercises. 'loop' = a Re-measure/Defend return visit (the retention loop). */
export type CaseKind = 'diagnostic' | 'teaching' | 'safety' | 'loop';

/** A field of supplied brand/avatar context the coach is given for this test. */
export interface ContextField {
  label: string;
  value: string;
}

export interface SuppliedContext {
  brand: string;
  product?: string;
  /** Avatar id the case assumes is already built/locked (memory), if any. */
  avatarId?: string;
  fields: ContextField[];
}

/** A seeded cross-session memory entry (what the coach "already knows" from prior sessions). */
export interface MemoryEntry {
  kind: 'brand-fact' | 'avatar' | 'preference' | 'history';
  note: string;
}

/** A curated sample upload the user provides during the test. */
export interface SampleUpload {
  name: string;
  kind: 'listing' | 'reviews' | 'screenshot' | 'doc';
  description: string;
  /** Inline content for text uploads (listing copy, review excerpts). Screenshots describe only. */
  content?: string;
}

/** One turn of the scripted practice conversation. */
export interface PracticeTurn {
  role: 'user' | 'coach';
  text: string;
  /** Tools the coach turn is expected to invoke. */
  tools?: string[];
  /** Skill ids/paths grounding the coach turn. */
  skills?: string[];
}

export interface ExpectedOutcome {
  /** Tools the coach should invoke across the case (registered tool names). */
  tools: string[];
  /** App-skill numbers ("01".."20") expected to ground the case. */
  skills: string[];
  /** Oracle dimensions the live run is judged on. */
  oracle: string[];
  /** The primary Decision Trigger the case should resolve to, if applicable. */
  primaryTrigger?: string;
  /** One-line description of the deliverable the session must end on. */
  outcome: string;
}

export interface EvalCase {
  id: string;
  title: string;
  persona: Persona;
  /** Grouping, e.g. "diagnostic", "teaching", "safety". */
  category: string;
  description: string;
  context: SuppliedContext;
  memory: MemoryEntry[];
  uploads: SampleUpload[];
  conversation: PracticeTurn[];
  expected: ExpectedOutcome;
  /** What the case exercises; defaults to its category if unset. Used by loop-readiness. */
  kind?: CaseKind;
  /** Structured Trust Gap pillars — lets the deterministic oracle verify the trigger choice. */
  diagnostic?: CaseDiagnostic;
  /** Related golden-corpus fixture (journey folder), if this case mirrors one. */
  corpusRef?: string;
}
