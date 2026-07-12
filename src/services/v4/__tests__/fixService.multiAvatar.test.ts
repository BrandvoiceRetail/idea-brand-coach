import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Multi-avatar funnel analysis. Pieces are BRAND-scoped; getFunnelPiecesForSet reads
 * the brand's pieces once PER selected avatar (the per-avatar verdict overlay via
 * listBrandAssets), combines by piece id, and rolls up to the deterministic
 * weakest-link verdict. The supabase client is mocked only for avatar→brand
 * resolution; the funnel reads go through an injected fake service (mirrors
 * fixService.brandScope.test.ts).
 */
const maybeSingle = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

import { FixService, weakestLinkVerdict } from '@/services/v4/fixService';
import type { IBrandFunnelService, BrandAsset } from '@/services/interfaces/IBrandFunnelService';
import type { JobVerdict } from '@/types/v4Fix';

const piece = (id: string, touchpoint: string, status: BrandAsset['status'], avatarId: string): BrandAsset => ({
  id,
  avatar_id: avatarId,
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

const v = (...xs: JobVerdict[]): JobVerdict[] => xs;

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { brand_id: 'brand-1' }, error: null });
});

describe('weakestLinkVerdict — multi-avatar funnel rollup', () => {
  it('is doing_job only when EVERY selected customer is doing_job', () => {
    expect(weakestLinkVerdict(v('doing_job', 'doing_job', 'doing_job'))).toBe('doing_job');
  });
  it('drops to the WORST verdict when any customer needs work', () => {
    expect(weakestLinkVerdict(v('doing_job', 'leaking'))).toBe('leaking');
    expect(weakestLinkVerdict(v('doing_job', 'off_brand'))).toBe('off_brand');
    expect(weakestLinkVerdict(v('doing_job', 'missing'))).toBe('missing');
  });
  it('orders severity missing > off_brand > leaking > doing_job', () => {
    expect(weakestLinkVerdict(v('leaking', 'off_brand'))).toBe('off_brand');
    expect(weakestLinkVerdict(v('off_brand', 'missing'))).toBe('missing');
    expect(weakestLinkVerdict(v('leaking', 'missing', 'doing_job'))).toBe('missing');
  });
  it('passes a single-element set through and defaults to doing_job on empty', () => {
    expect(weakestLinkVerdict(v('leaking'))).toBe('leaking');
    expect(weakestLinkVerdict([])).toBe('doing_job');
  });
});

describe('FixService.getFunnelPiecesForSet — brand-scoped overlay model', () => {
  it('combines per-avatar overlays by piece and rolls up to the weakest link', async () => {
    // Same brand piece p1, evaluated differently per avatar lens.
    const listBrandAssets = vi.fn(async (brandId: string, avatarId: string | null) => ({
      data: [piece('p1', 'amazon_listing_copy', avatarId === 'av1' ? 'aligned' : 'misaligned', avatarId ?? '')],
      error: null,
    }));
    const svc = new FixService(fakeFunnel({ listBrandAssets }));

    const res = await svc.getFunnelPiecesForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].status).toBe('off_brand'); // weakest of [doing_job, off_brand]
    expect(res.data[0].perAvatar).toEqual([
      { avatarId: 'av1', avatarName: 'Maya', status: 'doing_job' },
      { avatarId: 'av2', avatarName: 'Rico', status: 'off_brand' },
    ]);
    expect(listBrandAssets).toHaveBeenCalledTimes(2); // once per selected avatar
  });

  it('is doing_job only when the piece serves every selected customer', async () => {
    const listBrandAssets = vi.fn(async (_b: string, avatarId: string | null) => ({
      data: [piece('p1', 'amazon_listing_copy', 'aligned', avatarId ?? '')],
      error: null,
    }));
    const svc = new FixService(fakeFunnel({ listBrandAssets }));
    const res = await svc.getFunnelPiecesForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.data[0].status).toBe('doing_job');
  });

  it('delegates a single-id set to the single-avatar path (one brand read)', async () => {
    const listBrandAssets = vi.fn(async (_b: string, avatarId: string | null) => ({
      data: [piece('p1', 'amazon_listing_copy', 'aligned', avatarId ?? '')],
      error: null,
    }));
    const svc = new FixService(fakeFunnel({ listBrandAssets }));
    const res = await svc.getFunnelPiecesForSet(['av1'], { av1: 'Maya' });
    expect(res.status).toBe('ok');
    expect(listBrandAssets).toHaveBeenCalledTimes(1);
    expect(listBrandAssets).toHaveBeenCalledWith('brand-1', 'av1');
  });

  it('honest no_data when the brand has no pieces', async () => {
    const listBrandAssets = vi.fn(async () => ({ data: [], error: null }));
    const svc = new FixService(fakeFunnel({ listBrandAssets }));
    const res = await svc.getFunnelPiecesForSet(['av1', 'av2'], { av1: 'Maya', av2: 'Rico' });
    expect(res.status).toBe('no_data');
  });
});
