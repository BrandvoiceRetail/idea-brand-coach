import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Sparkles } from 'lucide-react';

interface AISuggestionPreviewProps {
  suggestion: string;
  currentValue: string;
  fieldType: string;
  onAccept: () => void;
  onReject: () => void;
}

export function AISuggestionPreview({
  suggestion,
  currentValue,
  fieldType,
  onAccept,
  onReject
}: AISuggestionPreviewProps): JSX.Element {
  const formatFieldType = (type: string): string => {
    return type
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
      .replace(/^\w/, c => c.toUpperCase());
  };

  const hasExistingContent = currentValue && currentValue.trim().length > 0;

  return (
    <Card className="mt-3 border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          <span>AI Suggestion for {formatFieldType(fieldType)}</span>
        </div>

        {hasExistingContent && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Your current content:</p>
            <div className="text-sm p-2 rounded bg-muted/50 border border-muted text-muted-foreground line-clamp-3">
              {currentValue}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">
            {hasExistingContent ? 'Suggested replacement:' : 'Suggested content:'}
          </p>
          <div className="text-sm p-3 rounded bg-background border border-primary/20">
            {suggestion}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={onAccept}
            size="sm"
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-1" />
            Accept
          </Button>
          <Button
            onClick={onReject}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>

        {hasExistingContent && (
          <p className="text-xs text-muted-foreground text-center">
            Accepting will replace your current content
          </p>
        )}
      </CardContent>
    </Card>
  );
}
