/**
 * V5Home — the returning-user home for /v5.
 *
 * The first thing a signed-in (non-anonymous) seller with ≥1 imported listing
 * sees, instead of the blank paste screen. It greets them, offers the primary
 * "analyse a new listing" path, and lists the listings they have already
 * analysed so they can re-open one in express (same compute, instant reveals).
 *
 * A listing whose last completed run is persisted (user_products.last_run)
 * opens its brief INSTANTLY — "Open brief" means open, not rebuild (Matthew,
 * 2026-07-08). Rebuild is the secondary action. Listings analysed before
 * snapshots existed only offer Rebuild.
 */
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { GlassEyebrow, GlassPanel } from '@/components/v2/problem-solver/glass';
import type { ImportedProduct } from '@/services/interfaces/IProductDataService';
import { isV5RunSnapshot } from './forensicReport';
import { V5Stage } from './V5Chrome';
import { MCP_URL } from '@/config/urls';
import { Info, RefreshCw, MessageSquare, Trash2 } from 'lucide-react';

export interface V5HomeProps {
  /** The signed-in account's email, for the greeting. Null → a generic welcome. */
  email: string | null;
  /** The seller's imported listings, newest-first. */
  products: ImportedProduct[];
  /** Start a fresh paste-an-ASIN read (returns to the entry screen). */
  onNewListing: () => void;
  /** Rebuild a listing in express (same compute, instant reveals). */
  onReopen: (asin: string, title: string | null) => void;
  /** Open a listing's persisted last brief instantly (no engine re-run). */
  onOpenBrief: (product: ImportedProduct) => void;
  /** Remove a listing (and its imported reviews) from the account. */
  onDelete: (product: ImportedProduct) => void;
}

/** Derive a friendly first name from an email local-part; null when we can't. */
function friendlyName(email: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0] ?? '';
  const first = local.split(/[._+-]/)[0] ?? '';
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Honest per-listing metadata drawn only from the imported product row. */
function listingMeta(product: ImportedProduct): string {
  const parts: string[] = [];
  if (product.reviewCount > 0) {
    parts.push(`${product.reviewCount} review${product.reviewCount === 1 ? '' : 's'}`);
  }
  if (typeof product.rating === 'number') {
    parts.push(`${product.rating.toFixed(1)}★`);
  }
  parts.push(product.asin);
  return parts.join(' · ');
}

export function V5Home({ email, products, onNewListing, onReopen, onOpenBrief, onDelete }: V5HomeProps): JSX.Element {
  const name = friendlyName(email);

  return (
    <V5Stage wide>
      <div className="mb-7 text-center">
        <GlassEyebrow>Alpha · Your listings</GlassEyebrow>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Welcome back{name ? `, ${name}` : ''}.
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Pick up where you left off, or read a new listing the way a buyer does.
        </p>
      </div>

      {/* ── Primary CTA: a fresh read ── */}
      <GlassPanel strong className="mb-4 p-6">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
          Start a new read
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] font-semibold text-foreground">
            Paste an ASIN or Amazon URL and I&apos;ll read the listing the way a buyer does.
          </p>
          <Button
            type="button"
            variant="brand"
            className="min-h-11 shrink-0 rounded-xl font-extrabold"
            onClick={onNewListing}
          >
            Analyse a new listing →
          </Button>
        </div>
      </GlassPanel>

      {/* ── The listings they've already analysed ── */}
      {products.length > 0 && (
        <GlassPanel className="p-6">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            The listings you&apos;ve analysed
          </div>
          <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
            Open a listing&apos;s latest brief instantly, or rebuild it for a fresh read of the
            reviews.
          </p>
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {product.title || product.asin}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {listingMeta(product)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isV5RunSnapshot(product.lastRun) ? (
                    <>
                      <Button
                        type="button"
                        variant="brand"
                        size="sm"
                        className="rounded-lg font-bold"
                        onClick={() => onOpenBrief(product)}
                      >
                        Design Brief →
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-muted-foreground"
                        onClick={() => onReopen(product.asin, product.title || null)}
                      >
                        Rebuild
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="brand"
                      size="sm"
                      className="rounded-lg font-bold"
                      onClick={() => onReopen(product.asin, product.title || null)}
                    >
                      Rebuild →
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${product.title || product.asin}`}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes “{product.title || product.asin}” and its imported reviews
                          from your account. Any design brief you generated for it is deleted too.
                          You can always analyse the listing again later. This can&apos;t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDelete(product)}
                        >
                          Delete listing
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Tool discovery section for signed-in users */}
      {email && (
        <GlassPanel className="mt-4 p-6">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            What else is here
          </div>
          <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
            More ways to strengthen your listings and connect with our tools.
          </p>
          <div className="space-y-3">
            {/* Your listings and design briefs */}
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Your listings and design briefs
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Already on this page. Open any brief instantly or rebuild for a fresh read.
                </div>
              </div>
            </div>

            {/* Rebuild for fresh reviews */}
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Rebuild for a fresh read of the reviews
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Use the Rebuild button on any listing above to get updated review insights.
                </div>
              </div>
            </div>

            {/* MCP connector */}
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Chat with the Brand Coach, 24/7
                </div>
                <div className="mt-1 rounded-md bg-foreground/[0.03] px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                  {MCP_URL}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  It&apos;s the same coach, always on in Claude — connect this URL once and ask it
                  anything about your brand, any time.
                </div>
              </div>
            </div>

            {/* Feedback widget reminder */}
            <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/30 dark:bg-purple-950/20">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-purple-600 text-xs font-bold text-white">
                ?
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Something feel off?
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Use the purple feedback widget (bottom left) to let us know.
                </div>
              </div>
            </div>
          </div>
        </GlassPanel>
      )}
    </V5Stage>
  );
}
