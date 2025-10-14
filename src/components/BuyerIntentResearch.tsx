import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Target, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResult {
  analysis: string;
}

interface BuyerIntentResearchProps {
  onInsightsGenerated: (analysis: string) => void;
}

export function BuyerIntentResearch({ onInsightsGenerated }: BuyerIntentResearchProps) {
  const [searchTerms, setSearchTerms] = useState("");
  const [industry, setIndustry] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const { toast } = useToast();

  const analyzeIntent = async () => {
    if (!searchTerms.trim() || !industry.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both search terms and industry.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('buyer-intent-analyzer', {
        body: { 
          searchTerms: searchTerms.split(',').map(term => term.trim()),
          industry: industry.trim()
        }
      });

      if (error) throw error;

      setAnalysis(data.analysis || "");
      onInsightsGenerated(data.analysis || "");
      
      toast({
        title: "Analysis Complete! 🎯",
        description: "IDEA Brand Framework analysis generated successfully.",
      });
    } catch (error) {
      console.error('Error analyzing buyer intent:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze buyer intent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const intentCategories = [
    {
      type: "Informational",
      description: "Users seeking knowledge or answers",
      examples: ["how to", "what is", "guide", "tutorial"],
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    },
    {
      type: "Commercial",
      description: "Users researching before purchase",
      examples: ["best", "reviews", "compare", "vs"],
      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    },
    {
      type: "Transactional",
      description: "Users ready to take action",
      examples: ["buy", "order", "price", "discount"],
      color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    },
    {
      type: "Navigational",
      description: "Users looking for specific brands/sites",
      examples: ["brand name", "website", "login", "contact"],
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            AI-Powered Buyer Intent Research
          </CardTitle>
          <CardDescription>
            Analyze search patterns to understand what drives your customers to seek solutions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="font-medium text-sm">Search Terms (comma-separated)</label>
              <Input
                placeholder="e.g., running shoes, workout gear, fitness tracker"
                value={searchTerms}
                onChange={(e) => setSearchTerms(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-sm">Industry/Niche</label>
              <Input
                placeholder="e.g., fitness equipment, skincare, productivity software"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={analyzeIntent}
            disabled={isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Intent Patterns...
              </>
            ) : (
              <>
                <Target className="w-4 h-4 mr-2" />
                Analyze Buyer Intent
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              IDEA Brand Framework Analysis
            </CardTitle>
            <CardDescription>
              Detailed buyer intent analysis for: {searchTerms}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ 
                __html: analysis
                  .replace(/##/g, '<h2 class="text-xl font-semibold mt-6 mb-3">')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/- (.*?)(\n|$)/g, '<li>$1</li>')
                  .replace(/(\d+)\. /g, '<div class="font-semibold mt-4">$1. ')
                  .replace(/\n\n/g, '</p><p class="mb-4">')
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}