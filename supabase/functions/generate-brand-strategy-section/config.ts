// ============================================================================
// CONFIGURATION
// ============================================================================

export const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
export const openAIApiKey = Deno.env.get('OPENAI_API_KEY'); // Still needed for embeddings + vector store search
export const skillsVectorStoreId = Deno.env.get('SKILLS_VECTOR_STORE_ID');

export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

export const SKILL_SEARCH_MAX_RESULTS = 5;
export const SKILL_SEARCH_MAX_RETRIES = 2;
export const USER_CONTEXT_MATCH_COUNT = 4;
export const SECTION_MAX_TOKENS = 1500;
export const FETCH_TIMEOUT_MS = 30000;
export const ASSISTANT_RESPONSE_TRUNCATE = 800;
export const CHAT_EXCERPT_MAX_LENGTH = 3000;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
