/**
 * Layer 3 (service) — artifact persistence over the RLS-bound user client.
 *
 * The artifact chain is the engine's durable memory: every generator output is a row
 * in `artifacts` (kind / content jsonb / grounding / evidence_refs / superseded_by),
 * RLS-scoped to `user_id = auth.uid()` by the JWT-bound client (supabaseUser.ts).
 *
 * Append-only history with a single CURRENT row per (kind, avatar scope): saving a new
 * artifact supersedes the prior current row(s) of that kind and adds a fresh current
 * row, atomically via the `save_artifact_atomic` Postgres RPC. Readers ask for
 * `superseded_by IS NULL` to get the live artifact and walk `superseded_by` for the
 * chain.
 *
 * The save is a single transaction (the RPC) rather than a client-side insert-then-
 * supersede: the prior ordering transiently created a second `superseded_by IS NULL`
 * row, which the partial unique index `uq_artifacts_current_per_kind` (non-deferrable)
 * rejected — silently blocking same-avatar REGENERATION (E2E_GAP_REPORT §4 R1). The RPC
 * self-supersedes the old current row(s) first (`superseded_by = id` frees the index
 * slot and satisfies the self-FK), inserts the new row, then repoints the old rows at
 * it — so the chain never has two current rows, and never zero on a failure path.
 *
 * Contract-validated: every artifact is parsed against its Phase-0 zod contract
 * (`CONTRACTS[kind].outputSchema`) before it touches the DB, and the grounding
 * invariant (manifest §6 / guardrail #4) is enforced here, not in the schema:
 * `grounding:'evidence'` REQUIRES a non-empty `evidence_refs[]`.
 *
 * `saveSignatureChoice` closes the Alpha "persist chosen Signature" item: it writes a
 * `signatures` row (the options + chosen index) AND a `signature` artifact row, so the
 * chain and the dedicated table stay consistent.
 */
import {
  CONTRACTS,
  evidenceRefSchema,
  groundingSchema,
  signatureContract,
  type ArtifactKind,
  type EvidenceRef,
  type Grounding,
  type SignatureOutput,
} from '../contracts/index.js';
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';

const ARTIFACTS_TABLE = 'artifacts';
const SIGNATURES_TABLE = 'signatures';

/** Common write metadata carried on every saved artifact. */
export interface SaveArtifactOptions {
  grounding: Grounding;
  evidenceRefs: EvidenceRef[];
  /** Optional avatar scope; `null`/absent rows form the brand-level (no-avatar) chain. */
  avatarId?: string | null;
}

/** A persisted artifact row, as read back from `artifacts`. */
export interface ArtifactRow {
  id: string;
  user_id: string;
  avatar_id: string | null;
  kind: ArtifactKind;
  content: unknown;
  grounding: Grounding;
  evidence_refs: EvidenceRef[];
  superseded_by: string | null;
  created_at: string;
}

/** A persisted signature-choice row, as read back from the live `signatures` table. */
export interface SignatureRow {
  id: string;
  user_id: string;
  avatar_id: string | null;
  signature_text: string | null;
  all_options: SignatureOutput['options'];
  chosen_index: number | null;
  used_reviews: boolean | null;
  inference: boolean | null;
  artifact_id: string | null;
  created_at: string;
}

/** Raised when a persistence call fails at the DB layer. */
export class ArtifactStoreError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ArtifactStoreError';
  }
}

/**
 * Validate `content` against its kind's contract and enforce the grounding invariant.
 * Returns the parsed (canonicalized) content so callers persist the validated shape.
 * @throws ArtifactStoreError on a contract mismatch or a violated grounding rule.
 */
function validateArtifact(kind: ArtifactKind, content: unknown, grounding: Grounding, evidenceRefs: EvidenceRef[]): unknown {
  const contract = CONTRACTS[kind];
  if (!contract) throw new ArtifactStoreError(`unknown artifact kind: ${kind}`);

  groundingSchema.parse(grounding);
  for (const ref of evidenceRefs) evidenceRefSchema.parse(ref);
  if (grounding === 'evidence' && evidenceRefs.length === 0) {
    throw new ArtifactStoreError(
      `grounding='evidence' requires non-empty evidence_refs for kind '${kind}' (manifest §6 / guardrail #4)`,
    );
  }

  const parsed = contract.outputSchema.safeParse(content);
  if (!parsed.success) {
    throw new ArtifactStoreError(`artifact content failed contract '${kind}': ${parsed.error.message}`, parsed.error);
  }
  return parsed.data;
}

/**
 * The current caller's auth user id, for the NOT-NULL `user_id` column.
 *
 * The live `artifacts`/`signatures` tables declare `user_id NOT NULL` with no
 * `DEFAULT auth.uid()`, so inserts must set it explicitly (the RLS INSERT policy
 * `WITH CHECK (auth.uid() = user_id)` then confirms it matches the JWT). An authenticated
 * identity always carries a userId (`resolveIdentity`); this guards the type.
 * @throws ArtifactStoreError when no authenticated user id is in scope.
 */
function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new ArtifactStoreError('no authenticated user id in scope for artifact write');
  return userId;
}

/** Equality on the avatar scope used by the current-row predicate (NULL-safe). */
function applyAvatarScope<Q extends { is(col: string, v: null): Q; eq(col: string, v: string): Q }>(
  query: Q,
  avatarId: string | null | undefined,
): Q {
  return avatarId == null ? query.is('avatar_id', null) : query.eq('avatar_id', avatarId);
}

