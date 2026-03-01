/**
 * Avatar Types
 * Type definitions for Brand Avatar feature
 */

export interface AvatarDemographics {
  age?: string;
  gender?: string;
  location?: string;
  education?: string;
  occupation?: string;
  income?: string;
  [key: string]: string | undefined;
}

export interface AvatarPsychographics {
  values?: string[];
  interests?: string[];
  lifestyle?: string;
  personality?: string;
  attitudes?: string[];
  [key: string]: string | string[] | undefined;
}

export interface Avatar {
  id: string;
  user_id: string;
  name: string;
  demographics: AvatarDemographics | null;
  psychographics: AvatarPsychographics | null;
  pain_points: string[];
  goals: string[];
  preferred_channels: string[];
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarCreate {
  name: string;
  demographics?: AvatarDemographics;
  psychographics?: AvatarPsychographics;
  pain_points?: string[];
  goals?: string[];
  preferred_channels?: string[];
  is_template?: boolean;
}

export interface AvatarUpdate {
  name?: string;
  demographics?: AvatarDemographics;
  psychographics?: AvatarPsychographics;
  pain_points?: string[];
  goals?: string[];
  preferred_channels?: string[];
  is_template?: boolean;
}

export interface AvatarTemplate extends Avatar {
  is_template: true;
}
