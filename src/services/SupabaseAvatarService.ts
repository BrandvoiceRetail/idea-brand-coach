/**
 * SupabaseAvatarService
 * Implements IAvatarService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IAvatarService } from './interfaces/IAvatarService';
import { Avatar, AvatarCreate, AvatarUpdate, AvatarTemplate } from '@/types/avatar';

export class SupabaseAvatarService implements IAvatarService {
  async getAvatars(): Promise<Avatar[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      demographics: item.demographics,
      psychographics: item.psychographics,
      pain_points: item.pain_points || [],
      goals: item.goals || [],
      preferred_channels: item.preferred_channels || [],
      is_template: item.is_template || false,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  async getAvatar(id: string): Promise<Avatar | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      demographics: data.demographics,
      psychographics: data.psychographics,
      pain_points: data.pain_points || [],
      goals: data.goals || [],
      preferred_channels: data.preferred_channels || [],
      is_template: data.is_template || false,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async createAvatar(avatarData: AvatarCreate): Promise<Avatar> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const insertData: any = {
      user_id: user.id,
      name: avatarData.name,
      demographics: avatarData.demographics || null,
      psychographics: avatarData.psychographics || null,
      pain_points: avatarData.pain_points || [],
      goals: avatarData.goals || [],
      preferred_channels: avatarData.preferred_channels || [],
      is_template: avatarData.is_template || false,
    };

    const { data, error } = await supabase
      .from('avatars')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      demographics: data.demographics,
      psychographics: data.psychographics,
      pain_points: data.pain_points || [],
      goals: data.goals || [],
      preferred_channels: data.preferred_channels || [],
      is_template: data.is_template || false,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async updateAvatar(id: string, updates: AvatarUpdate): Promise<Avatar> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First verify the avatar belongs to the user
    const existing = await this.getAvatar(id);
    if (!existing) {
      throw new Error('Avatar not found or access denied');
    }

    const { data, error } = await supabase
      .from('avatars')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      demographics: data.demographics,
      psychographics: data.psychographics,
      pain_points: data.pain_points || [],
      goals: data.goals || [],
      preferred_channels: data.preferred_channels || [],
      is_template: data.is_template || false,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async deleteAvatar(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First verify the avatar belongs to the user
    const existing = await this.getAvatar(id);
    if (!existing) {
      throw new Error('Avatar not found or access denied');
    }

    const { error } = await supabase
      .from('avatars')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  async getAvatarTemplates(): Promise<AvatarTemplate[]> {
    const { data, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('is_template', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      demographics: item.demographics,
      psychographics: item.psychographics,
      pain_points: item.pain_points || [],
      goals: item.goals || [],
      preferred_channels: item.preferred_channels || [],
      is_template: true,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }
}
