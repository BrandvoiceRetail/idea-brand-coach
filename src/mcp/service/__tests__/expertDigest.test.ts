import { describe, it, expect } from 'vitest';
import { composeDigest, sendWeeklyDigest, type DigestDeps } from '../expertDigest.js';
import type { FeedbackSink, FeedbackInput } from '../../slack/feedbackNotifier.js';

function sink(ok: boolean, spy?: (i: FeedbackInput) => void): FeedbackSink {
  return {
    send: async (i: FeedbackInput) => {
      spy?.(i);
      return { ok };
    },
  };
}

describe('composeDigest', () => {
  it('returns an empty string when there are no changes', () => {
    expect(composeDigest([])).toBe('');
  });

  it('lists each change and pluralizes correction counts (falls back to id)', () => {
    const msg = composeDigest(
      [
        { instructionId: 'expert.listing_copy', whenToUse: 'listing copy', correctionCount: 3 },
        { instructionId: 'expert.tone', whenToUse: null, correctionCount: 1 },
      ],
      'this week',
    );
    expect(msg).toContain('2 coaching updates went live this week');
    expect(msg).toContain('4 of your corrections');
    expect(msg).toContain('• listing copy (3 corrections)');
    expect(msg).toContain('• expert.tone (1 correction)');
  });
});

describe('sendWeeklyDigest', () => {
  it('skips (no Slack call) when nothing was applied', async () => {
    let called = false;
    const deps: DigestDeps = {
      readAppliedChanges: async () => [],
      notifier: sink(true, () => {
        called = true;
      }),
    };
    const res = await sendWeeklyDigest(deps, { sinceIso: 'x' });
    expect(res.sent).toBe(false);
    expect(res.changeCount).toBe(0);
    expect(called).toBe(false);
  });

  it('sends the digest for applied changes', async () => {
    let sent: FeedbackInput | undefined;
    const deps: DigestDeps = {
      readAppliedChanges: async () => [{ instructionId: 'i', whenToUse: 'w', correctionCount: 2 }],
      notifier: sink(true, (i) => (sent = i)),
    };
    const res = await sendWeeklyDigest(deps, { sinceIso: 'x' });
    expect(res.sent).toBe(true);
    expect(res.changeCount).toBe(1);
    expect(sent?.message).toContain('w (2 corrections)');
    expect(sent?.caller).toBe('expert-intel-loop');
  });

  it('returns sent:false when the notifier fails (never throws)', async () => {
    const deps: DigestDeps = {
      readAppliedChanges: async () => [{ instructionId: 'i', correctionCount: 1 }],
      notifier: sink(false),
    };
    expect((await sendWeeklyDigest(deps, { sinceIso: 'x' })).sent).toBe(false);
  });

  it('returns sent:false when reading changes throws (never throws)', async () => {
    const deps: DigestDeps = {
      readAppliedChanges: async () => {
        throw new Error('db down');
      },
      notifier: sink(true),
    };
    const res = await sendWeeklyDigest(deps, { sinceIso: 'x' });
    expect(res.sent).toBe(false);
    expect(res.note).toMatch(/could not read/);
  });
});
