import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TouchpointCompetitorAgentPanel } from '../TouchpointCompetitorAgentPanel';
import { useCompetitorInsights } from '@/hooks/useCompetitorInsights';
import type { CompetitorAnalysisResult } from '@/types/competitorInsights';

vi.mock('@/hooks/useCompetitorInsights');

// COMPETITOR_AGENTS gate (P7b). Default ENABLED for these state tests; the
// off-state (panel renders nothing) is covered explicitly below.
let competitorAgentsEnabled = true;
vi.mock('@/config/features', () => ({
  isCompetitorAgentsEnabled: () => competitorAgentsEnabled,
}));

const analyzeCompetitors = vi.fn();
const loadInsights = vi.fn();

function mockHook(overrides: Partial<ReturnType<typeof useCompetitorInsights>> = {}): void {
  vi.mocked(useCompetitorInsights).mockReturnValue({
    analysis: null,
    insights: [],
    isAnalyzing: false,
    isLoading: false,
    error: null,
    analyzeCompetitors,
    loadInsights,
    ...overrides,
  });
}

const RESULT: CompetitorAnalysisResult = {
  competitors: [
    {
      name: 'Acme Sleep',
      url: 'https://amazon.com/dp/B0TEST',
      idea_scores: { i: 60, d: 40, e: 30, a: 55 },
      rationale: 'Strong insight, weak empathy.',
      gap_to_our_avatar: 'Speaks to dosage, not the bedtime ritual our avatar cares about.',
      evidence_refs: [{ kind: 'listing', ref: 'asin:B0TEST' }],
    },
  ],
  strategicAngle: 'Own the bedtime ritual narrative.',
  grounding: 'evidence',
  evidenceRefs: [{ kind: 'listing', ref: 'asin:B0TEST' }],
  insightId: 'insight-1',
  needsInput: null,
};

const BASE_PROPS = {
  assetId: 'asset-1',
  touchpointId: 'amazon_listing_copy',
  touchpointLabel: 'Amazon listing copy',
  avatarId: 'avatar-1',
};

describe('TouchpointCompetitorAgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    competitorAgentsEnabled = true;
    mockHook();
  });

  it('renders the touchpoint-tailored analyze CTA in the idle state', () => {
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(
      screen.getByRole('button', { name: /analyze competitors for amazon listing copy/i }),
    ).toBeInTheDocument();
  });

  it('invokes analyzeCompetitors with the touchpoint-scoped request on click', () => {
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} category="sleep gummies" />);
    fireEvent.click(screen.getByRole('button', { name: /analyze competitors/i }));
    expect(analyzeCompetitors).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'asset-1',
        touchpointId: 'amazon_listing_copy',
        modality: 'marketplace-listing',
        avatarId: 'avatar-1',
        category: 'sleep gummies',
      }),
    );
  });

  it('shows a loading indicator while analyzing', () => {
    mockHook({ isAnalyzing: true });
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(screen.getByText(/gathering grounded competitor evidence/i)).toBeInTheDocument();
  });

  it('renders IDEA-scored competitor cards + strategic angle on result', () => {
    mockHook({ analysis: RESULT });
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(screen.getByText('Acme Sleep')).toBeInTheDocument();
    expect(screen.getByText(/gap to our avatar/i)).toBeInTheDocument();
    expect(screen.getByText(/own the bedtime ritual narrative/i)).toBeInTheDocument();
  });

  it('fires the Draft countermeasure callback with the strategic angle', () => {
    const onDraft = vi.fn();
    mockHook({ analysis: RESULT });
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} onDraftCountermeasure={onDraft} />);
    fireEvent.click(screen.getByRole('button', { name: /draft countermeasure/i }));
    expect(onDraft).toHaveBeenCalledWith('Own the bedtime ritual narrative.', 'asset-1');
  });

  it('surfaces the grounding-gate needs-input prompt instead of competitors', () => {
    mockHook({
      analysis: {
        ...RESULT,
        competitors: [],
        grounding: 'inference',
        needsInput: [{ slot: 1, question: 'Provide a category or competitor ASIN.', why: 'Grounding gate.' }],
      },
    });
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(screen.getByText(/more input needed/i)).toBeInTheDocument();
    expect(screen.getByText(/provide a category or competitor asin/i)).toBeInTheDocument();
    expect(screen.queryByText('Acme Sleep')).not.toBeInTheDocument();
  });

  it('renders the error state on failure', () => {
    mockHook({ error: 'Unable to analyze competitors right now.' });
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    expect(screen.getByText(/unable to analyze competitors right now/i)).toBeInTheDocument();
  });

  it('renders the empty state when a run grounds no competitors (no needs-input)', () => {
    mockHook({
      analysis: { ...RESULT, competitors: [], strategicAngle: null, insightId: null, needsInput: null },
    });
    render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(screen.getByText(/no grounded competitors were found/i)).toBeInTheDocument();
    expect(screen.queryByText('Acme Sleep')).not.toBeInTheDocument();
    // Empty != needs-input: the grounding-gate prompt must NOT show here.
    expect(screen.queryByText(/more input needed/i)).not.toBeInTheDocument();
  });

  // ── COMPETITOR_AGENTS gate (P7b) ─────────────────────────────────────────────

  it('renders nothing when COMPETITOR_AGENTS is disabled', () => {
    competitorAgentsEnabled = false;
    mockHook({ analysis: RESULT });
    const { container } = render(<TouchpointCompetitorAgentPanel {...BASE_PROPS} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /analyze competitors/i })).not.toBeInTheDocument();
  });
});
