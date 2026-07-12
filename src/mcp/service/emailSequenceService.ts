/**
 * Layer 1 (service) — email-sequence + email-step CRUD, prebuilt templates, and a
 * deterministic performance read, over the RLS-bound user client.
 *
 * The spine the email tools wrap:
 *   create_email_sequence   → createEmailSequence   (brand-level record; brand_id server-resolved)
 *   add_email_step          → addEmailStep          (child step; ownership-verified, user_id stamped)
 *   get_sequence_template   → getSequenceTemplate   (PURE prebuilts: welcome=5 / nurture=7 / abandoned_cart=3)
 *   list_sequences          → listSequences         (newest-created first, optional filters)
 *   get_sequence_performance→ getSequencePerformance(step count + the linked campaign's email metrics)
 *
 * Every write runs on the JWT-bound client so RLS scopes rows to `auth.uid()`; `brand_id` is
 * resolved SERVER-SIDE (resolveBrandId) and stamped — never accepted from a caller. `user_id` is
 * stamped explicitly (steps denormalise it so they are directly RLS-scoped). Before a step is
 * attached the parent sequence is verified to belong to the caller (RLS-scoped read) — a foreign
 * sequence_id is a clean not-found, never a cross-linked write.
 *
 * HONEST no_data: `getSequencePerformance` never fabricates email metrics — when the sequence has
 * no linked campaign, or that campaign has no email-channel metrics, it returns an empty metric set
 * with a note the coach surfaces rather than inventing opens/clicks.
 *
 * Row/insert shapes + the sequence vocab are the SSOT in `campaignTypes.ts` (mirrors the SQL CHECK
 * constraints in migration 20260626000000_campaign_analytics.sql). The generated
 * `src/integrations/supabase/types.ts` is NEVER hand-edited; we call `from(...)` on untyped chains
 * and coerce into these interfaces (matches the campaignService / nativeLedger house pattern).
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { resolveBrandId } from './avatarOwnership.js';
import { getCampaign } from './campaignService.js';
import type {
  CampaignMetricRow,
  EmailSequenceRow,
  EmailStepRow,
  SequenceStatus,
  SequenceType,
} from './campaignTypes.js';

const SEQUENCES_TABLE = 'email_sequences';
const STEPS_TABLE = 'email_steps';
const METRICS_TABLE = 'campaign_metrics';

const SEQUENCE_COLS =
  'id, user_id, brand_id, campaign_id, sequence_type, name, status, created_at, updated_at';
const STEP_COLS =
  'id, user_id, sequence_id, step_number, subject, body, delay_hours, email_type, trigger_event, created_at';
const METRIC_COLS =
  'id, user_id, campaign_id, channel, metric_name, metric_value, funnel_stage, measured_date, granularity, source, created_at';

/** Raised when an email-sequence DB call fails or the target sequence is absent / not owned. */
export class EmailSequenceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EmailSequenceError';
  }
}

function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new EmailSequenceError('no authenticated user id in scope');
  return userId;
}

// ── create_email_sequence ──────────────────────────────────────────────────────

/** Caller-supplied fields for a new sequence (brand_id is server-resolved, never input). */
export interface CreateEmailSequenceInput {
  sequence_type: SequenceType;
  name: string;
  campaign_id?: string | null;
  status?: SequenceStatus;
}

/**
 * Create a sequence under the caller's brand. `brand_id` is resolved server-side and stamped;
 * `user_id` is stamped explicitly so the row is valid (RLS also enforces it = auth.uid()).
 */
export async function createEmailSequence(
  input: CreateEmailSequenceInput,
): Promise<EmailSequenceRow> {
  const supabase = getUserSupabase();
  const userId = requireUserId();
  const brandId = await resolveBrandId();

  // A supplied campaign_id must be the caller's own (RLS-scoped read) — a foreign id is a clean
  // not-found, never a cross-tenant link (the FK only proves existence, not ownership).
  if (input.campaign_id) {
    const owned = await getCampaign(input.campaign_id);
    if (!owned) throw new EmailSequenceError('campaign not found or not owned');
  }

  const { data, error } = await supabase
    .from(SEQUENCES_TABLE)
    .insert({
      user_id: userId,
      brand_id: brandId,
      campaign_id: input.campaign_id ?? null,
      sequence_type: input.sequence_type,
      name: input.name,
      status: input.status ?? 'draft',
    })
    .select(SEQUENCE_COLS)
    .single();

  if (error || !data) {
    throw new EmailSequenceError(
      `failed to create email sequence: ${error?.message ?? 'no row returned'}`,
      error,
    );
  }
  return data as EmailSequenceRow;
}

