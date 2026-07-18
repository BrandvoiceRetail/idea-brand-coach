import { describe, it, expect } from 'vitest';
import {
  isRedirect,
  detectRedirects,
  harvestExpertChats,
  HARVEST_FIELD_MAX_CHARS,
  type HarvestDeps,
  type SessionTurns,
  type HarvestedCorrection,
} from '../expertHarvest.js';

describe('isRedirect (conservative — precision over recall)', () => {
  it.each([
    'No, that misses the emotional angle entirely.',
    "That's wrong — lead with the pain, not features.",
    "you're wrong about the positioning",
    'Not quite. Reconsider the trigger.',
    'I disagree with that read.',
    'are you sure? that feels off strategically',
    'what are you talking about, that is the opposite of the brief',
    "that's not right",
  ])('flags a genuine redirect: %s', (t) => {
    expect(isRedirect(t)).toBe(true);
  });

  it.each([
    'Yes, that looks great, thank you.',
    'Can you write three more bullets like that?',
    'There is no problem with the current listing.', // bare "no" mid-sentence must NOT trip
    'Go ahead and draft the copy.',
    'That is exactly what I meant.',
  ])('does NOT flag a non-redirect: %s', (t) => {
    expect(isRedirect(t)).toBe(false);
  });
});

describe('detectRedirects', () => {
  const session = (turns: SessionTurns['turns']): SessionTurns => ({ sessionId: 's1', avatarId: 'av1', turns });

  it('captures a user redirect that follows a coach turn (claim = prior coach turn)', () => {
    const out = detectRedirects('u1', session([
      { role: 'coach', text: 'Lead with the ingredient list.', createdAt: '2026-07-17T10:00:00Z' },
      { role: 'user', text: "No, that's wrong — lead with the hair-loss fear.", createdAt: '2026-07-17T10:01:00Z' },
    ]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      userId: 'u1',
      sessionId: 's1',
      avatarId: 'av1',
      coachClaim: 'Lead with the ingredient list.',
      createdAt: '2026-07-17T10:01:00Z',
    });
    expect(out[0].verbatim).toContain('lead with the hair-loss fear');
  });

  it('ignores a redirect-looking FIRST turn (nothing precedes it)', () => {
    expect(detectRedirects('u1', session([
      { role: 'user', text: "No, that's wrong", createdAt: '2026-07-17T10:00:00Z' },
    ]))).toHaveLength(0);
  });

  it('ignores a user turn that follows another USER turn (no coach claim to correct)', () => {
    expect(detectRedirects('u1', session([
      { role: 'user', text: 'here is my listing', createdAt: '2026-07-17T10:00:00Z' },
      { role: 'user', text: "no, that's wrong", createdAt: '2026-07-17T10:01:00Z' },
    ]))).toHaveLength(0);
  });

  it('ignores an agreeable follow-up turn', () => {
    expect(detectRedirects('u1', session([
      { role: 'coach', text: 'Lead with fear.', createdAt: '2026-07-17T10:00:00Z' },
      { role: 'user', text: 'Perfect, do that.', createdAt: '2026-07-17T10:01:00Z' },
    ]))).toHaveLength(0);
  });

  it('clips over-long fields to the cap', () => {
    const long = 'x'.repeat(HARVEST_FIELD_MAX_CHARS + 500);
    const out = detectRedirects('u1', session([
      { role: 'coach', text: long, createdAt: 'a' },
      { role: 'user', text: `no, that's wrong ${long}`, createdAt: 'b' },
    ]));
    expect(out[0].coachClaim.length).toBe(HARVEST_FIELD_MAX_CHARS);
    expect(out[0].verbatim.length).toBe(HARVEST_FIELD_MAX_CHARS);
  });
});

describe('harvestExpertChats orchestration', () => {
  function deps(over: Partial<HarvestDeps> & { sessions?: Record<string, SessionTurns[]> }): HarvestDeps {
    const inserted: HarvestedCorrection[] = [];
    return {
      listExpertUserIds: over.listExpertUserIds ?? (async () => Object.keys(over.sessions ?? {})),
      readSessions: over.readSessions ?? (async (u) => over.sessions?.[u] ?? []),
      insertCorrections: over.insertCorrections ?? (async (rows) => { inserted.push(...rows); }),
      // @ts-expect-error test accessor
      _inserted: inserted,
    };
  }

  it('captures redirects across experts and advances the high-water mark to the latest created_at', async () => {
    const d = deps({
      sessions: {
        u1: [{ sessionId: 's1', turns: [
          { role: 'coach', text: 'features first', createdAt: '2026-07-17T10:00:00Z' },
          { role: 'user', text: "no, that's wrong", createdAt: '2026-07-17T10:05:00Z' },
        ] }],
      },
    });
    const res = await harvestExpertChats(d, { sinceIso: null });
    expect(res.captured).toBe(1);
    expect(res.highWater).toBe('2026-07-17T10:05:00Z');
    // @ts-expect-error test accessor
    expect(d._inserted).toHaveLength(1);
  });

  it('isolates a failing expert and still reports the sweep (never throws)', async () => {
    const d = deps({
      listExpertUserIds: async () => ['bad', 'good'],
      readSessions: async (u) => {
        if (u === 'bad') throw new Error('db down');
        return [{ sessionId: 's', turns: [
          { role: 'coach', text: 'x', createdAt: 'a' },
          { role: 'user', text: 'i disagree', createdAt: 'b' },
        ] }];
      },
    });
    const res = await harvestExpertChats(d, { sinceIso: null });
    expect(res.experts).toBe(2);
    expect(res.captured).toBe(1);
  });
});
