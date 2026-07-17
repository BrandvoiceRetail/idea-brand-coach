import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clusterCorrections, writeDraftInstruction, type CorrectionRow } from '../expertDistill.js';

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
