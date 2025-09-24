import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, Target, BarChart, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SearchInsight {
  query: string;
  intent: string;
  volume: string;
  competition: string;
  insights: string[];
}

interface AnalysisResult {
  insights: SearchInsight[];
  ideaFrameworkAnalysis?: string;
}

interface BuyerIntentResearchProps {
  onInsightsGenerated: (insights: SearchInsight[]) => void;
}

export function BuyerIntentResearch({ onInsightsGenerated }: BuyerIntentResearchProps) {
  const [searchTerms, setSearchTerms] = useState("");
  const [industry, setIndustry] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<SearchInsight[]>([]);
  const [ideaFrameworkAnalysis, setIdeaFrameworkAnalysis] = useState<string>("");
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

      setInsights(data.insights);
      setIdeaFrameworkAnalysis(data.ideaFrameworkAnalysis || "");
      onInsightsGenerated(data.insights);
      
      toast({
        title: "Analysis Complete! 🎯",
        description: `Generated insights for ${data.insights.length} search patterns.`,
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

      {/* Intent Categories Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Understanding Search Intent</CardTitle>
          <CardDescription>
            The four types of search intent and how to identify them
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {intentCategories.map((category) => (
              <div key={category.type} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={category.color}>{category.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                <div className="flex flex-wrap gap-1">
                  {category.examples.map((example) => (
                    <Badge key={example} variant="outline" className="text-xs">
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5" />
              Intent Analysis Results
            </CardTitle>
            <CardDescription>
              Insights generated from your search terms and industry analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                <TabsTrigger value="idea-brand">Idea Brand Detail</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4">
                  {insights.map((insight, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">"{insight.query}"</h4>
                        <Badge variant="outline">{insight.intent}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Volume:</span> {insight.volume}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Competition:</span> {insight.competition}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="detailed" className="space-y-4">
                {insights.map((insight, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">"{insight.query}"</CardTitle>
                      <div className="flex gap-2">
                        <Badge>{insight.intent}</Badge>
                        <Badge variant="outline">Vol: {insight.volume}</Badge>
                        <Badge variant="outline">Comp: {insight.competition}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <h5 className="font-medium">Key Insights:</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {insight.insights.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="recommendations" className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-lg border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Actionable Recommendations
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Focus content creation on high-intent, low-competition terms</li>
                    <li>• Create separate landing pages for different intent types</li>
                    <li>• Develop informational content to capture early-stage buyers</li>
                    <li>• Optimize transactional pages for ready-to-buy customers</li>
                    <li>• Use commercial intent terms in paid advertising campaigns</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="idea-brand" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      IDEA Brand Framework Analysis
                    </CardTitle>
                    <CardDescription>
                      Detailed strategic insights based on buyer intent patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-line text-sm leading-relaxed">
                        {ideaFrameworkAnalysis || "No detailed analysis available. Please run the analysis to see IDEA Brand Framework insights."}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}