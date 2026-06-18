/**
 * useFunnelTracker — loads the Brand Funnel Tracker state for an avatar and exposes
 * refresh + audit actions + per-avatar channel tags. Backed by SupabaseBrandFunnelService.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SupabaseBrandFunnelService } from '../services/SupabaseBrandFunnelService';
import { captureAlphaEvent } from '../lib/posthogClient';
import type { ApplicabilityTag } from '../config/touchpointTaxonomy';
import type { BrandAsset, BrandTest, FunnelCoverage } from '../services/interfaces/IBrandFunnelService';

/** Default channel set for a new brand until the user narrows it. */
export const DEFAULT_BRAND_TAGS: ApplicabilityTag[] = [
  'amazon', 'shopify', 'dtc_site', 'email', 'organic_social', 'paid_social', 'packaging',
];

const TAGS_KEY = (avatarId: string): string => `funnel-tags-${avatarId}`;

function loadTags(avatarId: string | null): ApplicabilityTag[] {
  if (!avatarId) return DEFAULT_BRAND_TAGS;
  try {
    const raw = localStorage.getItem(TAGS_KEY(avatarId));
    if (raw) return JSON.parse(raw) as ApplicabilityTag[];
  } catch { /* ignore */ }
  return DEFAULT_BRAND_TAGS;
}

interface FunnelTrackerState {
  coverage: FunnelCoverage | null;
  assets: BrandAsset[];
  tests: BrandTest[];
  avatarFieldCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  auditAsset: (assetId: string) => Promise<void>;
  reauditAll: () => Promise<void>;
  brandTags: ApplicabilityTag[];
  setBrandTags: (tags: ApplicabilityTag[]) => void;
  service: SupabaseBrandFunnelService;
}

export function useFunnelTracker(avatarId: string | null): FunnelTrackerState {
  const service = useMemo(() => new SupabaseBrandFunnelService(), []);
  const [coverage, setCoverage] = useState<FunnelCoverage | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [tests, setTests] = useState<BrandTest[]>([]);
  const [avatarFieldCount, setAvatarFieldCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [brandTags, setBrandTagsState] = useState<ApplicabilityTag[]>(() => loadTags(avatarId));

  useEffect(() => { setBrandTagsState(loadTags(avatarId)); }, [avatarId]);

  const setBrandTags = useCallback((tags: ApplicabilityTag[]) => {
    setBrandTagsState(tags);
    if (avatarId) {
      try { localStorage.setItem(TAGS_KEY(avatarId), JSON.stringify(tags)); } catch { /* ignore */ }
    }
  }, [avatarId]);

  const refresh = useCallback(async () => {
    if (!avatarId) { setCoverage(null); setAssets([]); setTests([]); return; }
    setLoading(true);
    setError(null);
    const [cov, ass, roi, fieldCount] = await Promise.all([
      service.getCoverage(avatarId, brandTags),
      service.listAssets(avatarId),
      service.getAssetRoi(avatarId),
      service.getAvatarFieldCount(avatarId),
    ]);
    if (cov.error || ass.error || roi.error) setError(cov.error ?? ass.error ?? roi.error);
    setCoverage(cov.data);
    setAssets(ass.data ?? []);
    setTests(roi.data ?? []);
    setAvatarFieldCount(fieldCount);
    setLoading(false);
    if (cov.data) captureAlphaEvent('funnel_coverage_viewed', { coverage_pct: cov.data.coveragePct, tracked: ass.data?.length ?? 0 });
  }, [avatarId, brandTags, service]);

  const auditAsset = useCallback(async (assetId: string) => {
    const { error: auditErr } = await service.auditAsset(assetId);
    if (auditErr) setError(auditErr);
    await refresh();
  }, [service, refresh]);

  const reauditAll = useCallback(async () => {
    setLoading(true);
    for (const a of assets) {
      // eslint-disable-next-line no-await-in-loop
      await service.auditAsset(a.id);
    }
    await refresh();
  }, [assets, service, refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { coverage, assets, tests, avatarFieldCount, loading, error, refresh, auditAsset, reauditAll, brandTags, setBrandTags, service };
}
