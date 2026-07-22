import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseProductDataService } from '../SupabaseProductDataService';
import { supabase } from '@/integrations/supabase/client';
import type { ImportedProduct, ProductReview } from '../interfaces/IProductDataService';

const AUTH_USER = { id: 'user-123' };

/**
 * Build a `user_products` row for mocking, with sane defaults.
 */
function productRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'prod-1',
    asin: 'B000000001',
    title: 'Widget',
    price: 19.99,
    rating: 4.5,
    review_count: 120,
    bullets: ['Durable', 'Lightweight'],
    description: 'A handy widget',
    images: [{ url: 'https://img/1.jpg' }],
    scraped_at: '2026-06-01T00:00:00Z',
    user_id: AUTH_USER.id,
    status: 'completed',
    source_url: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Build a `user_product_reviews` row for mocking.
 */
function reviewRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rev-1',
    product_id: 'prod-1',
    rating: 5,
    title: 'Great',
    body: 'Loved it',
    reviewer_name: 'Jane',
    verified_purchase: true,
    review_date: null,
    source_url: null,
    created_at: '2026-06-02T00:00:00Z',
    ...overrides,
  };
}

/**
 * Mock supabase.from to return products then reviews on successive calls.
 */
function mockFromProductsThenReviews(products: unknown[], reviews: unknown[]): void {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'user_products') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: products, error: null }),
          }),
        }),
      } as any;
    }
    if (table === 'user_product_reviews') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: reviews, error: null }),
          }),
        }),
      } as any;
    }
    return {} as any;
  });
}

