/**
 * SupabaseCompetitorInsightsService
 *
 * Implements ICompetitorInsightsService against Supabase.
 *  - analyzeCompetitors: invokes the `competitor-analysis-asset` edge function
 *    (grounded, IDEA-scored, Sonnet 4.6) and maps its response.
 *  - getCompetitiveInsights: reads `brand_asset_competitive_insights` for an
 *    asset (RLS scopes to the caller's avatars).
 *
 * Follows the service-layer Result pattern (`{ data, error }`, never throws) and
 * the edge-invoke pattern from `SupabaseProductDataService` /
 * `CompetitiveAnalysisService`.
 *
 * NOTE: `brand_asset_competitive_insights` is not in the generated supabase
 * types yet (migration unapplied to prod), so the `.from(...)` builder is cast
 * at the boundary. // TODO(types-regen)
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (ST-3)
 */

import { supabase } from '@/integrations/supabase/client';
import { designAbTest } from '@/mcp/service/testDesign';
import { ICompetitorInsightsService, CompetitorInsightsResult } from './interfaces/ICompetitorInsightsService';
import type {
  AnalyzeCompetitorsRequest,
  CompetitorAnalysisResult,
  BrandAssetCompetitiveInsight,
  CompetitorEntry,
  CompetitorNeedsInput,
  EvidenceRef,
  Grounding,
  CompetitiveInsightStatus,
  DraftCountermeasureRequest,
  DraftCountermeasureResult,
  RecordTestRequest,
  BrandTest,
  BrandTestVariant,
  BrandTestStatus,
  VocSignals,
} from '@/types/competitorInsights';

/** Raw shape returned by the competitor-analysis-asset edge function. */
interface EdgeAnalysisResponse {
  competitors?: CompetitorEntry[];
  strategic_angle?: string | null;
  grounding?: Grounding;
  evidence_refs?: EvidenceRef[];
  voc_signals?: VocSignals | null;
  insightId?: string | null;
  needs_input?: CompetitorNeedsInput[];
  error?: string;
}

/** Raw shape returned by the funnel-rewrite edge function (P4). */
interface EdgeRewriteResponse {
  rewrite?: string;
  angle_note?: string;
  error?: string;
}

