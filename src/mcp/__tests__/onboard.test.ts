// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';
import { buildOnboardSurface, buildPathStub, buildOnboardPanelHtml, ONBOARD_UI_URI } from '../service/onboard.js';
import { SERVER_INSTRUCTIONS } from '../config.js';
import { findTierViolations } from '../terminologyGuard.js';

const cfg: HostConfig = {
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  slackBotToken: null,
  slackFeedbackChannelId: 'C0B9YT9TQ6T',
  mcpPublicUrl: 'https://app.example.com/mcp',
  oauthRequireAuth: false,
};

/** Connect a client WITHOUT wrapping in runWithIdentity → caller is anonymous. */
async function connectedClient() {
  const { server } = await createServer(cfg);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

describe('onboard service (Layer 1, pure)', () => {
  it('surface is branded and presents BOTH choices', () => {
    const { markdown, choices } = buildOnboardSurface();
    expect(markdown).toContain('IDEA Brand Coach');
    expect(markdown).toContain('What captures the heart goes in the cart');
    expect(markdown).toContain('Simple Diagnostic');
    expect(markdown).toContain('Full Contextual Upload');
    expect(choices.map((c) => c.id).sort()).toEqual(['diagnostic', 'upload']);
    // every choice carries a one-line next-step description
    expect(choices.every((c) => c.description.length > 0)).toBe(true);
  });

  it('each path yields a DISTINCT stub naming what comes next', () => {
    const diagnostic = buildPathStub('diagnostic');
    const upload = buildPathStub('upload');
    expect(diagnostic.path).toBe('diagnostic');
    expect(upload.path).toBe('upload');
    expect(diagnostic.markdown).not.toBe(upload.markdown);
    expect(diagnostic.markdown).toMatch(/Trust Gap/i);
    expect(upload.markdown).toMatch(/upload/i);
  });
});

describe('onboard front door (end-to-end, anonymous via in-memory transport)', () => {
  it('prompts/list includes `onboard`', async () => {
    const client = await connectedClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain('onboard');
  });

  it('prompts/get returns branded content with BOTH choices (no identity bound)', async () => {
    const client = await connectedClient();
    const res = await client.getPrompt({ name: 'onboard' });
    const text = res.messages
      .map((m) => (m.content.type === 'text' ? m.content.text : ''))
      .join('\n');
    expect(text).toContain('IDEA Brand Coach');
    expect(text).toContain('What captures the heart goes in the cart');
    expect(text).toContain('Simple Diagnostic');
    expect(text).toContain('Full Contextual Upload');
  });

  it('tools/list includes `onboard_choose`', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('onboard_choose');
  });

  it('onboard_choose routes to DISTINCT diagnostic vs upload stubs (anonymous)', async () => {
    const client = await connectedClient();
    const diag = await client.callTool({ name: 'onboard_choose', arguments: { path: 'diagnostic' } });
    const up = await client.callTool({ name: 'onboard_choose', arguments: { path: 'upload' } });

    const diagSc = diag.structuredContent as { path: string; title: string };
    const upSc = up.structuredContent as { path: string; title: string };
    expect(diagSc.path).toBe('diagnostic');
    expect(upSc.path).toBe('upload');
    expect(diagSc.title).not.toBe(upSc.title);

    const diagText = (diag.content as Array<{ type: string; text: string }>)[0].text;
    const upText = (up.content as Array<{ type: string; text: string }>)[0].text;
    expect(diagText).not.toBe(upText);
    expect(diagText).toMatch(/Trust Gap/i);
    expect(upText).toMatch(/listings, reviews/i);
  });

  it('onboard_choose rejects an unknown path (input validation)', async () => {
    const client = await connectedClient();
    const res = await client.callTool({ name: 'onboard_choose', arguments: { path: 'nope' } });
    expect(res.isError).toBe(true);
  });
});

describe('onboard interactive panel (MCP Apps / io.modelcontextprotocol/ui)', () => {
  it('panel HTML is branded, inlines the ext-apps client, and sends the selection to the chat', () => {
    const html = buildOnboardPanelHtml();
    expect(html).toContain('IDEA Brand Coach');
    expect(html).toContain('What captures the heart goes in the cart');
    expect(html).toContain('Simple Diagnostic');
    expect(html).toContain('Full Contextual Upload');
    // both routable paths are wired to buttons
    expect(html).toContain('data-path="diagnostic"');
    expect(html).toContain('data-path="upload"');
    // the interactive client (bundled @modelcontextprotocol/ext-apps App) is inlined
    expect(html).toContain('<script>');
    expect(html.length).toBeGreaterThan(100_000);
    // performs the spec iframe handshake + calls the server tool
    expect(html).toContain('ui/initialize');
    expect(html).toContain('ui/notifications/initialized');
    expect(html).toContain('tools/call');
    // the choice click sends the user's selection to the chat (sendMessage) so the coach
    // continues onboarding — it no longer renders a server-tool stub inside the panel
    expect(html).toContain('sendMessage');
    expect(html).toContain('Walk me through the four parts of trust');
    // exactly one closing </script> (the wrapper) — the inlined bundle must not
    // contain a literal </script that would terminate the tag early
    expect((html.match(/<\/script>/gi) ?? []).length).toBe(1);
  });

  it('exposes the ui:// resource with the mcp-app mimeType', async () => {
    const client = await connectedClient();
    const { resources } = await client.listResources();
    const panel = resources.find((r) => r.uri === ONBOARD_UI_URI);
    expect(panel).toBeTruthy();

    const read = await client.readResource({ uri: ONBOARD_UI_URI });
    const c = read.contents[0] as { mimeType?: string; text?: string };
    expect(c.mimeType).toBe('text/html;profile=mcp-app');
    expect(c.text).toContain('IDEA Brand Coach');
  });

  it('onboard_panel tool advertises its UI resource via _meta.ui.resourceUri', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const panelTool = tools.find((t) => t.name === 'onboard_panel');
    expect(panelTool).toBeTruthy();
    const meta = panelTool?._meta as { ui?: { resourceUri?: string } } | undefined;
    expect(meta?.ui?.resourceUri).toBe(ONBOARD_UI_URI);
  });

  it('onboard_panel runs anonymously and links the UI resource in its result', async () => {
    const client = await connectedClient();
    const res = await client.callTool({ name: 'onboard_panel', arguments: {} });
    const meta = res._meta as { ui?: { resourceUri?: string } } | undefined;
    expect(meta?.ui?.resourceUri).toBe(ONBOARD_UI_URI);
    const sc = res.structuredContent as { choices: Array<{ id: string }> };
    expect(sc.choices.map((c) => c.id).sort()).toEqual(['diagnostic', 'upload']);
  });
});

