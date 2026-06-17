/**
 * AssetUploadDialog — capture a touchpoint asset: a screenshot + a REQUIRED short
 * context description + the touchpoint it belongs to. On submit it uploads, persists,
 * and runs the vision audit, then calls onUploaded().
 */
import { useMemo, useState, type JSX, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SupabaseBrandFunnelService } from '@/services/SupabaseBrandFunnelService';
import { getApplicableTouchpoints, getStages } from '@/config/touchpointTaxonomy';
import { DEFAULT_BRAND_TAGS } from '@/hooks/useFunnelTracker';

interface AssetUploadDialogProps {
  avatarId: string;
  onUploaded: () => void;
  trigger?: ReactNode;
}

export function AssetUploadDialog({ avatarId, onUploaded, trigger }: AssetUploadDialogProps): JSX.Element {
  const service = useMemo(() => new SupabaseBrandFunnelService(), []);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [contentText, setContentText] = useState('');
  const [description, setDescription] = useState('');
  const [touchpointId, setTouchpointId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stages = getStages();
  const optionsByStage = useMemo(() => {
    const applicable = getApplicableTouchpoints(DEFAULT_BRAND_TAGS);
    return stages.map((s) => ({ stage: s, items: applicable.filter((t) => t.stage === s.id) }));
  }, [stages]);

  const descTooShort = description.trim().length < 8;
  const hasContent = !!file || contentText.trim().length > 0;
  const canSubmit = hasContent && !descTooShort && !!touchpointId && !submitting;

  const reset = (): void => {
    setFile(null);
    setContentText('');
    setDescription('');
    setTouchpointId('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!hasContent || !touchpointId) return;
    setSubmitting(true);
    const created = await service.createAsset({
      avatarId,
      touchpointId,
      contextDescription: description,
      file: file ?? undefined,
      contentText: contentText.trim() || undefined,
    });
    if (created.error || !created.data) {
      toast.error(created.error?.message ?? 'Upload failed');
      setSubmitting(false);
      return;
    }
    toast.message('Uploaded — auditing against your avatar + Signature…');
    const audited = await service.auditAsset(created.data.id);
    setSubmitting(false);
    if (audited.error) {
      toast.error(`Audit failed: ${audited.error.message}`);
    } else {
      toast.success(`Scored ${audited.data?.overall_score ?? '—'}/100 · ${audited.data?.status}`);
    }
    reset();
    setOpen(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="secondary">Upload asset</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a funnel asset</DialogTitle>
          <DialogDescription>
            Upload a screenshot of the touchpoint and tell us what it is — that context drives the audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="asset-file">Screenshot</Label>
            <input
              id="asset-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-copy">…or paste the copy (for text touchpoints)</Label>
            <Textarea
              id="asset-copy"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Paste the email / listing / page copy here instead of (or with) a screenshot"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-touchpoint">Touchpoint</Label>
            <Select value={touchpointId} onValueChange={setTouchpointId}>
              <SelectTrigger id="asset-touchpoint">
                <SelectValue placeholder="Where in the funnel is this?" />
              </SelectTrigger>
              <SelectContent>
                {optionsByStage.map(({ stage, items }) => (
                  items.length > 0 && (
                    <SelectGroup key={stage.id}>
                      <SelectLabel>{stage.label}</SelectLabel>
                      {items.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-desc">
              Short description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="asset-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Amazon main image — collector deck hero, sells the limited-edition angle"
              rows={3}
            />
            {descTooShort && description.length > 0 && (
              <p className="text-xs text-destructive">A bit more context (8+ characters) so the audit knows what it's looking at.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="coach" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? 'Auditing…' : 'Upload & audit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