// ── add_email_step ───────────────────────────────────────────────────────────

/** Caller-supplied fields for a new step (user_id is stamped by the service). */
export interface AddEmailStepInput {
  sequence_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_hours?: number;
  email_type?: string | null;
  trigger_event?: string | null;
}

/** Read one sequence by id (RLS-scoped), or `null` if it isn't the caller's / absent. */
export async function getSequence(sequenceId: string): Promise<EmailSequenceRow | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(SEQUENCES_TABLE)
    .select(SEQUENCE_COLS)
    .eq('id', sequenceId)
    .maybeSingle();

  if (error) {
    throw new EmailSequenceError(`failed to read email sequence: ${error.message}`, error);
  }
  return (data as EmailSequenceRow | null) ?? null;
}

/** Verify the sequence belongs to the caller (RLS read) or raise a clean not-found. */
async function requireOwnedSequence(sequenceId: string): Promise<void> {
  const seq = await getSequence(sequenceId);
  if (!seq) throw new EmailSequenceError('sequence not found or not owned');
}

/**
 * Append a step to a sequence the caller owns. Ownership is verified first (clean not-found for a
 * foreign/absent sequence_id); `user_id` is denormalised onto the step so it is directly RLS-scoped.
 * The (sequence_id, step_number) unique index makes re-adding the same ordinal a clean constraint
 * error surfaced as a service error (the coach can renumber).
 */
export async function addEmailStep(input: AddEmailStepInput): Promise<EmailStepRow> {
  await requireOwnedSequence(input.sequence_id);
  const supabase = getUserSupabase();
  const userId = requireUserId();

  const { data, error } = await supabase
    .from(STEPS_TABLE)
    .insert({
      user_id: userId,
      sequence_id: input.sequence_id,
      step_number: input.step_number,
      subject: input.subject,
      body: input.body,
      delay_hours: input.delay_hours ?? 0,
      email_type: input.email_type ?? null,
      trigger_event: input.trigger_event ?? null,
    })
    .select(STEP_COLS)
    .single();

  if (error || !data) {
    throw new EmailSequenceError(
      `failed to add email step: ${error?.message ?? 'no row returned'}`,
      error,
    );
  }
  return data as EmailStepRow;
}

// ── get_sequence_template (PURE prebuilts) ─────────────────────────────────────

/** A prebuilt template step (no DB row — a skeleton the caller can persist via add_email_step). */
export interface TemplateStep {
  step_number: number;
  subject: string;
  body: string;
  delay_hours: number;
  email_type: string;
  trigger_event: string | null;
}

/** Result of getSequenceTemplate. `steps` is empty (with a note) for types that have no prebuilt. */
export interface SequenceTemplate {
  ok: boolean;
  sequence_type: SequenceType;
  steps: TemplateStep[];
  note?: string;
}

/**
 * Deterministic prebuilt skeletons. Copy is generic, on-brand-neutral, and UK English — it makes
 * NO product claims (the caller/coach fills specifics through the claim gate). Delays are in hours
 * from the prior step / trigger. Only welcome / nurture / abandoned_cart have prebuilts (per spec).
 */
