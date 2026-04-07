/**
 * Brand Markdown Export Component
 *
 * UI component for exporting brand strategy as comprehensive markdown document.
 * Integrates with MarkdownExportService and handles user interactions.
 */

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBrand } from '@/contexts/BrandContext';
import { MarkdownExportService } from './MarkdownExportService';
import { KnowledgeBaseFactory } from '@/lib/knowledge-base';
import { SupabaseChatService } from '@/services/SupabaseChatService';

/** Progress stages shown during V2 document generation */
const PROGRESS_STAGES = [
  'Collecting your brand data...',
  'Retrieving IDEA framework skills...',
  'Analysing customer insights...',
  'Crafting brand canvas sections...',
  'Applying the 4 IDEA Tests...',
  'Building narrative framework...',
  'Running coherence pass...',
  'Finalising your document...',
] as const;

/** Imperative handle for triggering export programmatically */
export interface BrandMarkdownExportRef {
  /** Start the export process programmatically */
  startExport: () => Promise<void>;
}

interface BrandMarkdownExportProps {
  /** Company name for filename */
  companyName?: string;

  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';

  /** Button size */
  size?: 'default' | 'sm' | 'lg';

  /** Full width button */
  fullWidth?: boolean;

  /** Include chat conversation insights */
  includeChats?: boolean;

  /**
   * If provided, this callback is invoked when the user clicks the export button
   * INSTEAD of starting the export directly. Use this to gate export behind a
   * readiness check (e.g., opening ExportReadinessModal).
   */
  onBeforeExport?: () => void;
}

export const BrandMarkdownExport = forwardRef<BrandMarkdownExportRef, BrandMarkdownExportProps>(
  function BrandMarkdownExport({
    companyName,
    variant = 'outline',
    size = 'default',
    fullWidth = false,
    includeChats = true,
    onBeforeExport,
  }: BrandMarkdownExportProps, ref): JSX.Element {
  const { toast } = useToast();
  const { user } = useAuth();
  const { brandData } = useBrand();
  const [isExporting, setIsExporting] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle through progress stages while exporting
  useEffect(() => {
    if (isExporting) {
      setProgressStage(0);
      progressInterval.current = setInterval(() => {
        setProgressStage((prev) =>
          prev < PROGRESS_STAGES.length - 1 ? prev + 1 : prev
        );
      }, 8000); // ~8s per stage across ~60-90s generation
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isExporting]);

  // Expose startExport for programmatic triggering (e.g., from ExportReadinessModal)
  useImperativeHandle(ref, () => ({
    startExport: handleExport,
  }));

  const handleButtonClick = (): void => {
    if (onBeforeExport) {
      onBeforeExport();
    } else {
      handleExport();
    }
  };

  const handleExport = async (): Promise<void> => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to export your brand strategy.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      // Update brandData with current user ID
      const exportBrandData = {
        ...brandData,
        userInfo: {
          ...brandData.userInfo,
          userId: user.id,
          email: user.email || brandData.userInfo.email,
        },
      };

      // Initialize services
      const knowledgeRepo = await KnowledgeBaseFactory.createRepository();
      const chatService = new SupabaseChatService();
      const exportService = new MarkdownExportService(
        knowledgeRepo,
        chatService,
        exportBrandData
      );

      // Generate export - include up to 10 recent conversations for context
      const result = await exportService.generateExport({
        includeChats,
        maxChatExcerpts: 10,
        format: 'full',
      });

      if (!result.success) {
        throw result.error || new Error('Export generation failed');
      }

      // Create downloadable file
      const blob = exportService.createDownloadableFile(result.markdown!);

      // Trigger download
      exportService.downloadFile(blob, result.filename);

      // Success toast
      toast({
        title: 'Export Successful',
        description: `Your brand strategy has been exported as ${result.filename}`,
      });

      // Log metadata for debugging
      console.log('Export metadata:', result.metadata);
    } catch (error) {
      console.error('Export failed:', error);

      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <Button
        onClick={handleButtonClick}
        variant={variant}
        size={size}
        className={fullWidth ? 'w-full' : ''}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export Brand Strategy
          </>
        )}
      </Button>
      {isExporting && (
        <p className="mt-2 text-sm text-muted-foreground animate-pulse">
          {PROGRESS_STAGES[progressStage]}
        </p>
      )}
    </div>
  );
});
