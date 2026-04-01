// ============================================================================
// CONFIGURATION
// ============================================================================

export const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
export const skillsVectorStoreId = Deno.env.get('SKILLS_VECTOR_STORE_ID');

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
