import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../integrations/supabase/types';
import { SupabaseAvatarService } from '../../services/SupabaseAvatarService';
import { SupabaseBrandService } from '../../services/SupabaseBrandService';
import { FieldPersistenceService } from '../../services/field/FieldPersistenceService';

// Use test environment variables or local development
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

describe('Avatar Integration Tests', () => {
  let supabaseClient: ReturnType<typeof createClient<Database>>;
  let avatarService: SupabaseAvatarService;
  let brandService: SupabaseBrandService;
  let fieldService: FieldPersistenceService;

  beforeEach(() => {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);
    avatarService = new SupabaseAvatarService(supabaseClient);
    brandService = new SupabaseBrandService(supabaseClient);
    fieldService = new FieldPersistenceService(supabaseClient);
  });

  it('should create brand, avatar, and persist fields', async () => {
    // Skip if not in test environment
    if (!process.env.VITE_SUPABASE_URL) {
      console.log('Skipping integration test - no Supabase connection');
      return;
    }

    // 1. Create or get default brand
    const { data: brand, error: brandError } = await brandService.getOrCreateDefaultBrand();
    expect(brandError).toBeNull();
    expect(brand).toBeDefined();
    expect(brand?.name).toBeDefined();

    if (!brand) return;

    // 2. Create avatar
    const { data: avatar, error: avatarError } = await avatarService.createAvatar({
      name: 'Test Avatar',
      brand_id: brand.id,
      demographics: { age: '25-34', gender: 'female' },
      psychographics: { interests: ['technology', 'sustainability'] },
      behavioral_traits: { shopping_frequency: 'weekly' },
      status: 'active',
    });

    expect(avatarError).toBeNull();
    expect(avatar).toBeDefined();
    expect(avatar?.name).toBe('Test Avatar');
    expect(avatar?.brand_id).toBe(brand.id);

    if (!avatar) return;

    // 3. Save field values
    const { data: field1, error: fieldError1 } = await fieldService.saveField(
      avatar.id,
      {
        field_id: 'brand_mission',
        field_value: 'To empower sustainable living',
        field_source: 'manual',
        chapter_id: 'chapter-01',
      }
    );

    expect(fieldError1).toBeNull();
    expect(field1).toBeDefined();
    expect(field1?.field_value).toBe('To empower sustainable living');

    // 4. Batch save multiple fields
    const { data: batchFields, error: batchError } = await fieldService.batchSaveFields({
      avatar_id: avatar.id,
      fields: [
        {
          field_id: 'target_audience',
          field_value: 'Eco-conscious millennials',
          field_source: 'ai',
          confidence_score: 0.85,
        },
        {
          field_id: 'brand_values',
          field_value: 'Sustainability, Innovation, Community',
          field_source: 'ai',
          confidence_score: 0.92,
        },
      ],
    });

    expect(batchError).toBeNull();
    expect(batchFields).toHaveLength(2);

    // 5. Load all fields for avatar
    const { data: loadedFields, error: loadError } = await fieldService.loadFields(avatar.id);

    expect(loadError).toBeNull();
    expect(loadedFields).toBeDefined();
    expect(loadedFields?.length).toBeGreaterThanOrEqual(3);

    // 6. Test field locking
    const { data: lockedField, error: lockError } = await fieldService.toggleFieldLock(
      avatar.id,
      'brand_mission',
      true
    );

    expect(lockError).toBeNull();
    expect(lockedField?.is_locked).toBe(true);

    // 7. Try to update locked field with AI source (should fail)
    const { data: failedUpdate, error: updateError } = await fieldService.saveField(
      avatar.id,
      {
        field_id: 'brand_mission',
        field_value: 'Changed by AI',
        field_source: 'ai',
      }
    );

    expect(failedUpdate).toBeNull();
    expect(updateError).toBeDefined();
    expect(updateError?.message).toContain('locked');

    // 8. Update locked field with manual source (should succeed)
    const { data: manualUpdate, error: manualError } = await fieldService.saveField(
      avatar.id,
      {
        field_id: 'brand_mission',
        field_value: 'Manually updated mission',
        field_source: 'manual',
      }
    );

    expect(manualError).toBeNull();
    expect(manualUpdate?.field_value).toBe('Manually updated mission');

    // Cleanup
    if (avatar) {
      await avatarService.deleteAvatar(avatar.id);
    }
  });

  it('should handle localStorage migration', async () => {
    // Skip if not in test environment
    if (!process.env.VITE_SUPABASE_URL) {
      console.log('Skipping integration test - no Supabase connection');
      return;
    }

    // Setup localStorage with test data
    const testAvatarId = 'test-avatar-migration';
    const storageKey = `brandCoach_avatar_${testAvatarId}_fields`;
    const testFields = {
      brand_name: 'Legacy Brand',
      brand_tagline: 'From localStorage',
      brand_mission: 'Migrated mission statement',
    };

    localStorage.setItem(storageKey, JSON.stringify(testFields));

    // Create a test avatar
    const { data: brand } = await brandService.getOrCreateDefaultBrand();
    if (!brand) return;

    const { data: avatar } = await avatarService.createAvatar({
      name: 'Migration Test Avatar',
      brand_id: brand.id,
      demographics: {},
      psychographics: {},
      behavioral_traits: {},
      status: 'active',
    });

    if (!avatar) return;

    // Migrate fields from localStorage
    const { migrated, error } = await fieldService.migrateFromLocalStorage(avatar.id);

    expect(error).toBeNull();
    expect(migrated).toBe(3);

    // Verify migrated fields
    const { data: fields } = await fieldService.loadFields(avatar.id);
    expect(fields).toBeDefined();

    const brandNameField = fields?.find(f => f.field_id === 'brand_name');
    expect(brandNameField?.field_value).toBe('Legacy Brand');

    // Cleanup
    localStorage.removeItem(storageKey);
    if (avatar) {
      await avatarService.deleteAvatar(avatar.id);
    }
  });
});