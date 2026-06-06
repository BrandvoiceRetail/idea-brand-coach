/**
 * ProductImportCta
 *
 * Inline card (not a modal) on the diagnostic results page that lets a seller
 * import their Amazon listing(s) by ASIN so the Trust Gap interpretation can be
 * grounded in real listing copy and reviews.
 *
 * State machine: idle → importing → done → error. The seller pastes one ASIN or
 * Amazon URL per line; input is validated client-side via `parseAsinInput`. On
 * import the component calls `productDataService.importProducts(asins)` and renders
 * a per-ASIN result list plus a summary, then notifies the parent via
 * `onImportComplete` so it can refresh products and rebuild Trust Gap evidence.
 *
 * Guests (no authenticated user) see the CTA copy but the button routes to
 * `/auth?redirect=/diagnostic/results`, matching the auth-prompt pattern already
 * used on the results page.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Package,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/services/ServiceProvider';
import { parseAsinInput } from '@/utils/asinParser';
import type {
  ImportedProduct,
  ImportResultItem,
} from '@/services/interfaces/IProductDataService';

/** The most ASINs the import edge function accepts per request. */
const MAX_ASINS = 5;

type ImportStatus = 'idle' | 'importing' | 'done' | 'error';

interface ProductImportCtaProps {
  /** Products already imported by the user, loaded by the parent on mount. */
  importedProducts: ImportedProduct[];
  /** Called after a successful import so the parent can refresh + rebuild evidence. */
  onImportComplete: () => void | Promise<void>;
}

/** A single per-ASIN result row, mirroring the import status-row pattern. */
function ResultRow({ result }: { result: ImportResultItem }): JSX.Element {
  return (
    <div className="flex items-start gap-2 text-sm">
      {result.ok ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
      ) : (
        <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
      )}
      <div className="min-w-0">
        <span className="font-mono text-xs text-muted-foreground">{result.asin}</span>{' '}
        {result.ok ? (
          <span className="break-words">
            {result.title ?? 'Imported'}
            {typeof result.reviewsSaved === 'number' && (
              <span className="text-muted-foreground"> · {result.reviewsSaved} reviews</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground break-words">
            {result.error ?? 'Import failed'}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProductImportCta({
  importedProducts,
  onImportComplete,
}: ProductImportCtaProps): JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { productDataService } = useServices();

  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [results, setResults] = useState<ImportResultItem[]>([]);

  const parsedAsins = parseAsinInput(input);
  const hasExisting = importedProducts.length > 0;

  // When the user already has imports, collapse the form until they choose to
  // re-import, so the default view shows their listings rather than an empty box.
  const [isReimporting, setIsReimporting] = useState(false);
  useEffect(() => {
    if (!hasExisting) setIsReimporting(false);
  }, [hasExisting]);

  const handleImport = async (): Promise<void> => {
    if (parsedAsins.length === 0) return;

    setStatus('importing');
    setResults([]);
    try {
      const result = await productDataService.importProducts(parsedAsins.slice(0, MAX_ASINS));
      setResults(result.results);
      const anyOk = result.results.some((r) => r.ok);
      setStatus(anyOk ? 'done' : 'error');
      if (anyOk) {
        setInput('');
        setIsReimporting(false);
        await onImportComplete();
      }
    } catch (error) {
      console.error('[ProductImportCta] import failed:', error);
      toast.error('We could not import your listing. Please try again.');
      setStatus('error');
    }
  };

  const guestRedirect = (): void => {
    navigate('/auth?redirect=/diagnostic/results');
  };

  const showForm = !hasExisting || isReimporting;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Import your Amazon listing to see where this shows up
        </CardTitle>
        <CardDescription>
          We'll read your listing copy and recent reviews so your Trust Gap read is
          grounded in your real customers' words — not generic advice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Already-imported listings */}
        {hasExisting && (
          <div className="space-y-2">
            {importedProducts.map((product) => (
              <div key={product.id} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                <div className="min-w-0">
                  <span className="break-words">{product.title}</span>
                  <span className="text-muted-foreground">
                    {' '}· {product.reviewCount} reviews
                  </span>
                </div>
              </div>
            ))}
            {!isReimporting && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => user ? setIsReimporting(true) : guestRedirect()}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Add or re-import
              </Button>
            )}
          </div>
        )}

        {/* Import form */}
        {showForm && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="asin-input">ASIN or Amazon URL</Label>
              <Textarea
                id="asin-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={'One ASIN or Amazon URL per line\nB0CJBQ7F5C\nhttps://www.amazon.com/dp/B0CJBQ7F5C'}
                rows={4}
                className="font-mono text-sm"
                disabled={status === 'importing'}
              />
              {parsedAsins.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {parsedAsins.length} listing{parsedAsins.length === 1 ? '' : 's'} detected
                  {parsedAsins.length > MAX_ASINS && (
                    <span className="text-amber-600"> — only the first {MAX_ASINS} will import</span>
                  )}
                </p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={status === 'importing' || (!!user && parsedAsins.length === 0)}
              onClick={() => (user ? handleImport() : guestRedirect())}
            >
              {status === 'importing' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : user ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Import listing
                </>
              ) : (
                <>
                  Sign in to import
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Per-ASIN results + summary */}
        {results.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            {results.map((result) => (
              <ResultRow key={result.asin} result={result} />
            ))}
            <ImportSummary results={results} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Aggregate summary line under the per-ASIN result rows. */
function ImportSummary({ results }: { results: ImportResultItem[] }): JSX.Element {
  const okCount = results.filter((r) => r.ok).length;
  const totalReviews = results.reduce((sum, r) => sum + (r.reviewsSaved ?? 0), 0);

  return (
    <p className="text-sm text-muted-foreground pt-1">
      Imported {okCount} of {results.length} listing{results.length === 1 ? '' : 's'}
      {totalReviews > 0 && ` · ${totalReviews} reviews saved`}.
    </p>
  );
}
