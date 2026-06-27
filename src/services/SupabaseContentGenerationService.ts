import { supabase } from '../integrations/supabase/client';
import { captureAlphaEvent } from '../lib/posthogClient';
import { getTouchpoint, type StageId } from '../config/touchpointTaxonomy';
import type { Database } from '../integrations/supabase/types';
import type {
  IContentGenerationService,
  SaveToFunnelInput,
} from './interfaces/IContentGenerationService';
import type { Result, BrandAsset, AssetStatus, AuditResult } from './interfaces/IBrandFunnelService';
import type { ContentProvider, GenerationJob, GenerationOutput, GenerationStartInput } from './contentGeneration/types';

type AssetRow = Database['public']['Tables']['brand_assets']['Row'];

function toAsset(row: AssetRow): BrandAsset {
  return {
    ...row,
    stage: row.stage as StageId,
    status: row.status as AssetStatus,
    audit_result: row.audit_result ? (row.audit_result as unknown as AuditResult) : null,
  };
}

/** Map a content capability to the brand-copy-generator `format`. */
function copyFormat(capability: string): string {
  return capability === 'email_copy' ? 'email' : 'pdp-description';
}

/**
 * A saveable text reference for a Palmier video. The binary lives in the user's
 * Palmier project (MCP generate returns no downloadable URL), so the funnel records
 * the asset reference — or, when Palmier wasn't reachable, the ready-to-run brief.
 */
function describeVideo(output: GenerationOutput): string | null {
  const v = output.videos?.[0];
  if (v) {
    const head = v.palmier_asset_id
      ? `Palmier video — asset ${v.palmier_asset_id}`
      : 'Video (generated in the cloud)';
    const lines = [head, `Prompt: ${v.prompt}`];
    if (v.model) lines.push(`Model: ${v.model}`);
    if (v.duration_s) lines.push(`Duration: ${v.duration_s}s`);
    if (v.aspect) lines.push(`Aspect: ${v.aspect}`);
    return lines.join('\n');
  }
  const b = output.brief;
  if (b) {
    const lines = ['Palmier video brief — run in your local Palmier:', `Prompt: ${b.prompt}`];
    if (b.model) lines.push(`Model: ${b.model}`);
    if (b.duration_s) lines.push(`Duration: ${b.duration_s}s`);
    if (b.aspect) lines.push(`Aspect: ${b.aspect}`);
    return lines.join('\n');
  }
  return null;
}

/**
 * Supabase implementation of the content-generation seam.
 *
 * Pixii (images) and Claude (copy) are reached ONLY through edge functions
 * (pixii-generate / brand-copy-generator), so this service never touches the
 * Pixii key or the un-regenerated content_generation_jobs row type. Persistence
 * writes the existing, typed brand_assets table.
 */
export class SupabaseContentGenerationService implements IContentGenerationService {
  async start(input: GenerationStartInput): Promise<Result<GenerationJob>> {
    try {
      if (input.capability.provider === 'pixii') return await this.startPixii(input);
      if (input.capability.provider === 'palmier') return await this.startPalmier(input);
      if (input.capability.provider === 'fal') return await this.startFal(input);
      return await this.startClaude(input);
    } catch (error) {
      console.error('content-generation start error:', error);
      return { data: null, error: error as Error };
    }
  }

  private async startPalmier(input: GenerationStartInput): Promise<Result<GenerationJob>> {
    const { data, error } = await supabase.functions.invoke('palmier-generate', {
      body: {
        avatarId: input.avatarId,
        touchpointId: input.touchpointId,
        capability: input.capability.capability,
        videoPrompt: input.videoPrompt ?? input.prompt,
        model: input.model ?? input.capability.palmierModel,
        durationS: input.durationS ?? input.capability.videoDurationS,
        aspect: input.aspect ?? input.capability.videoAspect,
      },
    });
    if (error) return { data: null, error: new Error(error.message ?? 'Video generation request failed') };
    if (!data?.ok) {
      const retry = typeof data?.retryAfter === 'number' ? ` (retry in ${data.retryAfter}s)` : '';
      return { data: null, error: new Error(`${data?.error ?? 'Video generation failed'}${retry}`) };
    }
    captureAlphaEvent('funnel_content_generated', {
      provider: 'palmier',
      capability: input.capability.capability,
      touchpoint: input.touchpointId,
      mode: data.mode ?? 'generating',
    });
    // mode 'generating' → status 'processing' (poll it); mode 'brief' → status 'pending' with output.brief.
    return {
      data: {
        provider: 'palmier',
        jobId: data.jobId,
        externalJobId: data.externalJobId ?? null,
        status: data.status ?? 'pending',
        output: data.output,
      },
      error: null,
    };
  }

  private async startFal(input: GenerationStartInput): Promise<Result<GenerationJob>> {
    const { data, error } = await supabase.functions.invoke('fal-video-generate', {
      body: {
        avatarId: input.avatarId,
        touchpointId: input.touchpointId,
        capability: input.capability.capability,
        videoPrompt: input.videoPrompt ?? input.prompt,
        model: input.model ?? input.capability.falModel,
        durationS: input.durationS ?? input.capability.videoDurationS,
        aspect: input.aspect ?? input.capability.videoAspect,
      },
    });
    if (error) return { data: null, error: new Error(error.message ?? 'Video generation request failed') };
    if (!data?.ok) {
      const retry = typeof data?.retryAfter === 'number' ? ` (retry in ${data.retryAfter}s)` : '';
      return { data: null, error: new Error(`${data?.error ?? 'Video generation failed'}${retry}`) };
    }
    captureAlphaEvent('funnel_content_generated', { provider: 'fal', capability: input.capability.capability, touchpoint: input.touchpointId });
    return {
      data: { provider: 'fal', jobId: data.jobId, externalJobId: data.externalJobId ?? null, status: data.status ?? 'processing' },
      error: null,
    };
  }

