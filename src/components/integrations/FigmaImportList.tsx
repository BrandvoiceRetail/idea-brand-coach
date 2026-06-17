/**
 * FigmaImportList — presentational history of imported Figma files, showing the
 * extracted palette swatches, typography and component counts per file.
 */
import { Palette, Type, Component } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FigmaImport } from '@/services/FigmaIntegrationService';

interface FigmaImportListProps {
  imports: FigmaImport[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function FigmaImportItem({ imp }: { imp: FigmaImport }): JSX.Element {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{imp.file_name ?? 'Untitled Figma file'}</p>
          <p className="text-xs text-muted-foreground">
            Imported {formatDate(imp.updated_at ?? imp.created_at)}
          </p>
        </div>
        {imp.thumbnail_url && (
          <img
            src={imp.thumbnail_url}
            alt={`${imp.file_name ?? 'Figma file'} thumbnail`}
            className="h-12 w-20 rounded object-cover border"
            loading="lazy"
          />
        )}
      </div>

      {imp.palette.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Palette className="h-3.5 w-3.5" />
            <span>Palette ({imp.palette.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {imp.palette.map((c, i) => (
              <span
                key={`${c.hex}-${i}`}
                title={c.name ? `${c.name} · ${c.hex}` : c.hex}
                className="h-6 w-6 rounded border"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      )}

      {imp.typography.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Type className="h-3.5 w-3.5" />
            <span>Typography ({imp.typography.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {imp.typography.slice(0, 8).map((t, i) => (
              <Badge key={`${t.fontFamily}-${i}`} variant="secondary" className="font-normal">
                {t.name ? `${t.name} · ` : ''}
                {t.fontFamily}
                {t.fontSize ? ` ${t.fontSize}px` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {imp.components.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Component className="h-3.5 w-3.5" />
          <span>{imp.components.length} components</span>
        </div>
      )}
    </Card>
  );
}

export function FigmaImportList({ imports }: FigmaImportListProps): JSX.Element | null {
  if (imports.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Imported design data</h3>
      {imports.map((imp) => (
        <FigmaImportItem key={imp.id} imp={imp} />
      ))}
    </div>
  );
}
