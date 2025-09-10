import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { DesktopOnlyFeature } from '@/components/DesktopOnlyFeature';

interface BrandCanvasData {
  brandPurpose: string;
  brandVision: string;
  brandMission: string;
  brandValues: string[];
  positioningStatement: string;
  valueProposition: string;
  brandPersonality: string[];
  brandVoice: string;
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
      try {
        // Add the actual IDEA Brand Coach logo
        const logoImg = new Image();
        logoImg.src = '/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        
        const logoWidth = 40;
        const logoHeight = 12;
        pdf.addImage(logoImg, 'PNG', pageWidth / 2 - logoWidth/2, yPosition, logoWidth, logoHeight);
      } catch (error) {
        // Fallback to text if image fails to load
        const logoWidth = 60;
        const logoHeight = 15;
        pdf.setFillColor(0, 0, 0);
        pdf.rect(pageWidth / 2 - logoWidth/2, yPosition, logoWidth, logoHeight, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.text('IDEA Brand Coach', pageWidth / 2, yPosition + logoHeight/2 + 1, { align: 'center' });
      }
      
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

      // Brand Purpose
      if (brandCanvas.brandPurpose) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Purpose', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const purposeLines = pdf.splitTextToSize(brandCanvas.brandPurpose, pageWidth - 2 * margin);
        pdf.text(purposeLines, margin, yPosition);
        yPosition += (purposeLines.length * lineHeight) + 10;
      }

      // Brand Vision
      if (brandCanvas.brandVision) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Vision', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const visionLines = pdf.splitTextToSize(brandCanvas.brandVision, pageWidth - 2 * margin);
        pdf.text(visionLines, margin, yPosition);
        yPosition += (visionLines.length * lineHeight) + 10;
      }

      // Brand Mission
      if (brandCanvas.brandMission) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Mission', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const missionLines = pdf.splitTextToSize(brandCanvas.brandMission, pageWidth - 2 * margin);
        pdf.text(missionLines, margin, yPosition);
        yPosition += (missionLines.length * lineHeight) + 10;
      }

      // Brand Values
      if (brandCanvas.brandValues.length > 0) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Values', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        brandCanvas.brandValues.forEach(value => {
          checkPageBreak();
          const valueLines = pdf.splitTextToSize(`• ${value}`, pageWidth - 2 * margin);
          pdf.text(valueLines, margin, yPosition);
          yPosition += (valueLines.length * lineHeight);
        });
        yPosition += 5;
      }

      // Positioning Statement
      if (brandCanvas.positioningStatement) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Positioning Statement', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const positioningLines = pdf.splitTextToSize(brandCanvas.positioningStatement, pageWidth - 2 * margin);
        pdf.text(positioningLines, margin, yPosition);
        yPosition += (positioningLines.length * lineHeight) + 10;
      }

      // Value Proposition
      if (brandCanvas.valueProposition) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Value Proposition', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const valueLines = pdf.splitTextToSize(brandCanvas.valueProposition, pageWidth - 2 * margin);
        pdf.text(valueLines, margin, yPosition);
        yPosition += (valueLines.length * lineHeight) + 10;
      }

      // Brand Personality
      if (brandCanvas.brandPersonality.length > 0) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Personality', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        brandCanvas.brandPersonality.forEach(trait => {
          checkPageBreak();
          const traitLines = pdf.splitTextToSize(`• ${trait}`, pageWidth - 2 * margin);
          pdf.text(traitLines, margin, yPosition);
          yPosition += (traitLines.length * lineHeight);
        });
        yPosition += 5;
      }

      // Brand Voice
      if (brandCanvas.brandVoice) {
        checkPageBreak(30);
        pdf.setTextColor(30, 64, 175);
        pdf.setFontSize(16);
        pdf.text('Brand Voice', margin, yPosition);
        yPosition += 10;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        const voiceLines = pdf.splitTextToSize(brandCanvas.brandVoice, pageWidth - 2 * margin);
        pdf.text(voiceLines, margin, yPosition);
        yPosition += (voiceLines.length * lineHeight) + 10;
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