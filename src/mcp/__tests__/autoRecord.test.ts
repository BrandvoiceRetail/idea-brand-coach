// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import type { LogAssetParams, RecordAssessmentParams, WriteAck, LedgerResult } from '../ivos/capabilities.js';
import { runWithIdentity } from '../context/identity.js';

const cfg: HostConfig = {
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  slackBotToken: null,
  slackFeedbackChannelId: 'C0TEST',
};

const authed = { userId: 'user-1', token: 'tok', authenticated: true };

const DRAFT_ARGS = {
  productName: 'Infinity Binder',
  category: 'TCG accessories',
  features: ['side-loading'],
  targetAudience: 'collectors',
  emotionalPayoff: 'pride of a protected collection',
  tone: 'confident',
  format: 'social_post',
};

function stubEdgeFn(): EdgeFnClient {
  return {
    invoke: async <T>(): Promise<EdgeFnResult<T>> => ({
      ok: true,
      data: { copy: 'Drafted copy.', hasUserContext: true, format: 'social_post' } as T,
    }),
  } as unknown as EdgeFnClient;
}

/** Capturing ledger stub; `writeOk` controls whether writes ack or degrade. */
function stubIvos(writeOk = true) {
  const calls: { logAsset: LogAssetParams[]; recordAssessment: RecordAssessmentParams[] } = {
    logAsset: [],
    recordAssessment: [],
  };
  const ack = (id: string): LedgerResult<WriteAck | null> =>
    writeOk
      ? { available: true, data: { ok: true, request_id: id, report: 'ok' } }
      : { available: false, data: null, note: 'IV-OS unreachable' };
  const client = {
    logAsset: async (p: LogAssetParams) => {
      calls.logAsset.push(p);
      return ack('req-123');
    },
    recordAssessment: async (p: RecordAssessmentParams) => {
      calls.recordAssessment.push(p);
      return ack(p.request_id);
    },
  } as unknown as IvosLedgerClient;
  return { client, calls };
}

async function connectedClient(ivos: IvosLedgerClient) {
  const { server } = createServer(cfg, stubEdgeFn(), ivos);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

describe('chain auto-recording (produce -> record in one call)', () => {
  it('draft_asset auto-records via log_asset with attributed actor', async () => {
    const { client: ivos, calls } = stubIvos();
    const client = await connectedClient(ivos);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'draft_asset', arguments: { ...DRAFT_ARGS, campaign_id: 'camp-1' } }),
    );
    const sc = res.structuredContent as { ok: boolean; recorded: { ok: boolean; request_id: string } };
    expect(sc.ok).toBe(true);
    expect(sc.recorded).toEqual({ ok: true, request_id: 'req-123' });
    expect(calls.logAsset).toHaveLength(1);
    const w = calls.logAsset[0];
    expect(w.content).toBe('Drafted copy.');
    expect(w.content_type).toBe('social_post');
    expect(w.agent_name).toMatch(/^brand-coach-mcp:u_/);
    expect(w.agent_name).not.toContain('user-1'); // non-reversible attribution
    expect(w.status).toBe('success');
    expect(w.campaign_id).toBe('camp-1');
  });

  it('draft_asset record:false opts out of recording', async () => {
    const { client: ivos, calls } = stubIvos();
    const client = await connectedClient(ivos);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'draft_asset', arguments: { ...DRAFT_ARGS, record: false } }),
    );
    const sc = res.structuredContent as { ok: boolean; recorded: { ok: boolean; note: string } };
    expect(sc.ok).toBe(true);
    expect(calls.logAsset).toHaveLength(0);
    expect(sc.recorded.ok).toBe(false);
    expect(sc.recorded.note).toMatch(/opt-out/i);
  });

  it('draft_asset never fails on a degraded ledger write', async () => {
    const { client: ivos } = stubIvos(false);
    const client = await connectedClient(ivos);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'draft_asset', arguments: DRAFT_ARGS }),
    );
    const sc = res.structuredContent as { ok: boolean; copy: string; recorded: { ok: boolean; note: string } };
    expect(sc.ok).toBe(true); // the draft itself succeeds
    expect(sc.copy).toBe('Drafted copy.');
    expect(sc.recorded.ok).toBe(false);
    expect(sc.recorded.note).toMatch(/unreachable|degraded/i);
  });

  it('publish_filter_check records the mapped verdict (warn -> needs_work) with actor', async () => {
    const { client: ivos, calls } = stubIvos();
    const client = await connectedClient(ivos);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'publish_filter_check',
        arguments: { content: 'The best binder you will ever own, full stop.', request_id: 'req-9' },
      }),
    );
    const sc = res.structuredContent as { verdict: string; recorded: { ok: boolean; request_id: string } };
    expect(sc.verdict).toBe('warn');
    expect(sc.recorded).toEqual({ ok: true, request_id: 'req-9' });
    expect(calls.recordAssessment).toHaveLength(1);
    const a = calls.recordAssessment[0];
    expect(a.verdict).toBe('needs_work');
    expect(a.assessed_by).toMatch(/^brand-coach-mcp:u_/);
    expect(a.summary).toContain('unsubstantiated-superlative');
  });

  it('publish_filter_check denies recording for anonymous callers but still grades', async () => {
    const { client: ivos, calls } = stubIvos();
    const client = await connectedClient(ivos);
    const res = await client.callTool({
      name: 'publish_filter_check',
      arguments: { content: 'A thoughtfully designed binder for organized collections.', request_id: 'req-9' },
    });
    const sc = res.structuredContent as { verdict: string; recorded: { ok: boolean; note: string } };
    expect(sc.verdict).toBe('pass');
    expect(calls.recordAssessment).toHaveLength(0);
    expect(sc.recorded.ok).toBe(false);
    expect(sc.recorded.note).toMatch(/unauthenticated/i);
  });

  it('publish_filter_check without request_id records nothing and omits recorded', async () => {
    const { client: ivos, calls } = stubIvos();
    const client = await connectedClient(ivos);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'publish_filter_check', arguments: { content: 'Clean honest copy about a binder.' } }),
    );
    const sc = res.structuredContent as { recorded?: unknown };
    expect(calls.recordAssessment).toHaveLength(0);
    expect(sc.recorded).toBeUndefined();
  });
});
