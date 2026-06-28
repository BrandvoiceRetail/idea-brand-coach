import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

/** Renders a gated `/v4/start` route + a stub `/auth` so we can assert redirects. */
function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/v4/start"
          element={
            <RequireAuth>
              <div>protected content</div>
            </RequireAuth>
          }
        />
        <Route path="/auth" element={<div>auth screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  it('renders the protected content for an authenticated user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' }, loading: false } as ReturnType<typeof useAuth>);
    renderAt('/v4/start');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user to /auth (preserving the path)', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
    renderAt('/v4/start');
    expect(screen.getByText('auth screen')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders nothing while auth is still loading', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);
    renderAt('/v4/start');
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('auth screen')).not.toBeInTheDocument();
  });
});
