/**
 * Layer 0 (contract) — the 18 master context slots.
 *
 * Transcribed verbatim from OUTPUT_CONTEXT_MANIFEST.md §4 (the deduplicated slot
 * table). Each slot is the unit the context resolver (Phase 2) fills KB-first and
 * the unit a generator declares as `requiredContext`. Ids 1..18 are stable and are
 * the canonical numbering referenced across the manifest (§2 sheet requirements,
 * §5 resolver, §6 fabrication gates).
 *
 * `residesIn` lists the stores the resolver attempts, ordered by the manifest's
 * resolution order (§5 step 1): artifacts → evidence stores → avatar_field_values →
 * user_knowledge_base (current) → diagnostic_submissions → user_knowledge_chunks
 * (RAG) → IV-OS MCP (IV tenant only) → ASK USER. A slot only lists the stores that
 * actually carry it; the last fallback is always the user (`askQuestion`).
 */

/** The trust taxonomy from manifest §1. */
export type SlotClass =
  | 'EVIDENCE'
  | 'PRODUCT-TRUTH'
  | 'BUSINESS-FACT'
  | 'OWNER-INTENT'
  | 'INTAKE'
  | 'FRAMEWORK'
  | 'ESTIMATE'
  | 'SYNTHESIS';

/**
 * A store the resolver can read a slot from. `ask` is the terminal fallback —
 * the user is prompted and the answer is written back (manifest §5 step 5).
 */
export type SlotStore =
  | 'artifacts'
  | 'evidence_snapshots'
  | 'user_products'
  | 'user_product_reviews'
  | 'competitor_reviews'
  | 'avatar_field_values'
  | 'user_knowledge_base'
  | 'business_facts'
  | 'diagnostic_submissions'
  | 'user_knowledge_chunks'
  | 'ivos_mcp'
  | 'framework_static'
  | 'ask';

export interface ContextSlot {
  /** Manifest §4 numbering — stable, 1..18. */
  readonly id: number;
  /** Slot name verbatim from §4. */
  readonly name: string;
  /** Trust class governing how this slot may be used (§1, §6). */
  readonly class: SlotClass;
  /** Stores the resolver attempts, in resolution order; ends at `ask`. */
  readonly residesIn: readonly SlotStore[];
  /** The clarification question surfaced when the slot resolves to ask/missing. */
  readonly askQuestion: string;
}

/**
 * All 18 slots, `as const` so consumers get a literal union of ids and a frozen
 * source of truth. The fabrication-critical slot (#6) is flagged in its question.
 */
