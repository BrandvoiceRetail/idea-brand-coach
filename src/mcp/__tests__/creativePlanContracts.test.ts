// @vitest-environment node
/**
 * Creative-plan tools — OUTPUT-SHAPE regression lock (the app-behavior contract).
 *
 * The connector/host and the MCP-app panels consume each tool's `structuredContent` by
 * FIELD NAME (scenes, positioning_inputs, execution_modes, higgsfield_handoff, …). A
 * refactor that renames or drops one of those fields is silent to the type-checker at the
 * boundary but BREAKS the app. This suite calls each tool through a real in-memory MCP
 * client (exactly what the connector does) and locks:
 *   - the stable top-level keys are present (arrayContaining → additions OK, drops caught),
 *   - the cross-cutting guardrail contract holds on every plan (claim gate, Tier-C ban,
 *     positioning-inputs shape, the Higgsfield handoff sub-keys, ledger save-back),
 *   - invalid input is REJECTED at the zod boundary (a loosened schema is a regression too).
 *
 * These are the pure grounding directors — no identity/gateWrite — so they answer to an
 * anonymous client, which is what makes this contract cheap to assert.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';
import { POSITIONING_SPINE } from '../service/creativeAlignment.js';

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

type SC = Record<string, unknown>;

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<SC> {
  const res = await client.callTool({ name, arguments: args });
  expect(res.isError, `${name} returned isError`).toBeFalsy();
  const sc = res.structuredContent as SC | undefined;
  expect(sc, `${name} has no structuredContent`).toBeTruthy();
  return sc as SC;
}

/** True if a call was rejected at the input boundary (threw) OR came back isError. */
async function callRejected(client: Client, name: string, args: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await client.callTool({ name, arguments: args });
    return Boolean(res.isError);
  } catch {
    return true;
  }
}

/** The stable top-level keys each tool's structuredContent MUST carry (drops = app regression). */
const STABLE_KEYS: Record<string, { args: Record<string, unknown>; keys: string[]; plan: boolean }> = {
  generate_video_storyboard: {
    args: { product: 'Test binder product' },
    plan: true,
    keys: [
      'ok', 'format', 'decision_trigger', 'scenes', 'positioning_inputs', 'higgsfield_handoff',
      'execution_modes', 'storyboard_image_spec', 'audio_direction', 'preset_ad_formats',
      'prompt_construction', 'adjustment_protocol', 'claim_gate', 'evidence_discipline',
      'qa_checklist', 'never_contain', 'new_user_path', 'instructions', 'summary',
    ],
  },
  generate_aplus_content_plan: {
    args: { product: 'Test binder product' },
    plan: true,
    keys: [
      'ok', 'marketplace', 'decision_trigger', 'format', 'beats', 'mobile_rules', 'brand_registry_note',
      'positioning_inputs', 'higgsfield_handoff', 'prompt_construction', 'adjustment_protocol',
      'claim_gate', 'evidence_discipline', 'qa_checklist', 'never_contain', 'new_user_path', 'instructions', 'summary',
    ],
  },
  generate_main_image_title_plan: {
    args: { product: 'Test binder product' },
    plan: true,
    keys: [
      'ok', 'marketplace', 'decision_trigger', 'main_image', 'title_formula', 'title_rules',
      'coherence_rules', 'positioning_inputs', 'higgsfield_handoff', 'prompt_construction', 'test_plan',
      'claim_gate', 'evidence_discipline', 'never_contain', 'new_user_path', 'instructions', 'summary',
    ],
  },
  generate_storefront_messaging_plan: {
    args: { product: 'Test binder brand' },
    plan: true,
    keys: [
      'ok', 'marketplace', 'decision_trigger', 'sections', 'consistency_rules', 'positioning_inputs',
      'higgsfield_handoff', 'prompt_construction', 'adjustment_protocol', 'claim_gate',
      'evidence_discipline', 'never_contain', 'new_user_path', 'instructions', 'summary',
    ],
  },
  generate_ugc_ad_plan: {
    args: { product: 'Test binder product' },
    plan: true,
    keys: [
      'ok', 'format', 'platform', 'decision_trigger', 'beats', 'persona_spec', 'compliance', 'testing_plan',
      'positioning_inputs', 'higgsfield_handoff', 'adjustment_protocol', 'claim_gate', 'evidence_discipline',
      'never_contain', 'new_user_path', 'instructions', 'summary',
    ],
  },
  refine_creative_plan: {
    args: { plan_type: 'video_storyboard', change_request: 'change scene 2 setting' },
    plan: false,
    keys: [
      'ok', 'plan_type', 'change_scope', 'propagation', 'surgical_protocol', 'higgsfield_edit_tools',
      'save_back', 'never_contain', 'instructions', 'summary',
    ],
  },
};

