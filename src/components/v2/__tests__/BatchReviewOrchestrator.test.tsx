/**
 * Tests for BatchReviewOrchestrator component
 *
 * Verifies batch review UI: progress indicator, accept-all button,
 * toggle, and correct prop delegation to child components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PendingField } from '@/hooks/v2/useExtractionQueue';
import { BatchReviewOrchestrator } from '../BatchReviewOrchestrator';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../AdaptiveFieldReview', () => ({
  AdaptiveFieldReview: ({ fields, isOpen, onAccept, onReject, currentIndex }: any) =>
    isOpen ? (
      <div data-testid="adaptive-review">
        Review {currentIndex + 1} of {fields.length}
      </div>
    ) : null,
}));

vi.mock('../AcceptAllToggle', () => ({
  AcceptAllToggle: ({ isOn, onToggle }: any) => (
    <button data-testid="accept-toggle" onClick={onToggle}>
      {isOn ? 'On' : 'Off'}
    </button>
  ),
}));

// ============================================================================
// Fixtures
// ============================================================================

function makePendingField(overrides: Partial<PendingField> = {}): PendingField {
  return {
    fieldId: 'brand-name',
    label: 'Brand Name',
    value: 'Acme Co',
    confidence: 0.92,
    source: 'user_stated',
    chapterId: 'BRAND_FOUNDATION',
    chapterTitle: 'Brand Foundation',
    messageId: 'msg-001',
    ...overrides,
  };
}

function makeQueue(count: number): PendingField[] {
  return Array.from({ length: count }, (_, i) =>
    makePendingField({
      fieldId: `field-${i}`,
      label: `Field ${i}`,
      value: `Value ${i}`,
      messageId: `msg-${i}`,
    }),
  );
}

// ============================================================================
// Default props helper
// ============================================================================

interface DefaultPropsOverrides {
  queue?: PendingField[];
  currentIndex?: number;
  isOpen?: boolean;
  onAccept?: (fieldId: string, value?: string | string[]) => void;
  onReject?: (fieldId: string) => void;
  onAcceptAll?: () => void;
  onClose?: () => void;
  alwaysAccept?: boolean;
  onToggleAlwaysAccept?: () => void;
}

function defaultProps(overrides: DefaultPropsOverrides = {}) {
  return {
    queue: makeQueue(3),
    currentIndex: 0,
    isOpen: true,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onAcceptAll: vi.fn(),
    onClose: vi.fn(),
    alwaysAccept: false,
    onToggleAlwaysAccept: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BatchReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when alwaysAccept is true', () => {
    const { container } = render(
      <BatchReviewOrchestrator {...defaultProps({ alwaysAccept: true })} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('returns null when queue is empty', () => {
    const { container } = render(
      <BatchReviewOrchestrator {...defaultProps({ queue: [] })} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders batch controls bar when isOpen with queue items', () => {
    render(<BatchReviewOrchestrator {...defaultProps()} />);

    expect(screen.getByTestId('accept-toggle')).toBeInTheDocument();
    expect(screen.getByText(/Accept All/)).toBeInTheDocument();
  });

  it('shows correct "N of M" progress indicator', () => {
    render(
      <BatchReviewOrchestrator
        {...defaultProps({ queue: makeQueue(5), currentIndex: 2 })}
      />,
    );

    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('shows "Accept All N" button with correct count', () => {
    render(
      <BatchReviewOrchestrator {...defaultProps({ queue: makeQueue(4) })} />,
    );

    expect(screen.getByText(/Accept All 4/)).toBeInTheDocument();
  });

  it('calls onAcceptAll when Accept All button is clicked', () => {
    const onAcceptAll = vi.fn();
    render(
      <BatchReviewOrchestrator {...defaultProps({ onAcceptAll })} />,
    );

    fireEvent.click(screen.getByText(/Accept All/));
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it('renders AcceptAllToggle with correct props', () => {
    const onToggleAlwaysAccept = vi.fn();
    render(
      <BatchReviewOrchestrator
        {...defaultProps({ onToggleAlwaysAccept })}
      />,
    );

    const toggle = screen.getByTestId('accept-toggle');
    expect(toggle).toHaveTextContent('Off');

    fireEvent.click(toggle);
    expect(onToggleAlwaysAccept).toHaveBeenCalledTimes(1);
  });

  it('renders AdaptiveFieldReview with correct props', () => {
    render(
      <BatchReviewOrchestrator
        {...defaultProps({ queue: makeQueue(3), currentIndex: 1 })}
      />,
    );

    const review = screen.getByTestId('adaptive-review');
    expect(review).toBeInTheDocument();
    expect(review).toHaveTextContent('Review 2 of 3');
  });

  it('does not render batch controls bar when isOpen is false', () => {
    render(
      <BatchReviewOrchestrator {...defaultProps({ isOpen: false })} />,
    );

    expect(screen.queryByTestId('accept-toggle')).not.toBeInTheDocument();
    expect(screen.queryByText(/Accept All/)).not.toBeInTheDocument();
  });
});
