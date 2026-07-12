/**
 * Layer 3 (service) — NATIVE asset ledger over brand-coach's own Supabase storage.
 *
 * Drop-in for the former external (IV-OS) ledger client: implements the same
 * `LedgerClient` capability (LedgerReads + LedgerWrites + LedgerHistoryRead +
 * `configured`) so the tools bind to it unchanged. Backed by `coach_assets`
 * (asset records) + `coach_asset_events` (append-only change log), both RLS-scoped
 * to `user_id = auth.uid()` via the per-request JWT-bound client (supabaseUser.ts) —
 * no service-role, no cross-user bleed. Mirrors the coachConversations service style:
 * untyped `from(...)` chains with local row interfaces (types.ts is stale vs live).
 *
 * Resilience contract (honored verbatim): never throw to the caller. Return
 * `{ available:false, data:<null|[]>, note }` when the caller is anonymous or a DB
 * error occurs; `{ available:true, data:<null|[]> }` when reachable but empty.
 * Writes return a `WriteAck { ok, request_id, report }` with a Markdown report built
 * directly (no external round-trip).
 */
import { getUserSupabase, UnauthenticatedError } from '../supabaseUser.js';
import { safeLog } from '../logging/redact.js';
import type {
  AssetDetail,
  AssetSummary,
  LedgerClient,
  LedgerResult,
  ListAssetsParams,
  LogAssetParams,
  RecordAssessmentParams,
  UpdateAssetStatusParams,
  WriteAck,
} from '../ivos/capabilities.js';

const ASSETS_TABLE = 'coach_assets';
const EVENTS_TABLE = 'coach_asset_events';

const ASSET_COLUMNS =
  'id, content, content_type, status, approval_status, agent_name, prompt, model, tokens_used, campaign_id, external_id, parameters, metadata, performance_metrics, created_at, updated_at';

interface AssetRow {
  id: string;
  content: string;
  content_type: string;
  status: string;
  approval_status: string;
  agent_name: string | null;
  prompt: string | null;
  model: string | null;
  tokens_used: number | null;
  campaign_id: string | null;
  external_id: string | null;
  parameters: unknown;
  metadata: unknown;
  performance_metrics: unknown;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  event_type: string;
  actor: string | null;
  from_status: string | null;
  to_status: string | null;
  verdict: string | null;
  scores: unknown;
  summary: string | null;
  recommendations: string | null;
  notes: string | null;
  created_at: string;
}

function ok<T>(data: T): LedgerResult<T> {
  return { available: true, data };
}
function unavailable<T>(data: T, note: string): LedgerResult<T> {
  return { available: false, data, note };
}

