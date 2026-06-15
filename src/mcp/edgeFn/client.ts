/**
 * Supabase edge-function client for the MCP host (Calculation Parity seam).
 *
 * Owned tools wrap the EXISTING edge fns verbatim — this client is the single
 * transport they share. It forwards the BOUND caller identity (Supabase JWT from
 * AsyncLocalStorage — never from tool args) and degrades gracefully: anonymous
 * callers and unreachable functions yield `{ ok:false, note }`, never a throw.
 * `fetchImpl` is injectable for tests.
 */
import { loadConfig, type HostConfig } from '../config.js';
import { getIdentity, userTag } from '../context/identity.js';
import { safeLog } from '../logging/redact.js';

export interface EdgeFnResult<T> {
  ok: boolean;
  data: T | null;
  note?: string;
}

export class EdgeFnClient {
  constructor(
    private readonly config: Pick<HostConfig, 'supabaseUrl' | 'supabaseAnonKey'> = loadConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async invoke<T>(name: string, body: unknown): Promise<EdgeFnResult<T>> {
    const identity = getIdentity();
    if (!identity.authenticated || !identity.token) {
      return { ok: false, data: null, note: 'authentication required (Supabase JWT bearer)' };
    }
    try {
      const res = await this.fetchImpl(`${this.config.supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${identity.token}`,
          apikey: this.config.supabaseAnonKey,
        },
        body: JSON.stringify(body),
      });
      safeLog({ event: 'edgefn.invoke', fn: name, caller: userTag(identity), status: res.status });
      if (!res.ok) {
        return { ok: false, data: null, note: `edge function ${name} failed (HTTP ${res.status})` };
      }
      return { ok: true, data: (await res.json()) as T };
    } catch {
      safeLog({ level: 'warn', event: 'edgefn.unreachable', fn: name });
      return { ok: false, data: null, note: `edge function ${name} unreachable` };
    }
  }
}
