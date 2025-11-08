/**
 * SupabaseUserProfileService
 * Implements IUserProfileService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IUserProfileService } from './interfaces/IUserProfileService';
import { UserProfile, UserProfileUpdate } from '@/types/profile';

export class SupabaseUserProfileService implements IUserProfileService {
  async getProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
      latest_diagnostic_data: data.latest_diagnostic_data,
      latest_diagnostic_score: data.latest_diagnostic_score,
      diagnostic_completed_at: data.diagnostic_completed_at,
    };
  }

  async updateProfile(updates: UserProfileUpdate): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
      latest_diagnostic_data: data.latest_diagnostic_data,
      latest_diagnostic_score: data.latest_diagnostic_score,
      diagnostic_completed_at: data.diagnostic_completed_at,
    };
  }

  async createProfile(userId: string, email: string, fullName?: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName || null,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async hasDiagnostic(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('latest_diagnostic_score')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.latest_diagnostic_score !== null && data?.latest_diagnostic_score !== undefined;
  }
}
