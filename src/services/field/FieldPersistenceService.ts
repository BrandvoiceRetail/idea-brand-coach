import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../integrations/supabase/types';

export interface AvatarFieldValue {
  id?: string;
  avatar_id: string;
  field_id: string;
  field_value: string | null;
  field_source: 'ai' | 'manual';
  is_locked: boolean;
  confidence_score?: number;
  extracted_at?: string;
  chapter_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FieldUpdate {
  field_id: string;
  field_value: string | null;
  field_source: 'ai' | 'manual';
  is_locked?: boolean;
  confidence_score?: number;
  chapter_id?: string;
}

export interface FieldBatchUpdate {
  avatar_id: string;
  fields: FieldUpdate[];
}

export class FieldPersistenceService {
  constructor(private supabaseClient: SupabaseClient<Database>) {}

  /**
   * Save a single field value for an avatar
   */
  async saveField(
    avatarId: string,
    field: FieldUpdate
  ): Promise<{ data: AvatarFieldValue | null; error: Error | null }> {
    try {
      // Check if field is locked before updating
      const { data: existingField } = await this.supabaseClient
        .from('avatar_field_values')
        .select('is_locked')
        .eq('avatar_id', avatarId)
        .eq('field_id', field.field_id)
        .single();

      // If field exists and is locked, and the update is from AI, skip
      if (existingField?.is_locked && field.field_source === 'ai') {
        return {
          data: null,
          error: new Error(`Field ${field.field_id} is locked and cannot be updated by AI`)
        };
      }

      const { data, error } = await this.supabaseClient
        .from('avatar_field_values')
        .upsert(
          {
            avatar_id: avatarId,
            field_id: field.field_id,
            field_value: field.field_value,
            field_source: field.field_source,
            is_locked: field.is_locked ?? false,
            confidence_score: field.confidence_score,
            chapter_id: field.chapter_id,
            extracted_at: new Date().toISOString(),
          },
          {
            onConflict: 'avatar_id,field_id',
            ignoreDuplicates: false
          }
        )
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error saving field:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Batch save multiple fields for an avatar
   */
  async batchSaveFields(
    batch: FieldBatchUpdate
  ): Promise<{ data: AvatarFieldValue[] | null; error: Error | null }> {
    try {
      // Get locked fields for this avatar
      const { data: lockedFields } = await this.supabaseClient
        .from('avatar_field_values')
        .select('field_id')
        .eq('avatar_id', batch.avatar_id)
        .eq('is_locked', true);

      const lockedFieldIds = new Set(lockedFields?.map(f => f.field_id) || []);

      // Filter out locked fields if the update is from AI
      const fieldsToUpdate = batch.fields.filter(field => {
        if (field.field_source === 'ai' && lockedFieldIds.has(field.field_id)) {
          console.log(`Skipping locked field ${field.field_id}`);
          return false;
        }
        return true;
      });

      if (fieldsToUpdate.length === 0) {
        return { data: [], error: null };
      }

      // Prepare batch insert data
      const upsertData = fieldsToUpdate.map(field => ({
        avatar_id: batch.avatar_id,
        field_id: field.field_id,
        field_value: field.field_value,
        field_source: field.field_source,
        is_locked: field.is_locked ?? false,
        confidence_score: field.confidence_score,
        chapter_id: field.chapter_id,
        extracted_at: new Date().toISOString(),
      }));

      const { data, error } = await this.supabaseClient
        .from('avatar_field_values')
        .upsert(upsertData, {
          onConflict: 'avatar_id,field_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error batch saving fields:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Load all fields for an avatar
   */
  async loadFields(
    avatarId: string
  ): Promise<{ data: AvatarFieldValue[] | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('avatar_field_values')
        .select('*')
        .eq('avatar_id', avatarId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error loading fields:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Load fields for a specific chapter
   */
  async loadChapterFields(
    avatarId: string,
    chapterId: string
  ): Promise<{ data: AvatarFieldValue[] | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('avatar_field_values')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('chapter_id', chapterId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error loading chapter fields:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Lock/unlock a field to prevent AI updates
   */
  async toggleFieldLock(
    avatarId: string,
    fieldId: string,
    isLocked: boolean
  ): Promise<{ data: AvatarFieldValue | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabaseClient
        .from('avatar_field_values')
        .update({ is_locked: isLocked })
        .eq('avatar_id', avatarId)
        .eq('field_id', fieldId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error toggling field lock:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Delete a field value
   */
  async deleteField(
    avatarId: string,
    fieldId: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabaseClient
        .from('avatar_field_values')
        .delete()
        .eq('avatar_id', avatarId)
        .eq('field_id', fieldId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting field:', error);
      return { error: error as Error };
    }
  }

  /**
   * Clear all fields for an avatar
   */
  async clearAllFields(
    avatarId: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabaseClient
        .from('avatar_field_values')
        .delete()
        .eq('avatar_id', avatarId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error clearing all fields:', error);
      return { error: error as Error };
    }
  }

  /**
   * Sync fields with localStorage for backward compatibility
   */
  syncWithLocalStorage(avatarId: string, fields: AvatarFieldValue[]): void {
    try {
      // Create a map of field_id to field_value
      const fieldMap: Record<string, string> = {};
      fields.forEach(field => {
        if (field.field_value !== null) {
          fieldMap[field.field_id] = field.field_value;
        }
      });

      // Store in localStorage with avatar-specific key
      const storageKey = `brandCoach_avatar_${avatarId}_fields`;
      localStorage.setItem(storageKey, JSON.stringify(fieldMap));

      // Also update the legacy format for backward compatibility
      Object.entries(fieldMap).forEach(([fieldId, value]) => {
        localStorage.setItem(`brandCoach_field_${fieldId}`, value);
      });
    } catch (error) {
      console.error('Error syncing with localStorage:', error);
    }
  }

  /**
   * Load fields from localStorage (for migration)
   */
  loadFromLocalStorage(avatarId?: string): Record<string, string> {
    try {
      const fields: Record<string, string> = {};

      // Try avatar-specific storage first
      if (avatarId) {
        const storageKey = `brandCoach_avatar_${avatarId}_fields`;
        const storedData = localStorage.getItem(storageKey);
        if (storedData) {
          return JSON.parse(storedData);
        }
      }

      // Fall back to legacy format
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('brandCoach_field_')) {
          const fieldId = key.replace('brandCoach_field_', '');
          const value = localStorage.getItem(key);
          if (value) {
            fields[fieldId] = value;
          }
        }
      }

      return fields;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return {};
    }
  }

  /**
   * Migrate localStorage fields to database
   */
  async migrateFromLocalStorage(
    avatarId: string
  ): Promise<{ migrated: number; error: Error | null }> {
    try {
      const localFields = this.loadFromLocalStorage(avatarId);
      const fieldUpdates: FieldUpdate[] = Object.entries(localFields).map(([fieldId, value]) => ({
        field_id: fieldId,
        field_value: value,
        field_source: 'manual' as const, // Assume manual since we don't know the source
      }));

      if (fieldUpdates.length === 0) {
        return { migrated: 0, error: null };
      }

      const { data, error } = await this.batchSaveFields({
        avatar_id: avatarId,
        fields: fieldUpdates,
      });

      if (error) throw error;
      return { migrated: data?.length || 0, error: null };
    } catch (error) {
      console.error('Error migrating from localStorage:', error);
      return { migrated: 0, error: error as Error };
    }
  }
}