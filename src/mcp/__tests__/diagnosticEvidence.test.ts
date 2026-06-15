// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  registerRunDiagnosticEvidenceTool,
  type RunDiagnosticEvidenceDeps,
} from '../tools/runDiagnosticEvidence.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import type { ArtifactRow, SaveArtifactOptions } from '../service/artifactStore.js';
import type { ResolvedSlot } from '../service/contextResolver.js';
import type { ArtifactKind } from '../contracts/index.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

const VALID_SCORES = { insight: 14, distinctive: 16, empathetic: 8, authentic: 12 };

// --- Engine replies. The evidence reply cites real supplied evidence; the inference reply
//     flags every dimension as inference (no evidence to cite). -----------------------------
function evidenceReply() {
  return {
    overall_score: 50,
    primary_gap: 'Empathy',
    interpretation: 'Your weakest pillar is empathy.',
    dimensions: [
      {
        dimension: 'Insight',
        score: 14,
        what_it_measures: 'How well you understand the customer.',
        brand_read: 'Mixed.',
        where_it_shows_up: [{ evidence_type: 'listing_copy', quote_or_observation: 'Holds 432 cards' }],
        grounding: 'evidence' as const,
      },
      {
        dimension: 'Distinctiveness',
        score: 16,
        what_it_measures: 'How much you stand out.',
        brand_read: 'Mixed.',
        where_it_shows_up: [{ evidence_type: 'reviews', quote_or_observation: 'no more bent corners' }],
        grounding: 'evidence' as const,
      },
      {
        dimension: 'Empathy',
        score: 8,
        what_it_measures: 'How connected customers feel.',
        brand_read: 'Weak.',
        where_it_shows_up: [{ evidence_type: 'listing_copy', quote_or_observation: 'Holds 432 cards' }],
        grounding: 'evidence' as const,
      },
      {
        dimension: 'Authenticity',
        score: 12,
        what_it_measures: 'How genuine you are.',
        brand_read: 'Mixed.',
        where_it_shows_up: [{ evidence_type: 'reviews', quote_or_observation: 'no more bent corners' }],
        grounding: 'evidence' as const,
      },
    ],
    primaryGapSummary: 'Empathy is your biggest opportunity.',
    triage: { recommended_next_module: 'Avatar 2.0', rationale: 'Close the empathy gap.' },
    grounding: 'evidence' as const,
    evidence_refs: [
      { kind: 'listing_copy' as const, ref: 'supplied-listing_copy' },
      { kind: 'review' as const, ref: 'supplied-reviews' },
    ],
  };
}

function inferenceReply() {
  const note =
    'No supplied evidence for this read. Graded from intake answers and the score band; treat as inference.';
  const dims = (['Insight', 'Distinctiveness', 'Empathy', 'Authenticity'] as const).map((dimension, i) => ({
    dimension,
    score: Object.values(VALID_SCORES)[i],
    what_it_measures: 'Rubric question.',
    brand_read: 'Likely pattern at this score.',
    where_it_shows_up: [{ evidence_type: 'listing_copy', quote_or_observation: note }],
    grounding: 'inference' as const,
  }));
  return {
    overall_score: 50,
    primary_gap: 'Empathy',
    interpretation: 'Inference-only read.',
    dimensions: dims,
    primaryGapSummary: 'Empathy is your biggest opportunity.',
    triage: { recommended_next_module: 'Avatar 2.0', rationale: 'Close the empathy gap.' },
    grounding: 'inference' as const,
    evidence_refs: [],
  };
}

/** Stub EdgeFnClient returning a fixed reply for diagnostic-interpretation-evidence. */
function stubEdgeFn(reply: unknown, capture?: (fn: string, body: unknown) => void): EdgeFnClient {
  return {
    invoke: async <T>(name: string, body: unknown): Promise<EdgeFnResult<T>> => {
      capture?.(name, body);
      return { ok: true, data: reply as T };
    },
  } as unknown as EdgeFnClient;
}

