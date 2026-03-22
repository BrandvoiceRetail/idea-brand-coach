import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, Search, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseAsinInput, asinToReviewUrl } from '@/utils/asinParser';
import { cn } from '@/lib/utils';

interface ReviewAnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendToTrevor: (contextString: string) => void;
  onEnrichmentComplete?: (contextString: string, totalReviews: number) => void;
}

interface ScrapedReview {
  rating: number;
  body: string;
}

interface ProductResult {
  asin: string;
  reviews: ScrapedReview[];
  error?: string;
  starDistribution?: Record<string, number>;
}

type ModalState = 'input' | 'scraping' | 'results';
type AsinStatus = 'pending' | 'in-progress' | 'complete' | 'error';

function formatAsinDisplay(asin: string): string {
  if (asin.length <= 10) {
    return asin;
  }
  return `${asin.slice(0, 4)}...${asin.slice(-4)}`;
}

function buildContextString(results: ProductResult[]): string {
  const sections = results
    .filter((r) => r.reviews.length > 0)
    .map((product) => {
      const avgRating =
        product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
      const excerpts = product.reviews
        .slice(0, 3)
        .map((r) => `  - "${r.body.slice(0, 200)}"`)
        .join('\n');

      const lines = [
        `### Product: ${product.asin}`,
        `- Reviews analyzed: ${product.reviews.length}`,
        `- Average rating: ${avgRating.toFixed(1)}/5`,
      ];

      if (product.starDistribution) {
        const dist = Object.entries(product.starDistribution)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([star, count]) => `${star}\u2605: ${count}`)
          .join(', ');
        lines.push(`- Star distribution: ${dist}`);
      }

      lines.push(`- Top review excerpts:`, excerpts);

      return lines.join('\n');
    });

  return `## Competitor Review Analysis\n\n${sections.join('\n\n')}`;
}

export function ReviewAnalyzerModal({
  open,
  onOpenChange,
  onSendToTrevor,
  onEnrichmentComplete,
}: ReviewAnalyzerModalProps): JSX.Element {
  const [inputText, setInputText] = useState('');
  const [modalState, setModalState] = useState<ModalState>('input');
  const [asinStatuses, setAsinStatuses] = useState<Record<string, AsinStatus>>({});
  const [results, setResults] = useState<ProductResult[]>([]);

  const detectedAsins = useMemo(() => parseAsinInput(inputText), [inputText]);

  function resetToInput(): void {
    setModalState('input');
    setAsinStatuses({});
    setResults([]);
  }

  async function handleAnalyze(): Promise<void> {
    if (detectedAsins.length === 0) return;

    const reviewUrls = detectedAsins.map(asinToReviewUrl);

    const initialStatuses: Record<string, AsinStatus> = {};
    for (const asin of detectedAsins) {
      initialStatuses[asin] = 'in-progress';
    }
    setAsinStatuses(initialStatuses);
    setModalState('scraping');

    try {
      const { data, error } = await supabase.functions.invoke('review-scraper', {
        body: { urls: reviewUrls, maxReviewsPerUrl: 20 },
      });

      if (error) throw error;

      const productResults: ProductResult[] = detectedAsins.map((asin, index) => {
        const productData = data?.results?.[index];
        if (productData?.error) {
          return { asin, reviews: [], error: productData.error };
        }
        return {
          asin,
          reviews: (productData?.reviews ?? []) as ScrapedReview[],
        };
      });

      const updatedStatuses: Record<string, AsinStatus> = {};
      for (const product of productResults) {
        updatedStatuses[product.asin] = product.error ? 'error' : 'complete';
      }
      setAsinStatuses(updatedStatuses);
      setResults(productResults);
      setModalState('results');
    } catch {
      toast.error('Failed to scrape reviews. Please try again.');
      resetToInput();
    }
  }

  async function fireBackgroundEnrichment(asins: string[]): Promise<void> {
    try {
      const { data, error } = await supabase.functions.invoke('review-scraper-deep', {
        body: { asins, pagesPerStar: 1 },
      });

      if (error) {
        console.error('Background enrichment failed:', error);
        return;
      }

      const enrichedResults: ProductResult[] = (data?.results ?? []).map((r: any) => ({
        asin: r.asin,
        reviews: r.reviews ?? [],
        error: r.error,
        starDistribution: r.starDistribution,
      }));

      const enrichedContext = buildContextString(enrichedResults);
      const totalReviewCount = data?.totalReviews ?? 0;

      if (totalReviewCount > 0) {
        onEnrichmentComplete?.(enrichedContext, totalReviewCount);
      }
    } catch (err) {
      console.error('Background enrichment error:', err);
    }
  }

  function handleSendToTrevor(): void {
    const contextString = buildContextString(results);
    const asinsToEnrich = [...detectedAsins];

    onSendToTrevor(contextString);
    onOpenChange(false);

    if (onEnrichmentComplete) {
      fireBackgroundEnrichment(asinsToEnrich);
    }
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) {
      resetToInput();
      setInputText('');
    }
    onOpenChange(nextOpen);
  }

  const totalReviews = results.reduce((sum, r) => sum + r.reviews.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Review Analyzer
          </DialogTitle>
          <DialogDescription>
            Analyze competitor reviews to inform your brand strategy.
          </DialogDescription>
        </DialogHeader>

        {modalState === 'input' && (
          <div className="space-y-3">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste Amazon URLs or ASINs, one per line..."
              rows={6}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Accepts ASINs or full Amazon product URLs</span>
              <span>{detectedAsins.length} products detected</span>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={detectedAsins.length === 0}
              className="w-full"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analyze
            </Button>
          </div>
        )}

        {modalState === 'scraping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scraping reviews... {Object.values(asinStatuses).filter((s) => s === 'complete').length}{' '}
              of {detectedAsins.length}
            </p>
            <div className="space-y-2">
              {detectedAsins.map((asin) => (
                <div key={asin} className="flex items-center gap-3 text-sm">
                  <StatusIcon status={asinStatuses[asin] ?? 'pending'} />
                  <span className="font-mono">{asin}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {modalState === 'results' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              Found {totalReviews} reviews across {results.length} products
            </p>
            <div className="space-y-2">
              {results.map((product) => {
                const avgRating =
                  product.reviews.length > 0
                    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
                      product.reviews.length
                    : 0;

                return (
                  <div
                    key={product.asin}
                    className={cn(
                      'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                      product.error && 'border-red-200 bg-red-50'
                    )}
                  >
                    <span className="font-mono">{formatAsinDisplay(product.asin)}</span>
                    {product.error ? (
                      <span className="text-red-500">Error</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {product.reviews.length} reviews &middot; {avgRating.toFixed(1)} stars
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSendToTrevor} className="flex-1">
                Send to Trevor
              </Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: AsinStatus }): JSX.Element {
  switch (status) {
    case 'pending':
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />;
    case 'in-progress':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case 'complete':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'error':
      return <X className="h-4 w-4 text-red-500" />;
  }
}
