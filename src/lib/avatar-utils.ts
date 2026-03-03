import type { Avatar, AvatarCompletionStatus } from '@/types/avatar';

/**
 * Generates a unique avatar ID using timestamp and random string
 * Format: avatar_{timestamp}_{random}
 */
export function generateAvatarId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `avatar_${timestamp}_${random}`;
}

/**
 * Calculates completion percentage for an avatar based on filled fields
 * Returns detailed completion status including section breakdowns
 *
 * @param avatarData - Object containing avatar field data
 * @returns AvatarCompletionStatus with percentage, filled/total fields, and section completions
 */
export function calculateCompletionPercentage(avatarData: Record<string, any>): AvatarCompletionStatus {
  // Define expected fields per section
  const sections = {
    demographics: ['age', 'gender', 'location', 'occupation', 'education', 'income'],
    psychographics: ['values', 'interests', 'lifestyle', 'personality', 'goals', 'challenges'],
    behavior: ['shopping_habits', 'brand_preferences', 'media_consumption', 'decision_factors', 'pain_points'],
    voice: ['tone', 'communication_style', 'vocabulary', 'phrases', 'response_patterns']
  };

  let totalFields = 0;
  let filledFields = 0;
  const sectionCompletions: Record<string, number> = {};

  // Calculate completion for each section
  for (const [sectionName, fields] of Object.entries(sections)) {
    let sectionFilled = 0;
    const sectionTotal = fields.length;

    for (const field of fields) {
      totalFields++;
      const value = avatarData[field];

      // Check if field has meaningful content
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string' && value.trim().length > 0) {
          filledFields++;
          sectionFilled++;
        } else if (typeof value === 'object' && Object.keys(value).length > 0) {
          filledFields++;
          sectionFilled++;
        } else if (typeof value !== 'string' && typeof value !== 'object') {
          filledFields++;
          sectionFilled++;
        }
      }
    }

    sectionCompletions[sectionName] = sectionTotal > 0
      ? Math.round((sectionFilled / sectionTotal) * 100)
      : 0;
  }

  const percentage = totalFields > 0
    ? Math.round((filledFields / totalFields) * 100)
    : 0;

  return {
    percentage,
    filledFields,
    totalFields,
    sectionCompletions: {
      demographics: sectionCompletions.demographics,
      psychographics: sectionCompletions.psychographics,
      behavior: sectionCompletions.behavior,
      voice: sectionCompletions.voice
    }
  };
}

/**
 * Sorts avatars by date (most recent first)
 * Uses updated_at if available, falls back to created_at
 *
 * @param avatars - Array of avatars to sort
 * @returns Sorted array (does not mutate original)
 */
export function sortAvatarsByDate(avatars: Avatar[]): Avatar[] {
  return [...avatars].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at).getTime();
    const dateB = new Date(b.updated_at || b.created_at).getTime();
    return dateB - dateA; // Most recent first
  });
}

/**
 * Creates a default avatar object with initial values
 * Used when creating a new avatar
 *
 * @param name - Optional name for the avatar (defaults to "New Avatar")
 * @returns Avatar object with default values
 */
export function getDefaultAvatar(name: string = 'New Avatar'): Avatar {
  const now = new Date().toISOString();

  return {
    id: generateAvatarId(),
    name,
    completion_percentage: 0,
    created_at: now,
    updated_at: now,
    last_accessed_at: now,
    metadata: {
      color: '#6366f1', // Default indigo color
      icon: '👤'
    }
  };
}

/**
 * Validates avatar name
 * Returns error message if invalid, null if valid
 *
 * @param name - Avatar name to validate
 * @returns Error message or null
 */
export function validateAvatarName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Avatar name cannot be empty';
  }

  if (name.length > 50) {
    return 'Avatar name must be 50 characters or less';
  }

  return null;
}

/**
 * Finds avatar by ID in an array of avatars
 *
 * @param avatars - Array of avatars to search
 * @param id - Avatar ID to find
 * @returns Avatar if found, undefined otherwise
 */
export function findAvatarById(avatars: Avatar[], id: string): Avatar | undefined {
  return avatars.find(avatar => avatar.id === id);
}
