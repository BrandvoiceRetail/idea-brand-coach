// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';
import { runWithIdentity } from '../context/identity.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimal chainable Supabase stub for the funnel read tools. */
function stubSupabase(rows: unknown[]): SupabaseClient {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.is = () => builder;
  builder.order = () => builder;
  builder.limit = () => Promise.resolve({ data: rows, error: null });
  // resolving the builder itself (no .limit/.single) returns the rows too
  (builder as { then?: unknown }).then = (res: (v: unknown) => unknown) => res({ data: rows, error: null });
  return { from: () => builder } as unknown as SupabaseClient;
}

const cfg: HostConfig = {
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
};

async function connectedClient() {
  const { server } = createServer(cfg);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client };
}

describe('brand-coach MCP server (end-to-end via in-memory transport)', () => {
  it('advertises exactly the gateway + consumed IV-OS asset-tracking + owned chain tools', async () => {
    const { client } = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'audit_asset',
      'build_avatar_stage',
      'design_test',
      'draft_asset',
      'export_workbook',
      'generate_audit_idea_map',
      'generate_brief',
      'generate_canvas',
      'generate_concepts',
      'generate_signature',
      'get_asset',
      'get_asset_history',
      'get_context_status',
      'get_funnel_assets',
      'get_funnel_coverage',
      'health',
      'ingest_evidence',
      'list_assets',
      'log_asset',
      'onboard_choose',
      'onboard_panel',
      'persist_signature',
      'provide_context',
      'publish_filter_check',
      'record_assessment',
      'run_diagnostic_evidence',
      'run_marketing_audit',
      'run_trust_gap',
      'update_asset_status',
    ]);
  });

  it('health returns status ok and ivosConfigured=false when IV-OS is unset', async () => {
    const { client } = await connectedClient();
    const res = await client.callTool({ name: 'health', arguments: {} });
    const sc = res.structuredContent as { status: string; ivosConfigured: boolean };
    expect(sc.status).toBe('ok');
    expect(sc.ivosConfigured).toBe(false);
  });

  it('list_assets degrades gracefully (available=false) without IV-OS', async () => {
    const { client } = await connectedClient();
    const res = await client.callTool({ name: 'list_assets', arguments: {} });
    const sc = res.structuredContent as { available: boolean; assets: unknown[] };
    expect(sc.available).toBe(false);
    expect(sc.assets).toEqual([]);
  });

  it("get_funnel_assets returns the caller's assets (RLS, mocked client)", async () => {
    __setUserSupabaseFactory(() => stubSupabase([
      { id: 'a1', touchpoint_id: 'amazon_main_image', stage: 'awareness', status: 'misaligned', overall_score: 48, audit_result: { grounding: { fields_used: 7 } } },
    ]));
    try {
      const { client } = await connectedClient();
      const res = await runWithIdentity({ userId: 'u1', token: 't1', authenticated: true }, () =>
        client.callTool({ name: 'get_funnel_assets', arguments: { avatar_id: 'av1' } }));
      const sc = res.structuredContent as { ok: boolean; assets: Array<{ status: string; fields_used: number | null }> };
      expect(sc.ok).toBe(true);
      expect(sc.assets).toHaveLength(1);
      expect(sc.assets[0].status).toBe('misaligned');
      expect(sc.assets[0].fields_used).toBe(7);
    } finally {
      __setUserSupabaseFactory(null);
    }
  });

  it('get_funnel_assets denies an anonymous caller (identity gate)', async () => {
    const { client } = await connectedClient();
    const res = await client.callTool({ name: 'get_funnel_assets', arguments: { avatar_id: 'av1' } });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(sc.ok).toBe(false);
    expect(sc.note).toBe('unauthenticated');
  });

  it('advertises non-empty server instructions (SERVER_INSTRUCTIONS guard)', async () => {
    const { client } = await connectedClient();
    const instructions = client.getInstructions();
    expect(typeof instructions).toBe('string');
    expect((instructions ?? '').length).toBeGreaterThan(0);
  });
});
