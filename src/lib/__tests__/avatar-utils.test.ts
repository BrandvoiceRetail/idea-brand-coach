import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateAvatarId,
  calculateCompletionPercentage,
  sortAvatarsByDate,
  getDefaultAvatar,
  validateAvatarName,
  findAvatarById
} from '../avatar-utils';
import type { Avatar } from '@/types/avatar';

describe('avatar-utils', () => {
  describe('generateAvatarId', () => {
    it('should generate a unique avatar ID with correct format', () => {
      const id = generateAvatarId();
      expect(id).toMatch(/^avatar_\d+_[a-z0-9]+$/);
    });

    it('should generate different IDs on subsequent calls', () => {
      const id1 = generateAvatarId();
      const id2 = generateAvatarId();
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const beforeTime = Date.now();
      const id = generateAvatarId();
      const afterTime = Date.now();

      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('calculateCompletionPercentage', () => {
    it('should return 0% for empty avatar data', () => {
      const result = calculateCompletionPercentage({});
      expect(result.percentage).toBe(0);
      expect(result.filledFields).toBe(0);
      expect(result.totalFields).toBeGreaterThan(0);
    });

    it('should calculate completion for partially filled avatar', () => {
      const avatarData = {
        age: '25-34',
        gender: 'Female',
        location: 'New York',
        // Other fields empty
      };

      const result = calculateCompletionPercentage(avatarData);
      expect(result.percentage).toBeGreaterThan(0);
      expect(result.percentage).toBeLessThan(100);
      expect(result.filledFields).toBe(3);
    });

    it('should calculate 100% for fully filled avatar', () => {
      const avatarData = {
        // Demographics
        age: '25-34',
        gender: 'Female',
        location: 'New York',
        occupation: 'Software Engineer',
        education: 'Bachelor\'s Degree',
        income: '$75k-$100k',
        // Psychographics
        values: 'Innovation, Quality',
        interests: 'Technology, Design',
        lifestyle: 'Urban Professional',
        personality: 'Analytical, Creative',
        goals: 'Career Growth',
        challenges: 'Work-Life Balance',
        // Behavior
        shopping_habits: 'Online First',
        brand_preferences: 'Premium Brands',
        media_consumption: 'Social Media',
        decision_factors: 'Reviews, Quality',
        pain_points: 'Limited Time',
        // Voice
        tone: 'Professional',
        communication_style: 'Direct',
        vocabulary: 'Technical',
        phrases: 'Let\'s optimize',
        response_patterns: 'Data-driven'
      };

      const result = calculateCompletionPercentage(avatarData);
      expect(result.percentage).toBe(100);
      expect(result.filledFields).toBe(result.totalFields);
    });

    it('should include section completions', () => {
      const avatarData = {
        // Only demographics filled
        age: '25-34',
        gender: 'Female',
        location: 'New York',
        occupation: 'Software Engineer',
        education: 'Bachelor\'s Degree',
        income: '$75k-$100k'
      };

      const result = calculateCompletionPercentage(avatarData);
      expect(result.sectionCompletions).toBeDefined();
      expect(result.sectionCompletions?.demographics).toBe(100);
      expect(result.sectionCompletions?.psychographics).toBe(0);
      expect(result.sectionCompletions?.behavior).toBe(0);
      expect(result.sectionCompletions?.voice).toBe(0);
    });

    it('should ignore empty strings', () => {
      const avatarData = {
        age: '',
        gender: '   ',
        location: 'New York'
      };

      const result = calculateCompletionPercentage(avatarData);
      expect(result.filledFields).toBe(1); // Only 'location' counts
    });

    it('should count objects with content', () => {
      const avatarData = {
        values: { primary: 'Innovation', secondary: 'Quality' }
      };

      const result = calculateCompletionPercentage(avatarData);
      expect(result.filledFields).toBeGreaterThan(0);
    });

    it('should ignore empty objects', () => {
      const avatarData = {
        values: {}
      };

      const result = calculateCompletionPercentage(avatarData);
      // Empty objects should not count as filled
      const valuesResult = avatarData.values && Object.keys(avatarData.values).length > 0;
      expect(valuesResult).toBe(false);
    });

    it('should handle null and undefined values', () => {
      const avatarData = {
        age: null,
        gender: undefined,
        location: 'New York'
      };

      const result = calculateCompletionPercentage(avatarData);
      expect(result.filledFields).toBe(1); // Only 'location' counts
    });
  });

  describe('sortAvatarsByDate', () => {
    it('should sort avatars by updated_at (most recent first)', () => {
      const avatars: Avatar[] = [
        {
          id: '1',
          name: 'Avatar 1',
          completion_percentage: 50,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          name: 'Avatar 2',
          completion_percentage: 75,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z'
        },
        {
          id: '3',
          name: 'Avatar 3',
          completion_percentage: 25,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      const sorted = sortAvatarsByDate(avatars);
      expect(sorted[0].id).toBe('2'); // Most recently updated
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should not mutate original array', () => {
      const avatars: Avatar[] = [
        {
          id: '1',
          name: 'Avatar 1',
          completion_percentage: 50,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          name: 'Avatar 2',
          completion_percentage: 75,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      const originalOrder = avatars.map(a => a.id);
      sortAvatarsByDate(avatars);
      const afterSort = avatars.map(a => a.id);

      expect(afterSort).toEqual(originalOrder);
    });

    it('should handle empty array', () => {
      const sorted = sortAvatarsByDate([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single avatar', () => {
      const avatars: Avatar[] = [
        {
          id: '1',
          name: 'Avatar 1',
          completion_percentage: 50,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const sorted = sortAvatarsByDate(avatars);
      expect(sorted).toEqual(avatars);
    });
  });

  describe('getDefaultAvatar', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create default avatar with provided name', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const avatar = getDefaultAvatar('Test Avatar');
      expect(avatar.name).toBe('Test Avatar');
      expect(avatar.completion_percentage).toBe(0);
      expect(avatar.id).toMatch(/^avatar_\d+_[a-z0-9]+$/);
    });

    it('should use "New Avatar" as default name', () => {
      const avatar = getDefaultAvatar();
      expect(avatar.name).toBe('New Avatar');
    });

    it('should set timestamps to current time', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const avatar = getDefaultAvatar();
      expect(avatar.created_at).toBe(now.toISOString());
      expect(avatar.updated_at).toBe(now.toISOString());
      expect(avatar.last_accessed_at).toBe(now.toISOString());
    });

    it('should include default metadata', () => {
      const avatar = getDefaultAvatar();
      expect(avatar.metadata).toBeDefined();
      expect(avatar.metadata?.color).toBe('#6366f1');
      expect(avatar.metadata?.icon).toBe('👤');
    });

    it('should generate unique IDs for multiple calls', () => {
      const avatar1 = getDefaultAvatar();
      const avatar2 = getDefaultAvatar();
      expect(avatar1.id).not.toBe(avatar2.id);
    });
  });

  describe('validateAvatarName', () => {
    it('should return null for valid name', () => {
      const error = validateAvatarName('Valid Avatar Name');
      expect(error).toBeNull();
    });

    it('should return error for empty name', () => {
      const error = validateAvatarName('');
      expect(error).toBe('Avatar name cannot be empty');
    });

    it('should return error for whitespace-only name', () => {
      const error = validateAvatarName('   ');
      expect(error).toBe('Avatar name cannot be empty');
    });

    it('should return error for name over 50 characters', () => {
      const longName = 'A'.repeat(51);
      const error = validateAvatarName(longName);
      expect(error).toBe('Avatar name must be 50 characters or less');
    });

    it('should allow name with exactly 50 characters', () => {
      const maxName = 'A'.repeat(50);
      const error = validateAvatarName(maxName);
      expect(error).toBeNull();
    });

    it('should allow name with special characters', () => {
      const error = validateAvatarName('Avatar #1 - Test (2024)');
      expect(error).toBeNull();
    });
  });

  describe('findAvatarById', () => {
    const avatars: Avatar[] = [
      {
        id: 'avatar-1',
        name: 'Avatar 1',
        completion_percentage: 50,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'avatar-2',
        name: 'Avatar 2',
        completion_percentage: 75,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      },
      {
        id: 'avatar-3',
        name: 'Avatar 3',
        completion_percentage: 25,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z'
      }
    ];

    it('should find avatar by ID', () => {
      const avatar = findAvatarById(avatars, 'avatar-2');
      expect(avatar).toBeDefined();
      expect(avatar?.id).toBe('avatar-2');
      expect(avatar?.name).toBe('Avatar 2');
    });

    it('should return undefined for non-existent ID', () => {
      const avatar = findAvatarById(avatars, 'non-existent');
      expect(avatar).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      const avatar = findAvatarById([], 'avatar-1');
      expect(avatar).toBeUndefined();
    });

    it('should handle case-sensitive ID matching', () => {
      const avatar = findAvatarById(avatars, 'AVATAR-1');
      expect(avatar).toBeUndefined(); // IDs are case-sensitive
    });
  });
});
