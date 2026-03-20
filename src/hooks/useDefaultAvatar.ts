import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseBrandService } from '@/services/SupabaseBrandService';

interface UseDefaultAvatarProps {
  user: User | null;
  avatars: any[];
  isLoadingAvatars: boolean;
  createAvatar: (avatar: any) => Promise<any>;
}

/**
 * Custom hook to handle default avatar creation
 * Follows Single Responsibility Principle - only handles avatar creation logic
 */
export function useDefaultAvatar({
  user,
  avatars,
  isLoadingAvatars,
  createAvatar,
}: UseDefaultAvatarProps): void {
  const hasAttemptedCreation = useRef(false);
  const isCreating = useRef(false);

  useEffect(() => {
    // Early returns for defensive programming
    if (!user) return;
    if (isLoadingAvatars) return;
    if (avatars.length > 0) return;
    if (hasAttemptedCreation.current) return;
    if (isCreating.current) return;

    const createDefaultAvatar = async () => {
      // Set flags immediately to prevent race conditions
      hasAttemptedCreation.current = true;
      isCreating.current = true;

      try {
        const brandService = new SupabaseBrandService(supabase);
        const { data: brand, error: brandError } = await brandService.getOrCreateDefaultBrand();

        if (brandError) {
          console.error('Error getting/creating brand:', brandError);
          return;
        }

        if (!brand) {
          console.error('No brand returned from getOrCreateDefaultBrand');
          return;
        }

        await createAvatar({
          name: 'Default Avatar',
          brand_id: brand.id,
          demographics: {},
          psychographics: {},
          behavioral_traits: {},
          status: 'active',
        });

        console.log('Default avatar created successfully');
      } catch (error) {
        console.error('Error creating default avatar:', error);
        // Reset attempt flag on error to allow retry
        hasAttemptedCreation.current = false;
      } finally {
        isCreating.current = false;
      }
    };

    // Use setTimeout to defer execution and avoid render cycle issues
    const timeoutId = setTimeout(createDefaultAvatar, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user?.id, isLoadingAvatars, avatars.length]); // Use stable dependencies
}