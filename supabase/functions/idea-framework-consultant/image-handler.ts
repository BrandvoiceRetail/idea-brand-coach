/**
 * Image handling module.
 * Builds multimodal message content parts for image analysis
 * across both Chat Completions and Responses API formats.
 */

/** Image descriptor from the client metadata */
export interface MessageImage {
  url: string;
  detail?: 'high' | 'low' | 'auto';
}

/**
 * Build a multimodal user message for the Chat Completions API.
 * Returns an array of content parts with text + image_url blocks.
 */
export function buildChatCompletionsImageContent(
  userPrompt: string,
  images: MessageImage[]
): Array<Record<string, unknown>> {
  const contentParts: Array<Record<string, unknown>> = [
    { type: 'text', text: userPrompt }
  ];

  images.forEach((img) => {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: img.url,
        detail: img.detail || 'high'
      }
    });
  });

  return contentParts;
}

/**
 * Build a multimodal user message for the Responses API.
 * Uses `input_text` and `input_image` types per the Responses API schema.
 */
export function buildResponsesApiImageContent(
  userPrompt: string,
  images: MessageImage[]
): Array<Record<string, unknown>> {
  const contentParts: Array<Record<string, unknown>> = [
    { type: 'input_text', text: userPrompt }
  ];

  images.forEach((img) => {
    contentParts.push({
      type: 'input_image',
      image_url: img.url,
    });
  });

  return contentParts;
}

/**
 * Build the visual analysis suffix to append to the user prompt
 * when images are present.
 */
export function buildImageAnalysisSuffix(imageCount: number): string {
  return `\n\nVISUAL ANALYSIS: The user has provided ${imageCount} image(s) for analysis. Please analyze these images in the context of their brand strategy and IDEA Framework positioning. Provide specific visual feedback and recommendations.`;
}
