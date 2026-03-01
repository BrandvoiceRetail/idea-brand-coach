/**
 * ThreePanelTemplate Component
 * A flexible three-panel layout template using the ResizablePanel system.
 * Supports configurable default sizes and mobile-responsive layout with Sheet.
 */

import React from 'react';
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Menu, PanelLeftClose, PanelRightClose } from 'lucide-react';

interface ThreePanelTemplateProps {
  /** Content for the left panel */
  leftPanel: React.ReactNode;
  /** Content for the center panel */
  centerPanel: React.ReactNode;
  /** Content for the right panel */
  rightPanel: React.ReactNode;
  /** Default size for left panel (percentage, 0-100) */
  defaultLeftSize?: number;
  /** Default size for center panel (percentage, 0-100) */
  defaultCenterSize?: number;
  /** Default size for right panel (percentage, 0-100) */
  defaultRightSize?: number;
  /** Minimum size for left panel (percentage, 0-100) */
  minLeftSize?: number;
  /** Minimum size for center panel (percentage, 0-100) */
  minCenterSize?: number;
  /** Minimum size for right panel (percentage, 0-100) */
  minRightSize?: number;
  /** Whether to show resize handles */
  showHandles?: boolean;
  /** Optional className for the container */
  className?: string;
  /** Whether to show mobile Sheet for left panel */
  enableMobileLeftSheet?: boolean;
  /** Whether to show mobile Sheet for right panel */
  enableMobileRightSheet?: boolean;
}

/**
 * ThreePanelTemplate provides a responsive three-panel layout using ResizablePanels.
 * On desktop, all three panels are visible with resizable handles.
 * On mobile, left and right panels can be accessed via Sheet overlays.
 *
 * @example
 * ```tsx
 * <ThreePanelTemplate
 *   leftPanel={<Sidebar />}
 *   centerPanel={<MainContent />}
 *   rightPanel={<ContextPanel />}
 *   defaultLeftSize={20}
 *   defaultCenterSize={50}
 *   defaultRightSize={30}
 * />
 * ```
 */
export function ThreePanelTemplate({
  leftPanel,
  centerPanel,
  rightPanel,
  defaultLeftSize = 25,
  defaultCenterSize = 50,
  defaultRightSize = 25,
  minLeftSize = 15,
  minCenterSize = 30,
  minRightSize = 15,
  showHandles = true,
  className,
  enableMobileLeftSheet = true,
  enableMobileRightSheet = true,
}: ThreePanelTemplateProps): JSX.Element {
  const [isLeftCollapsed, setIsLeftCollapsed] = React.useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = React.useState(false);

  return (
    <div className={cn('h-full w-full', className)}>
      {/* Desktop Layout: Three Resizable Panels */}
      <div className="hidden md:block h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel */}
          <ResizablePanel
            defaultSize={defaultLeftSize}
            minSize={minLeftSize}
            collapsible={true}
            onCollapse={() => setIsLeftCollapsed(true)}
            onExpand={() => setIsLeftCollapsed(false)}
          >
            <ScrollArea className="h-full">
              {leftPanel}
            </ScrollArea>
          </ResizablePanel>

          {/* Resize Handle between Left and Center */}
          <ResizableHandle withHandle={showHandles} />

          {/* Center Panel */}
          <ResizablePanel
            defaultSize={defaultCenterSize}
            minSize={minCenterSize}
          >
            <ScrollArea className="h-full">
              {centerPanel}
            </ScrollArea>
          </ResizablePanel>

          {/* Resize Handle between Center and Right */}
          <ResizableHandle withHandle={showHandles} />

          {/* Right Panel */}
          <ResizablePanel
            defaultSize={defaultRightSize}
            minSize={minRightSize}
            collapsible={true}
            onCollapse={() => setIsRightCollapsed(true)}
            onExpand={() => setIsRightCollapsed(false)}
          >
            <ScrollArea className="h-full">
              {rightPanel}
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile Layout: Center panel with Sheet overlays for left/right */}
      <div className="md:hidden h-full flex flex-col">
        {/* Mobile Header with Sheet Triggers */}
        <div className="flex items-center justify-between p-2 border-b bg-background">
          {enableMobileLeftSheet && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open left panel</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] sm:w-[400px] p-0">
                <ScrollArea className="h-full p-6">
                  {leftPanel}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}

          <div className="flex-1" />

          {enableMobileRightSheet && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open right panel</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:w-[400px] p-0">
                <ScrollArea className="h-full p-6">
                  {rightPanel}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Mobile Center Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {centerPanel}
          </ScrollArea>
        </div>
      </div>

      {/* Collapse Toggle Buttons (Desktop only) */}
      {!isLeftCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex absolute top-2 left-2 z-10"
          onClick={() => setIsLeftCollapsed(true)}
          title="Collapse left panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      )}

      {!isRightCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex absolute top-2 right-2 z-10"
          onClick={() => setIsRightCollapsed(true)}
          title="Collapse right panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
