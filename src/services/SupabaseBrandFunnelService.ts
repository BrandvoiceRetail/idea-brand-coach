import imageCompression from 'browser-image-compression';
import { supabase } from '../integrations/supabase/client';
import type { Database, Json } from '../integrations/supabase/types';
import { captureAlphaEvent } from '../lib/posthogClient';
import {
  getApplicableTouchpoints,
  getTouchpoint,
  getStages,
  touchpointsByStage,
  type ApplicabilityTag,
  type StageId,
} from '../config/touchpointTaxonomy';
import type {
  IBrandFunnelService,
  Result,
  BrandAsset,
  BrandAssetCreate,
  BrandTest,
  AuditResult,
  AssetStatus,
  FunnelCoverage,
  CoverageCell,
} from './interfaces/IBrandFunnelService';

type AssetRow = Database['public']['Tables']['brand_assets']['Row'];
type TestRow = Database['public']['Tables']['brand_tests']['Row'];

const BUCKET = 'brand-assets';
const TARGET_PCT = 90;

function toAsset(row: AssetRow): BrandAsset {
  return {
    ...row,
    stage: row.stage as StageId,
    status: row.status as AssetStatus,
    audit_result: row.audit_result ? (row.audit_result as unknown as AuditResult) : null,
  };
}

function toTest(row: TestRow): BrandTest {
  return { ...row, status: row.status as BrandTest['status'], source: row.source as BrandTest['source'] };
}

/**
 * Supabase implementation of the Brand Funnel Tracker service.
 * RLS scopes every row to the caller via avatars.user_id; storage paths are owner-prefixed.
 * Follows the `{ data, error }` convention — never throws across the boundary.
 */
