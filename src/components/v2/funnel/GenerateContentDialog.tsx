/**
 * GenerateContentDialog — generate (or regenerate) a funnel piece's content.
 *
 * Routes by the touchpoint's capabilities (capabilityRegistry):
 *   - PIXII capabilities → product images (asin + market), async with progress.
 *   - PALMIER capabilities → short-form video via the local Palmier app, async;
 *     when Palmier isn't reachable the result is a ready-to-run brief.
 *   - CLAUDE capabilities → on-brand copy (email / listing / generic), synchronous.
 * On completion the user can Save it onto the touchpoint's brand_assets row so it
 * joins the audit + lift loop. This is the per-piece generate interface that lets
 * each piece of the funnel be created and updated.
 */
import { useMemo, useState, type JSX } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getTouchpoint } from '@/config/touchpointTaxonomy';
import { isVideoGenerationEnabled } from '@/config/features';
import { capabilitiesFor } from '@/services/contentGeneration/capabilityRegistry';
import { useContentGeneration } from '@/hooks/useContentGeneration';
import type { PalmierAspect, PieceCapability, GenerationJob } from '@/services/contentGeneration/types';

// A practical subset of Pixii marketplaces (the edge fn validates the full list).
const COUNTRIES = ['US', 'GB', 'CA', 'DE', 'FR', 'IT', 'ES', 'AU', 'JP', 'MX', 'NL', 'SE'] as const;
const APLUS_TYPES = ['A+ Basic', 'A+ Premium', 'A+ Premium Mobile'] as const;
const ASPECTS = ['9:16', '16:9', '1:1'] as const;

interface GenerateContentDialogProps {
  touchpointId: string;
  avatarId: string;
  onSaved?: () => void;
  triggerLabel?: string;
  triggerVariant?: 'coach' | 'outline' | 'secondary' | 'ghost';
  triggerSize?: 'sm' | 'default';
}

