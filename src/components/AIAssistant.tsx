import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';

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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { brandData } = useBrand();

  const generateContent = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('brand-ai-assistant', {
        body: {
          fieldType,
          currentValue,
          ideaFramework: {
            intent: brandData.insight?.marketInsight,
            motivation: brandData.insight?.consumerInsight,
            triggers: brandData.empathy?.emotionalConnection,
            shopper: brandData.empathy?.customerNeeds,
            demographics: brandData.avatar?.demographics
          },
          avatar: brandData.avatar,
          brandCanvas: brandData.brandCanvas,
          diagnostic: brandData.diagnostic
        }
      });

      if (error) throw error;

      // Directly apply the generated content to the field
      onSuggestion(data.suggestion);

      toast({
        title: "Content Generated",
        description: `Your ${fieldType.replace(/([A-Z])/g, ' $1').toLowerCase().trim()} has been generated.`
      });

    } catch (error) {
      console.error('AI Assistant Error:', error);
      toast({
        title: "AI Assistant Error",
        description: "Unable to generate content right now. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={generateContent}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="w-full text-foreground hover:text-foreground"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          Generate with AI
        </>
      )}
    </Button>
  );
};
