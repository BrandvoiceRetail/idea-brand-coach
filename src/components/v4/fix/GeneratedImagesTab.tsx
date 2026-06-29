/**
 * GeneratedImagesTab — the in-app "Generated images" gallery for the Fix surface.
 *
 * Surfaces the listing images the connector coach generated (via the
 * `generate_listing_image` tool → `gemini-image-generate` edge fn → `brand-assets`
 * bucket) so they live in the app, not just the chat. Loads on mount via
 * `listGeneratedImages` (authed client + per-user storage RLS), with honest
 * loading / empty / error states and a refresh. v23 dark surface (semantic tokens).
 *
 * NO FABRICATION: renders only real stored objects; the empty state explains how to
 * generate one rather than showing a placeholder image.
 */
import { useCallback, useEffect, useState } from 'react';
import { ImageIcon, RefreshCw, Download, ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listGeneratedImages, type GeneratedImage } from '@/services/v4/generatedImagesService';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; images: GeneratedImage[] }
  | { kind: 'unauth' }
  | { kind: 'error'; message: string };

export function GeneratedImagesTab(): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    const res = await listGeneratedImages();
    if (res.status === 'ok') setState({ kind: 'ready', images: res.images });
    else if (res.status === 'unauthenticated') setState({ kind: 'unauth' });
    else setState({ kind: 'error', message: res.message });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card data-testid="v4-generated-images">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-gold-warm" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Generated images</h2>
              <p className="text-xs text-muted-foreground">
                Listing images the coach created for you, saved to your assets.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 gap-1.5"
            onClick={() => void load()}
            disabled={state.kind === 'loading'}
            data-testid="v4-generated-images-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${state.kind === 'loading' ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {state.kind === 'loading' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span className="text-foreground">Couldn&apos;t load your images. {state.message}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        )}

        {state.kind === 'unauth' && (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Sign in to see the images the coach generated for you.
          </p>
        )}

        {state.kind === 'ready' && state.images.length === 0 && (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-gold-warm" />
              No generated images yet
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              Ask the Brand Coach connector for a listing image brief, then have it generate the
              image from your real product photo. It lands here automatically, sized for Amazon
              (2048&times;2048).
            </p>
          </div>
        )}

        {state.kind === 'ready' && state.images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {state.images.map((img) => (
              <figure
                key={img.path}
                className="group relative overflow-hidden rounded-lg border border-border bg-card"
              >
                {img.signedUrl ? (
                  <img
                    src={img.signedUrl}
                    alt="Coach-generated listing image"
                    loading="lazy"
                    className="aspect-square w-full bg-muted object-contain"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                    Preview unavailable
                  </div>
                )}
                {img.signedUrl && (
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-foreground/70 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <a
                      href={img.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-background hover:bg-background/20"
                      title="Open full size"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                    <a
                      href={img.signedUrl}
                      download
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-background hover:bg-background/20"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </a>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
