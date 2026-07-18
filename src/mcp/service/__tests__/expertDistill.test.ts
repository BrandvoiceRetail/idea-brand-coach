import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clusterCorrections,
  writeDraftInstruction,
  instructionIdForCluster,
  composeInstructionBody,
  runDistill,
  type CorrectionRow,
  type DraftSpec,
  type DistillDeps,
} from '../expertDistill.js';

const row = (id: string, tool_context: string | null): CorrectionRow => ({
  id,
  tool_context,
  coach_claim: 'claim',
  correction: 'fix',
  verbatim: null,
});

describe('clusterCorrections', () => {
  it('groups by tool_context and buckets missing context under "general", sorted by key', () => {
    const clusters = clusterCorrections([
      row('a', 'listing copy'),
      row('b', null),
      row('c', 'listing copy'),
      row('d', '  '),
    ]);
    expect(clusters.map((c) => c.key)).toEqual(['general', 'listing copy']);
    const listing = clusters.find((c) => c.key === 'listing copy')!;
    expect(listing.correctionIds).toEqual(['a', 'c']);
    const general = clusters.find((c) => c.key === 'general')!;
    expect(general.correctionIds).toEqual(['b', 'd']);
  });

  it('returns [] for no rows', () => {
    expect(clusterCorrections([])).toEqual([]);
  });
});

