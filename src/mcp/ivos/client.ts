/**
 * IV-OS MCP client adapter — implements the STABLE ledger-read capability by calling
 * the IV-OS Marketing MCP (Python FastMCP) over streamable HTTP.
 *
 * Resilience contract: this adapter never throws to its caller. If IV-OS is
 * unconfigured (no `IVOS_MCP_URL`), unreachable, or errors, it returns
 * `{ available:false, note }`. A reachable-but-empty ledger returns
 * `{ available:true, data:[] }`. IV-OS is not yet deployed to a reachable endpoint,
 * so the live path is structurally wired but exercised only once IV-OS ships; the
 * unit tests cover the degradation + envelope contract.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { HostConfig } from '../config.js';
import { SERVER_NAME, SERVER_VERSION } from '../config.js';
import { safeLog } from '../logging/redact.js';
import type {
  AssetDetail,
  AssetSummary,
  LedgerHistoryRead,
  LedgerReads,
  LedgerResult,
  LedgerWrites,
  ListAssetsParams,
  LogAssetParams,
  RecordAssessmentParams,
  UpdateAssetStatusParams,
  WriteAck,
} from './capabilities.js';

const UNAVAILABLE = (note: string): LedgerResult<never[]> => ({ available: false, data: [], note });

// IV-OS tools answer in a canonical Markdown report contract (covered by IV-OS's
// own unit tests). These extract the minimal machine-readable facts from a write
// acknowledgement; the full report is always forwarded verbatim.
const REQUEST_ID_RE = /\*\*request_id:\*\*\s*`([^`]+)`/;
const WRITE_OK_RE = /^# (Asset Logged|Asset Status Updated|Assessment Recorded)/m;

/** Concatenated text content from an MCP tool result (the markdown report). */
function textFrom(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');
}

function toWriteAck(report: string): WriteAck {
  return {
    ok: WRITE_OK_RE.test(report),
    request_id: REQUEST_ID_RE.exec(report)?.[1] ?? null,
    report,
  };
}

/** Best-effort extraction of structured rows from an MCP tool result. */
function rowsFrom(result: unknown): Record<string, unknown>[] | null {
  const r = result as { structuredContent?: unknown; content?: unknown };
  const sc = r?.structuredContent as { assets?: unknown } | unknown[] | undefined;
  if (Array.isArray(sc)) return sc as Record<string, unknown>[];
  if (sc && Array.isArray((sc as { assets?: unknown }).assets)) {
    return (sc as { assets: Record<string, unknown>[] }).assets;
  }
  return null;
}

function toSummary(row: Record<string, unknown>): AssetSummary {
  return {
    request_id: String(row.request_id ?? ''),
    content_type: String(row.content_type ?? ''),
    agent_name: String(row.agent_name ?? ''),
    status: String(row.status ?? ''),
    model: String(row.model ?? ''),
    tokens_used: Number(row.tokens_used ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

export class IvosLedgerClient implements LedgerReads, LedgerWrites, LedgerHistoryRead {
  constructor(private readonly config: Pick<HostConfig, 'ivosMcpUrl' | 'ivosMcpToken'>) {}

  get configured(): boolean {
    return Boolean(this.config.ivosMcpUrl);
  }

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T | { __unavailable: string }> {
    if (!this.config.ivosMcpUrl) return { __unavailable: 'IV-OS endpoint not configured (set IVOS_MCP_URL)' };
    const client = new Client({ name: `${SERVER_NAME}-ivos-consumer`, version: SERVER_VERSION });
    const requestInit = this.config.ivosMcpToken
      ? { headers: { Authorization: `Bearer ${this.config.ivosMcpToken}` } }
      : undefined;
    const transport = new StreamableHTTPClientTransport(new URL(this.config.ivosMcpUrl), { requestInit });
    try {
      await client.connect(transport);
      return await fn(client);
    } catch (err) {
      safeLog({ level: 'warn', event: 'ivos.call_failed', reason: err instanceof Error ? err.name : 'unknown' });
      return { __unavailable: 'IV-OS unreachable' };
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  async listAssets(params: ListAssetsParams): Promise<LedgerResult<AssetSummary[]>> {
    const res = await this.withClient((c) => c.callTool({ name: 'list_assets', arguments: { ...params } }));
    if (res && typeof res === 'object' && '__unavailable' in res) {
      return UNAVAILABLE((res as { __unavailable: string }).__unavailable);
    }
    const rows = rowsFrom(res);
    return { available: true, data: rows ? rows.map(toSummary) : [], note: rows ? undefined : 'no structured rows returned' };
  }

  async getAsset(requestId: string): Promise<LedgerResult<AssetDetail | null>> {
    const res = await this.withClient((c) => c.callTool({ name: 'get_asset', arguments: { request_id: requestId } }));
    if (res && typeof res === 'object' && '__unavailable' in res) {
      return { available: false, data: null, note: (res as { __unavailable: string }).__unavailable };
    }
    const rows = rowsFrom(res);
    const row = rows?.[0] ?? ((res as { structuredContent?: Record<string, unknown> })?.structuredContent ?? null);
    return { available: true, data: row ? (toSummary(row as Record<string, unknown>) as AssetDetail) : null };
  }

  /** Shared shape for the three consumed writes: call tool → forward report + ack. */
  private async write(tool: string, args: Record<string, unknown>): Promise<LedgerResult<WriteAck | null>> {
    const res = await this.withClient((c) => c.callTool({ name: tool, arguments: args }));
    if (res && typeof res === 'object' && '__unavailable' in res) {
      return { available: false, data: null, note: (res as { __unavailable: string }).__unavailable };
    }
    return { available: true, data: toWriteAck(textFrom(res)) };
  }

  async logAsset(params: LogAssetParams): Promise<LedgerResult<WriteAck | null>> {
    return this.write('log_asset', { ...params });
  }

  async updateAssetStatus(params: UpdateAssetStatusParams): Promise<LedgerResult<WriteAck | null>> {
    return this.write('update_asset_status', { ...params });
  }

  async recordAssessment(params: RecordAssessmentParams): Promise<LedgerResult<WriteAck | null>> {
    return this.write('record_assessment', { ...params });
  }

  async getAssetHistory(requestId: string): Promise<LedgerResult<string | null>> {
    const res = await this.withClient((c) =>
      c.callTool({ name: 'get_asset_history', arguments: { request_id: requestId } }),
    );
    if (res && typeof res === 'object' && '__unavailable' in res) {
      return { available: false, data: null, note: (res as { __unavailable: string }).__unavailable };
    }
    const report = textFrom(res);
    return { available: true, data: report || null, note: report ? undefined : 'empty report' };
  }
}
