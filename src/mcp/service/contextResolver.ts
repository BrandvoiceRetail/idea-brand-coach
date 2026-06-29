/**
 * Layer 3 (service) — the "never ask twice" context resolver (manifest §5).
 *
 * Given a set of context slots (§4 ids) and an avatar scope, the resolver fills each
 * slot KB-first by walking its `residesIn` stores in the manifest's resolution order:
 *
 *   artifacts → evidence stores (evidence_snapshots / user_products /
 *   user_product_reviews / competitor_reviews) → avatar_field_values →
 *   user_knowledge_base (current) → diagnostic_submissions → user_knowledge_chunks
 *   (RAG) → IV-OS MCP (IV tenant only — SKIPPED here, noted as future) → missing
 *
 * Every fill carries `{slot, value, source, confidence, status}`. `status` is the
 * trust signal that drives the clarification queue (§5 step 3): anything that is not
 * `filled-evidence`/`filled-stated` (i.e. `filled-inferred | missing | conflict |
 * stale`) is something the calling layer should confirm or ask about.
 *
 * Status is derived from WHERE the value came from and the slot's trust class:
 *   - artifacts                → grounding=evidence ? filled-evidence : filled-inferred
 *   - evidence stores          → filled-evidence (verbatim third-party data)
 *   - avatar_field_values      → field_source='manual' ? filled-stated : filled-inferred
 *   - user_knowledge_base      → filled-stated, but BUSINESS-FACT slots past the
 *                                staleness window degrade to `stale`
 *   - diagnostic_submissions   → filled-stated (structured intake answers)
 *   - user_knowledge_chunks    → filled-inferred (loose RAG mining)
 *   - nothing found anywhere   → missing
 *
 * `conflict`: when two stores both yield a value for a slot and the values disagree,
 * the highest-priority store wins the `value`/`source` but the status is `conflict`
 * so the disagreement surfaces for the owner to reconcile.
 *
 * This module is READ-ONLY. Write-back on a user's answer lives in
 * `contextWriteback.ts` (manifest §5 step 5).
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import {
  CONTEXT_SLOTS,
  getSlot,
  type ContextSlot,
  type SlotClass,
  type SlotId,
  type SlotStore,
} from '../contracts/slots.js';

/** Resolution status for a single slot (manifest §5 step 2). */
export type SlotStatus =
  | 'filled-evidence'
  | 'filled-stated'
  | 'filled-inferred'
  | 'missing'
  | 'conflict'
  | 'stale';

/** Scope for a resolve pass. `avatarId` scopes avatar-keyed stores; null = brand-level. */
export interface ResolveScope {
  avatarId?: string | null;
}

/** One resolved slot: its value, where it came from, confidence, and trust status. */
export interface ResolvedSlot {
  slot: SlotId;
  /** The resolved value, or null when `status` is `missing`. */
  value: unknown;
  /** The store the winning value came from, or `null` when missing. */
  source: SlotStore | null;
  /** 0..1 confidence in the fill (1 = verbatim/stated, lower for inferred). */
  confidence: number;
  status: SlotStatus;
}

/** Staleness window per slot class, in days. BUSINESS-FACTs go stale at 90 days. */
const STALENESS_DAYS: Partial<Record<SlotClass, number>> = {
  'BUSINESS-FACT': 90,
};

/** Confidence baselines per status (manifest §5: evidence/stated high, inferred low). */
const CONFIDENCE: Record<Exclude<SlotStatus, 'missing'>, number> = {
  'filled-evidence': 1,
  'filled-stated': 0.9,
  'filled-inferred': 0.5,
  conflict: 0.4,
  stale: 0.3,
};

/** A candidate fill from a single store, before conflict/staleness reconciliation. */
interface Candidate {
  store: SlotStore;
  value: unknown;
  /** The status this store would assign on its own (pre-reconciliation). */
  status: Exclude<SlotStatus, 'missing' | 'conflict'>;
  /** ISO timestamp of the value's freshness, when the store carries one. */
  asOf?: string | null;
}

/** Whether two resolved values are semantically equal (JSON-stable comparison). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Days between an ISO timestamp and now; `Infinity` when the timestamp is absent/bad. */
function ageInDays(asOf: string | null | undefined): number {
  if (!asOf) return Infinity;
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}