const TEMPLATES: Partial<Record<SequenceType, TemplateStep[]>> = {
  welcome: [
    { step_number: 1, subject: 'Welcome — here is what to expect', body: 'Thanks for joining. A quick hello and what you can expect from us.', delay_hours: 0, email_type: 'welcome', trigger_event: 'signup' },
    { step_number: 2, subject: 'The one thing most people miss', body: 'Share the single most useful idea that helps a new subscriber get value fast.', delay_hours: 24, email_type: 'value', trigger_event: null },
    { step_number: 3, subject: 'A quick story', body: 'A short, relatable story that shows the problem you solve and why it matters.', delay_hours: 72, email_type: 'story', trigger_event: null },
    { step_number: 4, subject: 'Proof it works', body: 'Show evidence — a result, a review, or a before/after — without overclaiming.', delay_hours: 120, email_type: 'proof', trigger_event: null },
    { step_number: 5, subject: 'A gentle next step', body: 'Invite the reader to take one clear, low-pressure next step.', delay_hours: 168, email_type: 'offer', trigger_event: null },
  ],
  nurture: [
    { step_number: 1, subject: 'Let us start with the problem', body: 'Name the core problem your reader faces and why it persists.', delay_hours: 0, email_type: 'problem', trigger_event: null },
    { step_number: 2, subject: 'Why the usual fixes fall short', body: 'Explain the common approaches and where they break down.', delay_hours: 48, email_type: 'insight', trigger_event: null },
    { step_number: 3, subject: 'A better way to think about it', body: 'Reframe the problem with your distinctive point of view.', delay_hours: 120, email_type: 'reframe', trigger_event: null },
    { step_number: 4, subject: 'A practical step you can take today', body: 'Give one actionable tip the reader can apply immediately.', delay_hours: 192, email_type: 'value', trigger_event: null },
    { step_number: 5, subject: 'What this looks like in practice', body: 'Walk through a concrete example or mini case study.', delay_hours: 288, email_type: 'story', trigger_event: null },
    { step_number: 6, subject: 'Answering the question you are probably asking', body: 'Address the most common objection or doubt honestly.', delay_hours: 384, email_type: 'objection', trigger_event: null },
    { step_number: 7, subject: 'Ready when you are', body: 'Make a clear, well-earned invitation to the next step.', delay_hours: 504, email_type: 'offer', trigger_event: null },
  ],
  abandoned_cart: [
    { step_number: 1, subject: 'You left something behind', body: 'A friendly nudge reminding the reader what is still in their basket.', delay_hours: 1, email_type: 'reminder', trigger_event: 'cart_abandoned' },
    { step_number: 2, subject: 'Any questions before you decide?', body: 'Offer help and address common reasons people hesitate.', delay_hours: 24, email_type: 'objection', trigger_event: null },
    { step_number: 3, subject: 'Last chance on your basket', body: 'A final reminder with a clear, time-bound reason to complete the order.', delay_hours: 72, email_type: 'urgency', trigger_event: null },
  ],
};

/**
 * Return the prebuilt step skeleton for a sequence type. Pure — no DB, no identity needed. Types
 * without a prebuilt (newsletter / upsell / downsell) return an empty set with a `no_template` note.
 */
export function getSequenceTemplate(sequenceType: SequenceType): SequenceTemplate {
  const steps = TEMPLATES[sequenceType];
  if (!steps || steps.length === 0) {
    return { ok: false, sequence_type: sequenceType, steps: [], note: 'no_template' };
  }
  return { ok: true, sequence_type: sequenceType, steps };
}

// ── list_sequences ─────────────────────────────────────────────────────────────

/** Optional filters for `listSequences`. */
export interface ListSequencesFilter {
  status?: SequenceStatus;
  campaign_id?: string;
}

/** List the caller's sequences (newest-created first), optionally filtered. */
export async function listSequences(
  filter: ListSequencesFilter = {},
): Promise<EmailSequenceRow[]> {
  const supabase = getUserSupabase();
  let query = supabase.from(SEQUENCES_TABLE).select(SEQUENCE_COLS);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.campaign_id) query = query.eq('campaign_id', filter.campaign_id);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    throw new EmailSequenceError(`failed to list email sequences: ${error.message}`, error);
  }
  return (data as EmailSequenceRow[] | null) ?? [];
}

// ── get_sequence_performance ───────────────────────────────────────────────────

/**
 * Performance of a sequence. There is no email-specific metrics table in Alpha; performance is the
 * email-channel metrics of the sequence's linked campaign (opens/clicks/ctr/cvr/revenue), plus the
 * step count. Honest no_data: empty `metrics` + a note when no campaign is linked or it has none.
 */
export interface SequencePerformanceResult {
  ok: boolean;
  sequence: EmailSequenceRow;
  step_count: number;
  metrics: CampaignMetricRow[];
  note?: string;
}

export async function getSequencePerformance(
  sequenceId: string,
): Promise<SequencePerformanceResult> {
  const sequence = await getSequence(sequenceId);
  if (!sequence) throw new EmailSequenceError('sequence not found or not owned');

  const supabase = getUserSupabase();

  const { count, error: countError } = await supabase
    .from(STEPS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('sequence_id', sequenceId);
  if (countError) {
    throw new EmailSequenceError(`failed to count email steps: ${countError.message}`, countError);
  }
  const stepCount = count ?? 0;

  if (!sequence.campaign_id) {
    return { ok: true, sequence, step_count: stepCount, metrics: [], note: 'no_campaign_linked' };
  }

  const { data, error } = await supabase
    .from(METRICS_TABLE)
    .select(METRIC_COLS)
    .eq('campaign_id', sequence.campaign_id)
    .eq('channel', 'email')
    .order('measured_date', { ascending: false });
  if (error) {
    throw new EmailSequenceError(`failed to read sequence metrics: ${error.message}`, error);
  }

  const metrics = (data as CampaignMetricRow[] | null) ?? [];
  return {
    ok: true,
    sequence,
    step_count: stepCount,
    metrics,
    note: metrics.length === 0 ? 'no_data' : undefined,
  };
}
