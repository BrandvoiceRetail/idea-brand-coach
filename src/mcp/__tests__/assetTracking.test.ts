// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';
import { IvosLedgerClient } from '../ivos/client.js';
import { runWithIdentity, ANONYMOUS, type Identity } from '../context/identity.js';
import { actorTag, gateWrite } from '../tools/writeAuth.js';

const cfg: HostConfig = {
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  slackBotToken: null,
  slackFeedbackChannelId: 'C0TEST',
};

const authed: Identity = { userId: 'user-1', token: 'tok', authenticated: true };

async function connectedClient() {
  const { server } = createServer(cfg);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client };
}

describe('writeAuth (D5 gate)', () => {
  it('denies writes outside any identity scope', () => {
    const { denied } = gateWrite();
    expect(denied).not.toBeNull();
    expect(denied?.isError).toBe(true);
  });

  it('allows writes for authenticated identities and tags the actor', async () => {
    await runWithIdentity(authed, async () => {
      const { identity, denied } = gateWrite();
      expect(denied).toBeNull();
      expect(identity.authenticated).toBe(true);
      const tag = actorTag(identity);
      expect(tag).toMatch(/^brand-coach-mcp:u_/);
      expect(tag).not.toContain('user-1'); // non-reversible — no raw user id
    });
  });
});

describe('IvosLedgerClient write/history adapter (resilience)', () => {
  it('writes report unavailable when IV-OS is unconfigured', async () => {
    const c = new IvosLedgerClient({ ivosMcpUrl: null, ivosMcpToken: null });
    const log = await c.logAsset({ content: 'copy', content_type: 'social' });
    expect(log.available).toBe(false);
    expect(log.data).toBeNull();
    expect(log.note).toMatch(/not configured/i);

    const status = await c.updateAssetStatus({ request_id: 'r1', approval_status: 'in_review' });
    expect(status.available).toBe(false);

    const assess = await c.recordAssessment({ request_id: 'r1', verdict: 'pass' });
    expect(assess.available).toBe(false);

    const history = await c.getAssetHistory('r1');
    expect(history.available).toBe(false);
    expect(history.data).toBeNull();
  });
});

describe('asset-tracking tools (end-to-end via in-memory transport)', () => {
  it('log_asset denies anonymous callers before touching IV-OS', async () => {
    const { client } = await connectedClient();
    const res = await client.callTool({ name: 'log_asset', arguments: { content: 'x', content_type: 'social' } });
    const sc = res.structuredContent as { ok: boolean; note?: string };
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('update_asset_status and record_assessment deny anonymous callers', async () => {
    const { client } = await connectedClient();
    for (const call of [
      { name: 'update_asset_status', arguments: { request_id: 'r1', approval_status: 'approved' } },
      { name: 'record_assessment', arguments: { request_id: 'r1', verdict: 'pass' } },
    ]) {
      const res = await client.callTool(call);
      const sc = res.structuredContent as { ok: boolean; note?: string };
      expect(sc.ok).toBe(false);
      expect(sc.note).toMatch(/unauthenticated/i);
    }
  });

  it('authenticated write proceeds past the gate and degrades gracefully without IV-OS', async () => {
    const { client } = await connectedClient();
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'log_asset', arguments: { content: 'x', content_type: 'social' } }),
    );
    const sc = res.structuredContent as { available: boolean; ok: boolean; note?: string };
    expect(sc.available).toBe(false); // IV-OS unconfigured — but NOT an auth denial
    expect(sc.note).not.toMatch(/unauthenticated/i);
  });

  it('get_asset_history is read-open and degrades gracefully without IV-OS', async () => {
    const { client } = await connectedClient();
    const res = await client.callTool({ name: 'get_asset_history', arguments: { request_id: 'r1' } });
    const sc = res.structuredContent as { available: boolean; report: string | null };
    expect(sc.available).toBe(false);
    expect(sc.report).toBeNull();
  });

  it('identity scope is torn down after a gated call (no bleed)', async () => {
    await runWithIdentity(authed, async () => {
      expect(gateWrite().denied).toBeNull();
    });
    expect(gateWrite().denied).not.toBeNull();
    expect(ANONYMOUS.authenticated).toBe(false);
  });
});
