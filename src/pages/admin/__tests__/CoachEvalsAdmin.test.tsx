import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { AdminGate } from '@/components/AdminGate';
import CoachEvalsAdmin from '../CoachEvalsAdmin';
import { isAdminEmail } from '@/config/admin';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

const mockAuth = (over: Record<string, unknown>) =>
  vi.mocked(useAuth).mockReturnValue({ user: null, session: null, loading: false, ...over } as never);

beforeEach(() => vi.clearAllMocks());

describe('isAdminEmail', () => {
  it('allows the built-in owner fallback, case-insensitive', () => {
    expect(isAdminEmail('matthew@arisegroup.ai')).toBe(true);
    expect(isAdminEmail('Matthew@AriseGroup.ai')).toBe(true);
  });
  it('rejects unknown + empty emails', () => {
    expect(isAdminEmail('stranger@example.com')).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});

describe('AdminGate', () => {
  it('renders children for an admin', () => {
    mockAuth({ user: { email: 'matthew@arisegroup.ai' } });
    render(
      <AdminGate>
        <div>secret admin content</div>
      </AdminGate>,
    );
    expect(screen.getByText('secret admin content')).toBeInTheDocument();
  });

  it('blocks a non-admin with a restricted notice (content not rendered)', () => {
    mockAuth({ user: { email: 'stranger@example.com' } });
    render(
      <AdminGate>
        <div>secret admin content</div>
      </AdminGate>,
    );
    expect(screen.queryByText('secret admin content')).not.toBeInTheDocument();
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
  });

  it('shows a loader while auth initialises', () => {
    mockAuth({ user: null, loading: true });
    const { container } = render(
      <AdminGate>
        <div>secret admin content</div>
      </AdminGate>,
    );
    expect(screen.queryByText('secret admin content')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});

describe('CoachEvalsAdmin dashboard', () => {
  it('renders the generated report: hero score, current config, value KPIs', () => {
    render(<CoachEvalsAdmin />);
    expect(screen.getByText('Brand Coach — Performance')).toBeInTheDocument();
    expect(screen.getByText('Coach value score')).toBeInTheDocument();
    // current config label appears in the hero badge
    expect(screen.getByText(/App Skills \+ Book/i)).toBeInTheDocument();
    // a value KPI from the default tab
    expect(screen.getByText('Skill faithfulness')).toBeInTheDocument();
  });
});
