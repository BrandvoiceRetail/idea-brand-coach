import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The widget's engine hooks are stubbed — this suite only exercises the
// drag-to-dock surface behaviour, not chat/session/upload wiring.
vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({ messages: [], sendMessage: vi.fn().mockResolvedValue(undefined), isSending: false }),
}));
vi.mock('@/hooks/useChatSessions', () => ({
  useChatSessions: () => ({ currentSessionId: 'session-1' }),
}));
vi.mock('@/hooks/useDocumentUpload', () => ({
  useDocumentUpload: () => ({
    documents: [],
    isUploading: false,
    fileInputRef: { current: null },
    handleFileSelect: vi.fn(),
  }),
}));
vi.mock('@/contexts/AvatarContext', () => ({
  useAvatarContext: () => ({ selectedAvatarId: null }),
}));

import { TrevorCoachWidget } from '../TrevorCoachWidget';

// 1024px viewport, 460px panel, 16px margin ⇒ right dock left = 548, left dock = 16.
const VW = 1024;
const PANEL_W = 460;
const MARGIN = 16;
const RIGHT_LEFT = VW - PANEL_W - MARGIN; // 548
const LEFT_LEFT = MARGIN; // 16

const realGBCR = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  window.localStorage.clear();
  (window as unknown as { innerWidth: number }).innerWidth = VW;
  // The component only needs the panel's measured WIDTH; position is driven by
  // its own clamped `left` state, so a fixed width is enough to make it draggable.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const isPanel = this instanceof HTMLElement && this.dataset.testid === 'coach-widget-panel';
    const w = isPanel ? PANEL_W : 0;
    return { left: 0, right: w, top: 0, bottom: 0, width: w, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = realGBCR;
});

const openPanel = (): HTMLElement => {
  fireEvent.click(screen.getByTestId('coach-widget-launcher'));
  return screen.getByTestId('coach-widget-panel');
};

const leftPx = (panel: HTMLElement): number => parseFloat(panel.style.left || 'NaN');

/** Drag the header from `fromX` to `toX` (clientX), then release. */
const dragHeader = (panel: HTMLElement, fromX: number, toX: number): void => {
  const header = panel.querySelector('header') as HTMLElement;
  fireEvent.pointerDown(header, { clientX: fromX, pointerId: 1, button: 0 });
  fireEvent.pointerMove(header, { clientX: (fromX + toX) / 2, pointerId: 1 });
  fireEvent.pointerMove(header, { clientX: toX, pointerId: 1 });
  fireEvent.pointerUp(header, { clientX: toX, pointerId: 1 });
};

describe('TrevorCoachWidget — drag to dock left/right', () => {
  it('opens docked against the right edge by default', () => {
    render(<TrevorCoachWidget />);
    const panel = openPanel();
    expect(leftPx(panel)).toBe(RIGHT_LEFT);
  });

  it('snaps to the LEFT edge when dragged across the midpoint and persists', () => {
    render(<TrevorCoachWidget />);
    const panel = openPanel();

    dragHeader(panel, 600, 60); // drop in the left half

    expect(window.localStorage.getItem('coach-widget-side')).toBe('left');
    expect(leftPx(panel)).toBe(LEFT_LEFT);
  });

  it('snaps back to the RIGHT edge when dragged across the midpoint', () => {
    render(<TrevorCoachWidget />);
    const panel = openPanel();

    dragHeader(panel, 600, 60); // → left
    expect(window.localStorage.getItem('coach-widget-side')).toBe('left');

    dragHeader(panel, 60, 980); // → back right
    expect(window.localStorage.getItem('coach-widget-side')).toBe('right');
    expect(leftPx(panel)).toBe(RIGHT_LEFT);
  });

  it('never parks off-screen — the docked left stays within the viewport', () => {
    render(<TrevorCoachWidget />);
    const panel = openPanel();

    // Yank far past the left edge (way beyond 0) — it must clamp on-screen.
    dragHeader(panel, 600, -5000);
    const left = leftPx(panel);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + PANEL_W).toBeLessThanOrEqual(VW);
    expect(left).toBe(LEFT_LEFT);
  });

  it('remembers the docked side across remounts (localStorage)', () => {
    window.localStorage.setItem('coach-widget-side', 'left');
    render(<TrevorCoachWidget />);
    const panel = openPanel();
    expect(leftPx(panel)).toBe(LEFT_LEFT); // re-opens left without any drag
  });

  it('only ever docks to an edge — a small nudge resolves to one side', () => {
    render(<TrevorCoachWidget />);
    const panel = openPanel();

    dragHeader(panel, 980, 900); // small move, stays in right half
    expect(window.localStorage.getItem('coach-widget-side')).toBe('right');
    expect(leftPx(panel)).toBe(RIGHT_LEFT);
  });
});