export class SupabaseBrandFunnelService implements IBrandFunnelService {
  /** Current Signature version for an avatar: avatar-scoped first, else latest brand-level. */
  async currentSignatureVersion(avatarId: string): Promise<string | null> {
    const scoped = await supabase.from('signatures')
      .select('id, artifact_id').eq('avatar_id', avatarId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    let sig = scoped.data;
    if (!sig) {
      const brandLevel = await supabase.from('signatures')
        .select('id, artifact_id').is('avatar_id', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      sig = brandLevel.data;
    }
    return sig ? (sig.artifact_id ?? sig.id) : null;
  }

  async createAsset(input: BrandAssetCreate): Promise<Result<BrandAsset>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      if (input.contextDescription.trim().length < 8) {
        throw new Error('A short context description (8+ characters) is required.');
      }
      if (!input.file && !input.contentText?.trim()) {
        throw new Error('Provide a screenshot or paste the copy.');
      }
      const tp = getTouchpoint(input.touchpointId);
      if (!tp) throw new Error(`Unknown touchpoint: ${input.touchpointId}`);

      const { data: inserted, error: insErr } = await supabase
        .from('brand_assets')
        .insert({
          // Brand inventory (/v4 funnel-by-job): the piece is the brand's, not an
          // avatar's. Legacy /v2 callers omit brandId and create avatar-keyed rows.
          ...(input.brandId
            ? { brand_id: input.brandId, avatar_id: null }
            : { avatar_id: input.avatarId }),
          touchpoint_id: tp.id,
          stage: tp.stage,
          context_description: input.contextDescription.trim(),
          content_text: input.contentText?.trim() || null,
          status: 'pending',
        })
        .select('*')
        .single();
      if (insErr) throw insErr;

      if (input.file) {
        const ext = (input.file.name.split('.').pop() || 'png').toLowerCase();
        const compressed = await imageCompression(input.file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true });
        const path = `${user.id}/funnel/${inserted.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, compressed, { upsert: true, contentType: compressed.type });
        if (upErr) throw upErr;
        await supabase.from('brand_assets').update({ storage_path: path, updated_at: new Date().toISOString() }).eq('id', inserted.id);
        inserted.storage_path = path;
      }

      // New upload becomes the current version: supersede any prior live asset for
      // this touchpoint — brand- or avatar-scoped to match how it was inserted.
      {
        const base = supabase.from('brand_assets')
          .update({ superseded_by: inserted.id, updated_at: new Date().toISOString() })
          .eq('touchpoint_id', tp.id)
          .is('superseded_by', null).neq('id', inserted.id);
        await (input.brandId
          ? base.eq('brand_id', input.brandId)
          : base.eq('avatar_id', input.avatarId));
      }

      captureAlphaEvent('funnel_asset_uploaded', { touchpoint: tp.id, stage: tp.stage, has_image: !!input.file, has_text: !!input.contentText });
      return { data: toAsset(inserted), error: null };
    } catch (error) {
      console.error('createAsset error:', error);
      return { data: null, error: error as Error };
    }
  }

  async listAssets(avatarId: string): Promise<Result<BrandAsset[]>> {
    try {
      const { data, error } = await supabase
        .from('brand_assets').select('*')
        .eq('avatar_id', avatarId).is('superseded_by', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data ?? []).map(toAsset), error: null };
    } catch (error) {
      console.error('listAssets error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Per-avatar verdict overlay: brand_asset_id → the CURRENT audit's
   * status/score/result for (piece, avatar). Empty when no avatar lens is given.
   */
  private async readAuditOverlay(
    brandId: string,
    avatarId: string | null,
  ): Promise<Map<string, { status: AssetStatus; overall_score: number | null; audit_result: AuditResult | null }>> {
    const overlay = new Map<string, { status: AssetStatus; overall_score: number | null; audit_result: AuditResult | null }>();
    if (!avatarId) return overlay;
    const { data, error } = await supabase
      .from('brand_asset_audits')
      .select('brand_asset_id, status, overall_score, audit_result')
      .eq('brand_id', brandId)
      .eq('avatar_id', avatarId)
      .is('superseded_by', null);
    if (error) throw error;
    for (const r of data ?? []) {
      overlay.set(r.brand_asset_id, {
        status: (r.status as AssetStatus | null) ?? 'pending',
        overall_score: r.overall_score,
        audit_result: r.audit_result ? (r.audit_result as unknown as AuditResult) : null,
      });
    }
    return overlay;
  }

  async listBrandAssets(brandId: string, avatarId: string | null): Promise<Result<BrandAsset[]>> {
    try {
      const [{ data, error }, overlay] = await Promise.all([
        supabase
          .from('brand_assets').select('*')
          .eq('brand_id', brandId).is('superseded_by', null)
          .order('created_at', { ascending: false }),
        this.readAuditOverlay(brandId, avatarId),
      ]);
      if (error) throw error;
      // The PIECE is brand-scoped; the VERDICT is the avatar's overlay (or 'pending'
      // when this customer hasn't been assessed against the piece yet).
      const pieces = (data ?? []).map((row) => {
        const piece = toAsset(row);
        const ov = overlay.get(piece.id);
        return {
          ...piece,
          avatar_id: avatarId,
          status: ov ? ov.status : ('pending' as AssetStatus),
          overall_score: ov ? ov.overall_score : null,
          audit_result: ov ? ov.audit_result : null,
        };
      });
      return { data: pieces, error: null };
    } catch (error) {
      console.error('listBrandAssets error:', error);
      return { data: null, error: error as Error };
    }
  }

  async getAsset(id: string): Promise<Result<BrandAsset>> {
    try {
      const { data, error } = await supabase.from('brand_assets').select('*').eq('id', id).single();
      if (error) throw error;
      return { data: toAsset(data), error: null };
    } catch (error) {
      console.error('getAsset error:', error);
      return { data: null, error: error as Error };
    }
  }

  async auditAsset(assetId: string): Promise<Result<BrandAsset>> {
    try {
      const { data: assetRow, error: getErr } = await supabase
        .from('brand_assets').select('*').eq('id', assetId).single();
      if (getErr) throw getErr;
      const tp = getTouchpoint(assetRow.touchpoint_id);
      const stage = getStages().find((s) => s.id === assetRow.stage);

      const { data: fnData, error: fnErr } = await supabase.functions.invoke('audit-asset', {
        body: {
          assetId,
          touchpointLabel: tp?.label ?? assetRow.touchpoint_id,
          brandTask: stage?.brandTask ?? '',
          auditAgainst: tp?.auditAgainst ?? [],
        },
      });
      // Surface a failed audit as a visible 'failed' state instead of a silent 'pending'.
      if (fnErr || (fnData && fnData.ok === false)) {
        await supabase.from('brand_assets').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', assetId);
        throw (fnErr ?? new Error(fnData?.error ?? 'audit failed'));
      }

      const { data: fresh, error: reErr } = await supabase
        .from('brand_assets').select('*').eq('id', assetId).single();
      if (reErr) throw reErr;
      captureAlphaEvent('funnel_asset_audited', { status: fresh.status, score: fresh.overall_score ?? -1 });
      return { data: toAsset(fresh), error: null };
    } catch (error) {
      console.error('auditAsset error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Per-avatar audit: compute the verdict via the `audit-asset` edge fn (which
   * writes the brand piece's legacy fields), then RECORD it into the per-avatar
   * `brand_asset_audits` overlay via the `save_asset_audit_atomic` RPC, so the SAME
   * brand piece can carry a different verdict per avatar. Returns the asset with the
   * avatar's verdict overlaid.
   */
  async auditAssetForAvatar(assetId: string, avatarId: string): Promise<Result<BrandAsset>> {
    try {
      const audited = await this.auditAsset(assetId);
      if (audited.error) return audited;
      if (!audited.data) return { data: null, error: new Error('The audit returned nothing.') };
      const a = audited.data;
      const { error: rpcErr } = await supabase.rpc('save_asset_audit_atomic', {
        p_brand_asset_id: assetId,
        p_avatar_id: avatarId,
        p_overall_score: a.overall_score,
        p_audit_result: (a.audit_result as unknown as Json) ?? null,
        p_grounding: a.audit_result?.grounding ? 'evidence' : 'inference',
        p_evidence_refs: [] as unknown as Json,
        p_status: a.status,
      });
      if (rpcErr) throw rpcErr;
      return { data: { ...a, avatar_id: avatarId }, error: null };
    } catch (error) {
      console.error('auditAssetForAvatar error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Upload a screenshot for an EXISTING piece (in-place: compress → upload to the
   * piece's own storage slot → update storage_path) and re-audit it for the avatar.
   * No new version is created — this is "re-check THIS piece with a fresh image".
   */
  async reAuditWithScreenshot(assetId: string, file: File, avatarId: string): Promise<Result<BrandAsset>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const compressed = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true });
      const path = `${user.id}/funnel/${assetId}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, compressed, { upsert: true, contentType: compressed.type });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase.from('brand_assets')
        .update({ storage_path: path, updated_at: new Date().toISOString() })
        .eq('id', assetId);
      if (updErr) throw updErr;
      return await this.auditAssetForAvatar(assetId, avatarId);
    } catch (error) {
      console.error('reAuditWithScreenshot error:', error);
      return { data: null, error: error as Error };
    }
  }

  /** Apply a coach rewrite: save the revised copy as a new asset version and re-audit. */
  async applyRewrite(asset: BrandAsset, revisedText: string): Promise<Result<BrandAsset>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const { data: inserted, error: insErr } = await supabase
        .from('brand_assets')
        .insert({
          avatar_id: asset.avatar_id,
          touchpoint_id: asset.touchpoint_id,
          stage: asset.stage,
          context_description: asset.context_description,
          content_text: revisedText,
          status: 'pending',
        })
        .select('*')
        .single();
      if (insErr) throw insErr;
      await supabase.from('brand_assets')
        .update({ superseded_by: inserted.id, updated_at: new Date().toISOString() })
        .eq('avatar_id', asset.avatar_id).eq('touchpoint_id', asset.touchpoint_id)
        .is('superseded_by', null).neq('id', inserted.id);
      captureAlphaEvent('funnel_fix_started', { applied_rewrite: true, touchpoint: asset.touchpoint_id });
      return await this.auditAsset(inserted.id);
    } catch (error) {
      console.error('applyRewrite error:', error);
      return { data: null, error: error as Error };
    }
  }

  /** How many strategy fields the avatar has (drives the grounding gate/badge). */
  async getAvatarFieldCount(avatarId: string): Promise<number> {
    const { count } = await supabase
      .from('avatar_field_values')
      .select('id', { count: 'exact', head: true })
      .eq('avatar_id', avatarId);
    return count ?? 0;
  }

  async getCoverage(avatarId: string, brandTags: ApplicabilityTag[]): Promise<Result<FunnelCoverage>> {
    try {
      const [{ data: assets, error }, currentSig] = await Promise.all([
        this.listAssets(avatarId),
        this.currentSignatureVersion(avatarId),
      ]);
      if (error) throw error;
      const latestByTouchpoint = new Map<string, BrandAsset>();
      for (const a of assets ?? []) {
        if (!latestByTouchpoint.has(a.touchpoint_id)) latestByTouchpoint.set(a.touchpoint_id, a);
      }

      const applicable = new Set(getApplicableTouchpoints(brandTags).map((t) => t.id));
      const counts = { aligned: 0, stale: 0, misaligned: 0, missing: 0 };

      const byStage = touchpointsByStage().map(({ stage, touchpoints }) => {
        const cells: CoverageCell[] = touchpoints
          .filter((t) => applicable.has(t.id))
          .map((t) => {
            const asset = latestByTouchpoint.get(t.id);
            // Read-time stale: an asset aligned under an older Signature is now stale.
            let status: AssetStatus = asset ? asset.status : 'missing';
            if (asset && status === 'aligned' && asset.signature_version && currentSig && asset.signature_version !== currentSig) {
              status = 'stale';
            }
            if (status === 'aligned') counts.aligned++;
            else if (status === 'stale') counts.stale++;
            else if (status === 'misaligned') counts.misaligned++;
            else counts.missing++;
            return {
              touchpointId: t.id, label: t.label, stage: stage.id, applicable: true,
              status, overallScore: asset?.overall_score ?? null, assetId: asset?.id ?? null,
            };
          });
        return { stage: stage.id, label: stage.label, cells };
      });

      const applicableCount = applicable.size || 1;
      const coveragePct = Math.round((counts.aligned / applicableCount) * 100);
      return { data: { byStage, counts, coveragePct, targetPct: TARGET_PCT }, error: null };
    } catch (error) {
      console.error('getCoverage error:', error);
      return { data: null, error: error as Error };
    }
  }

  /** Latest brand-level Signature version (avatar_id null) — the fallback lens. */
  private async brandLevelSignatureVersion(): Promise<string | null> {
    const { data } = await supabase.from('signatures')
      .select('id, artifact_id').is('avatar_id', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data ? (data.artifact_id ?? data.id) : null;
  }

  /**
   * BRAND-scoped coverage: the funnel pieces are the brand's (one current row per
   * (brand, touchpoint)); each cell's verdict is the per-avatar overlay (read-time
   * stale still derives from the piece's own signature_version). The same pieces
   * appear for every avatar — only the verdict changes with the lens.
   */
  async getBrandCoverage(
    brandId: string,
    avatarId: string | null,
    brandTags: ApplicabilityTag[],
  ): Promise<Result<FunnelCoverage>> {
    try {
      const [{ data: assets, error }, currentSig] = await Promise.all([
        this.listBrandAssets(brandId, avatarId),
        avatarId ? this.currentSignatureVersion(avatarId) : this.brandLevelSignatureVersion(),
      ]);
      if (error) throw error;
      const latestByTouchpoint = new Map<string, BrandAsset>();
      for (const a of assets ?? []) {
        if (!latestByTouchpoint.has(a.touchpoint_id)) latestByTouchpoint.set(a.touchpoint_id, a);
      }

      const applicable = new Set(getApplicableTouchpoints(brandTags).map((t) => t.id));
      const counts = { aligned: 0, stale: 0, misaligned: 0, missing: 0 };

      const byStage = touchpointsByStage().map(({ stage, touchpoints }) => {
        const cells: CoverageCell[] = touchpoints
          .filter((t) => applicable.has(t.id))
          .map((t) => {
            const asset = latestByTouchpoint.get(t.id);
            let status: AssetStatus = asset ? asset.status : 'missing';
            if (asset && status === 'aligned' && asset.signature_version && currentSig && asset.signature_version !== currentSig) {
              status = 'stale';
            }
            if (status === 'aligned') counts.aligned++;
            else if (status === 'stale') counts.stale++;
            else if (status === 'misaligned') counts.misaligned++;
            else counts.missing++;
            return {
              touchpointId: t.id, label: t.label, stage: stage.id, applicable: true,
              status, overallScore: asset?.overall_score ?? null, assetId: asset?.id ?? null,
            };
          });
        return { stage: stage.id, label: stage.label, cells };
      });

      const applicableCount = applicable.size || 1;
      const coveragePct = Math.round((counts.aligned / applicableCount) * 100);
      return { data: { byStage, counts, coveragePct, targetPct: TARGET_PCT }, error: null };
    } catch (error) {
      console.error('getBrandCoverage error:', error);
      return { data: null, error: error as Error };
    }
  }

  async recordTest(input: {
    assetId: string; hypothesis: string; metricType: string; baselineValue: number;
  }): Promise<Result<BrandTest>> {
    try {
      const { data, error } = await supabase
        .from('brand_tests')
        .insert({
          asset_id: input.assetId,
          hypothesis: input.hypothesis,
          metric_type: input.metricType,
          baseline_value: input.baselineValue,
          status: 'running',
          source: 'manual',
          deployed_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      captureAlphaEvent('funnel_fix_started', { metric: input.metricType });
      return { data: toTest(data), error: null };
    } catch (error) {
      console.error('recordTest error:', error);
      return { data: null, error: error as Error };
    }
  }

  async closeTest(testId: string, resultValue: number): Promise<Result<BrandTest>> {
    try {
      const { data: existing, error: getErr } = await supabase
        .from('brand_tests').select('*').eq('id', testId).single();
      if (getErr) throw getErr;
      const baseline = existing.baseline_value ?? 0;
      const status = resultValue > baseline ? 'won' : 'no_lift';
      const { data, error } = await supabase
        .from('brand_tests')
        .update({ result_value: resultValue, status, measured_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', testId)
        .select('*')
        .single();
      if (error) throw error;
      captureAlphaEvent('funnel_test_recorded', { status, lift: resultValue - baseline });
      return { data: toTest(data), error: null };
    } catch (error) {
      console.error('closeTest error:', error);
      return { data: null, error: error as Error };
    }
  }

  async getAssetRoi(avatarId: string): Promise<Result<BrandTest[]>> {
    try {
      const { data: assets } = await this.listAssets(avatarId);
      const assetIds = (assets ?? []).map((a) => a.id);
      if (assetIds.length === 0) return { data: [], error: null };
      const { data, error } = await supabase
        .from('brand_tests').select('*').in('asset_id', assetIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data ?? []).map(toTest), error: null };
    } catch (error) {
      console.error('getAssetRoi error:', error);
      return { data: null, error: error as Error };
    }
  }

  async getAssetRoiForBrand(brandId: string): Promise<Result<BrandTest[]>> {
    try {
      const { data: assets } = await this.listBrandAssets(brandId, null);
      const assetIds = (assets ?? []).map((a) => a.id);
      if (assetIds.length === 0) return { data: [], error: null };
      const { data, error } = await supabase
        .from('brand_tests').select('*').in('asset_id', assetIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data: (data ?? []).map(toTest), error: null };
    } catch (error) {
      console.error('getAssetRoiForBrand error:', error);
      return { data: null, error: error as Error };
    }
  }
}
