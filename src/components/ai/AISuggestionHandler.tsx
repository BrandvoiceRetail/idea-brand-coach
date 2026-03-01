import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AISuggestionPreview } from '@/components/AISuggestionPreview';

/**
 * Props for the AISuggestionHandler component
 */
interface AISuggestionHandlerProps {
  /** Type of field being generated (e.g., "tagline", "missionStatement") */
  fieldType: string;
  /** Current value of the field before AI generation */
  currentValue: string;
  /** IDEA framework data used to contextualize AI suggestions */
  ideaFramework: {
    /** Market insight from the Identify phase */
    intent?: string;
    /** Consumer insight from the Identify phase */
    motivation?: string;
    /** Emotional connection triggers from the Discover phase */
    triggers?: string;
    /** Shopper/customer needs from the Discover phase */
    shopper?: string;
    /** Target audience demographics */
    demographics?: string;
  };
  /** Avatar/persona data for the brand */
  avatar: any;
  /** Brand canvas data including positioning and values */
  brandCanvas: any;
  /** Callback function when a suggestion is accepted */
  onSuggestion: (suggestion: string) => void;
}

/**
 * Ref interface for imperative handle methods
 */
export interface AISuggestionHandlerRef {
  /** Triggers AI content generation */
  generate: () => Promise<void>;
  /** Indicates if content is currently being generated */
  isLoading: boolean;
  /** Indicates if there's a suggestion waiting for user review */
  hasPendingSuggestion: boolean;
}

/**
 * AISuggestionHandler component for managing AI-generated content suggestions
 *
 * This component handles the lifecycle of AI content generation including:
 * - Calling the brand-ai-assistant Supabase function
 * - Displaying suggestions for user review
 * - Handling accept/reject actions
 * - Managing loading and error states
 *
 * Exposes imperative methods via ref for parent control.
 *
 * @param fieldType - Type of field being generated
 * @param currentValue - Current field value
 * @param ideaFramework - IDEA framework context data
 * @param avatar - Brand avatar/persona data
 * @param brandCanvas - Brand canvas positioning data
 * @param onSuggestion - Callback when suggestion is accepted
 * @param ref - Forwarded ref for imperative handle
 */
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
