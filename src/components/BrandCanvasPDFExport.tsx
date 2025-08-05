import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { DesktopOnlyFeature } from '@/components/DesktopOnlyFeature';

interface BrandCanvasData {
  missionStatement: string;
  visionStatement: string;
  valueProposition: string;
  brandArchetype: string;
  tonalAttributes: string[];
  visualIdentity: string;
}

interface BrandCanvasPDFExportProps {
  brandCanvas: BrandCanvasData;
  companyName?: string;
}

export const BrandCanvasPDFExport: React.FC<BrandCanvasPDFExportProps> = ({ 
  brandCanvas, 
  companyName = "Your Brand" 
}) => {
  const { toast } = useToast();

  const handleExport = async () => {
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
          return true;
        }
        return false;
      };

      // Header with IDEA logo
      const logoWidth = 60;
      const logoHeight = 15;
      pdf.setFillColor(0, 0, 0);
      pdf.rect(pageWidth / 2 - logoWidth/2, yPosition, logoWidth, logoHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.text('IDEA Brand Coach', pageWidth / 2, yPosition + logoHeight/2 + 1, { align: 'center' });
      
      yPosition += 30;

      // Title
      pdf.setTextColor(30, 64, 175);
      pdf.setFontSize(24);
      pdf.text('Brand Canvas Strategy', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(14);
      pdf.setTextColor(107, 114, 128);
      pdf.text(companyName, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      pdf.setFontSize(10);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;

      // Mission Statement
      if (brandCanvas.missionStatement) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Mission Statement', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const missionLines = pdf.splitTextToSize(brandCanvas.missionStatement, pageWidth - 2 * margin);
        pdf.text(missionLines, margin, yPosition);
        yPosition += (missionLines.length * lineHeight) + 10;
      }

      // Vision Statement
      if (brandCanvas.visionStatement) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Vision Statement', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const visionLines = pdf.splitTextToSize(brandCanvas.visionStatement, pageWidth - 2 * margin);
        pdf.text(visionLines, margin, yPosition);
        yPosition += (visionLines.length * lineHeight) + 10;
      }

      // Value Proposition
      if (brandCanvas.valueProposition) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Core Value Proposition', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const valueLines = pdf.splitTextToSize(brandCanvas.valueProposition, pageWidth - 2 * margin);
        pdf.text(valueLines, margin, yPosition);
        yPosition += (valueLines.length * lineHeight) + 10;
      }

      // Brand Personality
      if (brandCanvas.brandArchetype || brandCanvas.tonalAttributes.length > 0) {
        checkPageBreak(40);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Personality', margin, yPosition);
        yPosition += 10;

        if (brandCanvas.brandArchetype) {
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(12);
          pdf.text('Brand Archetype:', margin, yPosition);
          yPosition += lineHeight;
          pdf.setFontSize(11);
          pdf.text(brandCanvas.brandArchetype, margin + 5, yPosition);
          yPosition += lineHeight + 5;
        }

        if (brandCanvas.tonalAttributes.length > 0) {
          pdf.setFontSize(12);
          pdf.text('Tonal Attributes:', margin, yPosition);
          yPosition += lineHeight;
          pdf.setFontSize(11);
          brandCanvas.tonalAttributes.forEach(attribute => {
            checkPageBreak();
            pdf.text(`• ${attribute}`, margin + 5, yPosition);
            yPosition += lineHeight;
          });
        }
      }

      // Implementation Guidelines
      yPosition += 10;
      checkPageBreak(50);
      pdf.setTextColor(30, 64, 175);
      pdf.setFontSize(16);
      pdf.text('Implementation Guidelines', margin, yPosition);
      yPosition += 10;

      const guidelines = [
        'Brand Consistency:',
        '• Ensure all communications reflect your mission and values',
        '• Maintain consistent tone across all touchpoints',
        '• Use your brand archetype to guide messaging decisions',
        '',
        'Content Strategy:',
        '• Create content that reinforces your value proposition',
        '• Align messaging with your brand personality traits',
        '• Test different approaches while staying true to core values',
        '',
        'Team Alignment:',
        '• Share this brand canvas with all team members',
        '• Use as reference for all marketing and communication decisions',
        '• Review and update quarterly to ensure relevance'
      ];

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      guidelines.forEach(guideline => {
        if (guideline === '') {
          yPosition += 3;
        } else if (guideline.endsWith(':')) {
          checkPageBreak(20);
          pdf.setFontSize(12);
          pdf.text(guideline, margin, yPosition);
          pdf.setFontSize(10);
          yPosition += lineHeight;
        } else {
          checkPageBreak();
          pdf.text(guideline, margin + 5, yPosition);
          yPosition += lineHeight;
        }
      });

      // Save the PDF
      pdf.save(`${companyName.replace(/\s+/g, '-').toLowerCase()}-brand-canvas.pdf`);

      toast({
        title: "PDF Generated Successfully",
        description: "Your brand canvas has been downloaded as an editable PDF file."
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export Error",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const mobileAlternative = (
    <div className="text-center p-4 bg-muted/30 rounded-lg">
      <p className="text-sm text-muted-foreground">
        PDF export is available on desktop. Access your account on a computer to download your brand canvas.
      </p>
    </div>
  );

  return (
    <DesktopOnlyFeature 
      featureName="Brand Canvas PDF Export"
      mobileAlternative={mobileAlternative}
    >
      <Button onClick={handleExport} variant="outline" className="w-full">
        <Download className="w-4 h-4 mr-2" />
        Export as PDF
      </Button>
    </DesktopOnlyFeature>
  );
};