/** Map a row to the public summary shape (defensive coercion, like the old adapter). */
function toSummary(row: AssetRow): AssetSummary {
  return {
    request_id: String(row.id),
    content_type: String(row.content_type ?? 'other'),
    agent_name: String(row.agent_name ?? ''),
    status: String(row.status ?? ''),
    model: String(row.model ?? ''),
    tokens_used: Number(row.tokens_used ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

function toDetail(row: AssetRow): AssetDetail {
  return {
    ...toSummary(row),
    prompt: row.prompt ?? undefined,
    content: row.content ?? undefined,
    parameters: row.parameters ?? undefined,
    metadata: row.metadata ?? undefined,
    performance_metrics: row.performance_metrics ?? undefined,
  };
}

/** Normalize a free-text content_type to the ledger's vocabulary (unknown → 'other').
 *  'model' = a 3D product model (GLB) + its rendered stills, the fidelity reference kit. */
const CONTENT_TYPES = new Set(['blog', 'social', 'amazon', 'competitor', 'model', 'other']);
function normContentType(v: string): string {
  const t = (v ?? '').toLowerCase().trim();
  return CONTENT_TYPES.has(t) ? t : 'other';
}

/** Turn an unexpected error into the never-throw envelope (no PII logged). */
function fail<T>(event: string, err: unknown, empty: T): LedgerResult<T> {
  if (err instanceof UnauthenticatedError) {
    return unavailable(empty, 'authentication required');
  }
  safeLog({ level: 'warn', event, reason: err instanceof Error ? err.name : 'unknown' });
  return unavailable(empty, err instanceof Error ? err.message : 'ledger error');
}

export class NativeLedgerClient implements LedgerClient {
  /** Native storage is always available (Supabase is the app's own backend). */
  get configured(): boolean {
    return true;
  }

  async listAssets(params: ListAssetsParams): Promise<LedgerResult<AssetSummary[]>> {
    try {
      const supabase = getUserSupabase();
      let q = supabase.from(ASSETS_TABLE).select(ASSET_COLUMNS).is('superseded_by', null);
      if (params.content_type) q = q.eq('content_type', normContentType(params.content_type));
      if (params.status) q = q.eq('status', params.status);
      if (params.campaign_id) q = q.eq('campaign_id', params.campaign_id);
      q = q.order('created_at', { ascending: false }).limit(Math.min(params.limit ?? 50, 200));
      const { data, error } = await q;
      if (error) throw error;
      return ok(((data as AssetRow[] | null) ?? []).map(toSummary));
    } catch (err) {
      return fail('ledger.list_assets_failed', err, []);
    }
  }

  async getAsset(requestId: string): Promise<LedgerResult<AssetDetail | null>> {
    try {
      const supabase = getUserSupabase();
      const { data, error } = await supabase
        .from(ASSETS_TABLE)
        .select(ASSET_COLUMNS)
        .eq('id', requestId)
        .maybeSingle();
      if (error) throw error;
      const row = data as AssetRow | null;
      return ok(row ? toDetail(row) : null);
    } catch (err) {
      return fail('ledger.get_asset_failed', err, null);
    }
  }

  async getAssetHistory(requestId: string): Promise<LedgerResult<string | null>> {
    try {
      const supabase = getUserSupabase();
      // RLS-scoped: only the owner sees the asset (and thus its history).
      const { data: assetData, error: assetErr } = await supabase
        .from(ASSETS_TABLE)
        .select('id, content_type, status, approval_status, created_at')
        .eq('id', requestId)
        .maybeSingle();
      if (assetErr) throw assetErr;
      if (!assetData) return ok(null);

      const { data: eventData, error: eventErr } = await supabase
        .from(EVENTS_TABLE)
        .select('event_type, actor, from_status, to_status, verdict, scores, summary, recommendations, notes, created_at')
        .eq('asset_id', requestId)
        .order('created_at', { ascending: true });
      if (eventErr) throw eventErr;

      return ok(renderHistory(requestId, (eventData as EventRow[] | null) ?? []));
    } catch (err) {
      return fail('ledger.get_asset_history_failed', err, null);
    }
  }

  async logAsset(params: LogAssetParams): Promise<LedgerResult<WriteAck | null>> {
    try {
      const supabase = getUserSupabase();

      // Idempotency: if the caller supplies an external_id they've used before, reconcile
      // to the existing asset instead of inserting a duplicate (re-upload safety).
      if (params.external_id) {
        const { data: existing, error: exErr } = await supabase
          .from(ASSETS_TABLE)
          .select('id')
          .eq('external_id', params.external_id)
          .maybeSingle();
        if (exErr) throw exErr;
        if (existing) {
          const id = (existing as { id: string }).id;
          return ok({ ok: true, request_id: id, report: writeReport('Asset Logged (existing)', id, `external_id \`${params.external_id}\` already logged — reconciled.`) });
        }
      }

      const insert = {
        content: params.content,
        content_type: normContentType(params.content_type),
        status: params.status ?? 'success',
        agent_name: params.agent_name ?? null,
        prompt: params.prompt ?? null,
        model: params.model ?? null,
        campaign_id: params.campaign_id ?? null,
        external_id: params.external_id ?? null,
        // user_id defaults to auth.uid() in the DB; RLS insert-check enforces it.
      };
      const { data, error } = await supabase.from(ASSETS_TABLE).insert(insert).select('id').single();
      if (error) throw error;
      const id = (data as { id: string }).id;

      await this.appendEvent(supabase, id, {
        event_type: 'logged',
        actor: params.agent_name ?? null,
        to_status: insert.status,
      });

      return ok({ ok: true, request_id: id, report: writeReport('Asset Logged', id, `content_type: ${insert.content_type}, status: ${insert.status}`) });
    } catch (err) {
      return fail('ledger.log_asset_failed', err, null);
    }
  }

  async updateAssetStatus(params: UpdateAssetStatusParams): Promise<LedgerResult<WriteAck | null>> {
    try {
      const supabase = getUserSupabase();
      const { data: current, error: curErr } = await supabase
        .from(ASSETS_TABLE)
        .select('id, approval_status')
        .eq('id', params.request_id)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!current) {
        return ok({ ok: false, request_id: params.request_id, report: writeReport('Asset Not Found', params.request_id, 'no such asset for this caller') });
      }
      const from = (current as { approval_status: string }).approval_status;

      const { error: updErr } = await supabase
        .from(ASSETS_TABLE)
        .update({ approval_status: params.approval_status })
        .eq('id', params.request_id);
      if (updErr) throw updErr;

      await this.appendEvent(supabase, params.request_id, {
        event_type: 'status_change',
        actor: params.reviewer_id ?? null,
        from_status: from,
        to_status: params.approval_status,
        notes: params.notes ?? null,
      });

      return ok({ ok: true, request_id: params.request_id, report: writeReport('Asset Status Updated', params.request_id, `${from} → ${params.approval_status}`) });
    } catch (err) {
      return fail('ledger.update_asset_status_failed', err, null);
    }
  }

  async recordAssessment(params: RecordAssessmentParams): Promise<LedgerResult<WriteAck | null>> {
    try {
      const supabase = getUserSupabase();
      const { data: current, error: curErr } = await supabase
        .from(ASSETS_TABLE)
        .select('id')
        .eq('id', params.request_id)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!current) {
        return ok({ ok: false, request_id: params.request_id, report: writeReport('Asset Not Found', params.request_id, 'no such asset for this caller') });
      }

      // Advisory: assessments never mutate the approval lifecycle — append only.
      await this.appendEvent(supabase, params.request_id, {
        event_type: 'assessment',
        actor: params.assessed_by ?? null,
        verdict: params.verdict,
        scores: params.scores ?? null,
        summary: params.summary ?? null,
        recommendations: params.recommendations ?? null,
      });

      return ok({ ok: true, request_id: params.request_id, report: writeReport('Assessment Recorded', params.request_id, `verdict: ${params.verdict}`) });
    } catch (err) {
      return fail('ledger.record_assessment_failed', err, null);
    }
  }

  /** Append one append-only history event (user_id defaults to auth.uid() in the DB). */
  private async appendEvent(
    supabase: ReturnType<typeof getUserSupabase>,
    assetId: string,
    event: {
      event_type: string;
      actor?: string | null;
      from_status?: string | null;
      to_status?: string | null;
      verdict?: string | null;
      scores?: unknown;
      summary?: string | null;
      recommendations?: string | null;
      notes?: string | null;
    },
  ): Promise<void> {
    const { error } = await supabase.from(EVENTS_TABLE).insert({ asset_id: assetId, ...event });
    if (error) {
      // History is non-critical to the write's success; log and continue.
      safeLog({ level: 'warn', event: 'ledger.append_event_failed', reason: error.name ?? 'unknown' });
    }
  }
}

/** Build the Markdown report a WriteAck carries (mirrors the canonical report headers). */
function writeReport(header: string, requestId: string, detail: string): string {
  return `# ${header}\n\n**request_id:** \`${requestId}\`\n\n${detail}`;
}

/** Render the append-only change log as a Markdown report (get_asset_history contract). */
function renderHistory(requestId: string, events: EventRow[]): string {
  const lines: string[] = [`# Asset Change Log — \`${requestId}\``, ''];
  if (events.length === 0) {
    lines.push('_No history events recorded yet._');
    return lines.join('\n');
  }
  for (const e of events) {
    const when = e.created_at;
    const by = e.actor ? ` by \`${e.actor}\`` : '';
    if (e.event_type === 'logged') {
      lines.push(`- **${when}** · logged${by}${e.to_status ? ` (status: ${e.to_status})` : ''}`);
    } else if (e.event_type === 'status_change') {
      lines.push(`- **${when}** · status \`${e.from_status ?? '?'}\` → \`${e.to_status ?? '?'}\`${by}${e.notes ? ` — ${e.notes}` : ''}`);
    } else if (e.event_type === 'assessment') {
      const scores = e.scores && typeof e.scores === 'object' ? ` (scores: ${JSON.stringify(e.scores)})` : '';
      lines.push(`- **${when}** · assessment \`${e.verdict ?? '?'}\`${by}${e.summary ? ` — ${e.summary}` : ''}${scores}`);
      if (e.recommendations) lines.push(`    - recommendations: ${e.recommendations}`);
    } else {
      lines.push(`- **${when}** · ${e.event_type}${by}`);
    }
  }
  return lines.join('\n');
}
