/**
 * useBrandSnapshot — loads the signed-in owner's REAL brand state into a BrandSnapshot for the
 * focus surface: their Trust Gap diagnostic (rescaled /25), their Avatar 2.0 portrait, and review
 * evidence. Until they've run a diagnostic, it falls back to the seeded InfinityVault example
 * (clearly flagged via `isLive`) so the surface is never empty or broken.
 *
 * This is the seam the focus surface was built behind — the page imports this instead of SEED_SNAPSHOT.
 */
import { useEffect, useMemo, useState } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useServices } from '@/services/ServiceProvider';
import { buildTrustGap } from '@/lib/trustGap';
import type { Avatar } from '@/types/avatar';
import { SEED_SNAPSHOT } from './engine';
import type { BrandSnapshot, Pillar } from './types';

const list = (xs?: string[] | null): string => (xs && xs.length ? xs.join(' · ') : '');

/** Map the basic Avatar object to the four forensic-portrait fields (best available client-side). */
function avatarFields(a: Avatar | null): BrandSnapshot['avatar'] | undefined {
  if (!a) return undefined;
  const psy = a.psychographics ?? {};
  const howTheyTalk = a.voice_of_customer?.trim() || list(psy.values);
  const whyBuyingToday = list(psy.desires) || a.buying_behavior?.intent || a.description?.trim() || '';
  const trustSignals = list(psy.triggers);
  const topObjection = list(psy.fears);
  // Only surface the panel if we actually have something real to show. Empty fields stay '' (not
  // placeholder prose) so they never get fed to the live copy generator as fake targeting/objection
  // text — downstream fallbacks (composeDeliverable/generate) handle the empties.
  if (!howTheyTalk && !whyBuyingToday && !trustSignals && !topObjection) return undefined;
  return { howTheyTalk, whyBuyingToday, trustSignals, topObjection };
}

export interface BrandSnapshotState {
  snapshot: BrandSnapshot;
  /** True once the owner's real diagnostic is loaded (false = showing the seeded example). */
  isLive: boolean;
  isLoading: boolean;
  /** They have a brand/avatar but no diagnostic yet — prompt them to run it. */
  needsDiagnostic: boolean;
}

export function useBrandSnapshot(): BrandSnapshotState {
  const { brandData } = useBrand();
  const { currentAvatar } = useAvatarContext();
  const { latestDiagnostic, isLoadingLatest } = useDiagnostic();
  const { productDataService } = useServices();

  const [evidence, setEvidence] = useState<string[]>([]);

  // Load review evidence for the current brand (3-star-and-below first — the forensic gold).
  useEffect(() => {
    let cancelled = false;
    productDataService
      .getAllReviews()
      .then((reviews) => {
        if (cancelled) return;
        const ranked = [...reviews].sort((a, b) => (a.rating ?? 5) - (b.rating ?? 5));
        setEvidence(ranked.map((r) => r.body?.trim()).filter((b): b is string => Boolean(b)).slice(0, 4));
      })
      .catch(() => {
        /* reviews are optional context; never block the surface on them */
      });
    return () => {
      cancelled = true;
    };
  }, [productDataService, currentAvatar?.id]);

  return useMemo<BrandSnapshotState>(() => {
    const company = brandData.userInfo.company?.trim();
    const avatar = avatarFields(currentAvatar);
    // Trust ONLY a complete score object — a partial/legacy row missing a dimension would make
    // buildTrustGap read it as 0 and point the owner at the wrong primary gap (a silent misfire).
    const s = latestDiagnostic?.scores;
    const hasDiagnostic = Boolean(
      s && (['insight', 'distinctive', 'empathetic', 'authentic'] as Pillar[]).every((k) => Number.isFinite(s[k])),
    );

    // No real signal yet → seeded example so the surface is never dead (clearly flagged).
    if (!hasDiagnostic && !avatar && !company) {
      return { snapshot: SEED_SNAPSHOT, isLive: false, isLoading: isLoadingLatest, needsDiagnostic: false };
    }

    let trustGap: BrandSnapshot['trustGap'];
    if (hasDiagnostic && s) {
      const tg = buildTrustGap(s);
      const pillars = {} as Record<Pillar, number>;
      for (const d of tg.dimensions) pillars[d.key] = d.score;
      trustGap = { overall: tg.overall, pillars, primaryGap: tg.primaryGap };
    }

    const snapshot: BrandSnapshot = {
      brand: company || currentAvatar?.name || 'Your brand',
      product: currentAvatar?.name,
      trustGap,
      avatar,
      evidence,
      ownerMode: 'diy-listing',
    };
    return { snapshot, isLive: true, isLoading: isLoadingLatest, needsDiagnostic: !hasDiagnostic };
  }, [brandData.userInfo.company, currentAvatar, latestDiagnostic, evidence, isLoadingLatest]);
}
