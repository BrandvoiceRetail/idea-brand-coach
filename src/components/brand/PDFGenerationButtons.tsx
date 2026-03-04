/**
 * PDFGenerationButtons Component
 * Renders two PDF generation action buttons with tooltip hints when disabled.
 */

import { FileText, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PDFGenerationButtonsProps {
  brandDataComplete: boolean;
  competitiveAnalysisComplete: boolean;
  isGeneratingBrand?: boolean;
  isGeneratingCompetitor?: boolean;
  onGenerateBrandPDF: () => void;
  onGenerateCompetitorPDF: () => void;
}

export function PDFGenerationButtons({
  brandDataComplete,
  competitiveAnalysisComplete,
  isGeneratingBrand = false,
  isGeneratingCompetitor = false,
  onGenerateBrandPDF,
  onGenerateCompetitorPDF,
}: PDFGenerationButtonsProps): JSX.Element {
  return (
    <TooltipProvider>
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1">
              <Button
                variant="brand"
                size="lg"
                className="w-full"
                disabled={!brandDataComplete || isGeneratingBrand}
                onClick={onGenerateBrandPDF}
              >
                {isGeneratingBrand ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileText />
                )}
                Brand Strategy PDF
              </Button>
            </span>
          </TooltipTrigger>
          {!brandDataComplete && (
            <TooltipContent>
              <p>Complete your brand profile to generate this report.</p>
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1">
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={!competitiveAnalysisComplete || isGeneratingCompetitor}
                onClick={onGenerateCompetitorPDF}
              >
                {isGeneratingCompetitor ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <BarChart3 />
                )}
                Competitor Analysis PDF
              </Button>
            </span>
          </TooltipTrigger>
          {!competitiveAnalysisComplete && (
            <TooltipContent>
              <p>Complete competitive analysis to generate this report.</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
