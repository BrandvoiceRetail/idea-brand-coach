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
import jsPDF from "jspdf";

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
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const lineHeight = 6;
      let yPosition = margin;

      const checkPageBreak = (additionalSpace = 15) => {
        if (yPosition > pageHeight - margin - additionalSpace) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Brand Diagnostic Results', margin, yPosition);
      yPosition += 15;

      // Date
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const completionDate = new Date(result.diagnostic_completion_date).toLocaleDateString();
      pdf.text(`Assessment Date: ${completionDate}`, margin, yPosition);
      yPosition += 10;

      // Overall Score Section
      checkPageBreak(20);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Overall Performance', margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(24);
      pdf.setTextColor(34, 197, 94); // Green color for good scores
      if (result.overall_score < 60) {
        pdf.setTextColor(239, 68, 68); // Red for poor scores
      } else if (result.overall_score < 80) {
        pdf.setTextColor(245, 158, 11); // Yellow for average scores
      }
      
      pdf.text(`${result.overall_score}%`, margin, yPosition);
      yPosition += 15;

      // Reset text color
      pdf.setTextColor(0, 0, 0);

      // Category Scores Section
      if (result.category_scores && typeof result.category_scores === 'object' && result.category_scores !== null) {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Category Breakdown', margin, yPosition);
        yPosition += 10;

        const categoryScores = result.category_scores as Record<string, number>;
        Object.entries(categoryScores).forEach(([category, score]) => {
          checkPageBreak();
          
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'normal');
          
          // Category name
          const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
          pdf.text(categoryName + ':', margin, yPosition);
          
          // Score with color coding
          if (score >= 80) {
            pdf.setTextColor(34, 197, 94); // Green
          } else if (score >= 60) {
            pdf.setTextColor(245, 158, 11); // Yellow
          } else {
            pdf.setTextColor(239, 68, 68); // Red
          }
          
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${score}%`, margin + 60, yPosition);
          
          // Reset color
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          
          yPosition += lineHeight + 2;
        });
      }

      // Footer
      yPosition = pageHeight - 30;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Report generated on ${new Date().toLocaleDateString()}`, margin, yPosition);
      pdf.text('Brand Diagnostic Assessment Report', pageWidth - margin - 60, yPosition);

      // Download the PDF
      const fileName = `diagnostic-results-${completionDate.replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Success",
        description: "Diagnostic results downloaded as PDF successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
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