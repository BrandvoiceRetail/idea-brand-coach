import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBrandSnapshot } from '../useBrandSnapshot';

// Mock the data-layer deps so the hook can be tested in isolation.
const brand = { brandData: { userInfo: { company: 'Acme' } } };
const avatarCtx: { currentAvatar: unknown } = { currentAvatar: null };
const diag: { latestDiagnostic: unknown; isLoadingLatest: boolean } = { latestDiagnostic: null, isLoadingLatest: false };
const reviews: { rating: number | null; body: string; title: string | null }[] = [];

vi.mock('@/contexts/BrandContext', () => ({ useBrand: () => brand }));
vi.mock('@/contexts/AvatarContext', () => ({ useAvatarContext: () => avatarCtx }));
vi.mock('@/hooks/useDiagnostic', () => ({ useDiagnostic: () => diag }));
vi.mock('@/services/ServiceProvider', () => ({
  useServices: () => ({ productDataService: { getAllReviews: () => Promise.resolve(reviews) } }),
}));

beforeEach(() => {
  brand.brandData.userInfo.company = 'Acme';
  avatarCtx.currentAvatar = null;
  diag.latestDiagnostic = null;
  diag.isLoadingLatest = false;
  reviews.length = 0;
});

describe('useBrandSnapshot', () => {
  it('falls back to the seeded example when there is no brand, avatar, or diagnostic', () => {
    brand.brandData.userInfo.company = '';
    const { result } = renderHook(() => useBrandSnapshot());
    expect(result.current.isLive).toBe(false);
    expect(result.current.snapshot.brand).toBe('InfinityVault'); // SEED
  });

  it('goes live with the real brand + rescaled Trust Gap when a diagnostic exists', () => {
    diag.latestDiagnostic = { scores: { overall: 58, insight: 76, distinctive: 60, empathetic: 36, authentic: 60 } };
    const { result } = renderHook(() => useBrandSnapshot());
    expect(result.current.isLive).toBe(true);
    expect(result.current.snapshot.brand).toBe('Acme');
    const tg = result.current.snapshot.trustGap!;
    expect(tg.primaryGap).toBe('empathetic'); // lowest raw score
    // 36/100 rescales to 9/25
    expect(tg.pillars.empathetic).toBe(9);
    expect(result.current.needsDiagnostic).toBe(false);
  });

  it('flags needsDiagnostic when there is a brand but no diagnostic', () => {
    const { result } = renderHook(() => useBrandSnapshot());
    expect(result.current.isLive).toBe(true);
    expect(result.current.needsDiagnostic).toBe(true);
    expect(result.current.snapshot.brand).toBe('Acme');
  });

  it('maps the avatar psychographics into the four forensic fields', () => {
    avatarCtx.currentAvatar = {
      id: 'a1',
      name: 'The collector',
      voice_of_customer: 'flimsy — I don’t trust it',
      psychographics: { desires: ['protect my chase cards'], triggers: ['proof it lasts'], fears: ['been burned before'] },
    };
    const { result } = renderHook(() => useBrandSnapshot());
    expect(result.current.snapshot.avatar?.howTheyTalk).toMatch(/flimsy/);
    expect(result.current.snapshot.avatar?.topObjection).toMatch(/burned/);
  });

  it('loads review evidence (3-star-and-below first), async', async () => {
    diag.latestDiagnostic = { scores: { overall: 58, insight: 76, distinctive: 60, empathetic: 36, authentic: 60 } };
    reviews.push({ rating: 5, body: 'love it', title: null }, { rating: 2, body: 'bent my cards', title: null });
    const { result } = renderHook(() => useBrandSnapshot());
    await waitFor(() => expect(result.current.snapshot.evidence.length).toBe(2));
    expect(result.current.snapshot.evidence[0]).toBe('bent my cards'); // lowest rating ranked first
  });
});
