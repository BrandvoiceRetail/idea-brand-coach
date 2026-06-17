/**
 * BulkUploadDialog — drop a folder of screenshots; each is auto-classified into a funnel
 * touchpoint (vision, editable), with a prefilled description, then uploaded + audited in
 * one pass. Removes the one-at-a-time friction. Description stays required (prefilled).
 */
import { useMemo, useState, type JSX } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupabaseBrandFunnelService } from '@/services/SupabaseBrandFunnelService';
import { getApplicableTouchpoints, getTouchpoint, type ApplicabilityTag } from '@/config/touchpointTaxonomy';

interface BulkItem {
  file: File;
  touchpointId: string;
  description: string;
  classifying: boolean;
}

interface BulkUploadDialogProps {
  avatarId: string;
  brandTags: ApplicabilityTag[];
  onUploaded: () => void;
}

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const [meta, b64] = result.split(',');
      resolve({ data: b64, mediaType: meta.match(/data:(.*?);/)?.[1] ?? 'image/png' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BulkUploadDialog({ avatarId, brandTags, onUploaded }: BulkUploadDialogProps): JSX.Element {
  const service = useMemo(() => new SupabaseBrandFunnelService(), []);
  const candidates = useMemo(
    () => getApplicableTouchpoints(brandTags).map((t) => ({ id: t.id, label: t.label, stage: t.stage })),
    [brandTags],
  );
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const addFiles = async (files: FileList | null): Promise<void> => {
    if (!files) return;
    const fresh: BulkItem[] = Array.from(files).map((file) => ({
      file, touchpointId: candidates[0]?.id ?? '', description: '', classifying: true,
    }));
    setItems((prev) => [...prev, ...fresh]);
    // Auto-classify each in the background.
    for (const item of fresh) {
      void (async () => {
        try {
          const { data, mediaType } = await fileToBase64(item.file);
          const res = await supabase.functions.invoke('classify-touchpoint', {
            body: { imageBase64: data, mediaType, candidates },
          });
          const tpId = res.data?.touchpoint_id ?? item.touchpointId;
          const label = getTouchpoint(tpId)?.label ?? '';
          setItems((prev) => prev.map((it) =>
            it.file === item.file ? { ...it, touchpointId: tpId, description: it.description || label, classifying: false } : it));
        } catch {
          setItems((prev) => prev.map((it) => (it.file === item.file ? { ...it, classifying: false } : it)));
        }
      })();
    }
  };

  const update = (file: File, patch: Partial<BulkItem>): void =>
    setItems((prev) => prev.map((it) => (it.file === file ? { ...it, ...patch } : it)));

  const allReady = items.length > 0 && items.every((it) => !it.classifying && it.touchpointId && it.description.trim().length >= 8);

  const submit = async (): Promise<void> => {
    setRunning(true);
    setDone(0);
    for (const it of items) {
      const created = await service.createAsset({ avatarId, touchpointId: it.touchpointId, contextDescription: it.description, file: it.file });
      if (created.data) await service.auditAsset(created.data.id);
      setDone((d) => d + 1);
    }
    setRunning(false);
    toast.success(`Uploaded + audited ${items.length} asset${items.length === 1 ? '' : 's'}`);
    setItems([]);
    setOpen(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Bulk upload</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk upload</DialogTitle>
          <DialogDescription>Add multiple screenshots — each is auto-matched to a touchpoint (editable). Confirm the description, then upload + audit all.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="bulk-files">Screenshots</Label>
            <input id="bulk-files" type="file" multiple accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void addFiles(e.target.files)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm" />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {items.map((it) => (
              <div key={it.file.name + it.file.size} className="grid grid-cols-[1fr_1.1fr] items-start gap-2 rounded-md border p-2">
                <div>
                  <div className="truncate text-xs font-medium">{it.file.name}</div>
                  <Select value={it.touchpointId} onValueChange={(v) => update(it.file, { touchpointId: v, description: it.description || (getTouchpoint(v)?.label ?? '') })}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder={it.classifying ? 'Detecting…' : 'Touchpoint'} /></SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input value={it.description} onChange={(e) => update(it.file, { description: e.target.value })}
                  placeholder="Short context (required)" className="h-8 text-xs" />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>Cancel</Button>
          <Button variant="coach" onClick={() => void submit()} disabled={!allReady || running}>
            {running ? `Auditing ${done}/${items.length}…` : `Upload & audit ${items.length || ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
