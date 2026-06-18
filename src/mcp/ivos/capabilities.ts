/**
 * IV-OS consumption — capability interface.
 *
 * Brand-coach consumes IV-OS; it never reimplements the ledger. Bound here: the two
 * STABLE ledger READS (`list_assets`, `get_asset`), the asset-tracking WRITES
 * (`log_asset`, `update_asset_status`, `record_assessment`), and the change-log read
 * (`get_asset_history`).
 *
 * D5 (cross-server write auth) — RESOLVED: IV-OS is single-tenant/no-auth (its ADR
 * 0001), so server-to-server uses the optional `IVOS_MCP_TOKEN` bearer (forward-compat
 * no-op today). Caller accountability lives at THIS gateway instead: write tools
 * require an authenticated Supabase identity (no anonymous writes) and forward the
 * non-reversible caller tag (`brand-coach-mcp:<userTag>`) as the ledger actor.
 *
 * Still PROVISIONAL (capability-only, deliberately unbound): the test-ledger writes
 * (`record_test`, `get_test_result`) and the knowledge reads (canon/product/funnel).
 */

export interface AssetSummary {
  request_id: string;
  content_type: string;
  agent_name: string;
  status: string;
  model: string;
  tokens_used: number;
  created_at: string;
}

export interface AssetDetail extends AssetSummary {
  prompt?: string;
  content?: string;
  parameters?: unknown;
  metadata?: unknown;
  performance_metrics?: unknown;
}

export interface ListAssetsParams {
  content_type?: string;
  status?: string;
  campaign_id?: string;
  limit?: number;
}

/**
 * Every consumed read resolves to this envelope so callers never need a try/catch:
 * `available:false` means IV-OS is unconfigured/unreachable (with a human `note`),
 * `available:true` with an empty payload means the ledger is reachable but empty.
 */
export interface LedgerResult<T> {
  available: boolean;
  data: T;
  note?: string;
}

/** The STABLE ledger-read capability the host binds today. */
export interface LedgerReads {
  listAssets(params: ListAssetsParams): Promise<LedgerResult<AssetSummary[]>>;
  getAsset(requestId: string): Promise<LedgerResult<AssetDetail | null>>;
}

export interface LogAssetParams {
  content: string;
  content_type: string; // blog|social|amazon|competitor|other (unknowns coerced to 'other')
  agent_name?: string;
  prompt?: string;
  model?: string;
  status?: string; // success|partial|failed|pending
  campaign_id?: string;
  /** Caller-supplied idempotency/dedup key: re-logging the same external_id reconciles to the existing asset. */
  external_id?: string;
}

export interface UpdateAssetStatusParams {
  request_id: string;
  approval_status: 'draft' | 'in_review' | 'approved' | 'rejected';
  reviewer_id?: string;
  notes?: string;
}

export interface RecordAssessmentParams {
  request_id: string;
  verdict: 'pass' | 'needs_work' | 'fail';
  assessed_by?: string;
  summary?: string;
  scores?: Record<string, number>;
  recommendations?: string;
}

/**
 * Acknowledgement for a consumed IV-OS write. IV-OS tools answer in canonical
 * Markdown (its tested report contract); we forward that verbatim as `report`
 * and extract the minimal machine-readable facts (`ok`, `request_id`) from it.
 */
export interface WriteAck {
  ok: boolean;
  /** The asset's request_id when the report confirms one (always set on log_asset success). */
  request_id: string | null;
  /** The authoritative IV-OS Markdown report. */
  report: string;
}

/** The asset-tracking WRITE capability (D5 resolved — see header). */
export interface LedgerWrites {
  logAsset(params: LogAssetParams): Promise<LedgerResult<WriteAck | null>>;
  updateAssetStatus(params: UpdateAssetStatusParams): Promise<LedgerResult<WriteAck | null>>;
  recordAssessment(params: RecordAssessmentParams): Promise<LedgerResult<WriteAck | null>>;
}

/** The asset change-log read (markdown report passed through verbatim). */
export interface LedgerHistoryRead {
  getAssetHistory(requestId: string): Promise<LedgerResult<string | null>>;
}

/**
 * The full asset-ledger capability the host binds to its tools. Tools type on THIS
 * interface, not on any concrete client, so the backing implementation is swappable
 * (native Supabase-backed `NativeLedgerClient`, or a remote adapter). `configured`
 * reports whether the backend is usable (the health probe surfaces it).
 */
export type LedgerClient = LedgerReads & LedgerWrites & LedgerHistoryRead & {
  readonly configured: boolean;
};

/** Marker list of capabilities intentionally deferred (documentation, not bound). */
export const DEFERRED_IVOS_CAPABILITIES = [
  'record_test (PROVISIONAL — test ledger, next initiative)',
  'get_test_result (PROVISIONAL)',
  'brand-canon reads (PROVISIONAL — IV-OS tools shipped; binding is a later slice)',
  'product-truth reads (PROVISIONAL)',
  'funnel reads (PROVISIONAL)',
] as const;
