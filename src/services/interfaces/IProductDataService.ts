/**
 * IProductDataService Interface
 *
 * Contract for importing and consuming a seller's Amazon listing data.
 *
 * Sellers import one or more listings by ASIN; an edge function
 * (`import-product-data`) scrapes each `/dp/{asin}` page via Firecrawl and
 * persists the listing plus its embedded reviews to `user_products` and
 * `user_product_reviews`. This service is the client-side gateway to that
 * data, exposing it for three downstream consumers:
 *   (a) Trust Gap interpretation evidence
 *   (b) Signature reveal preloaded reviews
 *   (c) coach chat product context
 */

/**
 * A product image reference as stored on an imported listing.
 */
export interface ProductImage {
  url: string;
}

/**
 * An imported Amazon listing, mapped from a `user_products` row.
 */
export interface ImportedProduct {
  id: string;
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  bullets: string[];
  description: string | null;
  images: ProductImage[];
  scrapedAt: string;
}

/**
 * A single review for an imported product, mapped from a
 * `user_product_reviews` row.
 */
export interface ProductReview {
  id: string;
  rating: number | null;
  title: string | null;
  body: string;
  reviewerName: string | null;
  verifiedPurchase: boolean;
}

/**
 * Per-ASIN outcome returned by the `import-product-data` edge function.
 * Mirrors the shared edge-function response contract exactly.
 */
export interface ImportResultItem {
  asin: string;
  ok: boolean;
  productId?: string;
  title?: string;
  rating?: number;
  reviewCount?: number;
  reviewsSaved?: number;
  error?: string;
}

/**
 * Aggregate result of an import call, mirroring the edge-function
 * `{ status, results }` response contract.
 */
export interface ImportResult {
  status: 'ok';
  results: ImportResultItem[];
}

/**
 * Evidence bundle handed to the diagnostic-interpretation edge function so
 * Trust Gap interpretation can cite real listing copy and reviews.
 *
 * `topReviews` entries are formatted "★{rating} — {body}", capped at 12
 * entries with each body truncated to ≤300 characters.
 */
export interface TrustGapEvidence {
  listings: Array<{
    asin: string;
    title: string;
    bullets: string[];
    description?: string;
  }>;
  topReviews: string[];
}

export interface IProductDataService {
  /**
   * Import one or more Amazon listings by ASIN.
   *
   * ASINs are submitted to the `import-product-data` edge function in
   * batches of at most 5 per call, sequentially; results from every batch
   * are merged into a single {@link ImportResult}.
   *
   * @param asins - ASINs to import
   * @returns Promise resolving to the merged import result
   */
  importProducts(asins: string[]): Promise<ImportResult>;

  /**
   * Get all imported products for the authenticated user, newest-first.
   *
   * @returns Promise resolving to the user's imported products
   */
  getProducts(): Promise<ImportedProduct[]>;

  /**
   * Get all reviews across the authenticated user's imported products.
   *
   * @returns Promise resolving to every imported review
   */
  getAllReviews(): Promise<ProductReview[]>;

  /**
   * Get all imported reviews formatted as newline-joined "★{rating} — {body}"
   * lines, capped at 40 reviews and 8000 characters.
   *
   * @param max - Optional cap on the number of reviews (defaults to 40)
   * @returns Promise resolving to the formatted review block
   */
  getAllReviewsAsString(max?: number): Promise<string>;

  /**
   * Build a compact product-context block for the coach chat from the given
   * products.
   *
   * @param products - Imported products to summarize
   * @returns A compact, human-readable context string
   */
  buildCoachContext(products: ImportedProduct[]): string;

  /**
   * Build the Trust Gap evidence bundle from the given products and their
   * reviews.
   *
   * @param products - Imported products to draw listing evidence from
   * @returns Promise resolving to the evidence bundle
   */
  buildTrustGapEvidence(products: ImportedProduct[]): Promise<TrustGapEvidence>;
}