function makeClient(opts: {
  existingVersion?: number;
  insertErr?: boolean;
  onInsert?: (p: Record<string, unknown>) => void;
  onUpdate?: (p: Record<string, unknown>) => void;
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'coach_instructions') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: opts.existingVersion ? [{ version: opts.existingVersion }] : [],
                  error: null,
                }),
              }),
            }),
          }),
          insert: (p: Record<string, unknown>) => {
            opts.onInsert?.(p);
            return Promise.resolve({ error: opts.insertErr ? { message: 'x' } : null });
          },
        };
      }
      if (table === 'expert_corrections') {
        return {
          update: (p: Record<string, unknown>) => {
            opts.onUpdate?.(p);
            return { in: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('writeDraftInstruction', () => {
  const spec = {
    instructionId: 'expert.listing_copy',
    surface: 'preamble' as const,
    whenToUse: 'when writing listing copy',
    body: 'Lead with the emotional pain, not the ingredient list.',
    correctionIds: ['a', 'c'],
  };

  it('inserts a DRAFT (never published) at version 1 when the instruction is new', async () => {
    let insert: Record<string, unknown> = {};
    const c = makeClient({ onInsert: (p) => (insert = p) });
    const res = await writeDraftInstruction(c, spec);
    expect(res).toEqual({ instructionId: 'expert.listing_copy', version: 1 });
    expect(insert.status).toBe('draft');
    expect(insert.version).toBe(1);
    expect(insert.instruction_id).toBe('expert.listing_copy');
  });

  it('bumps to max(existing)+1 so it never collides with a published row', async () => {
    let insert: Record<string, unknown> = {};
    const c = makeClient({ existingVersion: 2, onInsert: (p) => (insert = p) });
    const res = await writeDraftInstruction(c, spec);
    expect(res.version).toBe(3);
    expect(insert.version).toBe(3);
  });

  it('stamps provenance on the source corrections (drafted + proposed_instruction_id)', async () => {
    let update: Record<string, unknown> = {};
    const c = makeClient({ onUpdate: (p) => (update = p) });
    await writeDraftInstruction(c, spec);
    expect(update).toEqual({ status: 'drafted', proposed_instruction_id: 'expert.listing_copy' });
  });

  it('throws on insert error (caller logs + continues to next cluster)', async () => {
    const c = makeClient({ insertErr: true });
    await expect(writeDraftInstruction(c, spec)).rejects.toThrow(/draft insert/);
  });

  it('skips the provenance update when there are no correction ids', async () => {
    let updated = false;
    const c = makeClient({ onUpdate: () => (updated = true) });
    await writeDraftInstruction(c, { ...spec, correctionIds: [] });
    expect(updated).toBe(false);
  });
});

describe('instructionIdForCluster', () => {
  it('slugs the tool_context under the expert. namespace', () => {
    expect(instructionIdForCluster({ key: 'listing copy', correctionIds: [], corrections: [] }))
      .toBe('expert.listing_copy');
    expect(instructionIdForCluster({ key: 'generate_brief', correctionIds: [], corrections: [] }))
      .toBe('expert.generate_brief');
    expect(instructionIdForCluster({ key: 'general', correctionIds: [], corrections: [] }))
      .toBe('expert.general');
  });
});

describe('composeInstructionBody', () => {
  const cluster = (key: string, corrections: CorrectionRow[]) => ({
    key,
    correctionIds: corrections.map((c) => c.id),
    corrections,
  });

  it('lists each correction as do-not/instead guidance, scoped by topic', () => {
    const body = composeInstructionBody(
      cluster('listing copy', [
        { id: 'a', tool_context: 'listing copy', coach_claim: 'led with features', correction: 'lead with emotion', verbatim: null },
      ]),
    );
    expect(body).toContain('when working on listing copy');
    expect(body).toContain('Do NOT: led with features — instead: lead with emotion');
  });

  it('dedupes identical corrections', () => {
    const dup: CorrectionRow = { id: 'a', tool_context: 't', coach_claim: 'x', correction: 'y', verbatim: null };
    const body = composeInstructionBody(cluster('t', [dup, { ...dup, id: 'b' }]));
    expect(body.match(/Do NOT: x — instead: y/g)).toHaveLength(1);
  });
});

describe('runDistill', () => {
  function deps(rows: CorrectionRow[], onDraft?: (s: DraftSpec) => void): DistillDeps {
    return {
      readNewCorrections: async () => rows,
      writeDraft: async (spec) => {
        onDraft?.(spec);
        return { instructionId: spec.instructionId, version: 1 };
      },
    };
  }

  it('drafts one instruction per cluster and reports the summary', async () => {
    const specs: DraftSpec[] = [];
    const rows: CorrectionRow[] = [
      { id: 'a', tool_context: 'listing copy', coach_claim: 'c1', correction: 'f1', verbatim: null },
      { id: 'b', tool_context: 'listing copy', coach_claim: 'c2', correction: 'f2', verbatim: null },
      { id: 'c', tool_context: 'images', coach_claim: 'c3', correction: 'f3', verbatim: null },
    ];
    const res = await runDistill(deps(rows, (s) => specs.push(s)));
    expect(res).toMatchObject({ newCorrections: 3, clusters: 2, draftsCreated: 2 });
    expect(specs.map((s) => s.instructionId).sort()).toEqual(['expert.images', 'expert.listing_copy']);
    expect(specs.find((s) => s.instructionId === 'expert.listing_copy')!.correctionIds).toEqual(['a', 'b']);
  });

  it('skips a cluster whose draft throws, keeping the run going', async () => {
    const rows: CorrectionRow[] = [
      { id: 'a', tool_context: 'good', coach_claim: 'c', correction: 'f', verbatim: null },
      { id: 'b', tool_context: 'bad', coach_claim: 'c', correction: 'f', verbatim: null },
    ];
    const d: DistillDeps = {
      readNewCorrections: async () => rows,
      writeDraft: async (spec) => {
        if (spec.instructionId === 'expert.bad') throw new Error('insert failed');
        return { instructionId: spec.instructionId, version: 1 };
      },
    };
    const res = await runDistill(d);
    expect(res.clusters).toBe(2);
    expect(res.draftsCreated).toBe(1);
  });

  it('is a no-op summary when there are no new corrections', async () => {
    const res = await runDistill(deps([]));
    expect(res).toEqual({ newCorrections: 0, clusters: 0, draftsCreated: 0, drafts: [] });
  });
});
