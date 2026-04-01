/**
 * usePDFGeneration Hook
 * Manages PDF generation state and logic for brand strategy and competitor analysis reports.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type PDFType = 'brand-strategy' | 'competitor-analysis';

interface PDFGenerationState {
  isGeneratingBrand: boolean;
  isGeneratingCompetitor: boolean;
  brandPDFUrl: string | null;
  competitorPDFUrl: string | null;
  error: string | null;
}

interface UsePDFGenerationResult extends PDFGenerationState {
  generateBrandPDF: (brandId: string) => Promise<void>;
  generateCompetitorPDF: (brandId: string) => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: PDFGenerationState = {
  isGeneratingBrand: false,
  isGeneratingCompetitor: false,
  brandPDFUrl: null,
  competitorPDFUrl: null,
  error: null,
};

async function invokePDFGeneration(
  pdfType: PDFType,
  brandId: string
): Promise<string> {
  const functionName = pdfType === 'brand-strategy'
    ? 'generate-brand-strategy-pdf'
    : 'generate-competitor-analysis-pdf';

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { brandId },
  });

  if (error) {
    throw new Error(error.message || `Failed to generate ${pdfType} PDF`);
  }

  return data?.url as string;
}

export function usePDFGeneration(): UsePDFGenerationResult {
  const [state, setState] = useState<PDFGenerationState>(INITIAL_STATE);

  const generateBrandPDF = useCallback(async (brandId: string): Promise<void> => {
    setState((prev) => ({ ...prev, isGeneratingBrand: true, error: null }));
    try {
      const url = await invokePDFGeneration('brand-strategy', brandId);
      setState((prev) => ({ ...prev, isGeneratingBrand: false, brandPDFUrl: url }));
      toast.success('Brand Strategy PDF generated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Brand Strategy PDF.';
      setState((prev) => ({ ...prev, isGeneratingBrand: false, error: message }));
      toast.error(message);
    }
  }, []);

  const generateCompetitorPDF = useCallback(async (brandId: string): Promise<void> => {
    setState((prev) => ({ ...prev, isGeneratingCompetitor: true, error: null }));
    try {
      const url = await invokePDFGeneration('competitor-analysis', brandId);
      setState((prev) => ({ ...prev, isGeneratingCompetitor: false, competitorPDFUrl: url }));
      toast.success('Competitor Analysis PDF generated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate Competitor Analysis PDF.';
      setState((prev) => ({ ...prev, isGeneratingCompetitor: false, error: message }));
      toast.error(message);
    }
  }, []);

  const reset = useCallback((): void => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    generateBrandPDF,
    generateCompetitorPDF,
    reset,
  };
}
