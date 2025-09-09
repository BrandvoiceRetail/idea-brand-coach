import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Download, Calendar, TrendingUp, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface DiagnosticResult {
  id: string;
  overall_score: number;
  category_scores: Json;
  diagnostic_completion_date: string;
  created_at: string;
}

export const UserDiagnosticResults = () => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDiagnosticResults();
    }
  }, [user]);

  const fetchDiagnosticResults = async () => {
    try {
      const { data, error } = await supabase
        .from('user_diagnostic_results')
        .select('*')
        .order('diagnostic_completion_date', { ascending: false });

      if (error) throw error;
      
      setResults(data || []);
    } catch (error) {
      console.error('Error fetching diagnostic results:', error);
      toast({
        title: "Error",
        description: "Failed to load diagnostic results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  const downloadResults = (result: DiagnosticResult) => {
    // Generate a downloadable report (simplified version)
    const reportData = {
      overall_score: result.overall_score,
      category_scores: result.category_scores,
      completion_date: result.diagnostic_completion_date,
      report_generated: new Date().toISOString()
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `diagnostic-results-${new Date(result.diagnostic_completion_date).toLocaleDateString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: "Success",
      description: "Diagnostic results downloaded successfully",
    });
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Your Diagnostic Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading your results...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Your Diagnostic Results
          </CardTitle>
          <CardDescription>
            Your completed brand diagnostic assessments will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No diagnostic results found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Complete a brand diagnostic to see your results here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Your Diagnostic Results
        </CardTitle>
        <CardDescription>
          View and download your completed brand diagnostic assessments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.map((result) => (
          <Card key={result.id} className="bg-gradient-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Brand Diagnostic Assessment</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(result.diagnostic_completion_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={getScoreBadgeVariant(result.overall_score)} className="mb-2">
                    {result.overall_score}% Overall
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadResults(result)}
                    className="ml-2"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Overall Score</span>
                    <span className={`text-sm font-bold ${getScoreColor(result.overall_score)}`}>
                      {result.overall_score}%
                    </span>
                  </div>
                  <Progress value={result.overall_score} className="h-2" />
                </div>

                {result.category_scores && typeof result.category_scores === 'object' && result.category_scores !== null && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {Object.entries(result.category_scores as Record<string, number>).map(([category, score]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium capitalize">
                            {category}
                          </span>
                          <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                            {score}%
                          </span>
                        </div>
                        <Progress value={score} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};