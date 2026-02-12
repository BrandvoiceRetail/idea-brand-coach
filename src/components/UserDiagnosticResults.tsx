import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useDiagnostic } from "@/hooks/useDiagnostic";
import { Download, Calendar, TrendingUp, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface DiagnosticResult {
  id: string;
  scores: {
    overall: number;
    insight: number;
    distinctive: number;
    empathetic: number;
    authentic: number;
  };
  completed_at: string;
  created_at: string;
  answers: Record<string, string>;
}

export const UserDiagnosticResults = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { diagnosticHistory, isLoadingHistory } = useDiagnostic();

  // Transform and deduplicate diagnostic history
  const results: DiagnosticResult[] = (() => {
    if (!diagnosticHistory) return [];

    // Group by date, keeping highest score per date
    const grouped = new Map<string, typeof diagnosticHistory[0]>();

    diagnosticHistory.forEach(diag => {
      const date = new Date(diag.completed_at).toDateString();
      const existing = grouped.get(date);

      if (!existing || (diag.scores?.overall || 0) > (existing.scores?.overall || 0)) {
        grouped.set(date, diag);
      }
    });

    // Convert to array and transform, sorted by date descending
    return Array.from(grouped.values())
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 10) // Limit to 10 most recent
      .map(diag => ({
        id: diag.id,
        scores: diag.scores as DiagnosticResult['scores'],
        completed_at: diag.completed_at,
        created_at: diag.created_at,
        answers: diag.answers as Record<string, string>
      }));
  })();

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
      const completionDate = new Date(result.completed_at).toLocaleDateString();
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
      const overallScore = result.scores?.overall || 0;
      if (overallScore < 60) {
        pdf.setTextColor(239, 68, 68); // Red for poor scores
      } else if (overallScore < 80) {
        pdf.setTextColor(245, 158, 11); // Yellow for average scores
      }

      pdf.text(`${overallScore}%`, margin, yPosition);
      yPosition += 15;

      // Reset text color
      pdf.setTextColor(0, 0, 0);

      // Category Scores Section
      if (result.scores && typeof result.scores === 'object') {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Category Breakdown', margin, yPosition);
        yPosition += 10;

        const categoryScores = {
          'Insight': result.scores.insight || 0,
          'Distinctive': result.scores.distinctive || 0,
          'Empathetic': result.scores.empathetic || 0,
          'Authentic': result.scores.authentic || 0
        };

        Object.entries(categoryScores).forEach(([category, score]) => {
          checkPageBreak();

          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'normal');

          // Category name
          pdf.text(category + ':', margin, yPosition);

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

  if (isLoadingHistory) {
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
                      {new Date(result.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={getScoreBadgeVariant(result.scores?.overall || 0)} className="mb-2">
                    {result.scores?.overall || 0}% Overall
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
                    <span className={`text-sm font-bold ${getScoreColor(result.scores?.overall || 0)}`}>
                      {result.scores?.overall || 0}%
                    </span>
                  </div>
                  <Progress value={result.scores?.overall || 0} className="h-2" />
                </div>

                {result.scores && typeof result.scores === 'object' && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {[
                      { name: 'Insight', value: result.scores.insight || 0 },
                      { name: 'Distinctive', value: result.scores.distinctive || 0 },
                      { name: 'Empathetic', value: result.scores.empathetic || 0 },
                      { name: 'Authentic', value: result.scores.authentic || 0 }
                    ].map(({ name, value }) => (
                      <div key={name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium">
                            {name}
                          </span>
                          <span className={`text-xs font-bold ${getScoreColor(value)}`}>
                            {value}%
                          </span>
                        </div>
                        <Progress value={value} className="h-1" />
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