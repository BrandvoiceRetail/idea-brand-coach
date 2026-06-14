// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { HostConfig } from '../config.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import { buildConceptPrompt, parseConcepts } from '../service/concepts.js';
import { checkPublishFilter } from '../service/publishFilter.js';
import { designAbTest } from '../service/testDesign.js';
import { buildTrustGap } from '../../lib/trustGap.js';
import { runWithIdentity } from '../context/identity.js';

const cfg: HostConfig = {
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
};

/** Stub EdgeFnClient returning canned per-function responses. */
function stubEdgeFn(responses: Record<string, unknown>): EdgeFnClient {
  return {
    invoke: async <T>(name: string): Promise<EdgeFnResult<T>> => {
      if (name in responses) return { ok: true, data: responses[name] as T };
      return { ok: false, data: null, note: 'unknown fn' };
    },
  } as unknown as EdgeFnClient;
}

async function connectedClient(edgeFn?: EdgeFnClient) {
  const { server } = createServer(cfg, edgeFn);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

describe('concepts service', () => {
  it('builds a prompt embedding brief, channel, and count', () => {
    const p = buildConceptPrompt({ brief: 'launch a TCG binder', channel: 'instagram', count: 4 });
    expect(p).toContain('exactly 4');
    expect(p).toContain('launch a TCG binder');
    expect(p).toContain('instagram');
    expect(p).toContain('JSON array');
  });

  it('parses a strict JSON reply', () => {
    const text = 'Here you go:\n[{"title":"T1","hook":"H1","angle":"A1","rationale":"R1"},{"title":"T2","hook":"H2","angle":"A2","rationale":"R2"}]';
    const out = parseConcepts(text, 3);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ title: 'T1', hook: 'H1', angle: 'A1', rationale: 'R1' });
  });

  it('falls back to numbered-list parsing and caps at count', () => {
    const text = '1. Hero Origin — every collector is a hero\n2. Vault Keeper — protect the legacy\n3. Third One — extra';
    const out = parseConcepts(text, 2);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('Hero Origin');
  });
});

describe('publish_filter service (D6 deterministic v1)', () => {
  it('fails medical claims and short content', () => {
    const r = checkPublishFilter('This product cures anxiety and treats stress for everyone everywhere.');
    expect(r.verdict).toBe('fail');
    expect(r.violations.some((v) => v.rule === 'medical-therapeutic-claim')).toBe(true);
  });

  it('warns on superlatives and false urgency', () => {
    const r = checkPublishFilter('The best binder you will ever own. Act now while supplies remain available today.');
    expect(r.verdict).toBe('warn');
    const rules = r.violations.map((v) => v.rule);
    expect(rules).toContain('unsubstantiated-superlative');
    expect(rules).toContain('false-urgency');
  });

  it('fails channel length cap', () => {
    const long = 'a solid honest description of the product '.repeat(10);
    const r = checkPublishFilter(long, 'x');
    expect(r.violations.some((v) => v.rule === 'channel-length-exceeded')).toBe(true);
    expect(r.verdict).toBe('fail');
  });

  it('passes clean copy and marks IV-OS grounding deferred', () => {
    const r = checkPublishFilter('A thoughtfully designed binder that keeps your collection organized and protected.');
    expect(r.verdict).toBe('pass');
    expect(r.violations).toHaveLength(0);
    expect(r.checked_against.ivos_safe_claims).toMatch(/deferred/i);
  });
});

describe('test-design service', () => {
  it('composes lettered variants with even split and channel metric', () => {
    const spec = designAbTest({
      name: 'Hook test',
      channel: 'amazon_listing',
      variants: [{ content: 'copy A' }, { content: 'copy B' }],
    });
    expect(spec.variants.map((v) => v.variant_id)).toEqual(['A', 'B']);
    expect(spec.variants[0].traffic_share).toBe(50);
    expect(spec.primary_metric).toBe('unit_session_percentage');
    expect(spec.hypothesis.length).toBeGreaterThan(0);
  });

  it('rejects fewer than 2 variants', () => {
    expect(() => designAbTest({ name: 'x', variants: [{ content: 'only' }] })).toThrow(/at least 2/);
  });
});

describe('owned chain tools (end-to-end via in-memory transport)', () => {
  const authed = { userId: 'user-1', token: 'tok', authenticated: true };

  it('generate_concepts returns parsed concepts via the stubbed engine', async () => {
    const edge = stubEdgeFn({
      'idea-framework-consultant-claude': {
        response: '[{"title":"Vault Story","hook":"h","angle":"a","rationale":"r"}]',
      },
    });
    const client = await connectedClient(edge);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'generate_concepts', arguments: { brief: 'promote the new TCG binder line', count: 1 } }),
    );
    const sc = res.structuredContent as { ok: boolean; concepts: Array<{ title: string }> };
    expect(sc.ok).toBe(true);
    expect(sc.concepts[0].title).toBe('Vault Story');
  });

  it('generate_concepts degrades for anonymous callers (engine is JWT-gated)', async () => {
    const client = await connectedClient(); // real EdgeFnClient; anonymous identity
    const res = await client.callTool({
      name: 'generate_concepts',
      arguments: { brief: 'promote the new TCG binder line' },
    });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/authentication required/i);
  });

  it('draft_asset passes the CopyRequest through verbatim and returns copy', async () => {
    const edge = stubEdgeFn({
      'brand-copy-generator': { copy: 'Drafted copy.', hasUserContext: true, format: 'social_post' },
    });
    const client = await connectedClient(edge);
    const res = await runWithIdentity(authed, () =>
      client.callTool({
        name: 'draft_asset',
        arguments: {
          productName: 'Infinity Binder',
          category: 'TCG accessories',
          features: ['side-loading'],
          targetAudience: 'collectors',
          emotionalPayoff: 'pride of a protected collection',
          tone: 'confident',
          format: 'social_post',
        },
      }),
    );
    const sc = res.structuredContent as { ok: boolean; copy: string; recorded: { ok: boolean } };
    expect(sc.ok).toBe(true);
    expect(sc.copy).toBe('Drafted copy.');
    // real (unconfigured) ledger client here -> auto-record degrades, draft still succeeds
    expect(sc.recorded.ok).toBe(false);
  });

  it('run_trust_gap output is byte-identical to the in-app engine (Calculation Parity)', async () => {
    const client = await connectedClient();
    const scores = { insight: 80, distinctive: 60, empathetic: 70, authentic: 90 };
    const res = await client.callTool({ name: 'run_trust_gap', arguments: scores });
    const direct = buildTrustGap({ ...scores, overall: (80 + 60 + 70 + 90) / 4 });
    expect(res.structuredContent).toEqual(JSON.parse(JSON.stringify(direct)));
  });

  it('design_test returns a spec with deferred record_test', async () => {
    const client = await connectedClient();
    const res = await client.callTool({
      name: 'design_test',
      arguments: { name: 'Hook A/B', variants: [{ content: 'A' }, { content: 'B' }], channel: 'email' },
    });
    const sc = res.structuredContent as { primary_metric: string; record_test: string };
    expect(sc.primary_metric).toBe('click_through_rate');
    expect(sc.record_test).toMatch(/deferred/i);
  });
});
