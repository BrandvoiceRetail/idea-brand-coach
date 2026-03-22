import { describe, it, expect } from 'vitest';
import { extractAsin, parseAsinInput, asinToReviewUrl } from '../asinParser';

describe('extractAsin', () => {
  it('should extract a raw ASIN', () => {
    expect(extractAsin('B0CJBQ7F5C')).toBe('B0CJBQ7F5C');
  });

  it('should trim whitespace from a raw ASIN', () => {
    expect(extractAsin('  B0CJBQ7F5C  ')).toBe('B0CJBQ7F5C');
  });

  it('should uppercase a lowercase raw ASIN', () => {
    expect(extractAsin('b0cjbq7f5c')).toBe('B0CJBQ7F5C');
  });

  it('should extract ASIN from a /dp/ product URL', () => {
    expect(extractAsin('https://www.amazon.com/dp/B0CJBQ7F5C')).toBe('B0CJBQ7F5C');
  });

  it('should extract ASIN from a product URL with product name and ref', () => {
    expect(
      extractAsin('https://www.amazon.com/Product-Name/dp/B0CJBQ7F5C/ref=sr_1_1')
    ).toBe('B0CJBQ7F5C');
  });

  it('should extract ASIN from a product-reviews URL', () => {
    expect(
      extractAsin('https://www.amazon.com/product-reviews/B0CJBQ7F5C')
    ).toBe('B0CJBQ7F5C');
  });

  it('should extract ASIN from a /gp/product/ URL', () => {
    expect(
      extractAsin('https://www.amazon.com/gp/product/B0CJBQ7F5C')
    ).toBe('B0CJBQ7F5C');
  });

  it('should extract ASIN from a URL with query params', () => {
    expect(
      extractAsin('https://www.amazon.com/dp/B0CJBQ7F5C?ref=xyz&tag=abc')
    ).toBe('B0CJBQ7F5C');
  });

  it('should return null for invalid input', () => {
    expect(extractAsin('hello world')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractAsin('')).toBeNull();
  });

  it('should return null for a string too short to be an ASIN', () => {
    expect(extractAsin('B0CJB')).toBeNull();
  });

  it('should return null for a raw string too long to be an ASIN', () => {
    expect(extractAsin('B0CJBQ7F5CXXX')).toBeNull();
  });

  it('should extract ASIN from a non-Amazon URL if path pattern matches', () => {
    expect(extractAsin('https://google.com/dp/B0CJBQ7F5C')).toBe('B0CJBQ7F5C');
  });
});

describe('parseAsinInput', () => {
  it('should parse a single ASIN', () => {
    expect(parseAsinInput('B0CJBQ7F5C')).toEqual(['B0CJBQ7F5C']);
  });

  it('should parse multiple lines with mixed formats', () => {
    expect(
      parseAsinInput('B0CJBQ7F5C\nhttps://www.amazon.com/dp/B0D3EXAMPL')
    ).toEqual(['B0CJBQ7F5C', 'B0D3EXAMPL']);
  });

  it('should skip empty lines', () => {
    expect(parseAsinInput('B0CJBQ7F5C\n\n\nB0D3EXAMPL')).toEqual([
      'B0CJBQ7F5C',
      'B0D3EXAMPL',
    ]);
  });

  it('should deduplicate identical ASINs', () => {
    expect(parseAsinInput('B0CJBQ7F5C\nB0CJBQ7F5C')).toEqual(['B0CJBQ7F5C']);
  });

  it('should deduplicate case-insensitively', () => {
    expect(parseAsinInput('B0CJBQ7F5C\nb0cjbq7f5c')).toEqual(['B0CJBQ7F5C']);
  });

  it('should return empty array when all inputs are invalid', () => {
    expect(parseAsinInput('hello\nworld')).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseAsinInput('')).toEqual([]);
  });

  it('should filter out invalid lines and keep valid ones', () => {
    expect(
      parseAsinInput('B0CJBQ7F5C\ninvalid\nhttps://www.amazon.com/dp/B0D3EXAMPL')
    ).toEqual(['B0CJBQ7F5C', 'B0D3EXAMPL']);
  });
});

describe('asinToReviewUrl', () => {
  it('should convert an ASIN to an Amazon review URL', () => {
    expect(asinToReviewUrl('B0CJBQ7F5C')).toBe(
      'https://www.amazon.com/product-reviews/B0CJBQ7F5C'
    );
  });
});
