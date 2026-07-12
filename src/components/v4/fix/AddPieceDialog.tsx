/**
 * AddPieceDialog (Upload / Add-a-piece — screen ①) — Loop-3 entry for putting a
 * new funnel piece under the coach's eye.
 *
 * WHAT: A shadcn `Dialog` that captures one funnel piece — its touchpoint (grouped
 * by funnel stage), the channel + marketplace it lives on, the content we audit
 * (pasted copy or a URL; screenshot upload is post-Alpha and disabled), and an
 * optional one-line job. "Add & audit against my brand" calls the `addPiece` seam,
 * which creates the brand_asset and runs the real audit; Cancel discards.
 *
 * WHY: Per the locked product decisions, a funnel piece = one active brand asset
 * (decision #1) and Alpha is text-only — no live fetch, no image (decision #5),
 * so the screenshot tab is a labelled post-Alpha affordance, not a real upload.
 * Nothing here is fabricated: the verdict comes back from the audit engine via the
 * seam; this dialog only collects honest user input and surfaces what the seam
 * returns. All copy is Tier-A public vocabulary — no internal jargon leaks.
 */
import { useId, useMemo, useState } from 'react';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  getApplicableTouchpoints,
  touchpointsByStage,
  getTouchpoint,
  type ApplicabilityTag,
} from '@/config/touchpointTaxonomy';
import { addPiece as defaultAddPiece } from '@/services/v4/fixService';
import type { BrandAssetCreate } from '@/services/interfaces/IBrandFunnelService';
import type { DataResult, FunnelPiece } from '@/types/v4Fix';
import { captureAlphaEvent, type AlphaEventProps } from '@/lib/posthogClient';

/** Loop-3 add-a-piece telemetry — registered names, no casts (IDs/flags only). */
type V4AddEvent =
  | 'v4_add_piece_opened'
  | 'v4_add_piece_submitted'
  | 'v4_add_piece_succeeded'
  | 'v4_add_piece_failed';

