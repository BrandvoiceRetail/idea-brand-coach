/**
 * FunnelTracker — Competitor-Agents integration tests.
 *
 * Verifies the competitor surface is mounted into the CANONICAL FunnelTracker and
 * gated behind COMPETITOR_AGENTS: each needs-work funnel piece gets its own
 * TouchpointCompetitorAgentPanel (scoped to that asset's touchpoint), the "What
 * Needs Work" tab carries the CompetitorGapsAggregate rollup, and a "Defense" tab
 * appears. With the flag off, none of that renders.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FunnelTracker } from '../FunnelTracker';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useFunnelTracker } from '@/hooks/useFunnelTracker';
import type { BrandAsset } from '@/services/interfaces/IBrandFunnelService';

vi.mock('@/contexts/AvatarContext');
vi.mock('@/hooks/useFunnelTracker');
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));

// COMPETITOR_AGENTS gate. Default ON; the off-state is exercised explicitly.
let competitorAgentsEnabled = true;
// CONTENT_GENERATION gate stays OFF here so the generate surface doesn't change
// this test's competitor-focused assertions (it has its own coverage).
const contentGenerationEnabled = false;
vi.mock('@/config/features', () => ({
  isCompetitorAgentsEnabled: () => competitorAgentsEnabled,
  isContentGenerationEnabled: () => contentGenerationEnabled,
}));

// Stub the leaf panels so this test focuses on the FunnelTracker wiring (mounting
// + gating + scoping), not the panels' internals (covered by their own tests).
vi.mock('../TouchpointCompetitorAgentPanel', () => ({
  TouchpointCompetitorAgentPanel: ({ assetId, touchpointId }: { assetId: string; touchpointId: string }) => (
    <div data-testid="competitor-panel" data-asset={assetId} data-touchpoint={touchpointId} />
  ),
}));
vi.mock('../CompetitorGapsAggregate', () => ({
  CompetitorGapsAggregate: ({ pieces }: { pieces: unknown[] }) => (
    <div data-testid="competitor-aggregate" data-count={pieces.length} />
  ),
}));
vi.mock('../TestingLiftTab', () => ({
  TestingLiftTab: () => <div data-testid="testing-lift-tab" />,
}));
vi.mock('../BrandDefenseAlertsPanel', () => ({
  BrandDefenseAlertsPanel: () => <div data-testid="brand-defense-panel" />,
}));
vi.mock('@/hooks/useBrandDefenseAlerts', () => ({
  useBrandDefenseAlerts: () => ({
    alerts: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    loadAlerts: vi.fn(),
    refreshUnreadCount: vi.fn(),
    markRead: vi.fn(),
  }),
}));

function asset(overrides: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: 'asset-1',
    avatar_id: 'avatar-1',
    touchpoint_id: 'amazon_listing_copy',
    stage: 'consideration',
    context_description: 'listing copy',
    storage_path: null,
    content_text: 'Current listing copy.',
    positioning_statement_version: null,
    status: 'misaligned',
    overall_score: 40,
    previous_score: null,
    audit_result: null,
    superseded_by: null,
    created_at: '2026-06-17T00:00:00Z',
    updated_at: '2026-06-17T00:00:00Z',
    ...overrides,
  };
}

function mockFunnel(assets: BrandAsset[]): void {
  vi.mocked(useFunnelTracker).mockReturnValue({
    coverage: { byStage: [], counts: { aligned: 0, stale: 0, misaligned: assets.length, missing: 0 }, coveragePct: 0, targetPct: 80 },
    assets,
    tests: [],
    avatarFieldCount: 6,
    loading: false,
    error: null,
    refresh: vi.fn(),
    auditAsset: vi.fn(),
    reauditAll: vi.fn(),
    brandTags: ['amazon'],
    setBrandTags: vi.fn(),
    service: {} as never,
  } as ReturnType<typeof useFunnelTracker>);
}

function renderTracker(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <FunnelTracker />
    </MemoryRouter>,
  );
}

/** Activate the "What Needs Work" tab (Radix Tabs only renders the active panel). */
async function openNeedsWorkTab(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: /what needs work/i }));
}

describe('FunnelTracker — Competitor-Agents integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    competitorAgentsEnabled = true;
    vi.mocked(useAvatarContext).mockReturnValue({
      selectedAvatarId: 'avatar-1',
      currentAvatar: { id: 'avatar-1', name: 'Test Brand' },
    } as ReturnType<typeof useAvatarContext>);
    mockFunnel([asset()]);
  });

  it('mounts a per-touchpoint competitor agent on each needs-work piece, scoped to its touchpoint', async () => {
    renderTracker();
    await openNeedsWorkTab();
    const panel = screen.getByTestId('competitor-panel');
    expect(panel).toHaveAttribute('data-asset', 'asset-1');
    expect(panel).toHaveAttribute('data-touchpoint', 'amazon_listing_copy');
  });

  it('renders the competitor-gaps aggregate over the needs-work pieces', async () => {
    renderTracker();
    await openNeedsWorkTab();
    expect(screen.getByTestId('competitor-aggregate')).toHaveAttribute('data-count', '1');
  });

  it('shows the Defense tab when COMPETITOR_AGENTS is enabled', () => {
    renderTracker();
    expect(screen.getByRole('tab', { name: /defense/i })).toBeInTheDocument();
  });

  it('renders nothing competitor-related when COMPETITOR_AGENTS is disabled', async () => {
    competitorAgentsEnabled = false;
    renderTracker();
    // The base funnel tabs still render.
    expect(screen.getByRole('tab', { name: /what needs work/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /defense/i })).not.toBeInTheDocument();
    await openNeedsWorkTab();
    expect(screen.queryByTestId('competitor-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('competitor-aggregate')).not.toBeInTheDocument();
  });
});
