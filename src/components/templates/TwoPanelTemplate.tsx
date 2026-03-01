import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';

/**
 * TwoPanelTemplate Component
 *
 * A responsive two-panel layout template optimized for mobile and desktop.
 * On mobile: panels stack vertically with collapsible right panel (Sheet)
 * On desktop: panels display side-by-side
 *
 * Features:
 * - Responsive breakpoints (stacked mobile, side-by-side desktop)
 * - Collapsible field panel for mobile
 * - Touch-friendly interactions (44x44px minimum targets)
 * - Maximum reuse of shadcn-ui components
 */

interface TwoPanelTemplateProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  rightPanelTitle?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function TwoPanelTemplate({
  leftPanel,
  rightPanel,
  rightPanelTitle = 'Panel',
  header,
  footer,
}: TwoPanelTemplateProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      {header && <div className="flex-shrink-0">{header}</div>}

      <div className="flex-1 overflow-hidden relative">
        {/* Mobile: Left panel only, with Sheet trigger */}
        <div className="md:hidden h-full flex flex-col overflow-auto">
          {leftPanel}
        </div>

        {/* Desktop: Two-panel grid */}
        <div className="hidden md:grid h-full grid-cols-2 gap-0">
          <div className="flex flex-col h-full overflow-auto">
            {leftPanel}
          </div>
          <div className="flex flex-col h-full overflow-auto border-l">
            {rightPanel}
          </div>
        </div>

        {/* Mobile: Floating Sheet trigger button */}
        <div className="md:hidden fixed bottom-6 right-6 z-40">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg"
                aria-label="Open panel"
              >
                <PanelLeft className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0">
              <SheetHeader className="p-6 pb-4">
                <SheetTitle>{rightPanelTitle}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-auto px-6 pb-6">
                {rightPanel}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {footer && <div className="flex-shrink-0">{footer}</div>}
    </div>
  );
}