function captureV4(name: V4AddEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

/** How the user is supplying the content we audit. URL is still text in Alpha. */
type ContentMode = 'copy' | 'url' | 'screenshot';

/** Channel the piece lives on (display + telemetry; folded into context). */
const CHANNELS = ['Amazon', 'TikTok', 'Email', 'Website'] as const;
/** Marketplace / account the piece lives in. */
const MARKETPLACES = ['Amazon US', 'Amazon UK', 'Other / n/a'] as const;

/** The minimum substantive length we accept for the audited content. */
const MIN_CONTENT_LENGTH = 8;

export interface AddPieceDialogProps {
  /** Whether the dialog is open (controlled). */
  open: boolean;
  /** Open/close handler (controlled). */
  onOpenChange: (open: boolean) => void;
  /** The avatar the new piece belongs to; null disables submit (must pick one). */
  avatarId: string | null;
  /** Brand channel tags — when set, the touchpoint list is filtered to what applies. */
  brandTags?: ApplicabilityTag[];
  /**
   * The seam that creates the brand_asset and runs the audit. Defaults to the
   * `addPiece` service export; injectable for tests.
   */
  onAdd?: (input: BrandAssetCreate) => Promise<DataResult<FunnelPiece>>;
  /** Called with the new piece after a successful add + audit. */
  onAdded?: (piece: FunnelPiece) => void;
}

/**
 * Touchpoints grouped by stage for the select — filtered to the brand's channels
 * when `brandTags` is provided, else the full taxonomy.
 */
function useGroupedTouchpoints(brandTags?: ApplicabilityTag[]) {
  return useMemo(() => {
    if (brandTags && brandTags.length > 0) {
      const applicable = new Set(getApplicableTouchpoints(brandTags).map((t) => t.id));
      return touchpointsByStage()
        .map((g) => ({ ...g, touchpoints: g.touchpoints.filter((t) => applicable.has(t.id)) }))
        .filter((g) => g.touchpoints.length > 0);
    }
    return touchpointsByStage().filter((g) => g.touchpoints.length > 0);
  }, [brandTags]);
}

/**
 * The Add-a-piece dialog. Collects one funnel piece and routes it through the
 * grounded add+audit seam; surfaces the seam's error/no-data honestly.
 */
export function AddPieceDialog({
  open,
  onOpenChange,
  avatarId,
  brandTags,
  onAdd = defaultAddPiece,
  onAdded,
}: AddPieceDialogProps): JSX.Element {
  const groups = useGroupedTouchpoints(brandTags);
  const fieldId = useId();

  const [touchpointId, setTouchpointId] = useState('');
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const [marketplace, setMarketplace] = useState<string>(MARKETPLACES[0]);
  const [contentMode, setContentMode] = useState<ContentMode>('copy');
  const [content, setContent] = useState('');
  const [job, setJob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedContent = content.trim();
  const contentValid = trimmedContent.length >= MIN_CONTENT_LENGTH;
  const canSubmit = Boolean(avatarId) && Boolean(touchpointId) && contentValid && !submitting;

  function resetForm(): void {
    setTouchpointId('');
    setChannel(CHANNELS[0]);
    setMarketplace(MARKETPLACES[0]);
    setContentMode('copy');
    setContent('');
    setJob('');
    setError(null);
  }

  function handleOpenChange(next: boolean): void {
    if (next) {
      captureV4('v4_add_piece_opened');
    } else if (!submitting) {
      resetForm();
    }
    onOpenChange(next);
  }

  /** Honest, factual context from the user's selections + optional job line. */
  function buildContextDescription(): string {
    const job_ = job.trim();
    if (job_.length >= MIN_CONTENT_LENGTH) return job_;
    const label = getTouchpoint(touchpointId)?.label ?? touchpointId;
    return [label, channel, marketplace].filter(Boolean).join(' · ');
  }

  async function handleSubmit(): Promise<void> {
    if (!avatarId || !touchpointId || !contentValid) return;
    const tp = getTouchpoint(touchpointId);
    setSubmitting(true);
    setError(null);
    captureV4('v4_add_piece_submitted', {
      touchpoint: touchpointId,
      stage: tp?.stage ?? null,
      channel,
      content_mode: contentMode,
      has_job: job.trim().length > 0,
    });
    try {
      const result = await onAdd({
        avatarId,
        touchpointId,
        contextDescription: buildContextDescription(),
        contentText: trimmedContent,
      });
      if (result.status === 'ok') {
        captureV4('v4_add_piece_succeeded', {
          touchpoint: touchpointId,
          stage: tp?.stage ?? null,
          status: result.data.status,
        });
        onAdded?.(result.data);
        resetForm();
        onOpenChange(false);
        return;
      }
      const message =
        result.status === 'no_data'
          ? result.reason
          : result.error || 'Could not add that funnel piece.';
      setError(message);
      captureV4('v4_add_piece_failed', { touchpoint: touchpointId, reason: result.status });
    } catch (err) {
      setError('Something went wrong adding that piece. Please try again.');
      captureV4('v4_add_piece_failed', { touchpoint: touchpointId, reason: 'exception' });
      console.error('[AddPieceDialog] addPiece failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="v4-add-piece-dialog">
        <DialogHeader>
          <DialogTitle>Add a funnel piece</DialogTitle>
          <DialogDescription>
            A funnel piece = one active brand asset. Add it once; Brand Coach audits it against your
            brand and tracks its job from here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Touchpoint, grouped by stage */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-tp`}>Which touchpoint is this?</Label>
            <Select value={touchpointId} onValueChange={setTouchpointId}>
              <SelectTrigger id={`${fieldId}-tp`} data-testid="v4-add-piece-touchpoint">
                <SelectValue placeholder="Pick a touchpoint…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectGroup key={g.stage.id}>
                    <SelectLabel>{g.stage.label}</SelectLabel>
                    {g.touchpoints.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel + marketplace */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-channel`}>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger id={`${fieldId}-channel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-market`}>Marketplace / account</Label>
              <Select value={marketplace} onValueChange={setMarketplace}>
                <SelectTrigger id={`${fieldId}-market`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETPLACES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content — copy / URL / screenshot(post-Alpha) */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-content`}>What&apos;s on it? (the content we audit + track)</Label>
            <Tabs value={contentMode} onValueChange={(v) => setContentMode(v as ContentMode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="copy">Paste copy</TabsTrigger>
                <TabsTrigger value="url">Paste URL</TabsTrigger>
                <TabsTrigger value="screenshot">Upload screenshot</TabsTrigger>
              </TabsList>
              <TabsContent value="copy" className="mt-2">
                <Textarea
                  id={`${fieldId}-content`}
                  data-testid="v4-add-piece-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the listing copy / email body / page text…"
                  rows={5}
                />
              </TabsContent>
              <TabsContent value="url" className="mt-2">
                <Textarea
                  data-testid="v4-add-piece-content-url"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the page URL (we store the text, not a live fetch in Alpha)…"
                  rows={3}
                />
              </TabsContent>
              <TabsContent value="screenshot" className="mt-2">
                <div
                  className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground"
                  data-testid="v4-add-piece-screenshot-note"
                >
                  Screenshot upload + image audit is post-Alpha. For now, paste the copy or the URL —
                  Alpha audits text only.
                </div>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              Alpha: copy or URL (text). Screenshot upload + image audit = post-Alpha.
            </p>
            {content.length > 0 && !contentValid ? (
              <p className="text-xs text-destructive" data-testid="v4-add-piece-content-error">
                Add at least {MIN_CONTENT_LENGTH} characters so we have something real to audit.
              </p>
            ) : null}
          </div>

          {/* Optional job line */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-job`}>
              A line on its job (optional — what should this piece make the customer do?)
            </Label>
            <Input
              id={`${fieldId}-job`}
              data-testid="v4-add-piece-job"
              value={job}
              onChange={(e) => setJob(e.target.value)}
              placeholder="Convert the visit into an order while echoing the ad's promise."
            />
          </div>

          {!avatarId ? (
            <p className="text-xs text-muted-foreground" data-testid="v4-add-piece-no-avatar">
              Pick a customer avatar first so we can audit this piece against the right brand.
            </p>
          ) : null}

          {error ? (
            <div
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="v4-add-piece-submit-error"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="v4-add-piece-submit">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Auditing…
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Add &amp; audit against my brand
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddPieceDialog;