export function GenerateContentDialog({
  touchpointId, avatarId, onSaved, triggerLabel = 'Generate', triggerVariant = 'coach', triggerSize = 'sm',
}: GenerateContentDialogProps): JSX.Element | null {
  const caps = useMemo(() => capabilitiesFor(touchpointId), [touchpointId]);
  const [open, setOpen] = useState(false);
  const [capKey, setCapKey] = useState(`${caps[0]?.provider}:${caps[0]?.capability}`);
  const label = getTouchpoint(touchpointId)?.label ?? touchpointId;
  const gen = useContentGeneration();
  const [saving, setSaving] = useState(false);
  // Video generation is flag-gated separately from the content-gen surface: the
  // video tabs still show, but until the flag is on a Generate press opens this modal.
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  // Pixii inputs
  const [asin, setAsin] = useState('');
  const [country, setCountry] = useState<string>('US');
  const [mainImageUrl, setMainImageUrl] = useState('');
  const [aplusType, setAplusType] = useState<string>('A+ Basic');
  // Claude inputs
  const [productName, setProductName] = useState('');
  const [tone, setTone] = useState('');
  const [prompt, setPrompt] = useState('');
  // Video (fal / Palmier) inputs — default to the first video capability's hints.
  const firstVideo = caps.find((c) => c.outputKind === 'video');
  const [videoAspect, setVideoAspect] = useState<string>(firstVideo?.videoAspect ?? '9:16');
  const [videoDuration, setVideoDuration] = useState<string>(String(firstVideo?.videoDurationS ?? 8));

  if (caps.length === 0) return null;

  const capability: PieceCapability = caps.find((c) => `${c.provider}:${c.capability}` === capKey) ?? caps[0];
  const videoGated = capability.outputKind === 'video' && !isVideoGenerationEnabled();

  const onOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) gen.reset();
  };

  const onCapChange = (key: string): void => {
    setCapKey(key);
    gen.reset();
  };

  const submit = async (): Promise<void> => {
    if (capability.provider === 'pixii') {
      if (!asin.trim()) { toast.error('An ASIN is required to generate images.'); return; }
      await gen.start({
        capability, avatarId, touchpointId,
        asin: asin.trim(), countryCode: country,
        listingType: capability.pixiiListingType,
        types: capability.capability === 'a_plus' ? [aplusType] : capability.pixiiTypes,
        mainImageUrl: mainImageUrl.trim() || undefined,
        userPrompt: prompt.trim() || undefined,
      });
    } else if (capability.provider === 'palmier' || capability.provider === 'fal') {
      if (videoGated) { setComingSoonOpen(true); return; }
      if (!prompt.trim()) { toast.error('Describe the video you want to generate.'); return; }
      await gen.start({
        capability, avatarId, touchpointId,
        videoPrompt: prompt.trim(),
        model: capability.falModel ?? capability.palmierModel,
        aspect: videoAspect as PalmierAspect,
        durationS: Number(videoDuration) || capability.videoDurationS,
      });
    } else {
      await gen.start({
        capability, avatarId, touchpointId,
        productName: productName.trim() || undefined,
        tone: tone.trim() || undefined,
        prompt: prompt.trim() || undefined,
      });
    }
  };

  const save = async (): Promise<void> => {
    if (!gen.job?.output) return;
    setSaving(true);
    const { error } = await gen.save({ avatarId, touchpointId, capability, output: gen.job.output });
    setSaving(false);
    if (error) { toast.error(`Could not save: ${error.message}`); return; }
    toast.success('Saved to your funnel — run the audit to score it.');
    setOpen(false);
    gen.reset();
    onSaved?.();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate: {label}</DialogTitle>
          <DialogDescription>{capability.hint ?? 'Generate on-brand content for this funnel piece.'}</DialogDescription>
        </DialogHeader>

        {caps.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {caps.map((c) => {
              const key = `${c.provider}:${c.capability}`;
              const active = key === capKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCapChange(key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? 'border-transparent bg-secondary text-secondary-foreground' : 'border-input text-muted-foreground hover:text-foreground'}`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-4 py-1">
          {capability.provider === 'pixii' ? (
            <PixiiForm
              asin={asin} setAsin={setAsin}
              country={country} setCountry={setCountry}
              mainImageUrl={mainImageUrl} setMainImageUrl={setMainImageUrl}
              prompt={prompt} setPrompt={setPrompt}
              isAPlus={capability.capability === 'a_plus'}
              aplusType={aplusType} setAplusType={setAplusType}
            />
          ) : (capability.provider === 'palmier' || capability.provider === 'fal') ? (
            <VideoForm
              prompt={prompt} setPrompt={setPrompt}
              aspect={videoAspect} setAspect={setVideoAspect}
              duration={videoDuration} setDuration={setVideoDuration}
            />
          ) : (
            <CopyForm
              productName={productName} setProductName={setProductName}
              tone={tone} setTone={setTone}
              prompt={prompt} setPrompt={setPrompt}
              isEmail={capability.capability === 'email_copy'}
            />
          )}

          {videoGated && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> AI video generation is coming soon.
            </p>
          )}

          <Button variant="coach" className="w-full" onClick={() => void submit()} disabled={gen.generating}>
            {gen.generating
              ? (capability.provider === 'pixii' ? 'Generating images… (~2 min)' : (capability.provider === 'palmier' || capability.provider === 'fal') ? 'Generating video…' : 'Writing…')
              : `Generate ${capability.label.toLowerCase()}`}
          </Button>

          {gen.error && <p className="text-xs text-destructive">{gen.error}</p>}

          {gen.job
            && (gen.job.status === 'completed' || (gen.job.provider === 'palmier' && gen.job.status === 'pending'))
            && gen.job.output && (
            <GenerationResult job={gen.job} onSave={() => void save()} saving={saving} />
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Video generation is flag-gated — a Generate press surfaces this instead of calling the engine. */}
    <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-1 w-fit rounded-full bg-primary/10 p-4">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle>Video generation — coming soon</DialogTitle>
          <DialogDescription>
            We’re putting the finishing touches on AI video generation. It’ll be available right here
            shortly — check back soon.
          </DialogDescription>
        </DialogHeader>
        <Button variant="coach" className="w-full" onClick={() => setComingSoonOpen(false)}>Got it</Button>
      </DialogContent>
    </Dialog>
    </>
  );
}

function PixiiForm(props: {
  asin: string; setAsin: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  mainImageUrl: string; setMainImageUrl: (v: string) => void;
  prompt: string; setPrompt: (v: string) => void;
  isAPlus: boolean; aplusType: string; setAplusType: (v: string) => void;
}): JSX.Element {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="gen-asin">ASIN</Label>
          <Input id="gen-asin" value={props.asin} onChange={(e) => props.setAsin(e.target.value)} placeholder="e.g. B0DCPKQ8G7" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gen-country">Market</Label>
          <Select value={props.country} onValueChange={props.setCountry}>
            <SelectTrigger id="gen-country" className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {props.isAPlus && (
        <div className="space-y-1.5">
          <Label htmlFor="gen-aplus">A+ tier</Label>
          <Select value={props.aplusType} onValueChange={props.setAplusType}>
            <SelectTrigger id="gen-aplus"><SelectValue /></SelectTrigger>
            <SelectContent>
              {APLUS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="gen-img">Main image URL <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="gen-img" value={props.mainImageUrl} onChange={(e) => props.setMainImageUrl(e.target.value)} placeholder="https://…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gen-prompt">Creative direction <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="gen-prompt" value={props.prompt} onChange={(e) => props.setPrompt(e.target.value)} rows={2} placeholder="e.g. clean lifestyle shots, warm tones" />
      </div>
    </>
  );
}

function CopyForm(props: {
  productName: string; setProductName: (v: string) => void;
  tone: string; setTone: (v: string) => void;
  prompt: string; setPrompt: (v: string) => void;
  isEmail: boolean;
}): JSX.Element {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="gen-product">Product</Label>
          <Input id="gen-product" value={props.productName} onChange={(e) => props.setProductName(e.target.value)} placeholder="e.g. the display case" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gen-tone">Tone <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="gen-tone" value={props.tone} onChange={(e) => props.setTone(e.target.value)} placeholder="warm, confident" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gen-copyprompt">{props.isEmail ? "What's this email for?" : 'Key message'}</Label>
        <Textarea id="gen-copyprompt" value={props.prompt} onChange={(e) => props.setPrompt(e.target.value)} rows={3}
          placeholder={props.isEmail ? 'e.g. welcome new buyers and set up the first use' : 'e.g. lead with the protection promise'} />
      </div>
      <p className="text-[11px] text-muted-foreground">Grounded in your avatar + Signature. Review before publishing.</p>
    </>
  );
}

function VideoForm(props: {
  prompt: string; setPrompt: (v: string) => void;
  aspect: string; setAspect: (v: string) => void;
  duration: string; setDuration: (v: string) => void;
}): JSX.Element {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="gen-vprompt">What should the video show?</Label>
        <Textarea id="gen-vprompt" value={props.prompt} onChange={(e) => props.setPrompt(e.target.value)} rows={3}
          placeholder="e.g. fast-paced UGC unboxing — hands opening the case, warm natural light, punchy cuts" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="gen-aspect">Aspect</Label>
          <Select value={props.aspect} onValueChange={props.setAspect}>
            <SelectTrigger id="gen-aspect"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gen-duration">Duration (s)</Label>
          <Input id="gen-duration" type="number" min={1} value={props.duration} onChange={(e) => props.setDuration(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Generates in your local Palmier app (sign-in + credits required). If it isn’t reachable, you’ll get a ready-to-run brief to paste in.
      </p>
    </>
  );
}

function GenerationResult({ job, onSave, saving }: { job: GenerationJob; onSave: () => void; saving: boolean }): JSX.Element {
  const out = job.output ?? {};
  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-3">
      {out.images && out.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {out.images.map((img) => (
            <a key={img.storage_path} href={img.signed_url ?? undefined} target="_blank" rel="noreferrer" className="block">
              {img.signed_url
                ? <img src={img.signed_url} alt="generated" className="aspect-square w-full rounded object-cover" />
                : <div className="aspect-square w-full rounded bg-muted" />}
            </a>
          ))}
        </div>
      )}
      {out.videos && out.videos.length > 0 && out.videos.map((v, i) => (
        <div key={v.storage_path ?? v.palmier_asset_id ?? i} className="rounded border bg-background/60 p-2 text-xs space-y-1">
          {v.signed_url ? (
            <>
              <video src={v.signed_url} controls className="w-full rounded" />
              <p className="text-muted-foreground">{v.model ?? 'cloud'}{v.duration_s ? ` · ${v.duration_s}s` : ''}{v.aspect ? ` · ${v.aspect}` : ''}</p>
            </>
          ) : (
            <>
              <p className="font-medium">🎬 Video generated in Palmier</p>
              <p className="text-muted-foreground">Asset {v.palmier_asset_id}{v.duration_s ? ` · ${v.duration_s}s` : ''}{v.aspect ? ` · ${v.aspect}` : ''}</p>
              <p>{v.prompt}</p>
            </>
          )}
        </div>
      ))}
      {out.brief && (
        <div className="rounded border border-dashed bg-background/60 p-2 text-xs space-y-1">
          <p className="font-medium">🎬 Palmier brief — run this in your local Palmier</p>
          <p>{out.brief.prompt}</p>
          <p className="text-muted-foreground">
            {out.brief.aspect ?? '9:16'}{out.brief.duration_s ? ` · ${out.brief.duration_s}s` : ''}{out.brief.model ? ` · ${out.brief.model}` : ''}
          </p>
        </div>
      )}
      {out.copy && <Textarea readOnly value={out.copy} rows={8} className="text-xs" />}
      {out.ad_errors && out.ad_errors.length > 0 && (
        <p className="text-[11px] text-destructive">{out.ad_errors.length} image(s) failed to generate — try regenerating.</p>
      )}
      {typeof out.remaining_credits === 'number' && (
        <p className="text-[10px] text-muted-foreground">Pixii credits remaining: {out.remaining_credits}</p>
      )}
      <Button variant="coach" size="sm" onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save to funnel → new version'}
      </Button>
    </div>
  );
}
