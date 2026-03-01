import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIButtonProps {
  onGenerate: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

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
