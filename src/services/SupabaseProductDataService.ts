/**
 * SupabaseProductDataService
 * Implements IProductDataService for the Supabase backend.
 *
 * Imports Amazon listings via the `import-product-data` edge function and
 * reads back persisted `user_products` / `user_product_reviews` rows for the
 * three downstream consumers (Trust Gap evidence, Positioning Statement reveal reviews,
 * coach chat product context).
 */

import { supabase } from '@/integrations/supabase/client';
import { captureAlphaEvent } from '@/lib/posthogClient';
import {
  IProductDataService,
  ImportResult,
  ImportResultItem,
  ImportedProduct,
  ProductImage,
  ProductReview,
  TrustGapEvidence,
} from './interfaces/IProductDataService';

/** Maximum ASINs accepted per edge-function call (matches edge contract). */
const IMPORT_BATCH_SIZE = 5;

/** Default cap on reviews returned by getAllReviewsAsString. */
const REVIEWS_STRING_MAX = 40;

/** Hard character budget for the formatted review block. */
const REVIEWS_STRING_CHAR_BUDGET = 8000;

/** Max reviews embedded in the coach context block. */
const COACH_CONTEXT_MAX_REVIEWS = 10;

/** Max bullets per product in the coach context block. */
const COACH_CONTEXT_MAX_BULLETS = 3;

/** Max entries in the Trust Gap topReviews array. */
const TRUST_GAP_MAX_REVIEWS = 12;

/** Max characters of a review body in the Trust Gap topReviews array. */
const TRUST_GAP_REVIEW_BODY_MAX = 300;

export class SupabaseProductDataService implements IProductDataService {
  async importProducts(asins: string[]): Promise<ImportResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    captureAlphaEvent('product_import_started', { asin_count: asins.length });
    const results: ImportResultItem[] = [];

    try {
      for (let start = 0; start < asins.length; start += IMPORT_BATCH_SIZE) {
        const batch = asins.slice(start, start + IMPORT_BATCH_SIZE);

        const { data, error } = await supabase.functions.invoke('import-product-data', {
          body: { asins: batch },
        });

        if (error) throw error;

        const batchResults = (data as ImportResult | null)?.results ?? [];
        results.push(...batchResults);
      }
    } catch (err) {
      captureAlphaEvent('product_import_failed', {
        asin_count: asins.length,
        error_type: err instanceof Error ? err.name : 'unknown',
      });
      throw err;
    }