/**
 * A reader for one store: returns a candidate fill or null when the store has nothing
 * for this slot. Each is RLS-safe (runs on the JWT-bound client) and never throws —
 * a store error degrades to null so resolution falls through to the next store.
 */
type StoreReader = (slot: ContextSlot, scope: ResolveScope) => Promise<Candidate | null>;

/**
 * Resolve a set of slots KB-first. Returns one `ResolvedSlot` per requested id, in the
 * same order. Slots whose `residesIn` is purely framework-static (#17/#18) resolve to a
 * stated framework fill; everything else walks the live stores.
 */
export async function resolve(slots: SlotId[], scope: ResolveScope = {}): Promise<ResolvedSlot[]> {
  return Promise.all(slots.map((id) => resolveOne(getSlot(id), scope)));
}

/** Resolve every slot a contract requires (convenience for generator tools). */
export async function resolveAll(scope: ResolveScope = {}): Promise<ResolvedSlot[]> {
  return resolve(CONTEXT_SLOTS.map((s) => s.id as SlotId), scope);
}

/** Resolve a single slot by walking its stores; collects candidates for conflict checks. */
async function resolveOne(slot: ContextSlot, scope: ResolveScope): Promise<ResolvedSlot> {
  const candidates: Candidate[] = [];
  for (const store of slot.residesIn) {
    if (store === 'ask') continue; // terminal fallback — handled as `missing` below
    const reader = READERS[store];
    if (!reader) continue; // ivos_mcp etc. — skipped (future), see note
    const candidate = await safeRead(reader, slot, scope);
    if (candidate) candidates.push(candidate);
  }
  return reconcile(slot, candidates);
}

/** Run a reader, swallowing store errors into a null (resolution falls through). */
async function safeRead(reader: StoreReader, slot: ContextSlot, scope: ResolveScope): Promise<Candidate | null> {
  try {
    return await reader(slot, scope);
  } catch {
    return null;
  }
}

/**
 * Pick the winning candidate (first = highest-priority store) and derive the final
 * status: apply the staleness window for BUSINESS-FACTs, then flag `conflict` when a
 * lower-priority store disagrees with the winner.
 */
function reconcile(slot: ContextSlot, candidates: Candidate[]): ResolvedSlot {
  const id = slot.id as SlotId;
  if (candidates.length === 0) {
    return { slot: id, value: null, source: null, confidence: 0, status: 'missing' };
  }

  const [winner, ...rest] = candidates;
  let status: SlotStatus = winner.status;

  // Staleness: a BUSINESS-FACT past its window is a `confirm`, not a fresh fill.
  const windowDays = STALENESS_DAYS[slot.class];
  if (windowDays !== undefined && ageInDays(winner.asOf) > windowDays) {
    status = 'stale';
  }

  // Conflict: any other store yielding a different value flips the status (winner kept).
  if (status !== 'stale' && rest.some((c) => !valuesEqual(c.value, winner.value))) {
    status = 'conflict';
  }

  // `status` is one of the non-missing statuses here (candidates.length > 0).
  return {
    slot: id,
    value: winner.value,
    source: winner.store,
    confidence: CONFIDENCE[status as Exclude<SlotStatus, 'missing'>],
    status,
  };
}

// --------------------------------------------------------------------------------------
// Store readers. Keyed by `SlotStore`; `ask`/`ivos_mcp`/`framework_static` are special.
// All run on the JWT-bound RLS client, so they only ever see the caller's own rows.
// --------------------------------------------------------------------------------------

const READERS: Partial<Record<SlotStore, StoreReader>> = {
  artifacts: readArtifacts,
  evidence_snapshots: readEvidenceSnapshots,
  user_products: readUserProducts,
  user_product_reviews: readUserProductReviews,
  competitor_reviews: readCompetitorReviews,
  avatar_field_values: readAvatarFieldValues,
  user_knowledge_base: readUserKnowledgeBase,
  business_facts: readBusinessFacts,
  diagnostic_submissions: readDiagnosticSubmissions,
  user_knowledge_chunks: readUserKnowledgeChunks,
  framework_static: readFrameworkStatic,
  // ivos_mcp intentionally absent — IV-tenant-only, deferred (see resolve() note).
};

/**
 * Maps a slot id to the artifact kind that carries it, when a generated artifact is the
 * canonical home for that slot. Only intake/evidence-derived synthesis slots map here;
 * pure input slots (reviews, listing copy) are read from their own stores.
 */