describe('onboarding posture guardrails (no invented inputs)', () => {
  it('SERVER_INSTRUCTIONS leads with the no-invented-inputs posture', () => {
    expect(SERVER_INSTRUCTIONS).toContain('coach, not a form');
    expect(SERVER_INSTRUCTIONS).toContain('do not');
    expect(SERVER_INSTRUCTIONS).toMatch(/infer, default, or invent inputs/);
    expect(SERVER_INSTRUCTIONS).toMatch(/NEVER call a diagnostic\/scoring\/generation tool with values the user did not explicitly provide/);
  });

  it('advertises the posture to clients end-to-end', async () => {
    const client = await connectedClient();
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toMatch(/infer, default, or invent inputs/);
  });

  it('diagnostic path elicits one-at-a-time BEFORE any scoring', () => {
    const md = buildPathStub('diagnostic').markdown;
    expect(md).toMatch(/one at a time/i);
    expect(md).toMatch(/before any scoring/i);
    // explicitly does not ask the user for ratings/numbers
    expect(md).toMatch(/no ratings, no numbers/i);
    // names all four IDEA dimensions to walk through
    for (const dim of ['Insight', 'Distinctive', 'Empathetic', 'Authentic']) {
      expect(md).toContain(dim);
    }
  });

  it('run_trust_gap description gates on user-derived values', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const tg = tools.find((t) => t.name === 'run_trust_gap');
    expect(tg?.description).toMatch(/Only call AFTER the user has explicitly worked through all four/);
    expect(tg?.description).toMatch(/Never infer, default, or invent the four values/);
  });
});

describe('SERVER_INSTRUCTIONS — onboarding + funnel-metrics (Windsor) workflow', () => {
  it('directs the coach to call run_onboarding instead of pasting a prompt', () => {
    // The onboarding workflow is owned by the run_onboarding tool's playbook; the server
    // instructions just tell the coach to call it (when not onboarded / on request).
    expect(SERVER_INSTRUCTIONS).toMatch(/ONBOARDING:/);
    expect(SERVER_INSTRUCTIONS).toContain('run_onboarding');
    expect(SERVER_INSTRUCTIONS).toMatch(/do[\s\S]{0,4}NOT make the user[\s\S]{0,4}paste a prompt/i);
    // The host (not this server) reads Windsor; the instructions must say so.
    expect(SERVER_INSTRUCTIONS).toMatch(/this server cannot read Windsor/i);
    // The tools the coach is pointed at across onboarding + the experiment loop.
    for (const tool of [
      'upsert_funnel_touchpoint',
      'get_connectors',
      'ingest_campaign_analytics',
      'ingest_funnel_analytics',
      'get_funnel_piece_metrics',
      'design_test',
      'update_test_milestone',
      'get_experiment_lift',
    ]) {
      expect(SERVER_INSTRUCTIONS).toContain(tool);
    }
    expect(SERVER_INSTRUCTIONS).toMatch(/source="windsor"/);
    expect(SERVER_INSTRUCTIONS).toMatch(/journey_stage/);
    expect(SERVER_INSTRUCTIONS).toMatch(/fractions 0–1/);
    // Honesty bar: never fabricate.
    expect(SERVER_INSTRUCTIONS).toMatch(/never fabricate/i);
  });

  it('leaks zero Tier-B/C internals in the onboarding section', () => {
    // Scope to the onboarding section: the NARRATION guidance elsewhere legitimately names
    // (to forbid) "neuroanatomical framing" etc., which the guard flags as a token.
    const start = SERVER_INSTRUCTIONS.indexOf('ONBOARDING:');
    const end = SERVER_INSTRUCTIONS.indexOf('Any user can send product feedback');
    expect(start).toBeGreaterThan(-1);
    const section = SERVER_INSTRUCTIONS.slice(start, end);
    expect(findTierViolations(section)).toEqual([]);
  });
});
