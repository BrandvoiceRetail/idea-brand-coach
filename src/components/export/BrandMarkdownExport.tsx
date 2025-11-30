/**
 * Brand Markdown Export Component
 *
 * UI component for exporting brand strategy as comprehensive markdown document.
 * Integrates with MarkdownExportService and handles user interactions.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBrand } from '@/contexts/BrandContext';
import { MarkdownExportService } from './MarkdownExportService';
import { KnowledgeBaseFactory } from '@/lib/knowledge-base';
import { SupabaseChatService } from '@/services/SupabaseChatService';

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
}

export function BrandMarkdownExport({
  companyName,
  variant = 'outline',
  size = 'default',
  fullWidth = false,
  includeChats = true,
}: BrandMarkdownExportProps): JSX.Element {
  const { toast } = useToast();
  const { brandData } = useBrand();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);

    try {
      // Initialize services
      const knowledgeRepo = await KnowledgeBaseFactory.createRepository();
      const chatService = new SupabaseChatService('idea-framework-consultant');
      const exportService = new MarkdownExportService(
        knowledgeRepo,
        chatService,
        brandData
      );

      // Generate export
      const result = await exportService.generateExport({
        includeChats,
        maxChatExcerpts: 5,
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
    <Button
      onClick={handleExport}
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
          Export as Markdown
        </>
      )}
    </Button>
  );
}
