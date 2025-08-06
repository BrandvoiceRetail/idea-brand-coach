import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
  placeholder = "AI will help improve your input..."
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const { toast } = useToast();
  const { brandData } = useBrand();

  const generateSuggestion = async () => {
    if (!currentValue.trim()) {
      toast({
        title: "Add some content first",
        description: "Enter your initial thoughts so AI can help improve them.",
        variant: "destructive"
      });
      return;
    }

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
          brandCanvas: brandData.brandCanvas
        }
      });

      if (error) throw error;
      
      setSuggestion(data.suggestion);
      
    } catch (error) {
      console.error('AI Assistant Error:', error);
      toast({
        title: "AI Assistant Error",
        description: "Unable to generate suggestions right now. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = () => {
    onSuggestion(suggestion);
    setSuggestion('');
    toast({
      title: "Suggestion Applied",
      description: "AI suggestion has been applied to your input."
    });
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={generateSuggestion}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="w-full text-foreground hover:text-foreground"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating AI Suggestions...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Get AI Suggestions
          </>
        )}
      </Button>

      {suggestion && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
              <div className="text-sm text-muted-foreground font-medium">AI Suggestion</div>
            </div>
            <p className="text-sm mb-4">{suggestion}</p>
            <div className="flex gap-2">
              <Button onClick={applySuggestion} size="sm">
                Apply Suggestion
              </Button>
              <Button 
                onClick={() => setSuggestion('')} 
                variant="outline" 
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};