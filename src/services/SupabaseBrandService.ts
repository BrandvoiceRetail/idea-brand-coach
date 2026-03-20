import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';

export type Brand = Database['public']['Tables']['brands']['Row'];
export type BrandInsert = Database['public']['Tables']['brands']['Insert'];
export type BrandUpdate = Database['public']['Tables']['brands']['Update'];

export interface BrandServiceResult<T> {
  data: T | null;
  error: Error | null;
}

export class SupabaseBrandService {
  constructor(private supabaseClient: SupabaseClient<Database>) {}

  /**
   * Get all brands for the current user
   */
  async getBrands(): Promise<BrandServiceResult<Brand[]>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabaseClient
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching brands:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get a single brand by ID
   */
  async getBrand(id: string): Promise<BrandServiceResult<Brand>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabaseClient
        .from('brands')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching brand:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Create a new brand
   */
  async createBrand(brand: BrandInsert): Promise<BrandServiceResult<Brand>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabaseClient
        .from('brands')
        .insert({
          ...brand,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating brand:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Update an existing brand
   */
  async updateBrand(id: string, updates: BrandUpdate): Promise<BrandServiceResult<Brand>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabaseClient
        .from('brands')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating brand:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Delete a brand and all associated data
   */
  async deleteBrand(id: string): Promise<BrandServiceResult<void>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Note: Associated avatars and their data will be cascade deleted
      const { error } = await this.supabaseClient
        .from('brands')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return { data: undefined, error: null };
    } catch (error) {
      console.error('Error deleting brand:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get or create default brand for user
   */
  async getOrCreateDefaultBrand(): Promise<BrandServiceResult<Brand>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if user has any brands
      const { data: existingBrands, error: fetchError } = await this.supabaseClient
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (fetchError) throw fetchError;

      if (existingBrands && existingBrands.length > 0) {
        return { data: existingBrands[0], error: null };
      }

      // Create default brand if none exists
      const { data: newBrand, error: createError } = await this.supabaseClient
        .from('brands')
        .insert({
          user_id: user.id,
          name: 'My Brand',
          industry: 'General',
          description: 'Default brand profile',
          metadata: {},
        })
        .select()
        .single();

      if (createError) throw createError;
      return { data: newBrand, error: null };
    } catch (error) {
      console.error('Error getting/creating default brand:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get avatars for a brand
   */
  async getBrandAvatars(brandId: string): Promise<BrandServiceResult<any[]>> {
    try {
      const { data: { user } } = await this.supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // First verify the brand belongs to the user
      const { data: brand, error: brandError } = await this.supabaseClient
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .single();

      if (brandError || !brand) {
        throw new Error('Brand not found or access denied');
      }

      // Get avatars for the brand
      const { data: avatars, error: avatarsError } = await this.supabaseClient
        .from('avatars')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (avatarsError) throw avatarsError;
      return { data: avatars, error: null };
    } catch (error) {
      console.error('Error fetching brand avatars:', error);
      return { data: null, error: error as Error };
    }
  }
}