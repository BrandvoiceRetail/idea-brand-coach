import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

/**
 * Props for the AIButton component
 */
interface AIButtonProps {
  /** Callback function triggered when the generate button is clicked */
  onGenerate: () => void;
  /** Indicates if AI content generation is in progress */
  isLoading: boolean;
  /** Disables the button when true */
  disabled?: boolean;
}

/**
 * AIButton component for triggering AI content generation
 *
 * Displays a button with loading state and sparkle icon that triggers
 * AI-powered content generation when clicked.
 *
 * @param onGenerate - Callback function to execute when button is clicked
 * @param isLoading - Whether content is currently being generated
 * @param disabled - Whether the button should be disabled (defaults to false)
 */
export const AIButton: React.FC<AIButtonProps> = ({
  onGenerate,
  isLoading,
  disabled = false
}) => {
  return (
    <Button
      onClick={onGenerate}
      disabled={isLoading || disabled}
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
