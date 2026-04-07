import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MilestoneOverlay } from '../MilestoneOverlay';
import type { MilestoneData } from '@/hooks/v2/useMilestone';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('MilestoneOverlay', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render nothing when activeMilestone is null', () => {
    const { container } = render(
      <MilestoneOverlay
        activeMilestone={null}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(container.innerHTML).toBe('');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('should show toast for 10-field milestone', async () => {
    const milestone: MilestoneData = {
      tier: 10,
      message: '10 fields captured — your brand foundation is taking shape!',
      showConfetti: false,
      showPulse: true,
      showGold: false,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Milestone Reached!',
        description: milestone.message,
      }),
    );
  });

  it('should show toast for 20-field milestone', () => {
    const milestone: MilestoneData = {
      tier: 20,
      message: '20 fields — over halfway! Your brand strategy is really coming together.',
      showConfetti: true,
      showPulse: false,
      showGold: false,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Great Progress!',
        description: milestone.message,
      }),
    );
  });

  it('should show toast for 35-field milestone', () => {
    const milestone: MilestoneData = {
      tier: 35,
      message: 'All 35 fields captured! Your complete brand strategy is ready to export.',
      showConfetti: true,
      showPulse: false,
      showGold: true,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Brand Strategy Complete!',
        description: milestone.message,
      }),
    );
  });

  it('should fire confetti for tier 20', async () => {
    const confetti = (await import('canvas-confetti')).default;

    const milestone: MilestoneData = {
      tier: 20,
      message: 'test',
      showConfetti: true,
      showPulse: false,
      showGold: false,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 80,
        spread: 70,
        disableForReducedMotion: true,
      }),
    );
  });

  it('should fire confetti for tier 35 with multiple bursts', async () => {
    const confetti = (await import('canvas-confetti')).default;

    const milestone: MilestoneData = {
      tier: 35,
      message: 'test',
      showConfetti: true,
      showPulse: false,
      showGold: true,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    // First burst fires immediately
    expect(confetti).toHaveBeenCalledTimes(1);

    // Second burst fires after 250ms
    vi.advanceTimersByTime(250);
    expect(confetti).toHaveBeenCalledTimes(2);

    // Third burst fires after 400ms
    vi.advanceTimersByTime(150);
    expect(confetti).toHaveBeenCalledTimes(3);
  });

  it('should skip confetti when prefers-reduced-motion is true', async () => {
    const confetti = (await import('canvas-confetti')).default;

    const milestone: MilestoneData = {
      tier: 20,
      message: 'test',
      showConfetti: true,
      showPulse: false,
      showGold: false,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={true}
        onComplete={mockOnComplete}
      />,
    );

    // Toast should still fire
    expect(mockToast).toHaveBeenCalled();

    // Confetti should not fire
    expect(confetti).not.toHaveBeenCalled();

    // onComplete should be called immediately
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after delay', () => {
    const milestone: MilestoneData = {
      tier: 10,
      message: 'test',
      showConfetti: false,
      showPulse: true,
      showGold: false,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(mockOnComplete).not.toHaveBeenCalled();

    // Advance past 3000ms dismiss delay
    vi.advanceTimersByTime(3000);

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('should use longer delay for tier 35', () => {
    const milestone: MilestoneData = {
      tier: 35,
      message: 'test',
      showConfetti: true,
      showPulse: false,
      showGold: true,
    };

    render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    // Not dismissed at 3000ms
    vi.advanceTimersByTime(3000);
    expect(mockOnComplete).not.toHaveBeenCalled();

    // Dismissed at 4000ms
    vi.advanceTimersByTime(1000);
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('should not re-fire toast for the same tier on re-render', () => {
    const milestone: MilestoneData = {
      tier: 10,
      message: 'test',
      showConfetti: false,
      showPulse: true,
      showGold: false,
    };

    const { rerender } = render(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    expect(mockToast).toHaveBeenCalledTimes(1);

    // Re-render with same milestone
    rerender(
      <MilestoneOverlay
        activeMilestone={milestone}
        prefersReducedMotion={false}
        onComplete={mockOnComplete}
      />,
    );

    // Should still be 1
    expect(mockToast).toHaveBeenCalledTimes(1);
  });
});
