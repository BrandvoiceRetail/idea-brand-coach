/**
 * SupabaseAvatarService
 * Implements IAvatarService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IAvatarService } from './interfaces/IAvatarService';
import { Avatar, AvatarCreate, AvatarUpdate } from '@/types/avatar';

export class SupabaseAvatarService implements IAvatarService {
  /**
   * Get current authenticated user ID
   * @throws Error if user is not authenticated
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  /**
   * Create a new avatar for the current user.
   * If no name is provided in the avatar data, generates a unique name.
   */
  async create(avatar: AvatarCreate): Promise<Avatar> {
    const userId = await this.getUserId();

    // Generate unique name if not provided
    const name = avatar.name || await this.generateUniqueName();

    const { data, error } = await supabase
      .from('avatars')
      .insert({
        user_id: userId,
        name,
        description: avatar.description || null,
        demographics: avatar.demographics || null,
        psychographics: avatar.psychographics || null,
        buying_behavior: avatar.buying_behavior || null,
        voice_of_customer: avatar.voice_of_customer || null,
        is_template: avatar.is_template || false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      description: data.description,
      demographics: data.demographics,
      psychographics: data.psychographics,
      buying_behavior: data.buying_behavior,
      voice_of_customer: data.voice_of_customer,
      is_template: data.is_template,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Retrieve all avatars for the current user.
   * Results are ordered by updated_at timestamp (newest first).
   */
  async getAll(): Promise<Avatar[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      description: item.description,
      demographics: item.demographics,
      psychographics: item.psychographics,
      buying_behavior: item.buying_behavior,
      voice_of_customer: item.voice_of_customer,
      is_template: item.is_template,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  /**
   * Retrieve a single avatar by ID.
   * Only returns the avatar if it belongs to the current user (via RLS).
   */
  async getById(id: string): Promise<Avatar | null> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      description: data.description,
      demographics: data.demographics,
      psychographics: data.psychographics,
      buying_behavior: data.buying_behavior,
      voice_of_customer: data.voice_of_customer,
      is_template: data.is_template,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Update an existing avatar.
   * Only fields provided in the update object will be modified.
   */
  async update(id: string, update: AvatarUpdate): Promise<Avatar> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('avatars')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      description: data.description,
      demographics: data.demographics,
      psychographics: data.psychographics,
      buying_behavior: data.buying_behavior,
      voice_of_customer: data.voice_of_customer,
      is_template: data.is_template,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Delete an avatar by ID.
   * Only deletes if the avatar belongs to the current user (via RLS).
   */
  async delete(id: string): Promise<void> {
    const userId = await this.getUserId();

    const { error } = await supabase
      .from('avatars')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Duplicate an existing avatar with a new unique name.
   * Creates a copy of all avatar data including demographics, psychographics, and buying behavior.
   */
  async duplicate(id: string, newName?: string): Promise<Avatar> {
    // Get the source avatar
    const source = await this.getById(id);
    if (!source) throw new Error('Avatar not found');

    // Generate unique name if not provided
    const name = newName || await this.generateUniqueName(source.name);

    // Create a copy with the new name
    return this.create({
      name,
      description: source.description || undefined,
      demographics: source.demographics,
      psychographics: source.psychographics,
      buying_behavior: source.buying_behavior,
      voice_of_customer: source.voice_of_customer || undefined,
      is_template: false, // Duplicates are never templates
    });
  }

  /**
   * Generate a unique avatar name that doesn't conflict with existing avatars.
   * Creates names in the format 'Avatar 1', 'Avatar 2', etc.
   */
  async generateUniqueName(baseName: string = 'Avatar'): Promise<string> {
    const userId = await this.getUserId();

    // Get all existing avatar names for this user
    const { data, error } = await supabase
      .from('avatars')
      .select('name')
      .eq('user_id', userId);

    if (error) throw error;

    const existingNames = new Set(data.map(item => item.name));

    // Find first available number
    let counter = 1;
    let candidateName = `${baseName} ${counter}`;

    while (existingNames.has(candidateName)) {
      counter++;
      candidateName = `${baseName} ${counter}`;
    }

    return candidateName;
  }

  /**
   * Retrieve all pre-defined avatar templates.
   * Templates include personas like 'Weekend Warrior', 'Budget Conscious', etc.
   */
  async getTemplates(): Promise<Avatar[]> {
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('is_template', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      description: item.description,
      demographics: item.demographics,
      psychographics: item.psychographics,
      buying_behavior: item.buying_behavior,
      voice_of_customer: item.voice_of_customer,
      is_template: item.is_template,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }
}
