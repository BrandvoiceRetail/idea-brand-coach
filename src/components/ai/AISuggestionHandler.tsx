import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AISuggestionPreview } from '@/components/AISuggestionPreview';

interface AISuggestionHandlerProps {
  fieldType: string;
  currentValue: string;
  ideaFramework: {
    intent?: string;
    motivation?: string;
    triggers?: string;
    shopper?: string;
    demographics?: string;
  };
  avatar: any;
  brandCanvas: any;
  onSuggestion: (suggestion: string) => void;
}

export interface AISuggestionHandlerRef {
  generate: () => Promise<void>;
  isLoading: boolean;
  hasPendingSuggestion: boolean;
}

export const AISuggestionHandler = forwardRef<AISuggestionHandlerRef, AISuggestionHandlerProps>(
  ({ fieldType, currentValue, ideaFramework, avatar, brandCanvas, onSuggestion }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);
    const { toast } = useToast();

    const generateContent = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('brand-ai-assistant', {
          body: {
            fieldType,
            currentValue,
            ideaFramework,
            avatar,
            brandCanvas
          }
        });

        if (error) throw error;

        // Show the suggestion for review instead of directly applying
        setPendingSuggestion(data.suggestion);

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

    const handleAccept = (): void => {
      if (pendingSuggestion) {
        onSuggestion(pendingSuggestion);
        setPendingSuggestion(null);
        toast({
          title: "Content Applied",
          description: `Your ${fieldType.replace(/([A-Z])/g, ' $1').toLowerCase().trim()} has been updated.`
        });
      }
    };

    const handleReject = (): void => {
      setPendingSuggestion(null);
      toast({
        title: "Suggestion Dismissed",
        description: "Your original content has been preserved."
      });
    };

    // Expose generate method and state to parent via ref
    useImperativeHandle(ref, () => ({
      generate: generateContent,
      isLoading,
      hasPendingSuggestion: pendingSuggestion !== null
    }));

    return (
      <>
        {pendingSuggestion && (
          <AISuggestionPreview
            suggestion={pendingSuggestion}
            fieldType={fieldType}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        )}
      </>
    );
  }
);

AISuggestionHandler.displayName = 'AISuggestionHandler';