function artifactKindForSlot(slotId: number): string | null {
  switch (slotId) {
    case 14: // Target-customer beliefs — best carried by the avatar stages once built.
      return 'avatar_s1_vocab';
    default:
      return null;
  }
}

async function readArtifacts(slot: ContextSlot, scope: ResolveScope): Promise<Candidate | null> {
  const kind = artifactKindForSlot(slot.id);
  if (!kind) return null;
  const supabase = getUserSupabase();
  const readAt = async (avatarId: string | null): Promise<Candidate | null> => {
    let query = supabase.from('artifacts').select('content, grounding, created_at').eq('kind', kind).is('superseded_by', null);
    query = avatarId == null ? query.is('avatar_id', null) : query.eq('avatar_id', avatarId);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    const row = data as { content: unknown; grounding: string; created_at: string };
    return {
      store: 'artifacts',
      value: row.content,
      status: row.grounding === 'evidence' ? 'filled-evidence' : 'filled-inferred',
      asOf: row.created_at,
    };
  };
  // Avatar-scoped first, then brand-level fallback (same read-after-write reasoning as
  // readEvidenceSnapshots): a brand-level artifact must surface for an avatar-scoped read.
  if (scope.avatarId != null) {
    return (await readAt(scope.avatarId)) ?? (await readAt(null));
  }
  return readAt(null);
}

async function readEvidenceSnapshots(slot: ContextSlot, scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  // Listing-copy slots read the `listing` column; review slots read `reviews`.
  const column = slot.id === 3 || slot.id === 6 ? 'listing' : 'reviews';
  const readAt = async (avatarId: string | null): Promise<Candidate | null> => {
    let query = supabase.from('evidence_snapshots').select(`${column}, created_at`).not(column, 'is', null);
    query = avatarId == null ? query.is('avatar_id', null) : query.eq('avatar_id', avatarId);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown> & { created_at: string };
    const value = row[column];
    if (value == null) return null;
    return { store: 'evidence_snapshots', value, status: 'filled-evidence', asOf: row.created_at };
  };
  // Avatar-scoped first; then fall back to brand-level (avatar_id IS NULL). Evidence
  // ingested before an avatar was chosen (the onboarding case) lives at brand-level, so an
  // avatar-scoped assess must see it rather than report a false "no evidence". The fallback
  // never reaches a DIFFERENT avatar's rows — only the shared brand-level ones.
  if (scope.avatarId != null) {
    return (await readAt(scope.avatarId)) ?? (await readAt(null));
  }
  return readAt(null);
}

async function readUserProducts(_slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('user_products')
    .select('id, asin, title, price, bullets, description')
    .order('scraped_at', { ascending: false });
  if (error || !data || (data as unknown[]).length === 0) return null;
  return { store: 'user_products', value: data, status: 'filled-evidence' };
}

async function readUserProductReviews(_slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  // user_product_reviews has no user_id; RLS scopes via the product_id → user_products FK.
  // We select the caller's product ids first, then their reviews.
  const { data: products, error: prodErr } = await supabase.from('user_products').select('id');
  if (prodErr || !products || (products as unknown[]).length === 0) return null;
  const ids = (products as Array<{ id: string }>).map((p) => p.id);
  const { data, error } = await supabase
    .from('user_product_reviews')
    .select('id, rating, title, body, review_date')
    .in('product_id', ids);
  if (error || !data || (data as unknown[]).length === 0) return null;
  return { store: 'user_product_reviews', value: data, status: 'filled-evidence' };
}

async function readCompetitorReviews(_slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  // The `competitor_reviews` table is absent on live (manifest §4 #2: migrations in repo,
  // not applied). Reading it would error; the safeRead wrapper degrades that to null and
  // resolution falls through to evidence_snapshots / ask. Returning null here directly
  // avoids a guaranteed-failing round-trip.
  return null;
}