export class SupabaseCompetitorInsightsService implements ICompetitorInsightsService {
  // TODO(competitor-agents:LT-2): competitor monitoring at scale. `analyzeCompetitors`
  // is the on-demand (user-triggered) entry; LT-2 adds a SCHEDULED variant that
  // ports the Drive "Competitor Monitoring Automation System" Make.com scenario to
  // a cron-driven edge job (re-run analyzeCompetitors per tracked touchpoint on a
  // cadence) writing snapshots to brand_asset_competitive_insights, then diffs the
  // newest vs. prior insight to emit change-detection alerts via the existing
  // brand-defense IAlertSource / INotificationChannel seam.
  // See docs/brand-funnel-builder/COMPETITOR_AGENTS_LONGTERM.md §LT-2.
  async analyzeCompetitors(
    request: AnalyzeCompetitorsRequest,
  ): Promise<CompetitorInsightsResult<CompetitorAnalysisResult>> {
    try {
      // Map to the edge-function request body (mixed casing matches the fn's
      // AnalyzeRequest: ids/urls camelCase, context fields snake_case).
      const { data, error } = await supabase.functions.invoke('competitor-analysis-asset', {
        body: {
          assetId: request.assetId,
          touchpointId: request.touchpointId,
          modality: request.modality,
          avatarId: request.avatarId,
          category: request.category,
          asin: request.asin,
          reviewAsins: request.reviewAsins,
          competitorUrls: request.competitorUrls,
          marketplace: request.marketplace,
          avatar_context: request.avatarContext,
          signature_context: request.signatureContext,
          our_asset: request.ourAsset,
          audit_result: request.auditResult,
        },
      });

      if (error) {
        console.error('[CompetitorInsights] Edge function error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      const res = (data ?? {}) as EdgeAnalysisResponse;

      // A 500 from the edge fn surfaces as a JSON `{ error }` body.
      if (res.error) {
        return { data: null, error: new Error(res.error) };
      }

      const mapped: CompetitorAnalysisResult = {
        competitors: Array.isArray(res.competitors) ? res.competitors : [],
        strategicAngle: typeof res.strategic_angle === 'string' ? res.strategic_angle : null,
        grounding: res.grounding === 'evidence' ? 'evidence' : 'inference',
        evidenceRefs: Array.isArray(res.evidence_refs) ? res.evidence_refs : [],
        vocSignals: res.voc_signals ?? null,
        insightId: typeof res.insightId === 'string' ? res.insightId : null,
        needsInput: Array.isArray(res.needs_input) && res.needs_input.length > 0 ? res.needs_input : null,
      };

      return { data: mapped, error: null };
    } catch (err) {
      console.error('[CompetitorInsights] analyzeCompetitors threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to analyze competitors.') };
    }
  }

  async getCompetitiveInsights(
    assetId: string,
  ): Promise<CompetitorInsightsResult<BrandAssetCompetitiveInsight[]>> {
    try {
      // TODO(types-regen): table absent from generated supabase types — cast at boundary.
      const { data, error } = await (supabase
        .from('brand_asset_competitive_insights') as unknown as {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        })
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CompetitorInsights] getCompetitiveInsights error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      const rows = (data ?? []).map((row) => this.mapInsightFromDb(row as Record<string, unknown>));
      return { data: rows, error: null };
    } catch (err) {
      console.error('[CompetitorInsights] getCompetitiveInsights threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to load competitive insights.') };
    }
  }

  // ── P4 lift loop ─────────────────────────────────────────────────────────────

  async draftCountermeasure(
    request: DraftCountermeasureRequest,
  ): Promise<CompetitorInsightsResult<DraftCountermeasureResult>> {
    try {
      const { data, error } = await supabase.functions.invoke('funnel-rewrite', {
        body: {
          touchpoint_id: request.touchpointId,
          current_copy: request.currentCopy,
          competitor_brief: {
            gap_to_our_avatar: request.competitorBrief.gap_to_our_avatar,
            strategic_angle: request.competitorBrief.strategic_angle,
            competitor_names: request.competitorBrief.competitor_names,
          },
          avatar_context: request.avatarContext,
          signature_context: request.signatureContext,
        },
      });

      if (error) {
        console.error('[CompetitorInsights] funnel-rewrite error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      const res = (data ?? {}) as EdgeRewriteResponse;
      if (res.error) {
        return { data: null, error: new Error(res.error) };
      }
      if (typeof res.rewrite !== 'string' || res.rewrite.trim() === '') {
        return { data: null, error: new Error('The rewrite came back empty.') };
      }

      return {
        data: { rewrite: res.rewrite, angleNote: typeof res.angle_note === 'string' ? res.angle_note : '' },
        error: null,
      };
    } catch (err) {
      console.error('[CompetitorInsights] draftCountermeasure threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to draft a countermeasure.') };
    }
  }

  async recordTest(request: RecordTestRequest): Promise<CompetitorInsightsResult<BrandTest>> {
    try {
      // Compose the A/B spec via the SHARED test-design composer (the existing
      // designTest path — same logic the MCP design_test tool uses). Variant A is
      // the baseline; Variant B is the competitor-informed rewrite.
      const spec = designAbTest({
        name: request.name,
        variants: [
          { label: 'Baseline', content: request.baselineCopy },
          { label: 'Competitor-informed rewrite', content: request.rewriteCopy },
        ],
        hypothesis: request.hypothesis,
        primary_metric: request.primaryMetric,
        channel: request.channel,
      });

      // The P4 flag: competitor-informed unless explicitly told otherwise.
      const competitorInsightApplied =
        request.competitorInsightApplied ?? Boolean(request.competitiveInsightId);

      const variants: BrandTestVariant[] = spec.variants.map((v) => ({
        variant_id: v.variant_id,
        label: v.label,
        content: v.content,
        traffic_share: v.traffic_share,
      }));

      const insertRow = {
        avatar_id: request.avatarId,
        asset_id: request.assetId ?? null,
        competitive_insight_id: request.competitiveInsightId ?? null,
        touchpoint_id: request.touchpointId ?? null,
        name: spec.name,
        hypothesis: spec.hypothesis,
        channel: spec.channel ?? null,
        primary_metric: spec.primary_metric,
        variants,
        status: 'draft' as BrandTestStatus,
        competitor_insight_applied: competitorInsightApplied,
      };

      // TODO(types-regen): brand_tests is not in the generated supabase types yet
      // (migration unapplied to prod) — cast the builder at the boundary.
      const { data, error } = await (supabase
        .from('brand_tests') as unknown as {
          insert: (r: unknown) => {
            select: (c: string) => { single: () => Promise<{ data: unknown | null; error: unknown }> };
          };
        })
        .insert(insertRow)
        .select('*')
        .single();

      if (error) {
        console.error('[CompetitorInsights] recordTest error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      return { data: this.mapTestFromDb((data ?? {}) as Record<string, unknown>), error: null };
    } catch (err) {
      console.error('[CompetitorInsights] recordTest threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to record the test.') };
    }
  }

  async getBrandTests(avatarId: string): Promise<CompetitorInsightsResult<BrandTest[]>> {
    try {
      // TODO(types-regen): table absent from generated supabase types — cast at boundary.
      const { data, error } = await (supabase
        .from('brand_tests') as unknown as {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        })
        .select('*')
        .eq('avatar_id', avatarId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CompetitorInsights] getBrandTests error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      const rows = (data ?? []).map((row) => this.mapTestFromDb(row as Record<string, unknown>));
      return { data: rows, error: null };
    } catch (err) {
      console.error('[CompetitorInsights] getBrandTests threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to load brand tests.') };
    }
  }

  // ── Boundary mapping ────────────────────────────────────────────────────────

  /** Map a brand_tests row to the domain type. */
  private mapTestFromDb(row: Record<string, unknown>): BrandTest {
    return {
      id: row.id as string,
      avatar_id: row.avatar_id as string,
      asset_id: (row.asset_id as string | null) ?? null,
      competitive_insight_id: (row.competitive_insight_id as string | null) ?? null,
      touchpoint_id: (row.touchpoint_id as string | null) ?? null,
      name: row.name as string,
      hypothesis: (row.hypothesis as string | null) ?? null,
      channel: (row.channel as string | null) ?? null,
      primary_metric: (row.primary_metric as string | null) ?? null,
      variants: (row.variants as BrandTestVariant[]) ?? [],
      baseline_value: (row.baseline_value as number | null) ?? null,
      result_value: (row.result_value as number | null) ?? null,
      status: (row.status as BrandTestStatus) ?? 'draft',
      competitor_insight_applied: Boolean(row.competitor_insight_applied),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  /** Map a brand_asset_competitive_insights row to the domain type. */
  private mapInsightFromDb(row: Record<string, unknown>): BrandAssetCompetitiveInsight {
    return {
      id: row.id as string,
      avatar_id: row.avatar_id as string,
      asset_id: (row.asset_id as string | null) ?? null,
      modality: row.modality as string,
      competitors: (row.competitors as CompetitorEntry[]) ?? [],
      strategic_angle: (row.strategic_angle as string | null) ?? null,
      voc_signals: (row.voc_signals as VocSignals | null) ?? null,
      status: (row.status as CompetitiveInsightStatus) ?? 'pending',
      analyzed_at: (row.analyzed_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}
