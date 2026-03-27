import * as React from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useDeviceType } from "@/hooks/useDeviceType"
import { cn } from "@/lib/utils"

interface TwoPanelTemplateProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  rightPanelTitle?: string
  leftPanelDefaultSize?: number
  rightPanelDefaultSize?: number
  className?: string
  /** Control mobile sheet open state externally */
  mobileSheetOpen?: boolean
  /** Callback when mobile sheet open state changes */
  onMobileSheetOpenChange?: (open: boolean) => void
  /** Title for the mobile sheet */
  mobileSheetTitle?: string
  /** Whether the left panel is collapsed (desktop only) */
  isLeftCollapsed?: boolean
  /** Callback to toggle left panel collapse */
  onToggleLeftCollapse?: () => void
}

/**
 * TwoPanelTemplate - A responsive two-panel layout with resizable panels
 *
 * Desktop: Displays left and right panels side-by-side with a resizable divider
 * Mobile: Right panel is primary; left panel accessible via Sheet overlay
 */
export function TwoPanelTemplate({
  leftPanel,
  rightPanel,
  rightPanelTitle,
  leftPanelDefaultSize = 31,
  rightPanelDefaultSize = 69,
  className,
  mobileSheetOpen,
  onMobileSheetOpenChange,
  mobileSheetTitle = "Brand Chapters",
  isLeftCollapsed = false,
  onToggleLeftCollapse,
}: TwoPanelTemplateProps): JSX.Element {
  const { isDesktop } = useDeviceType()

  return (
    <div className={cn("flex-1 overflow-hidden relative", className)}>
      {/* Desktop: Resizable two-panel layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        {/* Left Panel */}
        {!isLeftCollapsed && (
          <ResizablePanel
            defaultSize={leftPanelDefaultSize}
            minSize={25}
            maxSize={38}
            className="hidden lg:block"
          >
            <div className="h-full overflow-y-auto">
              {leftPanel}
            </div>
          </ResizablePanel>
        )}

        {/* Resizable Handle with collapse toggle (Desktop only) */}
        {!isLeftCollapsed && (
          <ResizableHandle withHandle className="hidden lg:flex" />
        )}

        {/* Right Panel */}
        <ResizablePanel
          defaultSize={isLeftCollapsed ? 100 : rightPanelDefaultSize}
          minSize={50}
        >
          <div className="flex flex-col h-full">
            {/* Collapse toggle button (desktop only, shown when left panel is collapsed) */}
            {isLeftCollapsed && onToggleLeftCollapse && (
              <div className="hidden lg:flex items-center flex-shrink-0 border-b px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleLeftCollapse}
                  title="Expand left panel"
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Optional Title Header */}
            {rightPanelTitle && (
              <div className="flex-shrink-0 border-b px-4 py-3">
                <h2 className="font-semibold text-lg">{rightPanelTitle}</h2>
              </div>
            )}

            {/* Right Panel Content */}
            <div className="flex-1 overflow-hidden">
              {rightPanel}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Collapse toggle overlaid on resizable handle (desktop, when expanded) */}
      {!isLeftCollapsed && onToggleLeftCollapse && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleLeftCollapse}
          title="Collapse left panel"
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background border shadow-sm"
          style={{ left: `calc(${leftPanelDefaultSize}% - 16px)` }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile + Tablet: Left panel accessible via Sheet overlay */}
      {!isDesktop && (
        <Sheet open={mobileSheetOpen} onOpenChange={onMobileSheetOpenChange}>
          <SheetContent side="left" className="w-[85vw] max-w-md p-0 overflow-y-auto">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle>{mobileSheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              {leftPanel}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
