import React, { useRef } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { AIButton } from '@/components/ai/AIButton';
import { AISuggestionHandler, AISuggestionHandlerRef } from '@/components/ai/AISuggestionHandler';

/**
 * Props for the AIAssistant component
 */
interface AIAssistantProps {
  /** Type of field being generated (e.g., "tagline", "missionStatement") */
  fieldType: string;
  /** Current value of the field before AI generation */
  currentValue: string;
  /** Callback function when AI suggestion is accepted */
  onSuggestion: (suggestion: string) => void;
  /** Placeholder text for the field (optional) */
  placeholder?: string;
}

/**
 * AIAssistant component that orchestrates AI-powered content generation
 *
 * This is the main entry point for AI assistance features. It combines:
 * - AIButton for user interaction
 * - AISuggestionHandler for managing generation lifecycle
 * - Brand context for personalized suggestions
 *
 * The component automatically gathers relevant brand data from context
 * (IDEA framework, avatar, brand canvas) and passes it to the AI handler
 * for contextually-aware content generation.
 *
 * @param fieldType - Type of field being generated
 * @param currentValue - Current field value
 * @param onSuggestion - Callback when suggestion is accepted
 * @param placeholder - Optional placeholder text (defaults to generic message)
 */
export const AIAssistant: React.FC<AIAssistantProps> = ({
  fieldType,
  currentValue,
  onSuggestion,
  placeholder = "AI will generate content for this field..."
}) => {
  const { brandData } = useBrand();
  const handlerRef = useRef<AISuggestionHandlerRef>(null);

  const handleGenerate = (): void => {
    handlerRef.current?.generate();
  };

  const ideaFramework = {
    intent: brandData.insight?.marketInsight,
    motivation: brandData.insight?.consumerInsight,
    triggers: brandData.empathy?.emotionalConnection,
    shopper: brandData.empathy?.customerNeeds,
    demographics: brandData.avatar?.demographics
  };

  return (
    <div>
      <AIButton
        onGenerate={handleGenerate}
        isLoading={handlerRef.current?.isLoading ?? false}
        disabled={handlerRef.current?.hasPendingSuggestion ?? false}
      />

      <AISuggestionHandler
        ref={handlerRef}
        fieldType={fieldType}
        currentValue={currentValue}
        ideaFramework={ideaFramework}
        avatar={brandData.avatar}
        brandCanvas={brandData.brandCanvas}
        onSuggestion={onSuggestion}
      />
    </div>
  );
};
