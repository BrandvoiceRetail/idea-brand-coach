import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIAssistantProps {
  prompt: string;
  currentValue: string;
  onSuggestion: (suggestion: string) => void;
  placeholder?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  prompt,
  currentValue,
  onSuggestion,
  placeholder = "AI will help improve your input..."
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const { toast } = useToast();

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
      // Simulate AI API call - replace with actual AI service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockSuggestions = {
        purpose: `Consider making your brand purpose more emotionally resonant. Instead of focusing on what you do, emphasize why it matters to your customers' lives. For example, transform "We sell fitness equipment" into "We empower people to reclaim their health and confidence."`,
        insight: `Your market insight could be stronger with specific data points. Try adding statistics or trends that support your observation. Also, connect how this insight directly impacts your target customer's daily experience.`,
        positioning: `Your positioning statement needs more differentiation. What can you offer that competitors absolutely cannot replicate? Focus on your unique combination of factors rather than individual features.`,
        values: `Your brand values should be more specific and actionable. Instead of generic terms like "quality," try "meticulous craftsmanship that honors traditional techniques while embracing innovation."`
      };

      const suggestionKey = Object.keys(mockSuggestions)[Math.floor(Math.random() * Object.keys(mockSuggestions).length)];
      setSuggestion(mockSuggestions[suggestionKey as keyof typeof mockSuggestions]);
      
    } catch (error) {
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
        className="w-full"
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