/** Stub EdgeFnClient that fails `failTimes` transient 500s, then returns `reply`. */
function stubEdgeFnFlaky(failTimes: number, reply: unknown): { edgeFn: EdgeFnClient; calls: () => number } {
  let n = 0;
  return {
    edgeFn: {
      invoke: async <T>(): Promise<EdgeFnResult<T>> => {
        n += 1;
        if (n <= failTimes) return { ok: false, data: null, note: 'edge function failed (HTTP 500)' };
        return { ok: true, data: reply as T };
      },
    } as unknown as EdgeFnClient,
    calls: () => n,
  };
}

/** Resolve stub: intake filled; reviews/listing per flags. Order = [#15, #1, #3]. */
function resolveStub(opts: { intake?: boolean; reviews?: string; listing?: string }): RunDiagnosticEvidenceDeps['resolve'] {
  return (async (slots: number[]): Promise<ResolvedSlot[]> =>
    slots.map((slot) => {
      if (slot === 15) {
        return opts.intake === false
          ? ({ slot, value: null, source: null, confidence: 0, status: 'missing' } as ResolvedSlot)
          : ({ slot, value: { q1: 'a' }, source: 'diagnostic_submissions', confidence: 0.9, status: 'filled-stated' } as ResolvedSlot);
      }
      if (slot === 1) {
        return opts.reviews
          ? ({ slot, value: opts.reviews, source: 'user_product_reviews', confidence: 1, status: 'filled-evidence' } as ResolvedSlot)
          : ({ slot, value: null, source: null, confidence: 0, status: 'missing' } as ResolvedSlot);
      }
      // slot 3 — listing copy
      return opts.listing
        ? ({ slot, value: opts.listing, source: 'evidence_snapshots', confidence: 1, status: 'filled-evidence' } as ResolvedSlot)
        : ({ slot, value: null, source: null, confidence: 0, status: 'missing' } as ResolvedSlot);
    })) as RunDiagnosticEvidenceDeps['resolve'];
}

let savedCounter = 0;
/** saveArtifact stub recording every persisted (kind, content, opts). */
function makeSaveStub(record: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }>) {
  return (async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
    record.push({ kind, content, opts });
    savedCounter += 1;
    return {
      id: `art-${savedCounter}`,
      user_id: 'user-1',
      avatar_id: opts.avatarId ?? null,
      kind,
      content,
      grounding: opts.grounding,
      evidence_refs: opts.evidenceRefs,
      superseded_by: null,
      created_at: new Date().toISOString(),
    };
  }) as RunDiagnosticEvidenceDeps['saveArtifact'];
}

async function connect(deps?: Partial<RunDiagnosticEvidenceDeps>): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerRunDiagnosticEvidenceTool(server, deps);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

afterEach(() => vi.restoreAllMocks());

