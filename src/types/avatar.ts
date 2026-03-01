/**
 * Avatar Types
 * Type definitions for Multi-Avatar feature
 */

export interface Avatar {
  id: string;
  name: string;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  metadata?: AvatarMetadata;
}

export interface AvatarMetadata {
  color?: string;
  icon?: string;
  description?: string;
  [key: string]: any;
}

export interface AvatarCompletionStatus {
  percentage: number;
  filledFields: number;
  totalFields: number;
  sectionCompletions?: {
    demographics: number;
    psychographics: number;
    behavior: number;
    voice: number;
  };
}

export interface AvatarCreate {
  name: string;
  metadata?: AvatarMetadata;
}

export interface AvatarUpdate {
  name?: string;
  completion_percentage?: number;
  last_accessed_at?: string;
  metadata?: AvatarMetadata;
}