async function readAvatarFieldValues(slot: ContextSlot, scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  // avatar_field_values is keyed by avatar_id + field_id; the field id maps to the slot.
  const fieldId = AVATAR_FIELD_FOR_SLOT[slot.id];
  if (!fieldId) return null;
  let query = supabase
    .from('avatar_field_values')
    .select('field_value, field_source, extracted_at')
    .eq('field_id', fieldId);
  if (scope.avatarId != null) query = query.eq('avatar_id', scope.avatarId);
  const { data, error } = await query
    .order('extracted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { field_value: string | null; field_source: string | null; extracted_at: string | null };
  if (row.field_value == null) return null;
  return {
    store: 'avatar_field_values',
    value: row.field_value,
    status: row.field_source === 'manual' ? 'filled-stated' : 'filled-inferred',
    asOf: row.extracted_at,
  };
}

async function readUserKnowledgeBase(slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  const { category, field } = KB_FIELD_FOR_SLOT[slot.id] ?? {};
  if (!category || !field) return null;
  const { data, error } = await supabase
    .from('user_knowledge_base')
    .select('content, structured_data, updated_at')
    .eq('category', category)
    .eq('field_identifier', field)
    .eq('is_current', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { content: string | null; structured_data: unknown; updated_at: string | null };
  const value = row.structured_data ?? row.content;
  if (value == null) return null;
  return { store: 'user_knowledge_base', value, status: 'filled-stated', asOf: row.updated_at };
}

async function readBusinessFacts(slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  // business_facts is its own owner-confirmed table (migration 20260606000000) keyed by
  // field_identifier = the slot id. It is NOT user_knowledge_base: that table's category
  // CHECK constraint forbids a 'business_facts' category, so the write-back stores here.
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('business_facts')
    .select('content, structured_data, updated_at')
    .eq('field_identifier', String(slot.id))
    .eq('is_current', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { content: string | null; structured_data: unknown; updated_at: string | null };
  const value = row.structured_data ?? row.content;
  if (value == null) return null;
  // BUSINESS-FACT class: status is `filled-stated`, then reconcile() applies the
  // 90-day staleness window using asOf.
  return { store: 'business_facts', value, status: 'filled-stated', asOf: row.updated_at };
}

async function readDiagnosticSubmissions(_slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('diagnostic_submissions')
    .select('answers, completed_at')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { answers: unknown; completed_at: string };
  if (row.answers == null) return null;
  return { store: 'diagnostic_submissions', value: row.answers, status: 'filled-stated', asOf: row.completed_at };
}

async function readUserKnowledgeChunks(slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  const supabase = getUserSupabase();
  const field = KB_FIELD_FOR_SLOT[slot.id]?.field;
  if (!field) return null;
  // RAG mining is the loosest source — match on the field identifier, newest first.
  const { data, error } = await supabase
    .from('user_knowledge_chunks')
    .select('content, created_at')
    .eq('field_identifier', field)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { content: string | null; created_at: string };
  if (row.content == null) return null;
  return { store: 'user_knowledge_chunks', value: row.content, status: 'filled-inferred', asOf: row.created_at };
}

async function readFrameworkStatic(slot: ContextSlot, _scope: ResolveScope): Promise<Candidate | null> {
  // FRAMEWORK slots (#17 move library, #18 IDEA rubrics) are system-side and always
  // present; they resolve as `filled-stated` without a user round-trip. The concrete
  // payload is supplied by the framework data modules in later phases.
  return { store: 'framework_static', value: { framework: slot.name }, status: 'filled-stated' };
}

/**
 * Slot id → `avatar_field_values.field_id`. OWNER-INTENT slots live in the avatar field
 * store under these field ids (mirrors the keys the app's avatar editor writes).
 */
const AVATAR_FIELD_FOR_SLOT: Partial<Record<number, string>> = {
  12: 'positioningIntent',
  13: 'voicePreferences',
  14: 'targetCustomerBeliefs',
};

/**
 * Slot id → `user_knowledge_base` (category, field_identifier) for KB-backed slots.
 * BUSINESS-FACT slots are intentionally absent: their owner-confirmed home is the
 * dedicated `business_facts` table (readBusinessFacts), and user_knowledge_base's
 * category CHECK constraint has no 'business_facts' category to fall back to.
 */
const KB_FIELD_FOR_SLOT: Partial<Record<number, { category: string; field: string }>> = {
  12: { category: 'canvas', field: 'positioningIntent' },
  13: { category: 'canvas', field: 'voicePreferences' },
  14: { category: 'avatar', field: 'targetCustomerBeliefs' },
};

/** True when there is no authenticated caller (resolution requires the RLS client). */
export function resolverHasIdentity(): boolean {
  return getIdentity().authenticated;
}
