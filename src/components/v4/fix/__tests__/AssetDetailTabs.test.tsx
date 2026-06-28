/**
 * AssetDetailTabs (S-14) tests — proves the per-asset surface degrades honestly
 * (no fabricated prompt / brief / audit), records the verdict only when an audit
 * exists, and emits a PostHog event per tab view + on the audit run/verdict.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetDetailTabs } from '../AssetDetailTabs';
import { ASSET_DETAIL_EVENTS } from '../assetDetailEvents';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { AssetDetail, AuditResult } from '@/types/v4Fix';

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

const capture = vi.mocked(captureAlphaEvent);

const AUDIT: AuditResult = {
  scores: { i: 70, d: 80, e: 60, a: 90 },
  rationale: 'The hero says generic things the avatar already knows.',
  fix: 'Lead with the survives-the-drop proof in the first line.',
  grounding: { fields_used: 5 },
};

function makeAsset(overrides: Partial<AssetDetail> = {}): AssetDetail {
  return {
    assetId: 'asset-1',
    touchpointId: 'tp-hero',
    touchpointLabel: 'Hero image',
    stage: 'consideration',
    contextDescription: 'Main listing hero shot.',
    contentText: null,
    storagePath: null,
    status: 'aligned',
    overallScore: 75,
    previousScore: null,
    audit: null,
    signatureVersion: 'v2',
    updatedAt: '2026-06-26T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => capture.mockClear());

describe('AssetDetailTabs', () => {
  it('emits a tab-viewed event for the initial (image-prompt) tab on mount', () => {
    render(<AssetDetailTabs asset={makeAsset()} />);
    expect(capture).toHaveBeenCalledWith(ASSET_DETAIL_EVENTS.TAB_VIEWED, {
      tab: 'image-prompt',
      asset_id: 'asset-1',
    });
  });

  it('shows an honest empty image-prompt state and triggers generation — no fabricated prompt', () => {
    const onGenerateImagePrompt = vi.fn();
    render(<AssetDetailTabs asset={makeAsset()} onGenerateImagePrompt={onGenerateImagePrompt} />);
    expect(screen.getByTestId('asset-image-prompt-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('asset-image-prompt-empty-cta'));
    expect(onGenerateImagePrompt).toHaveBeenCalledTimes(1);
  });

  it('renders a real image prompt when one is supplied', () => {
    render(<AssetDetailTabs asset={makeAsset()} imagePrompt="A studio shot of the product mid-drop." />);
    expect(screen.getByTestId('asset-image-prompt')).toHaveTextContent(/mid-drop/i);
    expect(screen.queryByTestId('asset-image-prompt-empty')).not.toBeInTheDocument();
  });

  it('shows the honest image-prompt error with a working retry', () => {
    const onGenerateImagePrompt = vi.fn();
    render(
      <AssetDetailTabs
        asset={makeAsset()}
        imagePromptError="engine timeout"
        onGenerateImagePrompt={onGenerateImagePrompt}
      />,
    );
    expect(screen.getByTestId('asset-image-prompt-error')).toHaveTextContent(/nothing was made up/i);
    fireEvent.click(screen.getByTestId('asset-image-prompt-error-retry'));
    expect(onGenerateImagePrompt).toHaveBeenCalledTimes(1);
  });

  it('emits a tab-viewed event when switching to the check tab', () => {
    render(<AssetDetailTabs asset={makeAsset()} />);
    capture.mockClear();
    fireEvent.click(screen.getByTestId('asset-tab-check-asset'));
    expect(capture).toHaveBeenCalledWith(ASSET_DETAIL_EVENTS.TAB_VIEWED, {
      tab: 'check-asset',
      asset_id: 'asset-1',
    });
  });

  it('shows the not-checked-yet state and fires the check event — no fabricated scores', () => {
    const onCheckAsset = vi.fn();
    render(<AssetDetailTabs asset={makeAsset()} onCheckAsset={onCheckAsset} />);
    fireEvent.click(screen.getByTestId('asset-tab-check-asset'));
    expect(screen.getByTestId('asset-check-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('asset-check-empty-cta'));
    expect(onCheckAsset).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(ASSET_DETAIL_EVENTS.CHECK_RUN, { asset_id: 'asset-1' });
  });

  it('renders the real IDEA audit scores and records the verdict with an event', () => {
    const onRecordVerdict = vi.fn();
    render(
      <AssetDetailTabs
        asset={makeAsset({ audit: AUDIT })}
        onRecordVerdict={onRecordVerdict}
      />,
    );
    fireEvent.click(screen.getByTestId('asset-tab-check-asset'));
    expect(screen.getByTestId('asset-check-score-i')).toHaveTextContent('70');
    expect(screen.getByTestId('asset-check-score-a')).toHaveTextContent('90');

    fireEvent.click(screen.getByTestId('asset-check-verdict-on-brand'));
    expect(onRecordVerdict).toHaveBeenCalledWith(AUDIT, 'on_brand');
    expect(capture).toHaveBeenCalledWith(ASSET_DETAIL_EVENTS.VERDICT_RECORDED, {
      asset_id: 'asset-1',
      verdict: 'on_brand',
    });
  });

  it('shows the design-brief empty state when no brief is supplied (claim-gated surface)', () => {
    render(<AssetDetailTabs asset={makeAsset()} />);
    fireEvent.click(screen.getByTestId('asset-tab-design-brief'));
    expect(screen.getByTestId('v4-move-brief-claim-gate')).toBeInTheDocument();
  });

  it('shows an honest "coming soon" prompt state (no actionless blank) when generation is not wired', () => {
    render(<AssetDetailTabs asset={makeAsset()} />);
    expect(screen.getByTestId('asset-image-prompt-coming')).toHaveTextContent(/coming/i);
    expect(screen.queryByTestId('asset-image-prompt-empty')).not.toBeInTheDocument();
  });

  it('renders the Grounded-in strip with the supplied brand fields when a prompt exists', () => {
    render(
      <AssetDetailTabs
        asset={makeAsset()}
        imagePrompt="A studio shot."
        grounded={[
          { label: 'Signature', present: true },
          { label: 'Core message', present: false, note: 'unclear — output may drift' },
        ]}
      />,
    );
    const strip = screen.getByTestId('v4-grounded-strip');
    expect(strip).toHaveTextContent(/Grounded in/i);
    expect(strip).toHaveTextContent(/Signature/);
    expect(strip).toHaveTextContent(/may drift/i);
  });

  it('shows the honest "not grounded yet" strip when no brand fields are supplied', () => {
    render(<AssetDetailTabs asset={makeAsset()} imagePrompt="A studio shot." />);
    const strip = screen.getByTestId('v4-grounded-strip');
    expect(strip).toHaveAttribute('data-grounded', 'empty');
    expect(strip).toHaveTextContent(/not grounded in any brand fields yet/i);
  });

  it('wires each tab panel to its tab for a11y (role=tabpanel + aria-labelledby)', () => {
    render(<AssetDetailTabs asset={makeAsset()} imagePrompt="A studio shot." />);
    const panel = document.getElementById('asset-tab-panel-image-prompt');
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'asset-tab-btn-image-prompt');
    expect(screen.getByTestId('asset-tab-image-prompt')).toHaveAttribute(
      'aria-controls',
      'asset-tab-panel-image-prompt',
    );
  });
});
