import React, { useRef } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { AIButton } from '@/components/ai/AIButton';
import { AISuggestionHandler, AISuggestionHandlerRef } from '@/components/ai/AISuggestionHandler';

interface AIAssistantProps {
  fieldType: string;
  currentValue: string;
  onSuggestion: (suggestion: string) => void;
  placeholder?: string;
}

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
