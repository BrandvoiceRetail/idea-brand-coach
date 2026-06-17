/**
 * FigmaConnectCard — the Figma integration surface on the Integrations page.
 *
 * Drives the full click-through: Connect (OAuth) → Import a file → see the
 * extracted design data that now feeds the brand coach. Disconnect removes the
 * connection while keeping previously imported design data.
 */
import { useState, type FormEvent } from 'react';
import { Figma, Loader2, Plug, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFigmaIntegration } from '@/hooks/useFigmaIntegration';
import { FigmaImportList } from '@/components/integrations/FigmaImportList';

export function FigmaConnectCard(): JSX.Element {
  const { status, loading, error, importing, refresh, connect, disconnect, importFile } =
    useFigmaIntegration();
  const [fileInput, setFileInput] = useState<string>('');

  const handleImport = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const value = fileInput.trim();
    if (!value) return;
    const result = await importFile(value);
    if (result) setFileInput('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Figma className="h-5 w-5" />
          <CardTitle>Figma</CardTitle>
          {status?.connected && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          )}
        </div>
        <CardDescription>
          Connect Figma to import your real colors, typography and components so the brand coach can
          reference your actual visual identity.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <span className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && status && !status.connected && (
          <p className="text-sm text-muted-foreground">
            You haven't connected Figma yet. Connecting opens Figma's secure consent screen — we only
            request read access to your files.
          </p>
        )}

        {!loading && !error && status?.connected && (
          <>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {status.connection?.handle ?? status.connection?.email ?? 'Figma account'}
              </p>
              {status.connection?.email && status.connection?.handle && (
                <p className="text-xs text-muted-foreground">{status.connection.email}</p>
              )}
            </div>

            <form onSubmit={handleImport} className="space-y-2">
              <label htmlFor="figma-file" className="text-sm font-medium">
                Import a Figma file
              </label>
              <div className="flex gap-2">
                <Input
                  id="figma-file"
                  placeholder="Paste a Figma file URL or key"
                  value={fileInput}
                  onChange={(e) => setFileInput(e.target.value)}
                  disabled={importing}
                />
                <Button type="submit" disabled={importing || !fileInput.trim()}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                e.g. https://www.figma.com/design/abc123/My-Brand
              </p>
            </form>

            <FigmaImportList imports={status.imports} />
          </>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        {status?.connected ? (
          <Button variant="outline" onClick={() => void disconnect()}>
            Disconnect Figma
          </Button>
        ) : (
          <Button onClick={() => void connect()} disabled={loading}>
            <Plug className="h-4 w-4 mr-1.5" /> Connect Figma
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