export const CONTEXT_SLOTS = [
  {
    id: 1,
    name: 'Own product reviews (verbatim)',
    class: 'EVIDENCE',
    residesIn: ['user_product_reviews', 'evidence_snapshots', 'ask'],
    askQuestion:
      'Paste your product reviews verbatim (or an ASIN to fetch them). Avatar forensics quotes these directly — they cannot be invented.',
  },
  {
    id: 2,
    name: 'Competitor reviews',
    class: 'EVIDENCE',
    residesIn: ['competitor_reviews', 'evidence_snapshots', 'ask'],
    askQuestion:
      'Which competitors should we forensically read, and can you paste their reviews (or URLs)? Used to cluster category vocabulary.',
  },
  {
    id: 3,
    name: 'Own listing copy (title/bullets/A+/desc)',
    class: 'EVIDENCE',
    // evidence_snapshots first (an explicit ingest_evidence wins), then the app's scraped
    // listing in user_products (title/bullets/description) so a listing the user already
    // imported in-app resolves here without re-asking. See store-and-resurface principle.
    residesIn: ['evidence_snapshots', 'user_products', 'ask'],
    askQuestion:
      'Paste your current listing title, bullets, A+ content, and description (or an Amazon /dp/ URL). The diagnostic cites these as evidence.',
  },
  {
    id: 4,
    name: 'Ad copy / support messaging samples',
    class: 'EVIDENCE',
    residesIn: ['evidence_snapshots', 'ask'],
    askQuestion:
      'Share samples of your ad copy and customer-support messaging. Used to read authenticity / voice consistency.',
  },
  {
    id: 5,
    name: 'Product catalog (SKUs, names, prices)',
    class: 'PRODUCT-TRUTH',
    residesIn: ['user_products', 'ivos_mcp', 'ask'],
    askQuestion:
      'List your SKUs with their product names and prices. Used for diagnostic distinctiveness, the brief, and investment tiering.',
  },
  {
    id: 6,
    name: 'Product claims (capacity, materials, compatibility, guarantees/policies)',
    class: 'PRODUCT-TRUTH',
    // user_products carries the scraped bullets/description (where claims live) alongside
    // evidence_snapshots, so an already-imported listing surfaces its claims here too.
    residesIn: ['evidence_snapshots', 'user_products', 'ivos_mcp', 'ask'],
    askQuestion:
      'Confirm the exact product facts and policies (capacity, materials, compatibility, return/guarantee terms). FABRICATION-GATED: these may never appear in generated copy unconfirmed.',
  },
  {
    id: 7,
    name: 'Brand asset states (Brand Registry, A+, storefront, photography)',
    class: 'BUSINESS-FACT',
    residesIn: ['business_facts', 'ask'],
    askQuestion:
      'What brand assets do you have today — Brand Registry status, existing A+ content, storefront, photography? Drives investment tiering and the image brief.',
  },
  {
    id: 8,
    name: 'Revenue / margins / ad metrics (spend, ACOS targets)',
    class: 'BUSINESS-FACT',
    residesIn: ['business_facts', 'user_knowledge_base', 'ask'],
    askQuestion:
      'What are your monthly revenue, post-ad margin target, current ad spend, and ACOS targets? Calibrates every benefit estimate in the audit.',
  },
  {
    id: 9,
    name: 'Cash constraints & timing (repayments, inventory orders)',
    class: 'BUSINESS-FACT',
    residesIn: ['business_facts', 'ask'],
    askQuestion:
      'Describe your cash constraints and timing — loan repayments, inventory-order dates. The 90-day rollout is phased around this.',
  },
  {
    id: 10,
    name: 'Channel states (email list size, social, D2C)',
    class: 'BUSINESS-FACT',
    residesIn: ['business_facts', 'ask'],
    askQuestion:
      'What channels are live and at what scale — email list size, social presence, D2C store? Affects tier applicability.',
  },
  {
    id: 11,
    name: 'Inventory risks (LTSF SKUs)',
    class: 'BUSINESS-FACT',
    residesIn: ['business_facts', 'ivos_mcp', 'ask'],
    askQuestion:
      'Which SKUs carry inventory risk (e.g. long-term storage fees / slow movers)? The phasing prioritizes clearing these.',
  },
  {
    id: 12,
    name: 'Positioning intent / price-anchor strategy / variant naming intent',
    class: 'OWNER-INTENT',
    residesIn: ['avatar_field_values', 'user_knowledge_base', 'ask'],
    askQuestion:
      'What is your positioning intent — price-anchor logic, why your variants are named as they are? Feeds diagnostic distinctiveness and the canvas.',
  },
  {
    id: 13,
    name: "Voice preferences (do's/don'ts), brand story",
    class: 'OWNER-INTENT',
    residesIn: ['avatar_field_values', 'user_knowledge_base', 'ask'],
    askQuestion:
      "What are your voice do's and don'ts, and your brand story/origin? The canvas and brief are written to these rules.",
  },
  {
    id: 14,
    name: 'Target-customer beliefs',
    class: 'OWNER-INTENT',
    residesIn: ['avatar_field_values', 'user_knowledge_base', 'ask'],
    askQuestion:
      'What do you believe your target customer actually wants and fears? Seeds the avatar stages where evidence is thin.',
  },
  {
    id: 15,
    name: 'Intake answers',
    class: 'INTAKE',
    residesIn: ['diagnostic_submissions', 'ask'],
    askQuestion:
      'Complete the Trust Gap intake questionnaire. Combined with evidence to compute the diagnostic scores.',
  },
  {
    id: 16,
    name: 'Competitor set + price points',
    class: 'BUSINESS-FACT',
    residesIn: ['business_facts', 'ask'],
    askQuestion:
      'Who are your direct competitors and at what price points? Used in objections (price-vs-competitor) and the audit.',
  },
  {
    id: 17,
    name: 'Marketing-move library',
    class: 'FRAMEWORK',
    residesIn: ['framework_static'],
    askQuestion:
      'System-side: the reusable marketing-move library. Not asked of the user — supplied by the framework.',
  },
  {
    id: 18,
    name: 'IDEA definitions / rubrics',
    class: 'FRAMEWORK',
    residesIn: ['framework_static'],
    askQuestion:
      'System-side: the IDEA dimension definitions and scoring rubrics. Not asked of the user — supplied by the framework.',
  },
] as const satisfies readonly ContextSlot[];

/** Literal union of valid slot ids (1..18). */
export type SlotId = (typeof CONTEXT_SLOTS)[number]['id'];

/** Map for O(1) lookup by id. */
const SLOTS_BY_ID: ReadonlyMap<number, ContextSlot> = new Map(
  CONTEXT_SLOTS.map((s) => [s.id, s]),
);

/** Look up a slot by id; throws on an unknown id (contracts reference ids statically). */
export function getSlot(id: SlotId): ContextSlot {
  const slot = SLOTS_BY_ID.get(id);
  if (!slot) {
    throw new Error(`Unknown context slot id: ${id}`);
  }
  return slot;
}
