// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';

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
      'build_avatar_stage',
      'create_avatar',
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
      'get_avatar',
      'get_coach_conversation',
      'get_context_status',
      'get_funnel_audit',
      'health',
      'ingest_evidence',
      'list_assets',
      'list_avatars',
      'list_coach_conversations',
      'list_funnel_inventory',
      'log_asset',
      'onboard_choose',
      'onboard_panel',
      'persist_signature',
      'provide_context',
      'publish_filter_check',
      'record_assessment',
      'record_avatar_build',
      'run_diagnostic_evidence',
      'run_funnel_audit',
      'run_marketing_audit',
      'run_trust_gap',
      'set_context_avatars',
      'set_current_avatar',
      'set_primary_avatar',
      'update_asset_status',
      'upsert_funnel_touchpoint',
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

  it('advertises non-empty server instructions (SERVER_INSTRUCTIONS guard)', async () => {
    const { client } = await connectedClient();
    const instructions = client.getInstructions();
    expect(typeof instructions).toBe('string');
    expect((instructions ?? '').length).toBeGreaterThan(0);
  });
});
