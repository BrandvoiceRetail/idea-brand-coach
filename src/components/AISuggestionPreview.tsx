import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Sparkles } from 'lucide-react';
import { FormattedAIText } from '@/components/FormattedAIText';

interface AISuggestionPreviewProps {
  suggestion: string;
  fieldType: string;
  onAccept: () => void;
  onReject: () => void;
}

export function AISuggestionPreview({
  suggestion,
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

  return (
    <Card className="mt-3 border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          <span>AI Suggestion for {formatFieldType(fieldType)}</span>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Suggested content:</p>
          <div className="p-3 rounded bg-background border border-primary/20 max-h-64 overflow-y-auto">
            <FormattedAIText text={suggestion} />
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
      </CardContent>
    </Card>
  );
}
