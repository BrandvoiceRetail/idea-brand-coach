/**
 * System Knowledge Base Utility
 *
 * Provides access to the IDEA Framework system knowledge base (Trevor's book)
 * Uses OpenAI Responses API with file_search tool (replacing deprecated Assistants API)
 */

// System Knowledge Base Vector Store ID (Trevor's IDEA Framework book)
export const SYSTEM_KB_VECTOR_STORE_ID = "vs_6948707b318c81918a90e9b44970a99e";

/**
 * Search the system knowledge base for relevant IDEA Framework content.
 * Uses OpenAI's Responses API with file_search tool.
 *
 * @param query - The user's question or topic to search for
 * @param openAIApiKey - OpenAI API key
 * @param maxChars - Maximum characters to return (default 2000)
 * @returns Formatted context string or empty string if no results
 */
export async function searchSystemKB(
  query: string,
  openAIApiKey: string,
  maxChars: number = 2000
): Promise<string> {
  try {
    console.log(
      `[searchSystemKB] Searching system KB for: "${query.substring(0, 50)}..."`
    );

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `Find the most relevant information from the IDEA Strategic Brand Framework about: ${query}

Return the key concepts, principles, and guidance that relate to this topic. Focus on actionable insights and specific techniques from the framework.`,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [SYSTEM_KB_VECTOR_STORE_ID],
          },
        ],
        tool_choice: "required", // Force file search to be used
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[searchSystemKB] API error:", response.status, errorText);
      return "";
    }

    const data = await response.json();

    // Extract the response text
    let systemContext = "";

    // The Responses API returns output_text directly
    if (data.output_text) {
      systemContext = data.output_text;
    } else if (data.output && Array.isArray(data.output)) {
      // Fallback: extract from output array
      for (const item of data.output) {
        if (item.type === "message" && item.content) {
          for (const content of item.content) {
            if (content.type === "output_text" || content.type === "text") {
              systemContext += (content.text || content.output_text || "") + "\n";
            }
          }
        }
      }
    }

    if (!systemContext || systemContext.trim().length === 0) {
      console.log("[searchSystemKB] No context retrieved from system KB");
      return "";
    }

    // Truncate if needed
    const truncatedContent =
      systemContext.length > maxChars
        ? systemContext.substring(0, maxChars) + "..."
        : systemContext;

    console.log(
      `[searchSystemKB] Retrieved ${truncatedContent.length} chars from system KB`
    );

    return formatSystemKBContext(truncatedContent);
  } catch (error) {
    console.error("[searchSystemKB] Error:", error);
    return "";
  }
}

/**
 * Format the system KB content for inclusion in LLM prompts
 */
function formatSystemKBContext(content: string): string {
  if (!content) return "";

  return `
<IDEA_FRAMEWORK_KNOWLEDGE>
The following information is from the IDEA Strategic Brand Framework knowledge base. Use this expertise to inform your response:

${content}
</IDEA_FRAMEWORK_KNOWLEDGE>`;
}
