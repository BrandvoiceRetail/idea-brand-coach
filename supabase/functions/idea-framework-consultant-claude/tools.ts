/**
 * Claude tool definitions for the IDEA Brand Coach.
 * Converts field extraction from OpenAI function calling format to Claude tool_use format.
 */

import { ALL_FIELDS_MAP } from './fields.ts';

/** Claude tool_use definition shape */
interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Build the extract_brand_fields tool in Claude's tool_use format.
 * Scopes field descriptions to the current chapter for token efficiency.
 */
export function buildExtractionTool(
  extractionFields?: string[],
  scopeChapterKey?: string
): ClaudeTool {
  let fieldDescriptions: string;

  if (scopeChapterKey && ALL_FIELDS_MAP[scopeChapterKey]) {
    const focusedChapter = ALL_FIELDS_MAP[scopeChapterKey];
    const focusedDescriptions = focusedChapter.fields
      .map(f => `  - ${f.id} (${f.type}): ${f.label} — ${f.helpText}`)
      .join('\n');

    const otherFieldIds = Object.entries(ALL_FIELDS_MAP)
      .filter(([key]) => key !== scopeChapterKey)
      .flatMap(([, ch]) => ch.fields.map(f => f.id));

    fieldDescriptions = `Current chapter — ${focusedChapter.title}:\n${focusedDescriptions}\n\nOther field IDs (extract if mentioned): ${otherFieldIds.join(', ')}`;
  } else {
    const validFields = extractionFields && extractionFields.length > 0
      ? extractionFields
      : Object.values(ALL_FIELDS_MAP).flatMap(ch => ch.fields.map(f => f.id));

    fieldDescriptions = validFields.map(fieldId => {
      for (const chapter of Object.values(ALL_FIELDS_MAP)) {
        const field = chapter.fields.find(f => f.id === fieldId);
        if (field) return `  - ${field.id} (${field.type}): ${field.label} — ${field.helpText}`;
      }
      return `  - ${fieldId}`;
    }).join('\n');
  }

  return {
    name: 'extract_brand_fields',
    description: `Extract brand field values detected in the user's message. Call this whenever the user shares information that maps to any brand field. Valid fields:\n${fieldDescriptions}`,
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          description: 'Array of extracted brand field values',
          items: {
            type: 'object',
            properties: {
              identifier: {
                type: 'string',
                description: 'The field ID from the valid fields list',
              },
              value: {
                description: 'The extracted value — string for text/textarea fields, array of strings for array fields',
              },
              confidence: {
                type: 'number',
                description: 'Confidence score: 0.90+ for direct statements, 0.85+ for documents, 0.70+ for strong inferences',
              },
              source: {
                type: 'string',
                enum: ['user_stated', 'user_confirmed', 'inferred_strong', 'document'],
                description: 'How the value was obtained',
              },
              context: {
                type: 'string',
                description: 'Brief explanation of why this was extracted',
              },
            },
            required: ['identifier', 'value', 'confidence', 'source'],
          },
        },
      },
      required: ['fields'],
    },
  };
}

/**
 * Build all tools for the Trevor agent.
 * Returns array of Claude tool definitions.
 */
export function buildAgentTools(
  extractionFields?: string[],
  scopeChapterKey?: string,
  hasActiveExtraction?: boolean
): ClaudeTool[] {
  const tools: ClaudeTool[] = [];

  if (hasActiveExtraction) {
    tools.push(buildExtractionTool(extractionFields, scopeChapterKey));
  }

  return tools;
}
