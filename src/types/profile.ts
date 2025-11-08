/**
 * Profile Types
 * Type definitions for User Profile feature
 */

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  latest_diagnostic_data?: any;
  latest_diagnostic_score?: number;
  diagnostic_completed_at?: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  latest_diagnostic_data?: any;
  latest_diagnostic_score?: number;
  diagnostic_completed_at?: string;
}

export interface UserProfileCreate {
  id: string;
  email: string;
  full_name?: string;
}
