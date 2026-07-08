/**
 * Helper for edge functions to fetch coach instructions.
 *
 * Edge functions can append instruction blocks to their system prompts
 * by fetching from the coach_instructions table. This module provides
 * a simple interface that fails open (returns empty string on errors).
 *
 * IMPORTANT: This is for edge functions only. The MCP side uses
 * src/mcp/service/coachInstructions.ts with the node runtime.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface CoachInstruction {
  instruction_id: string;
  body: string;
  status: string;
}

/**
 * Fetch a specific coach instruction by ID.
 * Returns the body text if found and published, empty string otherwise.
 * FAILS OPEN: any error returns empty string, never throws.
 */
export async function fetchCoachInstruction(
  instructionId: string,
  serviceRoleKey?: string,
): Promise<string> {
  // Check if feature is enabled
  const coachInstructionsEnabled = (globalThis as any).Deno?.env?.get?.('COACH_INSTRUCTIONS_ENABLED');
  if (coachInstructionsEnabled !== 'true') {
    return '';
  }

  try {
    const url = (globalThis as any).Deno?.env?.get?.('SUPABASE_URL');
    const key = serviceRoleKey || (globalThis as any).Deno?.env?.get?.('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      console.log('[coach-instructions] Missing Supabase credentials, using inline prompt');
      return '';
    }

    const client = createClient(url, key);

    const { data, error } = await client
      .from('coach_instructions')
      .select('body')
      .eq('instruction_id', instructionId)
      .eq('status', 'published')
      .single();

    if (error || !data) {
      console.log(`[coach-instructions] Instruction ${instructionId} not found or error, using inline prompt`);
      return '';
    }

    return data.body || '';
  } catch (err) {
    console.log(`[coach-instructions] Failed to fetch ${instructionId}:`, err);
    return '';
  }
}

/**
 * Append coach instructions to an existing system prompt.
 * Fetches the instruction and appends it to the base prompt if found.
 *
 * Usage in edge function:
 * ```ts
 * const systemPrompt = await appendCoachInstruction(
 *   buildSystemPrompt(),
 *   'avatar_vocabulary'
 * );
 * ```
 */
export async function appendCoachInstruction(
  basePrompt: string,
  instructionId: string,
  serviceRoleKey?: string,
): Promise<string> {
  const instruction = await fetchCoachInstruction(instructionId, serviceRoleKey);

  if (!instruction) {
    return basePrompt;
  }

  return `${basePrompt}

COACH INSTRUCTIONS:
${instruction}`;
}