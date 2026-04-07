import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { anthropicApiKey, CLAUDE_API_URL, HAIKU_MODEL, SECTION_MAX_TOKENS, ASSISTANT_RESPONSE_TRUNCATE, CHAT_EXCERPT_MAX_LENGTH } from './config.ts';
import { TREVOR_VOICE_DIRECTIVE } from './voice.ts';
import { DocumentSection } from './sections.ts';
import { fetchWithRetry } from './utils.ts';
import { searchSkillsVectorStore } from './skills.ts';
import { retrieveUserContext } from './context.ts';

// ============================================================================
// SECTION GENERATION
// ============================================================================

export async function generateSection(
  section: DocumentSection,
  brandName: string,
  avatarFieldValues: Record<string, string>,
  canvas: Record<string, string>,
  avatar: Record<string, string>,
  insights: Record<string, string>,
  chatInsights: Array<{ title: string; excerpt: string }>,
  supabaseClient: ReturnType<typeof createClient> | null,
  userId: string | null,
  previousSections?: Record<string, string>
): Promise<string> {
  console.log(`[generateSection] Generating: ${section.title}`);

  const skillContextPromise = searchSkillsVectorStore(section.skillQueries, 3);
  const semanticContextPromise = (supabaseClient && userId)
    ? retrieveUserContext(supabaseClient, userId, section.skillQueries[0], 2)
    : Promise.resolve('');

  const [skillContext, semanticContext] = await Promise.all([skillContextPromise, semanticContextPromise]);

  // Gather user data for this section
  let userData = '';

  if (section.userDataFields.includes('*')) {
    for (const [key, value] of Object.entries(avatarFieldValues)) {
      if (value) userData += `${key}: ${value}\n`;
    }
  } else {
    for (const fieldId of section.userDataFields) {
      const value = avatarFieldValues[fieldId];
      if (value) userData += `${fieldId}: ${value}\n`;
    }
  }

  for (const [key, value] of Object.entries(canvas)) {
    if (value && !userData.includes(key)) userData += `canvas_${key}: ${value}\n`;
  }
  for (const [key, value] of Object.entries(avatar)) {
    if (value && !userData.includes(key)) userData += `avatar_${key}: ${value}\n`;
  }
  for (const [key, value] of Object.entries(insights)) {
    if (value && !userData.includes(key)) userData += `insight_${key}: ${value}\n`;
  }

  // Chat insights for sections that benefit from conversation context
  let chatContext = '';
  if (chatInsights.length > 0 && ['idea_overview', 'brand_story', 'implementation'].includes(section.id)) {
    chatContext = chatInsights
      .slice(0, 3)
      .map(c => `### ${c.title}\n${c.excerpt.substring(0, ASSISTANT_RESPONSE_TRUNCATE)}`)
      .join('\n\n');
    if (chatContext.length > CHAT_EXCERPT_MAX_LENGTH) {
      chatContext = chatContext.substring(0, CHAT_EXCERPT_MAX_LENGTH);
    }
  }

  // Previous sections context for synthesis sections
  let previousContext = '';
  if (previousSections && section.dependsOn) {
    for (const depId of section.dependsOn) {
      if (previousSections[depId]) {
        previousContext += `\n[From ${depId}]: ${previousSections[depId].substring(0, 500)}...\n`;
      }
    }
  }

  const systemPrompt = `${TREVOR_VOICE_DIRECTIVE}

## IDEA Framework Skill Knowledge
The following is relevant methodology from the IDEA Strategic Brand Framework skills library. Use this to ground your writing in the framework's principles:

${skillContext || 'No specific skill context available for this section.'}

## Section Writing Instructions
${section.writingInstructions}

## Output Rules
- Generate ONLY this section's content in clean Markdown
- Start with the ## heading as specified in the instructions
- Use ###, ####, tables, and bullet points as needed
- No preamble or closing remarks — just the section content
- Every recommendation must be specific to THIS brand, not generic advice
- If user data is missing for a subsection, write: "This area requires additional discovery through [specific method]."`;

  const userPrompt = `Generate section "${section.title}" for the brand: ${brandName}

## User's Brand Data
${userData || 'No structured field data available.'}

${semanticContext ? `## Additional Context (from uploaded documents and knowledge base)\n${semanticContext}` : ''}

${chatContext ? `## Strategic Conversation Insights\n${chatContext}` : ''}

${previousContext ? `## Context from Previous Sections\n${previousContext}` : ''}

Generate the complete section now.`;

  const response = await fetchWithRetry(
    CLAUDE_API_URL,
    {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: SECTION_MAX_TOKENS,
      }),
    },
    1,
    `generateSection:${section.id}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateSection] Claude Haiku error for ${section.title}:`, response.status, errorText);
    let parsedError = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      parsedError = errorJson?.error?.message || errorText;
    } catch { /* use raw text */ }
    throw new Error(`Anthropic API error (${response.status}): ${parsedError}`);
  }

  const data = await response.json();

  if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
    console.error(`[generateSection] Invalid response structure for ${section.title}`);
    throw new Error(`Claude returned invalid response structure for section "${section.title}"`);
  }

  const textBlock = data.content.find((block: { type: string }) => block.type === 'text');
  if (!textBlock?.text || typeof textBlock.text !== 'string') {
    console.error(`[generateSection] Missing text content in API response for ${section.title}`);
    throw new Error(`Claude returned empty content for section "${section.title}"`);
  }

  const content = textBlock.text.trim();
  console.log(`[generateSection] ${section.title} generated: ${content.length} chars`);
  return content;
}