const HANDOFF_SUBKEYS = ['image', 'video', 'reference_discipline', 'product_model', 'edit_tools', 'job_loop', 'save_back'];

describe('creative-plan tools — structuredContent shape is locked', () => {
  for (const [tool, spec] of Object.entries(STABLE_KEYS)) {
    it(`${tool} returns every stable key the app consumes`, async () => {
      const { client } = await connectedClient();
      const sc = await callTool(client, tool, spec.args);
      expect(Object.keys(sc)).toEqual(expect.arrayContaining(spec.keys));
      expect(sc.ok).toBe(true);
      expect(typeof sc.summary).toBe('string');
    });
  }
});

describe('creative-plan tools — cross-cutting guardrail contract', () => {
  for (const [tool, spec] of Object.entries(STABLE_KEYS)) {
    if (!spec.plan) continue;
    it(`${tool} carries the positioning spine, claim gate, Tier-C ban, Higgsfield handoff, and ledger save-back`, async () => {
      const { client } = await connectedClient();
      const sc = await callTool(client, tool, spec.args);

      // positioning spine reported for every element (the honest degrade surface)
      expect(Array.isArray(sc.positioning_inputs)).toBe(true);
      expect((sc.positioning_inputs as unknown[]).length).toBe(POSITIONING_SPINE.length);

      // claim gate + evidence discipline present
      expect(typeof sc.claim_gate).toBe('string');
      expect((sc.claim_gate as string).length).toBeGreaterThan(0);
      expect(Array.isArray(sc.evidence_discipline)).toBe(true);

      // Tier-C / framework jargon ban carried into the deliverable contract
      const banned = (sc.never_contain as string[]).join(' ');
      for (const term of ['Trust Gap', 'Decision Trigger', 'Assessor']) expect(banned).toContain(term);

      // the Higgsfield execution handoff shape (host drives generation from these)
      const handoff = sc.higgsfield_handoff as Record<string, unknown>;
      expect(Object.keys(handoff)).toEqual(expect.arrayContaining(HANDOFF_SUBKEYS));

      // every plan tells the coach to persist to the ledger (store-and-resurface)
      expect((sc.instructions as string[]).join(' ')).toContain('log_asset');
    });
  }

  it('refine_creative_plan reconciles via external_id and exposes a valid scope', async () => {
    const { client } = await connectedClient();
    const sc = await callTool(client, 'refine_creative_plan', STABLE_KEYS.refine_creative_plan.args);
    expect(['component', 'positioning']).toContain(sc.change_scope);
    expect(Array.isArray(sc.propagation)).toBe(true);
    expect((sc.save_back as string[]).join(' ').toLowerCase()).toContain('external_id');
  });
});

describe('creative-plan tools — invalid input is rejected at the schema boundary', () => {
  it('rejects an out-of-enum format', async () => {
    const { client } = await connectedClient();
    expect(await callRejected(client, 'generate_video_storyboard', { product: 'Valid product', format: 'bogus' })).toBe(true);
  });
  it('rejects an out-of-enum decision_trigger', async () => {
    const { client } = await connectedClient();
    expect(await callRejected(client, 'generate_aplus_content_plan', { product: 'Valid product', decision_trigger: 'made_up' })).toBe(true);
  });
  it('rejects a too-short product (min length is the input contract)', async () => {
    const { client } = await connectedClient();
    expect(await callRejected(client, 'generate_ugc_ad_plan', { product: 'x' })).toBe(true);
  });
  it('rejects an unknown plan_type on refine', async () => {
    const { client } = await connectedClient();
    expect(await callRejected(client, 'refine_creative_plan', { plan_type: 'not_a_plan', change_request: 'x' })).toBe(true);
  });
  it('rejects a missing required field (refine without change_request)', async () => {
    const { client } = await connectedClient();
    expect(await callRejected(client, 'refine_creative_plan', { plan_type: 'video_storyboard' })).toBe(true);
  });
});
