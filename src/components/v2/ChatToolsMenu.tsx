import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Wrench, Search } from 'lucide-react';
import { ReviewAnalyzerModal } from './ReviewAnalyzerModal';

interface ChatToolsMenuProps {
  onSendReviewContext: (contextString: string) => void;
  onEnrichmentComplete?: (contextString: string, totalReviews: number) => void;
  /** Optional class name for the trigger button (e.g., for mobile sizing) */
  triggerClassName?: string;
}

export function ChatToolsMenu({ onSendReviewContext, onEnrichmentComplete, triggerClassName }: ChatToolsMenuProps): JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleReviewAnalyzerClick = (): void => {
    setPopoverOpen(false);
    setModalOpen(true);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={triggerClassName ?? "h-[60px] w-[60px]"} title="Tools">
            <Wrench className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start" side="top">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={handleReviewAnalyzerClick}
          >
            <Search className="h-4 w-4" />
            Review Analyzer
          </button>
        </PopoverContent>
      </Popover>
      <ReviewAnalyzerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSendToTrevor={onSendReviewContext}
        onEnrichmentComplete={onEnrichmentComplete}
      />
    </>
  );
}
