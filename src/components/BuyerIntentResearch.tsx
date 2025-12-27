import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Target, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePersistedField } from "@/hooks/usePersistedField";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import type { SyncStatus } from "@/lib/knowledge-base/interfaces";

interface AnalysisResult {
  analysis: string;
}

interface BuyerIntentResearchProps {
  onInsightsGenerated: (analysis: string) => void;
}

export function BuyerIntentResearch({ onInsightsGenerated }: BuyerIntentResearchProps) {
  // Persisted fields with local-first storage
  // Field identifiers use semantic names for better AI context and data aggregation
  const searchTerms = usePersistedField({
    fieldIdentifier: 'insight_search_terms',
    defaultValue: '',
    category: 'insights',
  });

  const industry = usePersistedField({
    fieldIdentifier: 'insight_industry',
    defaultValue: '',
    category: 'insights',
  });

  const analysis = usePersistedField({
    fieldIdentifier: 'insight_intent_analysis',
    defaultValue: '',
    category: 'insights',
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  // Overall sync status
  const getOverallSyncStatus = (): SyncStatus => {
    const statuses = [searchTerms.syncStatus, industry.syncStatus, analysis.syncStatus];
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'syncing')) return 'syncing';
    if (statuses.some(s => s === 'offline')) return 'offline';
    return 'synced';
  };

  const analyzeIntent = async () => {
    if (!searchTerms.value.trim() || !industry.value.trim()) {
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
          searchTerms: searchTerms.value.split(',').map(term => term.trim()),
          industry: industry.value.trim()
        }
      });

      if (error) throw error;

      analysis.onChange(data.analysis || "");
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
          <div className="flex items-center justify-between mb-2">
            <SyncStatusIndicator status={getOverallSyncStatus()} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="font-medium text-sm">Search Terms (comma-separated)</label>
              </div>
              <Input
                placeholder="e.g., running shoes, workout gear, fitness tracker"
                value={searchTerms.value}
                onChange={(e) => searchTerms.onChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="font-medium text-sm">Industry/Niche</label>
              </div>
              <Input
                placeholder="e.g., fitness equipment, skincare, productivity software"
                value={industry.value}
                onChange={(e) => industry.onChange(e.target.value)}
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

      {/* Intent Categories Information */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding Buyer Intent Categories</CardTitle>
          <CardDescription>
            Different search patterns reveal different stages in the customer journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {intentCategories.map((category) => (
              <div key={category.type} className="space-y-2">
                <Badge className={category.color}>{category.type}</Badge>
                <p className="text-sm text-muted-foreground">{category.description}</p>
                <p className="text-xs text-muted-foreground">
                  Examples: {category.examples.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {analysis.value && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              IDEA Brand Framework Analysis
            </CardTitle>
            <CardDescription>
              Detailed buyer intent analysis for: {searchTerms.value}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm leading-relaxed">
              {analysis.value.split('\n\n').map((section, index) => {
                const lines = section.trim().split('\n');
                const firstLine = lines[0];
                const isHeading = firstLine && firstLine.toUpperCase() === firstLine && firstLine.length < 100;
                
                if (isHeading) {
                  return (
                    <div key={index} className="space-y-2">
                      <p className="text-foreground">
                        {firstLine}
                      </p>
                      {lines.slice(1).map((line, i) => (
                        <p key={i} className="text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  );
                }
                
                return (
                  <p key={index} className="text-muted-foreground">
                    {section}
                  </p>
                );
              }).filter(Boolean)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}