/**
 * Persist a new artifact and supersede the prior current row of the same kind/scope.
 *
 * Delegates the whole supersede→insert→repoint to the `save_artifact_atomic` RPC so it
 * runs as ONE transaction: this makes same-avatar REGENERATION safe (no transient second
 * current row to trip `uq_artifacts_current_per_kind`) and leaves the chain consistent on
 * any failure (the transaction rolls back as a unit). The RPC runs SECURITY INVOKER, so
 * the caller's RLS still gates every row it touches.
 */
export async function saveArtifact(
  kind: ArtifactKind,
  content: unknown,
  opts: SaveArtifactOptions,
): Promise<ArtifactRow> {
  const avatarId = opts.avatarId ?? null;
  const validated = validateArtifact(kind, content, opts.grounding, opts.evidenceRefs);
  const supabase = getUserSupabase();
  const userId = requireUserId();

  const { data: saved, error: saveError } = await supabase
    .rpc('save_artifact_atomic', {
      p_user_id: userId,
      p_avatar_id: avatarId,
      p_kind: kind,
      p_content: validated,
      p_grounding: opts.grounding,
      p_evidence_refs: opts.evidenceRefs,
    })
    .single();

  if (saveError || !saved) {
    throw new ArtifactStoreError(`failed to save artifact '${kind}': ${saveError?.message ?? 'no row returned'}`, saveError);
  }

  return saved as ArtifactRow;
}

/**
 * Read the single current (non-superseded) artifact of a kind for an avatar scope,
 * or `null` if none exists yet.
 */
export async function getCurrentArtifact(kind: ArtifactKind, avatarId?: string | null): Promise<ArtifactRow | null> {
  const supabase = getUserSupabase();
  const query = applyAvatarScope(
    supabase.from(ARTIFACTS_TABLE).select().eq('kind', kind).is('superseded_by', null),
    avatarId,
  );
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new ArtifactStoreError(`failed to read current '${kind}' artifact: ${error.message}`, error);
  }
  return (data as ArtifactRow | null) ?? null;
}

/**
 * Read the full current-artifact chain for an avatar scope: every kind's live row,
 * newest first. Superseded rows are excluded (history is reachable via `superseded_by`).
 */
export async function getChain(avatarId?: string | null): Promise<ArtifactRow[]> {
  const supabase = getUserSupabase();
  const query = applyAvatarScope(
    supabase.from(ARTIFACTS_TABLE).select().is('superseded_by', null),
    avatarId,
  );
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    throw new ArtifactStoreError(`failed to read artifact chain: ${error.message}`, error);
  }
  return (data as ArtifactRow[] | null) ?? [];
}

/** Input to `saveSignatureChoice`: the full options set + the picked option. */
export interface SaveSignatureChoiceInput {
  options: SignatureOutput['options'];
  chosenOption: number;
  grounding: Grounding;
  evidenceRefs: EvidenceRef[];
  avatarId?: string | null;
}

/** Both rows written by a signature choice: the dedicated row and the chain artifact. */
export interface SaveSignatureChoiceResult {
  signature: SignatureRow;
  artifact: ArtifactRow;
}

/**
 * Persist a chosen Signature (closes the Alpha local-persistence item).
 *
 * Writes BOTH a `signatures` row (options + chosen index, the dedicated store the app
 * reads) and a `signature` artifact (so the chain stays whole for downstream stages).
 * The artifact content is validated against `signatureContract`, with `chosen_option`
 * carried through so re-reads recover the pick.
 */
export async function saveSignatureChoice(input: SaveSignatureChoiceInput): Promise<SaveSignatureChoiceResult> {
  const avatarId = input.avatarId ?? null;

  const chosen = input.options.find((o) => o.option === input.chosenOption);
  if (!chosen) {
    throw new ArtifactStoreError(`chosen_option ${input.chosenOption} is not among the provided options`);
  }

  // Validate the artifact shape up front so a bad payload fails before any write.
  const artifactContent: SignatureOutput = {
    options: input.options,
    chosen_option: input.chosenOption,
    grounding: input.grounding,
    evidence_refs: input.evidenceRefs,
  };
  validateArtifact(signatureContract.kind, artifactContent, input.grounding, input.evidenceRefs);

  // Write the chain artifact first so the `signatures` row can carry its `artifact_id` FK.
  const artifact = await saveArtifact(signatureContract.kind, artifactContent, {
    grounding: input.grounding,
    evidenceRefs: input.evidenceRefs,
    avatarId,
  });

  // The live `signatures` table stores the choice in dedicated columns (no grounding/
  // evidence_refs/options): the chosen sentence in `signature_text`, the full set in
  // `all_options`, the 1-based pick in `chosen_index`, and the grounding split across the
  // `used_reviews`/`inference` flags.
  const supabase = getUserSupabase();
  const userId = requireUserId();
  const { data: sigInserted, error: sigError } = await supabase
    .from(SIGNATURES_TABLE)
    .insert({
      user_id: userId,
      avatar_id: avatarId,
      signature_text: chosen.sentence,
      all_options: input.options,
      chosen_index: input.chosenOption,
      used_reviews: input.grounding === 'evidence',
      inference: input.grounding === 'inference',
      artifact_id: artifact.id,
    })
    .select()
    .single();

  if (sigError || !sigInserted) {
    throw new ArtifactStoreError(`failed to insert signature: ${sigError?.message ?? 'no row returned'}`, sigError);
  }

  return { signature: sigInserted as SignatureRow, artifact };
}
