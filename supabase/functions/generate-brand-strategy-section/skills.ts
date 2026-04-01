import { openAIApiKey, skillsVectorStoreId, SKILL_SEARCH_MAX_RESULTS, SKILL_SEARCH_MAX_RETRIES } from './config.ts';
import { fetchWithRetry } from './utils.ts';

// ============================================================================
// SKILLS VECTOR STORE SEARCH
// ============================================================================

export async function searchSkillsVectorStore(
  queries: string[],
  maxResults: number = SKILL_SEARCH_MAX_RESULTS
): Promise<string> {
  if (!skillsVectorStoreId) {
    console.warn('[searchSkills] No SKILLS_VECTOR_STORE_ID configured');
    return '';
  }

  try {
    const allResults: Array<{ content: string; score: number }> = [];

    const responses = await Promise.all(
      queries.map(query =>
        fetchWithRetry(
          `https://api.openai.com/v1/vector_stores/${skillsVectorStoreId}/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
            body: JSON.stringify({
              query,
              max_num_results: maxResults,
            }),
          },
          SKILL_SEARCH_MAX_RETRIES,
          'searchSkills'
        ).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[searchSkills] Search failed for query "${query.substring(0, 40)}...":`, response.status, errorText);
            return null;
          }
          return response.json();
        }).catch(() => null)
      )
    );

    for (const data of responses) {
      if (!data?.data) continue;
      for (const result of data.data) {
        for (const contentItem of result.content || []) {
          if (contentItem.type === 'text' && contentItem.text) {
            allResults.push({
              content: contentItem.text,
              score: result.score || 0,
            });
          }
        }
      }
    }

    const seen = new Set<string>();
    const unique = allResults.filter(r => {
      const key = r.content.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => b.score - a.score);
    const topResults = unique.slice(0, maxResults * 2);

    if (topResults.length === 0) return '';

    return topResults.map(r => r.content).join('\n\n---\n\n');
  } catch (error) {
    console.error('[searchSkills] Error:', error);
    return '';
  }
}
