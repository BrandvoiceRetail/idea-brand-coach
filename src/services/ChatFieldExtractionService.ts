/**
 * ChatFieldExtractionService
 * Extracts field data from raw AI responses before they're saved to Supabase
 */

interface ExtractedField {
  fieldId: string;
  value: string | string[];
  confidence?: number;
  context?: string;
}

interface ExtractionResult {
  cleanedContent: string;
  extractedFields: ExtractedField[];
}

export class ChatFieldExtractionService {
  private static readonly EXTRACTION_START = '---FIELD_EXTRACTION_JSON---';
  private static readonly EXTRACTION_END = '---END_FIELD_EXTRACTION_JSON---';

  /**
   * Process raw AI response to extract fields and clean content
   * @param rawContent - Raw response from edge function (with extraction blocks)
   * @returns Object with cleaned content and extracted fields
   */
  processResponse(rawContent: string): ExtractionResult {
    const extractedFields: ExtractedField[] = [];
    let cleanedContent = rawContent;

    // Find all extraction blocks
    const regex = new RegExp(
      `${this.escapeRegex(ChatFieldExtractionService.EXTRACTION_START)}([\\s\\S]*?)${this.escapeRegex(
        ChatFieldExtractionService.EXTRACTION_END
      )}`,
      'g'
    );

    let match;
    const blocksToRemove: Array<{ start: number; end: number }> = [];

    while ((match = regex.exec(rawContent)) !== null) {
      const jsonContent = match[1].trim();

      try {
        const extraction = JSON.parse(jsonContent);

        // Handle both single and array of extractions
        const fields = Array.isArray(extraction) ? extraction : [extraction];

        fields.forEach((field: any) => {
          if (field.fieldId && field.value !== undefined) {
            extractedFields.push({
              fieldId: field.fieldId,
              value: field.value,
              confidence: field.confidence,
              context: field.context,
            });
          }
        });

        // Mark this block for removal
        blocksToRemove.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      } catch (error) {
        console.warn('Failed to parse extraction block:', error, jsonContent);
      }
    }

    // Remove extraction blocks from content (in reverse order to maintain indices)
    if (blocksToRemove.length > 0) {
      const parts: string[] = [];
      let lastEnd = 0;

      blocksToRemove.forEach((block) => {
        // Add content before this block
        if (block.start > lastEnd) {
          parts.push(rawContent.slice(lastEnd, block.start));
        }
        lastEnd = block.end;
      });

      // Add any remaining content after the last block
      if (lastEnd < rawContent.length) {
        parts.push(rawContent.slice(lastEnd));
      }

      // Join and clean up extra whitespace
      cleanedContent = parts
        .join('')
        .replace(/\n\n\n+/g, '\n\n') // Collapse multiple newlines
        .trim();
    }

    return {
      cleanedContent,
      extractedFields,
    };
  }

  /**
   * Merge extracted fields with existing fields, respecting source tracking
   * @param existingFields - Current field values with source tracking
   * @param newFields - Newly extracted fields from AI
   * @returns Merged fields, only updating AI-sourced or empty fields
   */
  mergeFields(
    existingFields: Record<string, { value: any; source: 'ai' | 'manual' }>,
    newFields: ExtractedField[]
  ): Record<string, { value: any; source: 'ai' | 'manual' }> {
    const merged = { ...existingFields };

    newFields.forEach((field) => {
      const existing = merged[field.fieldId];

      // Only update if field doesn't exist, is empty, or was AI-sourced
      if (!existing || !existing.value || existing.source === 'ai') {
        merged[field.fieldId] = {
          value: field.value,
          source: 'ai',
        };
      }
    });

    return merged;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}