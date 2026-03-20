import { Brand, BrandInsert, BrandUpdate } from '../SupabaseBrandService';

export interface BrandServiceResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Interface for brand management services
 */
export interface IBrandService {
  /**
   * Get all brands for the current user
   */
  getBrands(): Promise<BrandServiceResult<Brand[]>>;

  /**
   * Get a single brand by ID
   */
  getBrand(id: string): Promise<BrandServiceResult<Brand>>;

  /**
   * Create a new brand
   */
  createBrand(brand: BrandInsert): Promise<BrandServiceResult<Brand>>;

  /**
   * Update an existing brand
   */
  updateBrand(id: string, updates: BrandUpdate): Promise<BrandServiceResult<Brand>>;

  /**
   * Delete a brand and all associated data
   */
  deleteBrand(id: string): Promise<BrandServiceResult<void>>;

  /**
   * Get or create default brand for user
   */
  getOrCreateDefaultBrand(): Promise<BrandServiceResult<Brand>>;

  /**
   * Get avatars for a brand
   */
  getBrandAvatars(brandId: string): Promise<BrandServiceResult<any[]>>;
}