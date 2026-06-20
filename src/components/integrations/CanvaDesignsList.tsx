/**
 * CanvaDesignsList — browse live Canva designs and import them into the Brand Coach.
 *
 * Shows a "Load designs" trigger, then a responsive thumbnail grid. Each card
 * has its title, thumbnail, an open-in-Canva link, and an "Add to Brand Coach"
 * action that toggles to "Remove" once imported. Presentational — design data
 * and actions come from `useCanvaConnection` via props.
 */

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, ExternalLink, ImageOff, RefreshCw, Plus, Check, Trash2 } from 'lucide-react';
import type { CanvaDesign, ImportedDesign } from '@/services/canva/types';

export interface CanvaDesignsListProps {
  designs: CanvaDesign[];
  imports: ImportedDesign[];
  isLoadingDesigns: boolean;
  designsContinuation: string | undefined;
  importingIds: ReadonlySet<string>;
  onLoadDesigns: (continuation?: string) => void;
  onImport: (design: CanvaDesign) => void;
  onRemove: (canvaDesignId: string) => void;
}

/** Open-in-Canva link, preferring the edit URL, falling back to view. */
function openInCanvaHref(design: CanvaDesign): string | null {
  return design.editUrl ?? design.viewUrl ?? null;
}

function DesignCard({
  design,
  isImported,
  isBusy,
  onImport,
  onRemove,
}: {
  design: CanvaDesign;
  isImported: boolean;
  isBusy: boolean;
  onImport: (design: CanvaDesign) => void;
  onRemove: (canvaDesignId: string) => void;
}): JSX.Element {
  const href = openInCanvaHref(design);
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {design.thumbnailUrl ? (
          <img
            src={design.thumbnailUrl}
            alt={design.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageOff className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <CardContent className="p-4 flex-1">
        <h3 className="font-medium text-sm line-clamp-2" title={design.title}>
          {design.title || 'Untitled design'}
        </h3>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2 flex-wrap">
        {isImported ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(design.id)}
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            )}
            Remove
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onImport(design)}
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4" aria-hidden="true" />
            )}
            Add to Brand Coach
          </Button>
        )}

        {href && (
          <Button variant="ghost" size="sm" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Open
            </a>
          </Button>
        )}

        {isImported && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 ml-auto">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            Imported
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

export function CanvaDesignsList({
  designs,
  imports,
  isLoadingDesigns,
  designsContinuation,
  importingIds,
  onLoadDesigns,
  onImport,
  onRemove,
}: CanvaDesignsListProps): JSX.Element {
  const importedIds = useMemo(
    () => new Set(imports.map((d) => d.canvaDesignId)),
    [imports],
  );

  const hasLoadedOnce = designs.length > 0 || (!isLoadingDesigns && designsContinuation === undefined);

  return (
    <section className="space-y-4" aria-label="Your Canva designs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Your designs</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onLoadDesigns()}
          disabled={isLoadingDesigns}
        >
          {isLoadingDesigns ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          )}
          {designs.length > 0 ? 'Refresh' : 'Load designs'}
        </Button>
      </div>

      {isLoadingDesigns && designs.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading your designs…
        </div>
      ) : designs.length === 0 ? (
        hasLoadedOnce ? (
          <p className="text-sm text-muted-foreground py-8">
            No designs found in your Canva account yet.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground py-8">
            Load your designs to browse and import them.
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                isImported={importedIds.has(design.id)}
                isBusy={importingIds.has(design.id)}
                onImport={onImport}
                onRemove={onRemove}
              />
            ))}
          </div>

          {designsContinuation && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLoadDesigns(designsContinuation)}
                disabled={isLoadingDesigns}
              >
                {isLoadingDesigns ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
