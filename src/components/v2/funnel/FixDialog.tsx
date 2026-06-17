/**
 * FixDialog — start fixing a misaligned/stale asset. Shows the audit's concrete fix,
 * deep-links to the coach to action it, and opens a before/after brand_test (baseline
 * captured now; result recorded later from the Testing tab).
 */
import { useMemo, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SupabaseBrandFunnelService } from '@/services/SupabaseBrandFunnelService';
import { getTouchpoint } from '@/config/touchpointTaxonomy';
import type { BrandAsset } from '@/services/interfaces/IBrandFunnelService';

interface FixDialogProps {
  asset: BrandAsset;
  onDone: () => void;
}

export function FixDialog({ asset, onDone }: FixDialogProps): JSX.Element {
  const service = useMemo(() => new SupabaseBrandFunnelService(), []);
  const [open, setOpen] = useState(false);
  const [hypothesis, setHypothesis] = useState(asset.audit_result?.fix ?? '');
  const [metricType, setMetricType] = useState('');
  const [baseline, setBaseline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [revised, setRevised] = useState<string | null>(null);
  const [flags, setFlags] = useState<string[]>([]);

  const label = getTouchpoint(asset.touchpoint_id)?.label ?? asset.touchpoint_id;

  const generateRewrite = async (): Promise<void> => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke('funnel-rewrite', { body: { assetId: asset.id } });
    setGenerating(false);
    if (error || !data?.ok) { toast.error('Rewrite failed'); return; }
    setRevised(data.revised as string);
    setFlags((data.flags as string[]) ?? []);
  };

  const applyRewrite = async (): Promise<void> => {
    if (!revised) return;
    setApplying(true);
    const { data, error } = await service.applyRewrite(asset, revised);
    setApplying(false);
    if (error || !data) { toast.error(`Could not apply: ${error?.message ?? 'unknown'}`); return; }
    toast.success(`Applied + re-audited · ${data.overall_score ?? '—'}/100 ${data.status}`);
    setOpen(false);
    onDone();
  };
  const canStart = hypothesis.trim().length > 0 && metricType.trim().length > 0 && baseline.trim() !== '' && !submitting;

  const startTest = async (): Promise<void> => {
    setSubmitting(true);
    const { error } = await service.recordTest({
      assetId: asset.id,
      hypothesis: hypothesis.trim(),
      metricType: metricType.trim(),
      baselineValue: Number(baseline),
    });
    setSubmitting(false);
    if (error) { toast.error(`Could not start test: ${error.message}`); return; }
    toast.success('Test opened — record the result later from Testing & Lift.');
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="coach">Fix with coach</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fix: {label}</DialogTitle>
          <DialogDescription>
            The audit's recommended change, and a before/after test so you can prove the lift.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {asset.audit_result?.rationale && (
            <p className="text-xs text-muted-foreground">{asset.audit_result.rationale}</p>
          )}

          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => void generateRewrite()} disabled={generating}>
              {generating ? 'Writing…' : '✨ Generate on-brand rewrite'}
            </Button>
            {revised && (
              <div className="rounded-md border bg-muted/40 p-3">
                <Textarea readOnly value={revised} rows={5} className="text-xs" />
                {flags.length > 0 && (
                  <div className="mt-2 text-xs text-destructive">Publish-filter flags: {flags.join('; ')}</div>
                )}
                <Button variant="coach" size="sm" className="mt-2" onClick={() => void applyRewrite()} disabled={applying}>
                  {applying ? 'Applying…' : 'Apply rewrite → new version + re-audit'}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fix-hyp">The fix (hypothesis)</Label>
            <Textarea id="fix-hyp" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fix-metric">Metric to move</Label>
              <Input id="fix-metric" value={metricType} onChange={(e) => setMetricType(e.target.value)} placeholder="e.g. PDP conversion %" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fix-baseline">Baseline now</Label>
              <Input id="fix-baseline" type="number" value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="e.g. 3.0" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="outline">
            <Link to={`/v2/coach?fixAsset=${asset.id}`}>Open coach to rewrite</Link>
          </Button>
          <Button variant="coach" onClick={() => void startTest()} disabled={!canStart}>
            {submitting ? 'Opening…' : 'Open test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
