import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * T11 — funnel pieces are BRAND-scoped, evaluated per-avatar. FixService resolves
 * the brand from the active avatar lens (avatars.brand_id) and reads pieces via the
 * brand-scoped `listBrandAssets(brandId, avatarId)` — so switching to another avatar
 * of the SAME brand shows the SAME pieces (only the verdict overlay changes), which
 * is the bug this fixes. The supabase client is mocked only for the avatar→brand
 * resolution; the funnel reads go through an injected fake service.
 */

const maybeSingle = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  },
}));

import { FixService } from '@/services/v4/fixService';
import type { IBrandFunnelService, BrandAsset } from '@/services/interfaces/IBrandFunnelService';

const piece = (id: string, touchpoint: string, status: BrandAsset['status']): BrandAsset => ({
  id,
  avatar_id: 'av1',
  brand_id: 'brand-1',
  touchpoint_id: touchpoint,
  stage: 'consideration',
  context_description: 'ctx',
  storage_path: null,
  content_text: 'Title line\nbullet',
  signature_version: null,
  status,
  overall_score: null,
  previous_score: null,
  audit_result: null,
  superseded_by: null,
  created_at: '2026-06-29T00:00:00Z',
  updated_at: '2026-06-29T00:00:00Z',
});

function fakeFunnel(over: Partial<IBrandFunnelService>): IBrandFunnelService {
  return {
    createAsset: vi.fn(),
    listAssets: vi.fn(),
    listBrandAssets: vi.fn(),
    getAsset: vi.fn(),
    auditAsset: vi.fn(),
    auditAssetForAvatar: vi.fn(),
    reAuditWithScreenshot: vi.fn(),
    applyRewrite: vi.fn(),
    getAvatarFieldCount: vi.fn(),
    getCoverage: vi.fn(),
    getBrandCoverage: vi.fn(),
    recordTest: vi.fn(),
    closeTest: vi.fn(),
    getAssetRoi: vi.fn(),
    getAssetRoiForBrand: vi.fn(),
    ...over,
  } as unknown as IBrandFunnelService;
}

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { brand_id: 'brand-1' }, error: null });
});

describe('FixService — brand-scoped funnel pieces (T11)', () => {
  it('resolves the brand from the avatar and reads pieces BY BRAND, not by avatar', async () => {
    const listBrandAssets = vi.fn(async (brandId: string, avatarId: string | null) => {
      expect(brandId).toBe('brand-1');
      expect(avatarId).toBe('av1');
      return { data: [piece('p1', 'amazon_listing_copy', 'misaligned')], error: null };
    });
    const svc = new FixService(fakeFunnel({ listBrandAssets }));

    const res = await svc.getFunnelPieces('av1');

    expect(listBrandAssets).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.data.map((p) => p.id)).toEqual(['p1']);
  });

  it('returns honest no_data (never fabricates) when the brand has no pieces', async () => {
    const svc = new FixService(
      fakeFunnel({ listBrandAssets: vi.fn(async () => ({ data: [], error: null })) }),
    );
    const res = await svc.getFunnelPieces('av1');
    expect(res.status).toBe('no_data');
  });

  it('errors honestly when the avatar resolves no brand', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { brand_id: null }, error: null });
    const svc = new FixService(fakeFunnel({}));
    const res = await svc.getFunnelPieces('av1');
    expect(res.status).toBe('error');
  });

  it('re-audits an existing piece from a screenshot, scored for the active avatar', async () => {
    const reAuditWithScreenshot = vi.fn(async (id: string, _file: File, avatarId: string) => {
      expect(id).toBe('p1');
      expect(avatarId).toBe('av1');
      return { data: piece('p1', 'amazon_listing_copy', 'aligned'), error: null };
    });
    const svc = new FixService(fakeFunnel({ reAuditWithScreenshot }));
    const file = new File(['x'], 'shot.png', { type: 'image/png' });

    const res = await svc.reAuditPiece('p1', file, 'av1');

    expect(reAuditWithScreenshot).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('ok');
    if (res.status === 'ok') expect(res.data.status).toBe('doing_job'); // aligned → doing_job verdict
  });

  it('refuses to re-audit without an avatar lens (honest error, no fabrication)', async () => {
    const svc = new FixService(fakeFunnel({}));
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const res = await svc.reAuditPiece('p1', file, null);
    expect(res.status).toBe('error');
  });

  it('lists tests across the BRAND pieces (brand-scoped roi), not the avatar', async () => {
    const getAssetRoiForBrand = vi.fn(async (brandId: string) => {
      expect(brandId).toBe('brand-1');
      return { data: [], error: null };
    });
    const svc = new FixService(
      fakeFunnel({
        getAssetRoiForBrand,
        listBrandAssets: vi.fn(async () => ({ data: [], error: null })),
      }),
    );
    const res = await svc.listTests('av1');
    expect(getAssetRoiForBrand).toHaveBeenCalledWith('brand-1');
    expect(res.status).toBe('no_data');
  });
});