describe('SupabaseProductDataService', () => {
  let service: SupabaseProductDataService;

  beforeEach(() => {
    service = new SupabaseProductDataService();
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: AUTH_USER as any },
      error: null,
    });
  });

  describe('importProducts', () => {
    it('batches 7 asins into 2 edge-function calls and merges results', async () => {
      const asins = [
        'B000000001', 'B000000002', 'B000000003', 'B000000004',
        'B000000005', 'B000000006', 'B000000007',
      ];

      vi.mocked(supabase.functions.invoke).mockImplementation((_fn, opts: any) => {
        const batch: string[] = opts.body.asins;
        return Promise.resolve({
          data: {
            status: 'ok',
            results: batch.map((asin) => ({ asin, ok: true, productId: `p-${asin}` })),
          },
          error: null,
        }) as any;
      });

      const result = await service.importProducts(asins);

      expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
      // First batch is 5 ASINs, second is 2.
      const firstCallBody = vi.mocked(supabase.functions.invoke).mock.calls[0][1] as any;
      const secondCallBody = vi.mocked(supabase.functions.invoke).mock.calls[1][1] as any;
      expect(firstCallBody.body.asins).toHaveLength(5);
      expect(secondCallBody.body.asins).toHaveLength(2);

      expect(result.status).toBe('ok');
      expect(result.results).toHaveLength(7);
      expect(result.results.map((r) => r.asin)).toEqual(asins);
    });

    it('throws when the user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(service.importProducts(['B000000001'])).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('getAllReviews dedupe', () => {
    it('drops duplicate review bodies across variant products', async () => {
      const sharedBody = 'My favourite top loader binder here on amazon, the discrete logo looks sleek.';
      mockFromProductsThenReviews(
        [productRow({ id: 'prod-1', asin: 'B000000001' }), productRow({ id: 'prod-2', asin: 'B000000002' })],
        [
          reviewRow({ id: 'rev-1', product_id: 'prod-1', body: sharedBody }),
          reviewRow({ id: 'rev-2', product_id: 'prod-2', body: sharedBody }),
          reviewRow({ id: 'rev-3', product_id: 'prod-2', body: 'A genuinely different review about the 288 card capacity.' }),
        ],
      );

      const reviews = await service.getAllReviews();

      expect(reviews).toHaveLength(2);
      expect(reviews.filter((r) => r.body === sharedBody)).toHaveLength(1);
    });

    it('treats whitespace/case variants of the same body as duplicates', async () => {
      mockFromProductsThenReviews(
        [productRow()],
        [
          reviewRow({ id: 'rev-1', body: 'Keeps cards secure, fits toploaders perfectly. Great binder' }),
          reviewRow({ id: 'rev-2', body: '  keeps Cards secure,  fits toploaders perfectly. great BINDER ' }),
        ],
      );

      const reviews = await service.getAllReviews();

      expect(reviews).toHaveLength(1);
    });

    it('keeps very short bodies even when identical (too little signal to dedupe)', async () => {
      mockFromProductsThenReviews(
        [productRow()],
        [reviewRow({ id: 'rev-1', body: 'Great!' }), reviewRow({ id: 'rev-2', body: 'Great!' })],
      );

      const reviews = await service.getAllReviews();

      expect(reviews).toHaveLength(2);
    });
  });

  describe('getAllReviewsAsString', () => {
    it('formats reviews as "★{rating} — {body}" newline-joined', async () => {
      mockFromProductsThenReviews(
        [productRow()],
        [
          reviewRow({ id: 'rev-1', rating: 5, body: 'Loved it' }),
          reviewRow({ id: 'rev-2', rating: 3, body: 'It was okay' }),
        ]
      );

      const result = await service.getAllReviewsAsString();

      expect(result).toBe('★5 — Loved it\n★3 — It was okay');
    });

    it('caps the number of reviews at 40', async () => {
      const reviews = Array.from({ length: 60 }, (_, i) =>
        reviewRow({ id: `rev-${i}`, rating: 5, body: 'Solid' })
      );
      mockFromProductsThenReviews([productRow()], reviews);

      const result = await service.getAllReviewsAsString();

      expect(result.split('\n')).toHaveLength(40);
    });

    it('respects an explicit max below the hard cap', async () => {
      const reviews = Array.from({ length: 10 }, (_, i) =>
        reviewRow({ id: `rev-${i}`, rating: 4, body: 'Nice' })
      );
      mockFromProductsThenReviews([productRow()], reviews);

      const result = await service.getAllReviewsAsString(3);

      expect(result.split('\n')).toHaveLength(3);
    });

    it('stops before exceeding the 8000-character budget', async () => {
      const longBody = 'x'.repeat(4000);
      const reviews = Array.from({ length: 5 }, (_, i) =>
        reviewRow({ id: `rev-${i}`, rating: 5, body: longBody })
      );
      mockFromProductsThenReviews([productRow()], reviews);

      const result = await service.getAllReviewsAsString();

      expect(result.length).toBeLessThanOrEqual(8000);
      // Each line is ~4004 chars, so only one fits under 8000.
      expect(result.split('\n')).toHaveLength(1);
    });
  });

  describe('buildCoachContext', () => {
    const products: ImportedProduct[] = [
      {
        id: 'prod-1',
        asin: 'B000000001',
        title: 'Widget',
        price: 19.99,
        rating: 4.5,
        reviewCount: 120,
        bullets: ['Durable', 'Lightweight'],
        description: 'A handy widget',
        images: [{ url: 'https://img/1.jpg' }],
        scrapedAt: '2026-06-01T00:00:00Z',
      },
    ];

    function review(overrides: Partial<ProductReview> = {}): ProductReview {
      return {
        id: 'rev-1',
        rating: 5,
        title: 'Great',
        body: 'Loved it for storing my Pokemon cards',
        reviewerName: 'Jane',
        verifiedPurchase: true,
        ...overrides,
      };
    }

    it('omits the review block when no reviews are given', () => {
      const context = service.buildCoachContext(products);

      expect(context).toContain('Product: Widget (ASIN B000000001)');
      expect(context).not.toContain('Customer reviews');
    });

    it('embeds verbatim review lines when reviews are given', () => {
      const context = service.buildCoachContext(products, [
        review(),
        review({ id: 'rev-2', rating: 3, body: 'Pages feel thin but holds cards well' }),
      ]);

      expect(context).toContain('Customer reviews (verbatim sample):');
      expect(context).toContain('\u26055 \u2014 Loved it for storing my Pokemon cards');
      expect(context).toContain('\u26053 \u2014 Pages feel thin but holds cards well');
    });

    it('dedupes duplicate review bodies and caps the sample at 10', () => {
      const dupes = [review(), review({ id: 'rev-dup' })];
      const many = Array.from({ length: 15 }, (_, i) =>
        review({ id: `rev-${i}`, body: `Unique review body number ${i} with enough length` })
      );

      const context = service.buildCoachContext(products, [...dupes, ...many]);
      const lines = context.split('Customer reviews (verbatim sample):')[1].trim().split('\n');

      expect(lines).toHaveLength(10);
      expect(lines.filter((l) => l.includes('Loved it for storing'))).toHaveLength(1);
    });
  });

  describe('buildTrustGapEvidence', () => {
    const products: ImportedProduct[] = [
      {
        id: 'prod-1',
        asin: 'B000000001',
        title: 'Widget',
        price: 19.99,
        rating: 4.5,
        reviewCount: 120,
        bullets: ['Durable', 'Lightweight'],
        description: 'A handy widget',
        images: [{ url: 'https://img/1.jpg' }],
        scrapedAt: '2026-06-01T00:00:00Z',
      },
    ];

    it('maps listings from products and formats topReviews', async () => {
      mockFromProductsThenReviews(
        [productRow()],
        [reviewRow({ rating: 4, body: 'Pretty good' })]
      );

      const evidence = await service.buildTrustGapEvidence(products);

      expect(evidence.listings).toEqual([
        {
          asin: 'B000000001',
          title: 'Widget',
          bullets: ['Durable', 'Lightweight'],
          description: 'A handy widget',
        },
      ]);
      expect(evidence.topReviews).toEqual(['★4 — Pretty good']);
    });

    it('caps topReviews at 12 entries', async () => {
      const reviews = Array.from({ length: 20 }, (_, i) =>
        reviewRow({ id: `rev-${i}`, rating: 5, body: 'Good' })
      );
      mockFromProductsThenReviews([productRow()], reviews);

      const evidence = await service.buildTrustGapEvidence(products);

      expect(evidence.topReviews).toHaveLength(12);
    });

    it('truncates review bodies to 300 characters', async () => {
      const longBody = 'y'.repeat(500);
      mockFromProductsThenReviews(
        [productRow()],
        [reviewRow({ rating: 5, body: longBody })]
      );

      const evidence = await service.buildTrustGapEvidence(products);

      // "★5 — " prefix (5 chars) + 300-char body.
      expect(evidence.topReviews[0]).toHaveLength(5 + 300);
      expect(evidence.topReviews[0].startsWith('★5 — ')).toBe(true);
    });
  });

  describe('deleteProduct', () => {
    type FromMock = ReturnType<typeof supabase.from>;

    it('deletes the listing scoped to the caller and asin', async () => {
      const eqAsin = vi.fn().mockResolvedValue({ error: null });
      const eqUser = vi.fn().mockReturnValue({ eq: eqAsin });
      const del = vi.fn().mockReturnValue({ eq: eqUser });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as unknown as FromMock);

      await service.deleteProduct('B000000001');

      expect(supabase.from).toHaveBeenCalledWith('user_products');
      expect(del).toHaveBeenCalledTimes(1);
      expect(eqUser).toHaveBeenCalledWith('user_id', AUTH_USER.id);
      expect(eqAsin).toHaveBeenCalledWith('asin', 'B000000001');
    });

    it('is a no-op when there is no authenticated user', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const del = vi.fn();
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as unknown as FromMock);

      await service.deleteProduct('B000000001');

      expect(del).not.toHaveBeenCalled();
    });

    it('throws when the delete errors', async () => {
      const eqAsin = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
      const eqUser = vi.fn().mockReturnValue({ eq: eqAsin });
      const del = vi.fn().mockReturnValue({ eq: eqUser });
      vi.mocked(supabase.from).mockReturnValue({ delete: del } as unknown as FromMock);

      await expect(service.deleteProduct('B000000001')).rejects.toEqual({ message: 'boom' });
    });
  });
});
