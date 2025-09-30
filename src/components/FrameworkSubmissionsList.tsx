import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface FrameworkSubmission {
  id: string;
  buyer_intent: string | null;
  motivation: string | null;
  triggers: string | null;
  shopper_type: string | null;
  demographics: string | null;
  created_at: string;
}

export const FrameworkSubmissionsList = () => {
  const [submissions, setSubmissions] = useState<FrameworkSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('idea_framework_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadSubmission = async (submission: FrameworkSubmission) => {
    setDownloadingId(submission.id);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPosition = 20;

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('IDEA Framework Submission', margin, yPosition);
      yPosition += 10;

      // Date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(`Submitted: ${format(new Date(submission.created_at), 'PPP')}`, margin, yPosition);
      yPosition += 15;

      // Helper function to add section
      const addSection = (title: string, content: string | null) => {
        // Check if we need a new page
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        // Section title
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0);
        pdf.text(title, margin, yPosition);
        yPosition += 7;

        // Section content
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(50);
        
        const text = content || 'Not provided';
        const lines = pdf.splitTextToSize(text, maxWidth);
        
        lines.forEach((line: string) => {
          if (yPosition > 280) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        });
        
        yPosition += 8;
      };

      // Add all sections
      addSection('Buyer Intent', submission.buyer_intent);
      addSection('Motivation', submission.motivation);
      addSection('Emotional Triggers', submission.triggers);
      addSection('Shopper Type', submission.shopper_type);
      addSection('Demographics', submission.demographics);

      // Save the PDF
      pdf.save(`IDEA_Framework_${format(new Date(submission.created_at), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Your Framework Submissions</h2>
      <div className="grid gap-4">
        {submissions.map((submission) => (
          <Card key={submission.id} className="bg-gradient-card shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Submitted {format(new Date(submission.created_at), 'PPP')}
                </CardTitle>
                <Button
                  onClick={() => downloadSubmission(submission)}
                  disabled={downloadingId === submission.id}
                  size="sm"
                  variant="outline"
                >
                  {downloadingId === submission.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold">Buyer Intent: </span>
                  <span className="text-muted-foreground line-clamp-2">
                    {submission.buyer_intent || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Motivation: </span>
                  <span className="text-muted-foreground line-clamp-2">
                    {submission.motivation || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Emotional Triggers: </span>
                  <span className="text-muted-foreground line-clamp-2">
                    {submission.triggers || 'Not provided'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
