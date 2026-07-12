import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * V4Diagnose returning-user routing (per ux-design-entry-experience.md §B —
 * "Diagnose → Fix routing"). A user who already has a saved Trust Gap (been
 * through the diagnostic, or onboarded via the MCP connector) gets a recap that
 * routes to Fix instead of restarting; a fresh user gets the diagnostic; and the
 * recap's "re-run" escape always drops back into the diagnostic.
 */

const navigateSpy = vi.fn();
const getLatestDiagnostic = vi.fn();
let avatarState: { selectedAvatarId: string | null; isLoadingAvatars: boolean } = {
  selectedAvatarId: 'a1',
  isLoadingAvatars: false,
};

vi.mock('@/lib/posthogClient', () => ({ captureAlphaEvent: vi.fn() }));
vi.mock('@/contexts/AvatarContext', () => ({ useAvatarContext: () => avatarState }));
vi.mock('@/services/ServiceProvider', () => ({
  useServices: () => ({ diagnosticService: { getLatestDiagnostic } }),
}));
vi.mock('@/pages/v2/ProblemSolverDiagnostic', () => ({
  default: () => <div data-testid="diagnostic-stub" />,
}));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// Imported AFTER the mocks so V4Diagnose picks them up.
import V4Diagnose from '@/pages/v4/V4Diagnose';

const SCORED = {
  id: 'd1',
  user_id: 'u1',
  answers: {},
  scores: { overall: 54, insight: 12, distinctive: 18, empathetic: 8, authentic: 16 },
  completed_at: '2026-06-29T00:00:00Z',
  created_at: '2026-06-29T00:00:00Z',
  updated_at: '2026-06-29T00:00:00Z',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <V4Diagnose />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  avatarState = { selectedAvatarId: 'a1', isLoadingAvatars: false };
});

describe('V4Diagnose returning-user routing', () => {
  it('shows a recap and routes to Fix when the user already has a Trust Gap', async () => {
    getLatestDiagnostic.mockResolvedValue(SCORED);
    renderPage();

    const cta = await screen.findByTestId('v4-diagnose-continue-to-fix');
    // The questionnaire is NOT rendered for an already-diagnosed user.
    expect(screen.queryByTestId('diagnostic-stub')).toBeNull();

    fireEvent.click(cta);
    expect(navigateSpy).toHaveBeenCalledWith('/v4/fix');
  });

  it('renders the diagnostic for a first-time user (no saved Trust Gap)', async () => {
    getLatestDiagnostic.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByTestId('diagnostic-stub')).toBeTruthy();
    expect(screen.queryByTestId('v4-diagnose-recap')).toBeNull();
  });

  it('lets the user re-run the diagnostic from the recap', async () => {
    getLatestDiagnostic.mockResolvedValue(SCORED);
    renderPage();

    const rerun = await screen.findByTestId('v4-diagnose-rerun');
    fireEvent.click(rerun);

    expect(await screen.findByTestId('diagnostic-stub')).toBeTruthy();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
