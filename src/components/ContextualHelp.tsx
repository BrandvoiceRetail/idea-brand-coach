import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, X, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ContextualHelpProps {
  question: string;
  category: string;
  context?: string;
}

export function ContextualHelp({ question, category, context }: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [helpText, setHelpText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getHelp = async () => {
    if (helpText) {
      setIsOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('contextual-help', {
        body: { question, category, context }
      });

      if (error) throw error;

      setHelpText(data.helpText);
      setIsOpen(true);
    } catch (error) {
      console.error('Error getting contextual help:', error);
      toast({
        title: "Help Unavailable",
        description: "Unable to get AI assistance right now. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={getHelp}
        disabled={isLoading}
        className="text-muted-foreground hover:text-secondary transition-colors"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        Get AI Help
      </Button>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-secondary/5 to-primary/5 border-secondary/20 shadow-glow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-secondary">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Guidance
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed text-foreground/90">
          {helpText}
        </p>
      </CardContent>
    </Card>
  );
}