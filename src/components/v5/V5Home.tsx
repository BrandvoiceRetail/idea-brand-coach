/**
 * V5Home — the returning-user home for /v5.
 *
 * The first thing a signed-in (non-anonymous) seller with ≥1 imported listing
 * sees, instead of the blank paste screen. It greets them, offers the primary
 * "analyse a new listing" path, and lists the listings they have already
 * analysed so they can re-open one in express (same compute, instant reveals).
 *
 * Honest framing: the per-listing outputs (customer profile, brief, score) are
 * brand-level and rebuilt on each run, so this is "the listings you have
 * analysed", NOT "your saved briefs". Re-open rebuilds the customer and brief.
 * The only per-listing facts shown here are the listing's own imported product
 * data (review count, rating) — cheap, already loaded, never a stored artifact.
 */
import { Button } from '@/components/ui/button';
import { GlassEyebrow, GlassPanel } from '@/components/v2/problem-solver/glass';
import type { ImportedProduct } from '@/services/interfaces/IProductDataService';
import { V5Stage } from './V5Chrome';

export interface V5HomeProps {
  /** The signed-in account's email, for the greeting. Null → a generic welcome. */
  email: string | null;
  /** The seller's imported listings, newest-first. */
  products: ImportedProduct[];
  /** Start a fresh paste-an-ASIN read (returns to the entry screen). */
  onNewListing: () => void;
  /** Re-open a listing in express (same compute, instant reveals). */
  onReopen: (asin: string, title: string | null) => void;
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

export function V5Home({ email, products, onNewListing, onReopen }: V5HomeProps): JSX.Element {
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
            Re-open one to rebuild the customer and the brief. Your positioning is rebuilt fresh on
            each read, so this is your listings, not a stored file.
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
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  className="shrink-0 rounded-lg font-bold"
                  onClick={() => onReopen(product.asin, product.title || null)}
                >
                  Re-open →
                </Button>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </V5Stage>
  );
}
