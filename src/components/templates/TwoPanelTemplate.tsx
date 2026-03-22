import * as React from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
  leftPanelDefaultSize = 35,
  rightPanelDefaultSize = 65,
  className,
  mobileSheetOpen,
  onMobileSheetOpenChange,
  mobileSheetTitle = "Brand Chapters",
}: TwoPanelTemplateProps): JSX.Element {
  const { isMobile } = useDeviceType()

  return (
    <div className={cn("flex-1 overflow-hidden", className)}>
      {/* Desktop: Resizable two-panel layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        {/* Left Panel */}
        <ResizablePanel
          defaultSize={leftPanelDefaultSize}
          minSize={25}
          maxSize={50}
          className="hidden lg:block"
        >
          <div className="h-full overflow-y-auto">
            {leftPanel}
          </div>
        </ResizablePanel>

        {/* Resizable Handle (Desktop only) */}
        <ResizableHandle withHandle className="hidden lg:flex" />

        {/* Right Panel */}
        <ResizablePanel
          defaultSize={rightPanelDefaultSize}
          minSize={50}
        >
          <div className="flex flex-col h-full">
            {/* Optional Title Header */}
            {rightPanelTitle && (
              <div className="flex-shrink-0 border-b px-4 py-3">
                <h2 className="font-semibold text-lg">{rightPanelTitle}</h2>
              </div>
            )}

            {/* Right Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {rightPanel}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Mobile: Left panel accessible via Sheet overlay */}
      {isMobile && (
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
