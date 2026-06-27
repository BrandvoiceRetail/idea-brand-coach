/**
 * Content Generation — service contract (interface-first per src/services/AGENTS.md).
 *
 * Orchestrates the generation providers behind one seam:
 *   - start()  routes a piece to Pixii (async images), Palmier (async video), or
 *              Claude (sync copy).
 *   - poll()   advances an async job (Pixii / Palmier) until completed/failed
 *              (no-op for copy). The provider selects which edge function to poll.
 *   - saveToFunnel() persists a finished generation onto the touchpoint's
 *                    brand_assets row so it joins the audit/lift loop.
 *
 * Mirrors the `{ data, error }` Result convention; never throws across the boundary.
 */
import type { Result, BrandAsset } from './IBrandFunnelService';
import type { ContentProvider, GenerationJob, GenerationStartInput, GenerationOutput, PieceCapability } from '../contentGeneration/types';

export interface SaveToFunnelInput {
  avatarId: string;
  touchpointId: string;
  capability: PieceCapability;
  output: GenerationOutput;
}

export interface IContentGenerationService {
  /** Begin a generation. Pixii/Palmier return a job to poll; Claude returns completed copy. */
  start(input: GenerationStartInput): Promise<Result<GenerationJob>>;
  /** Poll an async job by its content_generation_jobs id; provider routes the edge fn (default pixii). */
  poll(jobId: string, provider?: ContentProvider): Promise<Result<GenerationJob>>;
  /** Persist a completed generation as the touchpoint's current brand_assets row. */
  saveToFunnel(input: SaveToFunnelInput): Promise<Result<BrandAsset>>;
}
