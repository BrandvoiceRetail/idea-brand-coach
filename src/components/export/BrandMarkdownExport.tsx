/**
 * Brand Markdown Export Component
 *
 * UI component for exporting brand strategy as comprehensive markdown document.
 * Integrates with MarkdownExportService and handles user interactions.
 *
 * Export state is stored at module level so it survives component remounts
 * (e.g. when the user switches chat sessions mid-export).
 */

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useSyncExternalStore } from 'react';
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

// ============================================================================
// Module-level export state (survives component remounts)
// ============================================================================

interface ExportState {
  isExporting: boolean;
  progressStage: number;
}

let exportState: ExportState = { isExporting: false, progressStage: 0 };
let progressInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ExportState {
  return exportState;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setExportState(next: Partial<ExportState>): void {
  exportState = { ...exportState, ...next };
  listeners.forEach((l) => l());
}

function startProgressCycle(): void {
  stopProgressCycle();
  setExportState({ progressStage: 0 });
  progressInterval = setInterval(() => {
    if (exportState.progressStage < PROGRESS_STAGES.length - 1) {
      setExportState({ progressStage: exportState.progressStage + 1 });
    }
  }, 8000);
}

function stopProgressCycle(): void {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

// ============================================================================
// Component
// ============================================================================

/** Imperative handle for triggering export programmatically */
export interface BrandMarkdownExportRef {
  /** Start the export process programmatically */
  startExport: () => Promise<void>;
}

interface BrandMarkdownExportProps {
  companyName?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
  includeChats?: boolean;
  fieldValues?: Record<string, string | string[]>;
  onBeforeExport?: () => void;
}

export const BrandMarkdownExport = forwardRef<BrandMarkdownExportRef, BrandMarkdownExportProps>(
  function BrandMarkdownExport({
    variant = 'outline',
    size = 'default',
    fullWidth = false,
    includeChats = true,
    onBeforeExport,
  }: BrandMarkdownExportProps, ref): JSX.Element {
  const { toast } = useToast();
  const { user } = useAuth();
  const { brandData } = useBrand();
  const { isExporting, progressStage } = useSyncExternalStore(subscribe, getSnapshot);

  // Clean up interval on unmount only if no export is running
  useEffect(() => {
    return () => {
      if (!exportState.isExporting) {
        stopProgressCycle();
      }
    };
  }, []);

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

    if (exportState.isExporting) return;

    setExportState({ isExporting: true });
    startProgressCycle();

    try {
      const exportBrandData = {
        ...brandData,
        userInfo: {
          ...brandData.userInfo,
          userId: user.id,
          email: user.email || brandData.userInfo.email,
        },
      };

      const knowledgeRepo = await KnowledgeBaseFactory.createRepository();
      const chatService = new SupabaseChatService();
      const exportService = new MarkdownExportService(
        knowledgeRepo,
        chatService,
        exportBrandData
      );

      const result = await exportService.generateExport({
        includeChats,
        maxChatExcerpts: 10,
        format: 'full',
      });

      if (!result.success) {
        throw result.error || new Error('Export generation failed');
      }

      const blob = exportService.createDownloadableFile(result.markdown!);
      exportService.downloadFile(blob, result.filename);

      toast({
        title: 'Export Successful',
        description: `Your brand strategy has been exported as ${result.filename}`,
      });

      console.log('Export metadata:', result.metadata);
    } catch (error) {
      console.error('Export failed:', error);

      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      stopProgressCycle();
      setExportState({ isExporting: false, progressStage: 0 });
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