    captureAlphaEvent('product_import_completed', {
      asin_count: asins.length,
      result_count: results.length,
    });
    return { status: 'ok', results };
  }

  async getProducts(): Promise<ImportedProduct[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_products')
      .select('*')
      .eq('user_id', user.id)
      .order('scraped_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => this.mapProduct(row));
  }

  async getAllReviews(): Promise<ProductReview[]> {
    const products = await this.getProducts();
    if (products.length === 0) return [];

    const productIds = products.map((product) => product.id);

    const { data, error } = await supabase
      .from('user_product_reviews')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return this.dedupeReviews((data ?? []).map((row) => this.mapReview(row)));
  }

  /**
   * Drop duplicate reviews across products. Variant ASINs of the same parent
   * share Amazon's parent-level review corpus, so importing two variants stores
   * the same reviews twice; without this the Positioning Statement prefill and Trust Gap
   * evidence repeat themselves. Keyed on the normalised body prefix (same
   * scheme as the scraper-side dedupe); first occurrence wins (newest-first).
   */
  private dedupeReviews(reviews: ProductReview[]): ProductReview[] {
    const seen = new Set<string>();
    const unique: ProductReview[] = [];

    for (const review of reviews) {
      const key = review.body.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100);
      if (key.length < 10) {
        unique.push(review);
        continue;
      }
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(review);
      }
    }

    return unique;
  }

  async getAllReviewsAsString(max: number = REVIEWS_STRING_MAX): Promise<string> {
    return this.reviewsToString(await this.getAllReviews(), max);
  }

  /**
   * Reviews for ONE listing only (every imported variant row of the asin), in
   * the same capped string shape as getAllReviewsAsString. The /v5 build
   * theatre uses this so an account with several imported products never
   * blends corpora across listings.
   */
  async getReviewsForAsinAsString(asin: string, max: number = REVIEWS_STRING_MAX): Promise<string> {
    const products = await this.getProducts();
    const matching = products.filter((p) => p.asin.toUpperCase() === asin.toUpperCase());
    if (matching.length === 0) return '';

    const { data, error } = await supabase
      .from('user_product_reviews')
      .select('*')
      .in('product_id', matching.map((p) => p.id))
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reviews = this.dedupeReviews((data ?? []).map((row) => this.mapReview(row)));
    return this.reviewsToString(reviews, max);
  }

  private reviewsToString(reviews: ProductReview[], max: number): string {
    const cap = Math.min(max, REVIEWS_STRING_MAX);

    const lines: string[] = [];
    let charCount = 0;

    for (const review of reviews.slice(0, cap)) {
      const line = this.formatReviewLine(review);
      const projected = charCount + line.length + (lines.length > 0 ? 1 : 0);
      if (projected > REVIEWS_STRING_CHAR_BUDGET) break;

      lines.push(line);
      charCount = projected;
    }

    return lines.join('\n');
  }

  buildCoachContext(products: ImportedProduct[], reviews: ProductReview[] = []): string {
    if (products.length === 0) return '';

    const blocks = products.map((product) => {
      const lines: string[] = [];
      lines.push(`Product: ${product.title} (ASIN ${product.asin})`);

      if (product.price !== null) {
        lines.push(`Price: $${product.price.toFixed(2)}`);
      }
      if (product.rating !== null) {
        lines.push(`Rating: ${product.rating} (${product.reviewCount} reviews)`);
      }

      const bullets = product.bullets.slice(0, COACH_CONTEXT_MAX_BULLETS);
      if (bullets.length > 0) {
        lines.push('Key features:');
        bullets.forEach((bullet) => lines.push(`- ${bullet}`));
      }

      return lines.join('\n');
    });

    const reviewLines = this.dedupeReviews(reviews)
      .slice(0, COACH_CONTEXT_MAX_REVIEWS)
      .map((review) => this.formatReviewLine(review));
    if (reviewLines.length > 0) {
      blocks.push(['Customer reviews (verbatim sample):', ...reviewLines].join('\n'));
    }

    return blocks.join('\n\n');
  }

  async buildTrustGapEvidence(products: ImportedProduct[]): Promise<TrustGapEvidence> {
    const listings = products.map((product) => ({
      asin: product.asin,
      title: product.title,
      bullets: product.bullets,
      ...(product.description ? { description: product.description } : {}),
    }));

    const reviews = await this.getAllReviews();
    const topReviews = reviews
      .slice(0, TRUST_GAP_MAX_REVIEWS)
      .map((review) => this.formatTrustGapReview(review));

    // Amazon's full-corpus signals (captured by import-product-data) travel with the
    // first product; they let interpretation reason about the whole review base, not
    // just the ~8 verbatim reviews above.
    const first = products[0];
    return {
      listings,
      topReviews,
      ...(first?.customersSay ? { customersSay: first.customersSay } : {}),
      ...(first?.reviewAspects && first.reviewAspects.length > 0 ? { aspects: first.reviewAspects } : {}),
      ...(first?.starDistribution ? { starDistribution: first.starDistribution } : {}),
    };
  }

  /**
   * Format a single review as a "★{rating} — {body}" line.
   */
  private formatReviewLine(review: ProductReview): string {
    return `★${review.rating ?? 0} — ${review.body}`;
  }

  /**
   * Format a review for Trust Gap evidence, truncating the body to the
   * contract limit.
   */
  private formatTrustGapReview(review: ProductReview): string {
    const body = review.body.slice(0, TRUST_GAP_REVIEW_BODY_MAX);
    return `★${review.rating ?? 0} — ${body}`;
  }

  /**
   * Map a `user_products` row to an {@link ImportedProduct}, normalizing the
   * jsonb `bullets` and `images` columns.
   */
  /**
   * Persist the latest completed v5 run for a listing (overwrites the
   * previous snapshot — latest only, by design). Fire-and-forget safe:
   * throws only on a real write error.
   */
  async saveLastRun(asin: string, snapshot: Record<string, unknown>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_products')
      .update({ last_run: snapshot as never, last_run_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('asin', asin);
    if (error) throw error;
  }

  private mapProduct(row: {
    id: string;
    asin: string;
    title: string | null;
    price: number | null;
    rating: number | null;
    review_count: number;
    bullets: unknown;
    description: string | null;
    images: unknown;
    scraped_at: string;
    last_run?: unknown;
    last_run_at?: string | null;
    customers_say?: string | null;
    review_aspects?: unknown;
    star_distribution?: Record<string, number> | null;
  }): ImportedProduct {
    return {
      id: row.id,
      asin: row.asin,
      title: row.title ?? '',
      price: row.price,
      rating: row.rating,
      reviewCount: row.review_count,
      bullets: this.normalizeBullets(row.bullets),
      description: row.description,
      images: this.normalizeImages(row.images),
      scrapedAt: row.scraped_at,
      lastRun: row.last_run ?? null,
      lastRunAt: row.last_run_at ?? null,
      ...(row.customers_say ? { customersSay: row.customers_say } : {}),
      ...(Array.isArray(row.review_aspects)
        ? { reviewAspects: row.review_aspects as Array<{ aspect?: string; sentiment?: string }> }
        : {}),
      ...(row.star_distribution && typeof row.star_distribution === 'object'
        ? { starDistribution: row.star_distribution }
        : {}),
    };
  }

  /**
   * Map a `user_product_reviews` row to a {@link ProductReview}.
   */
  private mapReview(row: {
    id: string;
    rating: number | null;
    title: string | null;
    body: string;
    reviewer_name: string | null;
    verified_purchase: boolean;
  }): ProductReview {
    return {
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      reviewerName: row.reviewer_name,
      verifiedPurchase: row.verified_purchase,
    };
  }

  /**
   * Coerce the jsonb `bullets` column to a string[].
   */
  private normalizeBullets(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  /**
   * Coerce the jsonb `images` column to a {@link ProductImage}[].
   */
  private normalizeImages(value: unknown): ProductImage[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item): ProductImage | null => {
        if (typeof item === 'string') return { url: item };
        if (
          item !== null &&
          typeof item === 'object' &&
          'url' in item &&
          typeof (item as { url: unknown }).url === 'string'
        ) {
          return { url: (item as { url: string }).url };
        }
        return null;
      })
      .filter((image): image is ProductImage => image !== null);
  }
}
