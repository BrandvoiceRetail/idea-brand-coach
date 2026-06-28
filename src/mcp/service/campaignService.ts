/**
 * Layer 1 (service) — campaign CRUD over the RLS-bound user client.
 *
 * The CRUD spine the campaign tools (create_campaign / get_campaign / list_campaigns /
 * update_campaign_status) wrap. Every write runs on the JWT-bound client so RLS scopes rows
 * to `auth.uid()`; `brand_id` is resolved SERVER-SIDE (avatarOwnership.resolveBrandId) and
 * stamped here — never accepted from a caller (a caller cannot plant a campaign under a foreign
 * brand). `campaign_metrics` are NOT touched here (append-only ingestion is a separate service).
 *
 * Row/insert shapes + the channel/status vocab are the SSOT in `campaignTypes.ts` (mirrors the
 * SQL CHECK constraints in migration 20260626000000_campaign_analytics.sql). The generated
 * `src/integrations/supabase/types.ts` is NEVER hand-edited; we call `from('campaigns')` on
 * untyped chains and coerce into these interfaces (matches the nativeLedger / avatarLifecycle
 * house pattern).
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { resolveBrandId } from './avatarOwnership.js';
import type {
  CampaignChannel,
  CampaignRow,
  CampaignStatus,
} from './campaignTypes.js';

const CAMPAIGNS_TABLE = 'campaigns';
const CAMPAIGN_COLS =
  'id, user_id, brand_id, name, channel, status, description, created_at, updated_at';

/** Raised when a campaign DB call fails. */
export class CampaignServiceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'CampaignServiceError';
  }
}

function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new CampaignServiceError('no authenticated user id in scope');
  return userId;
}

/** Caller-supplied fields for a new campaign (brand_id is server-resolved, never input). */
export interface CreateCampaignInput {
  name: string;
  channel: CampaignChannel;
  status?: CampaignStatus;
  description?: string | null;
}

/**
 * Create a campaign under the caller's brand. `brand_id` is resolved server-side and stamped;
 * `user_id` is stamped explicitly so the row is valid (RLS also enforces it = auth.uid()).
 */
export async function createCampaign(input: CreateCampaignInput): Promise<CampaignRow> {
  const supabase = getUserSupabase();
  const userId = requireUserId();
  const brandId = await resolveBrandId();

  const { data, error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .insert({
      user_id: userId,
      brand_id: brandId,
      name: input.name,
      channel: input.channel,
      status: input.status ?? 'draft',
      description: input.description ?? null,
    })
    .select(CAMPAIGN_COLS)
    .single();

  if (error || !data) {
    throw new CampaignServiceError(
      `failed to create campaign: ${error?.message ?? 'no row returned'}`,
      error,
    );
  }
  return data as CampaignRow;
}

/** Read one campaign by id (RLS-scoped), or `null` if it isn't the caller's / absent. */
export async function getCampaign(campaignId: string): Promise<CampaignRow | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .select(CAMPAIGN_COLS)
    .eq('id', campaignId)
    .maybeSingle();

  if (error) {
    throw new CampaignServiceError(`failed to read campaign: ${error.message}`, error);
  }
  return (data as CampaignRow | null) ?? null;
}

/** Optional filters for `listCampaigns` (status narrows the index-aligned scan). */
export interface ListCampaignsFilter {
  status?: CampaignStatus;
}

/** List the caller's campaigns (newest-created first), optionally filtered by status. */
export async function listCampaigns(filter: ListCampaignsFilter = {}): Promise<CampaignRow[]> {
  const supabase = getUserSupabase();
  let query = supabase.from(CAMPAIGNS_TABLE).select(CAMPAIGN_COLS);
  if (filter.status) query = query.eq('status', filter.status);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new CampaignServiceError(`failed to list campaigns: ${error.message}`, error);
  }
  return (data as CampaignRow[] | null) ?? [];
}

/**
 * Flip a campaign's lifecycle status (the only mutable field — campaigns are status-driven,
 * never hard-deleted). RLS re-checks ownership on the UPDATE; an absent/foreign id resolves to
 * zero rows and returns `null` (the tool surfaces a not-found, not a silent success).
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
): Promise<CampaignRow | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .update({ status })
    .eq('id', campaignId)
    .select(CAMPAIGN_COLS)
    .maybeSingle();

  if (error) {
    throw new CampaignServiceError(`failed to update campaign status: ${error.message}`, error);
  }
  return (data as CampaignRow | null) ?? null;
}
