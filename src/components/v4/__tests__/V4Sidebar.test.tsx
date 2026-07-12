import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { V4Sidebar } from '../V4Sidebar';
import { V4_ROUTES } from '@/config/v4';

// ProfileMenu pulls auth/services we don't need here — stub it out.
vi.mock('../ProfileMenu', () => ({ ProfileMenu: () => null }));

describe('V4Sidebar', () => {
  it('points the Onboarding link at the CHOICE screen (/v4/start)', () => {
    render(
      <MemoryRouter initialEntries={['/v4/diagnose']}>
        <V4Sidebar />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Onboarding' });
    expect(link).toHaveAttribute('href', V4_ROUTES.CHOICE);
    expect(V4_ROUTES.CHOICE).toBe('/v4/start');
  });
});
