import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import V4OnboardingChoice from '../V4OnboardingChoice';
import { V4_ROUTES } from '@/config/v4';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const capture = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (name: string) => capture(name),
}));

function renderChoice(): void {
  render(
    <MemoryRouter>
      <V4OnboardingChoice />
    </MemoryRouter>,
  );
}

describe('V4OnboardingChoice — post-signup fork', () => {
  beforeEach(() => {
    navigate.mockClear();
    capture.mockClear();
  });

  it('emits the viewed event on mount and renders both paths', () => {
    renderChoice();
    expect(capture).toHaveBeenCalledWith('v4_onboard_choice_viewed');
    expect(screen.getByTestId('choice-connector-cta')).toBeInTheDocument();
    expect(screen.getByTestId('choice-in-app-link')).toBeInTheDocument();
  });

  it('primary CTA routes to the connector setup and emits its event', () => {
    renderChoice();
    fireEvent.click(screen.getByTestId('choice-connector-cta'));
    expect(capture).toHaveBeenCalledWith('v4_onboard_choice_connector');
    expect(navigate).toHaveBeenCalledWith(V4_ROUTES.CONNECTOR);
  });

  it('secondary link routes to the in-app megaprompt path and emits its event', () => {
    renderChoice();
    fireEvent.click(screen.getByTestId('choice-in-app-link'));
    expect(capture).toHaveBeenCalledWith('v4_onboard_choice_in_app');
    expect(navigate).toHaveBeenCalledWith(V4_ROUTES.ROOT);
  });

  it('marks the connector path as the recommended (primary) choice', () => {
    renderChoice();
    expect(screen.getByTestId('choice-connector-card')).toHaveTextContent(/recommended/i);
  });
});
