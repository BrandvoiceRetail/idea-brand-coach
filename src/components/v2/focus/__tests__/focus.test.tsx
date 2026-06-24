import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { buildFocusQueue, composeDeliverable, SEED_SNAPSHOT, TRIGGER_ANCHOR } from '../engine';
import { FocusWorkspace } from '../FocusWorkspace';

describe('focus engine', () => {
  it('prioritises the lowest pillar as the primary fix with the right trigger + Dove anchor', () => {
    const q = buildFocusQueue(SEED_SNAPSHOT);
    expect(q[0].pillar).toBe('empathetic'); // 9/25 is the lowest
    expect(q[0].trigger).toBe('Recognition');
    expect(q[0].anchor).toBe('Dove');
    expect(q[0].priorityScore).toBeGreaterThan(q[1]?.priorityScore ?? 0);
  });

  it('anchors are corrected (Recognition=Dove, never Lego)', () => {
    expect(TRIGGER_ANCHOR.Recognition).toBe('Dove');
    expect(Object.values(TRIGGER_ANCHOR)).not.toContain('Lego');
  });

  it('composes a stage-adaptive deliverable per mode and flags risky claims', () => {
    const f = buildFocusQueue(SEED_SNAPSHOT)[0];
    const listing = composeDeliverable({ focus: f, snapshot: SEED_SNAPSHOT, mode: 'diy-listing', idea: 'lean into the lifetime warranty' });
    expect(listing.mode).toBe('diy-listing');
    expect(listing.body.length).toBeGreaterThan(40);
    expect(listing.claimFlags?.some((c) => /guarantee|warranty/i.test(c))).toBe(true);
    const brief = composeDeliverable({ focus: f, snapshot: SEED_SNAPSHOT, mode: 'designer-brief' });
    expect(brief.pasteablePrompt).toBeTruthy();
    expect(brief.body).toMatch(/Dove/);
  });
});

describe('FocusWorkspace (single-focus workspace)', () => {
  it('shows exactly one focus, the Trust Gap rail, and produces a deliverable on demand', async () => {
    render(<FocusWorkspace snapshot={SEED_SNAPSHOT} />);
    expect(screen.getByText('What needs you now')).toBeInTheDocument();
    expect(screen.getAllByText(/Empathetic gap/i).length).toBeGreaterThan(0); // primary fix (card + queue)
    expect(screen.getByText('Trust Gap™')).toBeInTheDocument();

    // empty state until the owner produces it; no produced deliverable title yet
    expect(screen.getByText(/turns this focus into something you can use today/i)).toBeInTheDocument();
    expect(screen.queryByText(/edit, don.t rewrite/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Produce the deliverable/i }));
    // produce() is async (tries live AI, falls back to the deterministic template).
    expect(await screen.findByText(/edit, don.t rewrite/i)).toBeInTheDocument();
  });
});
