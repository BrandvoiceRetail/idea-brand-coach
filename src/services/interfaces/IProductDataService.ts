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
 *   (b) Positioning Statement reveal preloaded reviews
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
  /**
   * Latest completed v5 run for this listing (report + trigger + brief),
   * persisted so the brief reopens instantly on any later visit. Shape is
   * owned by the v5 surface (see V5RunSnapshot); the service layer treats
   * it as opaque JSON. Null until a run completes.
   */
  lastRun: unknown | null;
  lastRunAt: string | null;
  /** Amazon "Customers say" AI summary (synthesised over the FULL review corpus), if captured. */
  customersSay?: string;
  /** Review-aspect highlights: [{aspect, sentiment}]. */
  reviewAspects?: Array<{ aspect?: string; sentiment?: string }>;
  /** Star-rating histogram {five,four,three,two,one} as percentages. */
  starDistribution?: Record<string, number> | null;
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
  /** Amazon's "Customers say" AI summary — synthesised over the FULL review corpus. */
  customersSay?: string;
  /** Review-aspect highlights: [{aspect, sentiment}]. */
  aspects?: Array<{ aspect?: string; sentiment?: string }>;
  /** Star-rating histogram {five,four,three,two,one} as percentages. */
  starDistribution?: Record<string, number> | null;
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
   * Same formatted review block, but scoped to ONE listing (every imported
   * variant row of the given asin). Empty string when the asin has no
   * imported product. Used by the /v5 build theatre so accounts with several
   * imported products never blend corpora across listings.
   *
   * @param asin - The listing's ASIN (case-insensitive)
   * @param max - Optional cap on the number of reviews (defaults to 40)
   * @returns Promise resolving to the formatted review block
   */
  getReviewsForAsinAsString(asin: string, max?: number): Promise<string>;

  /**
   * Build a compact product-context block for the coach chat from the given
   * products, optionally embedding a capped sample of verbatim customer
   * reviews (deduped, max 10) so the coach can reference real customer language.
   *
   * @param products - Imported products to summarize
   * @param reviews - Optional imported reviews to sample into the context
   * @returns A compact, human-readable context string
   */
  buildCoachContext(products: ImportedProduct[], reviews?: ProductReview[]): string;

  /**
   * Build the Trust Gap evidence bundle from the given products and their
   * reviews.
   *
   * @param products - Imported products to draw listing evidence from
   * @returns Promise resolving to the evidence bundle
   */
  buildTrustGapEvidence(products: ImportedProduct[]): Promise<TrustGapEvidence>;
}
