/**
 * Layer 3 (service) — store-on-answer write-back (manifest §5 step 5).
 *
 * The other half of "never ask twice": when the user answers a clarification, the
 * answer is written back to the CORRECT store for its slot's trust class, so the same
 * question is never asked again. Routing by class (manifest §5 step 5):
 *
 *   EVIDENCE      → evidence_snapshots (reviews/listing copy frozen as a snapshot);
 *                   user_product_reviews when a product_id is supplied (own-product reviews).
 *   BUSINESS-FACT → business_facts, field_identifier=<slot id>, structured_data=<value>,
 *                   with is_current versioning (prior current row flipped to
 *                   is_current=false; new row at version = prior+1).
 *   OWNER-INTENT  → avatar_field_values, field_source='manual' (the lockable owner store).
 *
 * All writes run on the JWT-bound RLS client (guardrail #5: no service-role), and every
 * write requires an authenticated caller. `business_facts` is a dedicated owner-confirmed
 * store (migration 20260606000000): user_knowledge_base's CHECK constraint forbids a
 * 'business_facts' category, so BUSINESS-FACT/PRODUCT-TRUTH answers land in their own
 * table that keeps the same KB versioning shape. OWNER-INTENT writes the avatar field
 * store directly (FieldPersistenceService is a browser-side service outside the MCP
 * tsconfig, so it cannot be imported here — manifest §5 fallback).
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { getSlot, type ContextSlot, type SlotClass, type SlotId, type SlotStore } from '../contracts/slots.js';

/** The store a write-back landed in, returned so callers/tests can assert routing. */
export type WritebackStore = Extract<
  SlotStore,
  'evidence_snapshots' | 'user_product_reviews' | 'business_facts' | 'avatar_field_values'
>;

/** Per-write options: avatar scope, and the product to attach own-product reviews to. */
export interface StoreAnswerOptions {
  /** Avatar scope for OWNER-INTENT / evidence writes; null = brand-level. */
  avatarId?: string | null;
  /** Own-product id; when present, EVIDENCE review answers go to user_product_reviews. */
  productId?: string | null;
  /**
   * Provenance of the value. `stated` (default) = the owner asserted it → resolves
   * `filled-stated`. `inferred` = the coach derived it from context → resolves
   * `filled-inferred` (lower confidence, surfaced for confirmation). Only affects
   * OWNER-INTENT writes (field_source manual vs ai); other classes are always owner-stated.
   */
  source?: 'stated' | 'inferred';
}

/** Result of a write-back: which store, the new row id, and the resolved class. */
export interface StoreAnswerResult {
  slot: SlotId;
  class: SlotClass;
  store: WritebackStore;
  rowId: string;
}

/** Raised when a write-back fails or is not routable for the slot's class. */
export class ContextWritebackError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ContextWritebackError';
  }
}

/** The current authenticated user id; throws when no caller is in scope. */
function requireUserId(): string {
  const { userId, authenticated } = getIdentity();
  if (!authenticated || !userId) {
    throw new ContextWritebackError('no authenticated caller in scope for context write-back');
  }
  return userId;
}

/**
 * Persist a user's answer for a slot to the correct store for its trust class.
 * @throws ContextWritebackError when the class is not write-back-routable or the DB rejects the write.
 */
export async function storeAnswer(
  slot: SlotId,
  value: unknown,
  opts: StoreAnswerOptions = {},
): Promise<StoreAnswerResult> {
  requireUserId(); // identity gate: anon callers are rejected before any store is touched.
  const def = getSlot(slot);
  switch (def.class) {
    case 'EVIDENCE':
      return writeEvidence(def, value, opts);
    case 'BUSINESS-FACT':
      return writeBusinessFact(def, value);
    case 'OWNER-INTENT':
      return writeOwnerIntent(def, value, opts);
    case 'PRODUCT-TRUTH':
      // PRODUCT-TRUTH is fabrication-gated: confirmations are recorded as business
      // facts (the structured owner-confirmation store) so a later generator can read
      // a `filled-stated` confirmation. Reviews/listing copy of products remain EVIDENCE.
      return writeBusinessFact(def, value);
    default:
      throw new ContextWritebackError(
        `slot ${slot} (class ${def.class}) is not user-answerable — no write-back route`,
      );
  }
}

/**
 * EVIDENCE → evidence_snapshots by default; user_product_reviews when a product is given.
 * Listing-copy slots (#3 listing, #6 product claims) land in the snapshot `listing`
 * column; review slots land in `reviews` (or the dedicated reviews table when scoped).
 */
