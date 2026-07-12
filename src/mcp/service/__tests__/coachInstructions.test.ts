/**
 * Tests for coach_instructions substrate
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchCoachInstructions,
  composeCoachPreamble,
  fetchInstructionForId,
  tier1GroundingPreamble,
  clearInstructionCache,
} from '../coachInstructions.js';

describe('coachInstructions', () => {
  let mockSupabase: any;
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear cache before each test
    clearInstructionCache();

    // Mock Supabase client with chained methods
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };

    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('fetchCoachInstructions', () => {
    it('fetches published instructions for preamble surface', async () => {
      const mockInstructions = [
        {
          id: '1',
          instruction_id: 'global.tier_a_terminology',
          surface: 'both',
          body: 'Use Trust Gap™ always',
          status: 'published',
        },
        {
          id: '2',
          instruction_id: 'tool.specific',
          surface: 'preamble',
          body: 'Tool-specific guidance',
          status: 'published',
        },
      ];

      (mockSupabase as any).order = vi.fn().mockResolvedValue({
        data: mockInstructions,
        error: null,
      });

      const result = await fetchCoachInstructions(mockSupabase as SupabaseClient, 'preamble');

      expect(result).toEqual(mockInstructions);
      expect(mockSupabase.from).toHaveBeenCalledWith('coach_instructions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'published');
      expect(mockSupabase.in).toHaveBeenCalledWith('surface', ['preamble', 'both']);
    });

    it('returns empty array on database error (fail open)', async () => {
      (mockSupabase as any).order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await fetchCoachInstructions(mockSupabase as SupabaseClient, 'preamble');

      expect(result).toEqual([]);
    });

    it('returns empty array on exception (fail open)', async () => {
      (mockSupabase as any).order = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchCoachInstructions(mockSupabase as SupabaseClient, 'preamble');

      expect(result).toEqual([]);
    });
  });

  describe('composeCoachPreamble', () => {
    it('returns empty string when feature is disabled', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'false';

      const result = await composeCoachPreamble(mockSupabase as SupabaseClient);

      expect(result).toBe('');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('composes instructions into preamble when enabled', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      const mockInstructions = [
        {
          instruction_id: 'global.tier_a_terminology',
          body: 'Always use Trust Gap™',
          when_to_use: 'In all narration',
        },
        {
          instruction_id: 'build_avatar_stage.s1',
          body: 'Stage 1 specific guidance',
          when_to_use: null,
        },
      ];

      (mockSupabase as any).order = vi.fn().mockResolvedValue({
        data: mockInstructions,
        error: null,
      });

      const result = await composeCoachPreamble(mockSupabase as SupabaseClient);

      expect(result).toContain('COACH INSTRUCTIONS (Global):');
      expect(result).toContain('Always use Trust Gap™');
      expect(result).toContain('COACH INSTRUCTIONS (Tool-specific):');
      expect(result).toContain('Stage 1 specific guidance');
    });

    it('returns empty string when no instructions found', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      (mockSupabase as any).order = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await composeCoachPreamble(mockSupabase as SupabaseClient);

      expect(result).toBe('');
    });

    it('uses cache on subsequent calls with same instructions', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      const mockInstructions = [
        {
          instruction_id: 'global.tier_a_terminology',
          body: 'Cached instruction',
          version: 1,
        },
      ];

      (mockSupabase as any).order = vi.fn().mockResolvedValue({
        data: mockInstructions,
        error: null,
      });

      // First call - should hit DB
      const result1 = await composeCoachPreamble(mockSupabase as SupabaseClient);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await composeCoachPreamble(mockSupabase as SupabaseClient);
      expect(mockSupabase.from).toHaveBeenCalledTimes(2); // Called again to check for updates
      expect(result1).toBe(result2);
    });
  });

  describe('fetchInstructionForId', () => {
    it('fetches specific instruction by ID', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      (mockSupabase as any).single = vi.fn().mockResolvedValue({
        data: { body: 'Specific instruction body' },
        error: null,
      });

      const result = await fetchInstructionForId(
        mockSupabase as SupabaseClient,
        'global.tier_a_terminology'
      );

      expect(result).toBe('Specific instruction body');
      expect(mockSupabase.eq).toHaveBeenCalledWith('instruction_id', 'global.tier_a_terminology');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('returns empty string when instruction not found', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      (mockSupabase as any).single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await fetchInstructionForId(
        mockSupabase as SupabaseClient,
        'nonexistent'
      );

      expect(result).toBe('');
    });

    it('returns empty string when feature disabled', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'false';

      const result = await fetchInstructionForId(
        mockSupabase as SupabaseClient,
        'any_id'
      );

      expect(result).toBe('');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('tier1GroundingPreamble', () => {
    it('returns fetched instruction when available', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      const customInstruction = 'Custom Tier-A terminology guidance from DB';
      (mockSupabase as any).single = vi.fn().mockResolvedValue({
        data: { body: customInstruction },
        error: null,
      });

      const result = await tier1GroundingPreamble(mockSupabase as SupabaseClient);

      expect(result).toBe(customInstruction);
    });

    it('returns fallback text when instruction not in DB', async () => {
      process.env.COACH_INSTRUCTIONS_ENABLED = 'true';

      (mockSupabase as any).single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await tier1GroundingPreamble(mockSupabase as SupabaseClient);

      expect(result).toContain('TIER-A TERMINOLOGY: Always use Trust Gap™');
      expect(result).toContain('Decision Trigger™');
      expect(result).toContain('Avatar 2.0™');
    });
  });
});