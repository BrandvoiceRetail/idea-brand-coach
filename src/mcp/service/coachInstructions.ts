/**
 * Coach instructions substrate — Phase B
 *
 * Reads versioned instruction blocks from the coach_instructions table
 * and composes them into grounding preambles for MCP tools and edge functions.
 *
 * CRITICAL: Every read FAILS OPEN — any DB error or missing table falls back
 * to the existing inline prompts. The system must never block on instructions fetch.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { safeLog } from '../logging/redact.js';
import { createHash } from 'node:crypto';

export interface CoachInstruction {
  id: string;
  instruction_id: string;
  surface: 'preamble' | 'edge-fn' | 'both';
  when_to_use: string | null;
  body: string;
  input_keys: string[] | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  created_by: string | null;
  created_at: string;
  published_at: string | null;
  updated_at: string;
}

// Cache for composed instructions, keyed by hash of active version ids
const instructionCache = new Map<string, { instructions: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hash of active instruction version ids for cache keying.
 * Stable ordering ensures consistent hashes.
 */
function computeCacheKey(instructions: CoachInstruction[]): string {
  const versionIds = instructions
    .map(i => `${i.instruction_id}:v${i.version}`)
    .sort()
    .join(',');
  return createHash('sha256').update(versionIds).digest('hex').substring(0, 16);
}

/**
 * Fetch published coach instructions for the given surface.
 * FAILS OPEN: returns empty array on any error.
 */
export async function fetchCoachInstructions(
  supabase: SupabaseClient,
  surface: 'preamble' | 'edge-fn' | 'both',
): Promise<CoachInstruction[]> {
  try {
    const { data, error } = await supabase
      .from('coach_instructions')
      .select('*')
      .eq('status', 'published')
      .in('surface', surface === 'preamble' ? ['preamble', 'both'] : ['edge-fn', 'both'])
      .order('instruction_id', { ascending: true });

    if (error) {
      safeLog({
        event: 'coach_instructions.fetch_error',
        surface,
        error: error.message,
        fallback: 'using_inline_prompts',
      });
      return [];
    }

    return data || [];
  } catch (err) {
    // Fail open: table doesn't exist, network error, etc.
    safeLog({
      event: 'coach_instructions.fetch_exception',
      surface,
      error: err instanceof Error ? err.message : 'unknown',
      fallback: 'using_inline_prompts',
    });
    return [];
  }
}

/**
 * Compose coach instructions into a grounding preamble string.
 * Includes cache for performance on the hot MCP request path.
 */
export async function composeCoachPreamble(
  supabase: SupabaseClient,
  surface: 'preamble' | 'edge-fn' | 'both' = 'preamble',
): Promise<string> {
  // Check if the feature is enabled
  if (process.env.COACH_INSTRUCTIONS_ENABLED !== 'true') {
    return '';
  }

  const instructions = await fetchCoachInstructions(supabase, surface);

  if (instructions.length === 0) {
    return '';
  }

  // Check cache
  const cacheKey = computeCacheKey(instructions);
  const cached = instructionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.instructions;
  }

  // Compose instructions
  const sections: string[] = [];

  // Group by instruction_id prefix for organization
  const globalInstructions = instructions.filter(i => i.instruction_id.startsWith('global.'));
  const toolInstructions = instructions.filter(i => !i.instruction_id.startsWith('global.'));

  if (globalInstructions.length > 0) {
    sections.push('COACH INSTRUCTIONS (Global):');
    globalInstructions.forEach(inst => {
      sections.push(inst.body);
    });
  }

  if (toolInstructions.length > 0) {
    sections.push('COACH INSTRUCTIONS (Tool-specific):');
    toolInstructions.forEach(inst => {
      if (inst.when_to_use) {
        sections.push(`[${inst.instruction_id}] When: ${inst.when_to_use}`);
      }
      sections.push(inst.body);
    });
  }

  const composed = sections.join('\n');

  // Cache the result
  instructionCache.set(cacheKey, {
    instructions: composed,
    timestamp: Date.now(),
  });

  safeLog({
    event: 'coach_instructions.composed',
    surface,
    instruction_count: instructions.length,
    cache_key: cacheKey,
  });

  return composed;
}

/**
 * Fetch instructions for a specific tool/stage.
 * Used by edge functions to get their specific instructions.
 */
export async function fetchInstructionForId(
  supabase: SupabaseClient,
  instructionId: string,
): Promise<string> {
  // Check if the feature is enabled
  if (process.env.COACH_INSTRUCTIONS_ENABLED !== 'true') {
    return '';
  }

  try {
    const { data, error } = await supabase
      .from('coach_instructions')
      .select('body')
      .eq('instruction_id', instructionId)
      .eq('status', 'published')
      .single();

    if (error || !data) {
      safeLog({
        event: 'coach_instructions.fetch_by_id',
        instruction_id: instructionId,
        found: false,
        fallback: 'using_inline_prompt',
      });
      return '';
    }

    return data.body;
  } catch (err) {
    safeLog({
      event: 'coach_instructions.fetch_by_id_exception',
      instruction_id: instructionId,
      error: err instanceof Error ? err.message : 'unknown',
      fallback: 'using_inline_prompt',
    });
    return '';
  }
}

/**
 * Tier-1 grounding preamble for MCP tools.
 * Returns tier-A terminology instructions to be prepended to the coach system prompt.
 */
export async function tier1GroundingPreamble(supabase: SupabaseClient): Promise<string> {
  // Fetch the global tier-a terminology instruction
  const tierATerms = await fetchInstructionForId(supabase, 'global.tier_a_terminology');

  if (tierATerms) {
    return tierATerms;
  }

  // Fallback to inline definition if not in DB
  return [
    'TIER-A TERMINOLOGY: Always use Trust Gap™, Decision Trigger™, Avatar 2.0™, and the four',
    'IDEA pillar names (Insight-Driven, Distinctive, Empathetic, Authentic) in your narration',
    'to the user. These proprietary terms are the product\'s commercial vocabulary and must be',
    'visible in your spoken output. When a tool scrubs terminology from an artifact (e.g., a',
    'design brief for an external designer), that restriction applies ONLY to the artifact text',
    'itself — your narration about the artifact must still name these terms explicitly.',
  ].join(' ');
}

/**
 * Clear the instruction cache (for testing or manual invalidation).
 */
export function clearInstructionCache(): void {
  instructionCache.clear();
}