async function writeEvidence(
  slot: ContextSlot,
  value: unknown,
  opts: StoreAnswerOptions,
): Promise<StoreAnswerResult> {
  const supabase = getUserSupabase();

  // Own-product reviews with a product id → the dedicated reviews table (richer schema).
  if (opts.productId && (slot.id === 1)) {
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    const { data, error } = await supabase
      .from('user_product_reviews')
      .insert({ product_id: opts.productId, body })
      .select('id')
      .single();
    if (error || !data) {
      throw new ContextWritebackError(`failed to write user_product_review: ${error?.message ?? 'no row'}`, error);
    }
    return { slot: slot.id as SlotId, class: slot.class, store: 'user_product_reviews', rowId: (data as { id: string }).id };
  }

  const userId = requireUserId();
  const isListing = slot.id === 3 || slot.id === 6;
  const { data, error } = await supabase
    .from('evidence_snapshots')
    .insert({
      user_id: userId,
      avatar_id: opts.avatarId ?? null,
      source: `slot:${slot.id}`,
      ...(isListing ? { listing: value } : { reviews: value }),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new ContextWritebackError(`failed to write evidence_snapshot: ${error?.message ?? 'no row'}`, error);
  }
  return { slot: slot.id as SlotId, class: slot.class, store: 'evidence_snapshots', rowId: (data as { id: string }).id };
}

/**
 * BUSINESS-FACT (and PRODUCT-TRUTH confirmations) → the dedicated `business_facts` table.
 *
 * Keeps KB-style versioning: the prior current row for this field_identifier=<slot id> is
 * flipped to is_current=false, and a new row is inserted at version = prior+1 with the
 * answer in `structured_data`. This keeps history while exactly one row stays current —
 * which the resolver reads via `is_current=true ORDER BY version DESC`.
 *
 * A dedicated table (not user_knowledge_base) because user_knowledge_base's category
 * CHECK constraint forbids a 'business_facts' category — see migration 20260606000000.
 */
async function writeBusinessFact(slot: ContextSlot, value: unknown): Promise<StoreAnswerResult> {
  const supabase = getUserSupabase();
  const userId = requireUserId();
  const field = String(slot.id);

  // Find the prior current version (if any) to compute the next version and supersede it.
  const { data: prior, error: priorErr } = await supabase
    .from('business_facts')
    .select('id, version')
    .eq('field_identifier', field)
    .eq('is_current', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorErr) {
    throw new ContextWritebackError(`failed to read prior business_fact: ${priorErr.message}`, priorErr);
  }
  const priorRow = prior as { id: string; version: number } | null;
  const nextVersion = (priorRow?.version ?? 0) + 1;

  // Supersede the prior current row first so there is never more than one current.
  if (priorRow) {
    const { error: supErr } = await supabase
      .from('business_facts')
      .update({ is_current: false })
      .eq('id', priorRow.id);
    if (supErr) {
      throw new ContextWritebackError(`failed to supersede prior business_fact: ${supErr.message}`, supErr);
    }
  }

  const content = typeof value === 'string' ? value : JSON.stringify(value);
  const { data, error } = await supabase
    .from('business_facts')
    .insert({
      user_id: userId,
      field_identifier: field,
      content,
      structured_data: value,
      version: nextVersion,
      is_current: true,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new ContextWritebackError(`failed to write business_fact: ${error?.message ?? 'no row'}`, error);
  }
  return { slot: slot.id as SlotId, class: slot.class, store: 'business_facts', rowId: (data as { id: string }).id };
}

/**
 * OWNER-INTENT → avatar_field_values with field_source='manual' (the lockable owner
 * store). Requires an avatar scope: avatar_field_values is keyed by avatar_id + field_id.
 */
async function writeOwnerIntent(
  slot: ContextSlot,
  value: unknown,
  opts: StoreAnswerOptions,
): Promise<StoreAnswerResult> {
  if (opts.avatarId == null) {
    throw new ContextWritebackError(
      `OWNER-INTENT slot ${slot.id} requires an avatarId — avatar_field_values is avatar-keyed`,
    );
  }
  const fieldId = AVATAR_FIELD_FOR_SLOT[slot.id];
  if (!fieldId) {
    throw new ContextWritebackError(`no avatar field mapping for OWNER-INTENT slot ${slot.id}`);
  }
  const supabase = getUserSupabase();
  const fieldValue = typeof value === 'string' ? value : JSON.stringify(value);
  const { data, error } = await supabase
    .from('avatar_field_values')
    .insert({
      avatar_id: opts.avatarId,
      field_id: fieldId,
      field_value: fieldValue,
      // `manual` (owner stated it) resolves filled-stated; `ai` (coach inferred it) resolves
      // filled-inferred, so a remembered inference surfaces for confirmation, not as fact.
      field_source: opts.source === 'inferred' ? 'ai' : 'manual',
      is_locked: false,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new ContextWritebackError(`failed to write avatar_field_value: ${error?.message ?? 'no row'}`, error);
  }
  return { slot: slot.id as SlotId, class: slot.class, store: 'avatar_field_values', rowId: (data as { id: string }).id };
}

/** OWNER-INTENT slot id → avatar_field_values.field_id (matches the resolver's mapping). */
const AVATAR_FIELD_FOR_SLOT: Partial<Record<number, string>> = {
  12: 'positioningIntent',
  13: 'voicePreferences',
  14: 'targetCustomerBeliefs',
};
