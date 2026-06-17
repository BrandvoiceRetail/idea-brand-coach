/**
 * FunnelPiece — the per-asset shape the Competitor-Agents surface consumes.
 *
 * The canonical FunnelTracker is driven by `BrandAsset` rows (see
 * IBrandFunnelService). The competitor panels (TouchpointCompetitorAgentPanel,
 * CompetitorGapsAggregate) want a slimmer, touchpoint-scoped view of one funnel
 * piece. This module derives that view from a BrandAsset + the taxonomy so the
 * competitor surface stays decoupled from the funnel-tracker internals.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md
 */
import { getTouchpoint } from '@/config/touchpointTaxonomy';
import type { BrandAsset } from '@/services/interfaces/IBrandFunnelService';
import type { CompetitorModality } from '@/types/competitorInsights';

/** A single funnel piece (asset) the competitor agent is scoped to. */
export interface FunnelPiece {
  assetId: string;
  touchpointId: string;
  touchpointLabel: string;
  modality?: CompetitorModality;
  /** The asset's current copy — seeds the A/B test baseline (Variant A). */
  currentCopy?: string;
  /** Channel hint for a recorded test's default primary metric. */
  channel?: string;
}

/**
 * Map a touchpoint to its competitor-analyzer modality (plan §3 — one
 * parameterized analyzer, routed by modality). Marketplace-listing is the only
 * modality wired for evidence gathering today; the rest fall back to it (the
 * edge fn returns needs_input for the unwired modalities) so the panel never
 * fabricates a read.
 */
export function touchpointModality(touchpointId: string): CompetitorModality {
  const tp = getTouchpoint(touchpointId);
  if (!tp) return 'marketplace-listing';
  if (tp.appliesWhen.includes('amazon')) return 'marketplace-listing';
  if (tp.appliesWhen.includes('email')) return 'email/lifecycle';
  if (tp.appliesWhen.includes('organic_social') || tp.appliesWhen.includes('paid_social')) {
    return 'social/content';
  }
  if (tp.appliesWhen.includes('shopify') || tp.appliesWhen.includes('dtc_site')) {
    return 'web/store-copy';
  }
  return 'marketplace-listing';
}

/** The asset's primary channel hint, for the recorded test's default metric. */
function touchpointChannel(touchpointId: string): string | undefined {
  return getTouchpoint(touchpointId)?.appliesWhen[0];
}

/** Derive the competitor-surface FunnelPiece view from a BrandAsset row. */
export function pieceFromAsset(asset: BrandAsset): FunnelPiece {
  return {
    assetId: asset.id,
    touchpointId: asset.touchpoint_id,
    touchpointLabel: getTouchpoint(asset.touchpoint_id)?.label ?? asset.touchpoint_id,
    modality: touchpointModality(asset.touchpoint_id),
    currentCopy: asset.content_text ?? undefined,
    channel: touchpointChannel(asset.touchpoint_id),
  };
}
