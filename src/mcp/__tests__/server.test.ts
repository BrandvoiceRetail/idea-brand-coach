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
  slackBotToken: null,
  slackFeedbackChannelId: 'C0TEST',
  mcpPublicUrl: 'https://app.example.com/mcp',
  oauthRequireAuth: false,
};

async function connectedClient() {
  const { server } = await createServer(cfg);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client };
}

describe('brand-coach MCP server (end-to-end via in-memory transport)', () => {
  it('advertises exactly the gateway + native asset-tracking + owned chain tools', async () => {
    const { client } = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'add_email_step',
      'assess_idea_dimensions',
      'audit_asset',
      'build_avatar_stage',
      'bulk_ingest_evidence',
      'compute_trust_gap_lift',
      'create_avatar',
      'create_campaign',
      'create_email_sequence',
      'delete_avatar',
      'design_test',
      'export_messaging_workbook',
      'export_workbook',
      'generate_audit_idea_map',
      'generate_brief',
      'generate_canvas',
      'generate_concepts',
      'generate_listing_image',
      'generate_listing_image_brief',
      'generate_positioning_moves',
      'generate_signature',
      'get_asset',
      'get_asset_history',
      'get_avatar',
      'get_campaign',
      'get_campaign_metrics',
      'get_coach_conversation',
      'get_context_status',
      'get_experiment_lift',
      'get_funnel_assets',
      'get_funnel_audit',
      'get_funnel_coverage',
      'get_funnel_piece_metrics',
      'get_ingest_job',
      'get_sequence_performance',
      'get_sequence_template',
      'health',
      'identify_decision_trigger',
      'ingest_campaign_analytics',
      'ingest_content_performance',
      'ingest_evidence',
      'ingest_funnel_analytics',
      'list_assets',
      'list_avatars',
      'list_campaigns',
      'list_coach_conversations',
      'list_funnel_inventory',
      'list_sequences',
      'log_asset',
      'onboard_choose',
      'onboard_panel',
      'onboard_status',
      'persist_signature',
      'provide_context',
      'publish_filter_check',
      'recall',
      'record_assessment',
      'record_avatar_build',
      'remember',
      'run_diagnostic_evidence',
      'run_funnel_audit',
      'run_marketing_audit',
      'run_onboarding',
      'run_trust_gap',
      'set_context_avatars',
      'set_current_avatar',
      'set_primary_avatar',
      'submit_feedback',
      'update_asset_status',
      'update_avatar',
      'update_campaign_status',
      'update_test_milestone',
      'upsert_funnel_touchpoint',
    ]);
  });

  it('health returns status ok and ledgerConfigured=true (native ledger)', async () => {
    const { client } = await connectedClient();
    const res = await client.callTool({ name: 'health', arguments: {} });
    const sc = res.structuredContent as { status: string; ledgerConfigured: boolean };
    expect(sc.status).toBe('ok');
    expect(sc.ledgerConfigured).toBe(true);
  });

  it('list_assets degrades gracefully (available=false) for an anonymous caller', async () => {
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