  private async startPixii(input: GenerationStartInput): Promise<Result<GenerationJob>> {
    const { data, error } = await supabase.functions.invoke('pixii-generate', {
      body: {
        avatarId: input.avatarId,
        touchpointId: input.touchpointId,
        capability: input.capability.capability,
        asin: input.asin,
        countryCode: input.countryCode,
        listingType: input.listingType ?? input.capability.pixiiListingType,
        types: input.types ?? input.capability.pixiiTypes,
        mainImageUrl: input.mainImageUrl,
        otherImageUrls: input.otherImageUrls,
        userPrompt: input.userPrompt,
      },
    });
    if (error) return { data: null, error: new Error(error.message ?? 'Generation request failed') };
    if (!data?.ok) {
      const retry = typeof data?.retryAfter === 'number' ? ` (retry in ${data.retryAfter}s)` : '';
      return { data: null, error: new Error(`${data?.error ?? 'Generation failed'}${retry}`) };
    }
    captureAlphaEvent('funnel_content_generated', { provider: 'pixii', capability: input.capability.capability, touchpoint: input.touchpointId });
    return {
      data: { provider: 'pixii', jobId: data.jobId, externalJobId: data.externalJobId, status: data.status ?? 'pending' },
      error: null,
    };
  }

  private async startClaude(input: GenerationStartInput): Promise<Result<GenerationJob>> {
    const { data, error } = await supabase.functions.invoke('brand-copy-generator', {
      body: {
        productName: input.productName?.trim() || 'this product',
        category: '',
        features: [],
        // brand-copy-generator hard-rejects an empty targetAudience (and productName).
        // The real audience comes from the user's KB grounding + the prompt; this just
        // satisfies the required-field guard so the copy/email path actually runs.
        targetAudience: 'this brand\'s ideal customer',
        emotionalPayoff: '',
        tone: input.tone?.trim() || 'authentic, warm',
        format: copyFormat(input.capability.capability),
        additionalContext: input.prompt?.trim() || '',
      },
    });
    if (error) return { data: null, error: new Error(error.message ?? 'Copy generation failed') };
    if (data?.error || !data?.copy) return { data: null, error: new Error(data?.error ?? 'Copy generation returned nothing') };
    captureAlphaEvent('funnel_content_generated', { provider: 'claude', capability: input.capability.capability, touchpoint: input.touchpointId });
    return {
      data: { provider: 'claude', status: 'completed', output: { copy: String(data.copy) } },
      error: null,
    };
  }

  async poll(jobId: string, provider: ContentProvider = 'pixii'): Promise<Result<GenerationJob>> {
    const fn = provider === 'palmier' ? 'palmier-generate' : provider === 'fal' ? 'fal-video-generate' : 'pixii-generate';
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { poll: jobId } });
      if (error) return { data: null, error: new Error(error.message ?? 'Polling failed') };
      if (!data?.ok) {
        const retry = typeof data?.retryAfter === 'number' ? ` (retry in ${data.retryAfter}s)` : '';
        return { data: null, error: new Error(`${data?.error ?? 'Polling failed'}${retry}`) };
      }
      return {
        data: { provider, jobId, status: data.status, output: data.output, error: data.error ?? null },
        error: null,
      };
    } catch (error) {
      console.error('content-generation poll error:', error);
      return { data: null, error: error as Error };
    }
  }

  async saveToFunnel(input: SaveToFunnelInput): Promise<Result<BrandAsset>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const tp = getTouchpoint(input.touchpointId);
      if (!tp) throw new Error(`Unknown touchpoint: ${input.touchpointId}`);

      const kind = input.capability.outputKind;
      let heroPath: string | null = null;
      let contentText: string | null = null;
      if (kind === 'image') {
        heroPath = input.output.images?.[0]?.storage_path ?? null;
        if (!heroPath) throw new Error('No generated image to save.');
      } else if (kind === 'video') {
        contentText = describeVideo(input.output);
        heroPath = input.output.videos?.[0]?.storage_path ?? null;
        if (!contentText && !heroPath) throw new Error('No generated video or brief to save.');
      } else {
        contentText = input.output.copy ?? null;
        if (!contentText?.trim()) throw new Error('No generated copy to save.');
      }

      const { data: inserted, error: insErr } = await supabase
        .from('brand_assets')
        .insert({
          avatar_id: input.avatarId,
          touchpoint_id: tp.id,
          stage: tp.stage,
          context_description: `Generated ${input.capability.label}`.slice(0, 280),
          content_text: contentText,
          storage_path: heroPath,
          status: 'pending',
        })
        .select('*')
        .single();
      if (insErr) throw insErr;

      // New generation becomes the current version for this touchpoint.
      await supabase.from('brand_assets')
        .update({ superseded_by: inserted.id, updated_at: new Date().toISOString() })
        .eq('avatar_id', input.avatarId).eq('touchpoint_id', tp.id)
        .is('superseded_by', null).neq('id', inserted.id);

      captureAlphaEvent('funnel_content_saved', { provider: input.capability.provider, kind: input.capability.outputKind, touchpoint: tp.id });
      return { data: toAsset(inserted), error: null };
    } catch (error) {
      console.error('content-generation saveToFunnel error:', error);
      return { data: null, error: error as Error };
    }
  }
}
