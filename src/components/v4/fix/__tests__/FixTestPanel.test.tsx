/**
 * FixTestPanel (S-16) tests — proves the Fix & Test surface renders the leak
 * honestly ("—" for a null reading), never fabricates variant B (explicit
 * loading/error/empty), claim-gates the rewrite, gates "Open A/B test" until a
 * hypothesis + rewrite exist, and emits a PostHog event per meaningful action.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FixTestPanel, type FixTestPanelProps } from '../FixTestPanel';
import { FIX_TEST_EVENTS } from '../fixTestEvents';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { ClaimGateItem } from '@/types/v4Analyse';

vi.mock('@/lib/posthogClient', () => ({ captureAlphaEvent: vi.fn() }));
const capture = vi.mocked(captureAlphaEvent);

function makeProps(overrides: Partial<FixTestPanelProps> = {}): FixTestPanelProps {
  return {
    pieceLabel: 'Amazon Listing — TLB216',
    stageLabel: 'Consideration → Purchase',
    leak: { metric: 'cvr', current: 0.107, target: 0.15, continuityBreak: '"battle-ready" not echoed' },
    hypothesis: '',
    onHypothesisChange: vi.fn(),
    metric: 'cvr',
    onMetricChange: vi.fn(),
    baseline: '10.7%',
    onBaselineChange: vi.fn(),
    currentCopy: '216-Card Toploader Binder, Vintage Leather…',
    rewrite: null,
    onGenerateRewrite: vi.fn(),
    onOpenTest: vi.fn(),
    onOpenCoach: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => capture.mockClear());

describe('FixTestPanel', () => {
  it('emits a viewed event on mount and renders the leak metric vs target', () => {
    render(<FixTestPanel {...makeProps()} />);
    expect(capture).toHaveBeenCalledWith(FIX_TEST_EVENTS.VIEWED, { metric: 'cvr', has_target: true });
    expect(screen.getByTestId('v4-fix-leak-current')).toHaveTextContent('10.7%');
    expect(screen.getByTestId('v4-fix-leak-target')).toHaveTextContent('15.0%');
    expect(screen.getByTestId('v4-fix-leak-continuity')).toHaveTextContent(/battle-ready/i);
  });

  it('renders an honest "—" for a null leak reading — never a fabricated number', () => {
    render(
      <FixTestPanel {...makeProps({ leak: { metric: 'cvr', current: null, target: null, continuityBreak: null } })} />,
    );
    expect(screen.getByTestId('v4-fix-leak-current')).toHaveTextContent('—');
    expect(screen.getByTestId('v4-fix-leak-target')).toHaveTextContent('—');
    expect(screen.queryByTestId('v4-fix-leak-continuity')).not.toBeInTheDocument();
  });

  it('shows an honest empty variant B until a rewrite is generated', () => {
    render(<FixTestPanel {...makeProps()} />);
    expect(screen.getByTestId('v4-fix-variant-b-empty')).toBeInTheDocument();
  });

  it('triggers (and instruments) rewrite generation', () => {
    const onGenerateRewrite = vi.fn();
    render(<FixTestPanel {...makeProps({ onGenerateRewrite })} />);
    fireEvent.click(screen.getByTestId('v4-fix-generate-rewrite'));
    expect(onGenerateRewrite).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(FIX_TEST_EVENTS.REWRITE_REQUESTED, { metric: 'cvr' });
  });

  it('shows the variant B loading and error states without fabricating copy', () => {
    const { rerender } = render(<FixTestPanel {...makeProps({ rewriteLoading: true })} />);
    expect(screen.getByTestId('v4-fix-variant-b-loading')).toBeInTheDocument();

    rerender(<FixTestPanel {...makeProps({ rewriteError: 'engine timeout' })} />);
    expect(screen.getByTestId('v4-fix-variant-b-error')).toHaveTextContent(/engine timeout/i);
    fireEvent.click(screen.getByTestId('v4-fix-variant-b-retry'));
  });

  it('claim-gates the rewrite and confirms a claim', () => {
    const claims: ClaimGateItem[] = [
      { claim: 'lifetime warranty', status: 'unconfirmed', slot: 2, reason: 'no proof yet' },
    ];
    const onConfirmClaim = vi.fn();
    render(
      <FixTestPanel
        {...makeProps({ rewrite: 'Battle-Ready Binder…', rewriteClaims: claims, onConfirmClaim })}
      />,
    );
    expect(screen.getByTestId('v4-fix-claim-gate-summary')).toHaveTextContent(/not shipped as fact/i);
    fireEvent.click(screen.getByTestId('v4-fix-claim-confirm-0'));
    expect(onConfirmClaim).toHaveBeenCalledWith(claims[0], 0);
    expect(capture).toHaveBeenCalledWith(FIX_TEST_EVENTS.CLAIM_CONFIRMED, { slot: 2 });
  });

  it('gates "Open A/B test" until a hypothesis AND a rewrite exist', () => {
    const onOpenTest = vi.fn();
    const { rerender } = render(<FixTestPanel {...makeProps()} />);
    expect(screen.getByTestId('v4-fix-open-test')).toBeDisabled();
    expect(screen.getByTestId('v4-fix-open-test-hint')).toBeInTheDocument();

    rerender(
      <FixTestPanel {...makeProps({ hypothesis: 'Lead with battle-ready', rewrite: 'B copy', onOpenTest })} />,
    );
    const openBtn = screen.getByTestId('v4-fix-open-test');
    expect(openBtn).not.toBeDisabled();
    fireEvent.click(openBtn);
    expect(onOpenTest).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(FIX_TEST_EVENTS.TEST_OPENED, {
      metric: 'cvr',
      unconfirmed_count: 0,
    });
  });

  it('surfaces an honest open-test error and opens the coach', () => {
    const onOpenCoach = vi.fn();
    render(
      <FixTestPanel
        {...makeProps({ hypothesis: 'h', rewrite: 'B', openTestError: 'db down', onOpenCoach })}
      />,
    );
    expect(screen.getByTestId('v4-fix-open-test-error')).toHaveTextContent(/db down/i);
    fireEvent.click(screen.getByTestId('v4-fix-open-coach'));
    expect(onOpenCoach).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(FIX_TEST_EVENTS.COACH_OPENED, { metric: 'cvr' });
  });
});