describe('run_diagnostic_evidence', () => {
  it('denies anonymous callers before any leg runs (C1 identity binding)', async () => {
    let resolved = false;
    const client = await connect({
      resolve: (async () => {
        resolved = true;
        return [];
      }) as RunDiagnosticEvidenceDeps['resolve'],
      saveArtifact: makeSaveStub([]),
      edgeFn: stubEdgeFn(evidenceReply()),
    });
    // No runWithIdentity wrapper -> anonymous.
    const res = await client.callTool({ name: 'run_diagnostic_evidence', arguments: { scores: VALID_SCORES } });
    const sc = res.structuredContent as { ok: boolean; note?: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
    // Gate fired before resolve — no leg ran.
    expect(resolved).toBe(false);
  });

  it('returns needs_input when intake is missing (the diagnostic was never taken)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    let invoked = false;
    const client = await connect({
      resolve: resolveStub({ intake: false }),
      saveArtifact: makeSaveStub(saved),
      edgeFn: { invoke: async () => { invoked = true; return { ok: true, data: evidenceReply() }; } } as unknown as EdgeFnClient,
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_diagnostic_evidence', arguments: { scores: VALID_SCORES } }),
    );
    const sc = res.structuredContent as { ok: boolean; needs_input?: Array<{ slot: number }> };
    expect(sc.ok).toBe(false);
    expect(sc.needs_input?.[0].slot).toBe(15);
    // Engine never called, nothing persisted.
    expect(invoked).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('cites evidence and persists an evidence-grounded artifact when listing/reviews are supplied', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const calls: Array<{ fn: string; body: unknown }> = [];
    const client = await connect({
      resolve: resolveStub({ reviews: 'no more bent corners', listing: 'Holds 432 cards' }),
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(evidenceReply(), (fn, body) => calls.push({ fn, body })),
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_diagnostic_evidence', arguments: { scores: VALID_SCORES } }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      grounding: string;
      dimensions: Array<{ grounding: string; where_it_shows_up: Array<{ quote_or_observation: string }> }>;
    };
    expect(sc.ok).toBe(true);
    expect(sc.grounding).toBe('evidence');
    // The engine was called with the resolved evidence block.
    const body = calls[0].body as { evidence: { listing_copy?: string; reviews?: string } };
    expect(body.evidence.listing_copy).toBe('Holds 432 cards');
    expect(body.evidence.reviews).toBe('no more bent corners');
    // Per-dimension grounding flags surfaced; citations preserved.
    expect(sc.dimensions.every((dim) => dim.grounding === 'evidence')).toBe(true);
    // One artifact persisted, of kind diagnostic_interpretation, with evidence_refs + the
    // citation array mapped into the contract's string where_it_shows_up.
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe('diagnostic_interpretation');
    expect(saved[0].opts.grounding).toBe('evidence');
    expect(saved[0].opts.evidenceRefs.length).toBeGreaterThan(0);
    const content = saved[0].content as { dimensions: Array<{ where_it_shows_up: string }> };
    expect(content.dimensions[0].where_it_shows_up).toContain('Holds 432 cards');
    expect(content.dimensions[0].where_it_shows_up).toMatch(/\[listing_copy\]/);
  });

  it('retries a transient engine 500 then succeeds (self-heals the JSON-shape variance)', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const flaky = stubEdgeFnFlaky(2, evidenceReply()); // fail twice, succeed on the 3rd
    const client = await connect({
      resolve: resolveStub({ reviews: 'no more bent corners', listing: 'Holds 432 cards' }),
      saveArtifact: makeSaveStub(saved),
      edgeFn: flaky.edgeFn,
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_diagnostic_evidence', arguments: { scores: VALID_SCORES } }),
    );
    const sc = res.structuredContent as { ok: boolean; grounding: string };
    expect(sc.ok).toBe(true);
    expect(sc.grounding).toBe('evidence');
    // 1 initial + 2 retries = 3 attempts, the last one succeeding; one artifact persisted.
    expect(flaky.calls()).toBe(3);
    expect(saved).toHaveLength(1);
  });

  it('gives up (engine unavailable) after exhausting retries, persisting nothing', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const flaky = stubEdgeFnFlaky(99, evidenceReply()); // always fails
    const client = await connect({
      resolve: resolveStub({ reviews: 'r', listing: 'l' }),
      saveArtifact: makeSaveStub(saved),
      edgeFn: flaky.edgeFn,
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_diagnostic_evidence', arguments: { scores: VALID_SCORES } }),
    );
    const sc = res.structuredContent as { ok: boolean; note?: string };
    expect(sc.ok).toBe(false);
    expect(res.isError).toBe(true);
    expect(flaky.calls()).toBe(3); // 1 initial + 2 retries, all failed
    expect(saved).toHaveLength(0);
  });

  it('flags inference and persists with no evidence_refs when no evidence is supplied', async () => {
    const saved: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const client = await connect({
      resolve: resolveStub({}), // intake present, no reviews, no listing
      saveArtifact: makeSaveStub(saved),
      edgeFn: stubEdgeFn(inferenceReply()),
    });
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'run_diagnostic_evidence', arguments: { scores: VALID_SCORES } }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      grounding: string;
      dimensions: Array<{ grounding: string }>;
    };
    expect(sc.ok).toBe(true);
    expect(sc.grounding).toBe('inference');
    expect(sc.dimensions.every((dim) => dim.grounding === 'inference')).toBe(true);
    // Persisted as inference with empty evidence_refs (no fabricated grounding).
    expect(saved).toHaveLength(1);
    expect(saved[0].opts.grounding).toBe('inference');
    expect(saved[0].opts.evidenceRefs).toHaveLength(0);
  });
});
