import * as React from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"

interface TwoPanelTemplateProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  rightPanelTitle?: string
  leftPanelDefaultSize?: number
  rightPanelDefaultSize?: number
  className?: string
}

/**
 * TwoPanelTemplate - A responsive two-panel layout with resizable panels
 *
 * Desktop: Displays left and right panels side-by-side with a resizable divider
 * Mobile: Stacks panels vertically with the right panel as the primary view
 *
 * @param leftPanel - Content for the left panel (typically accordion or navigation)
 * @param rightPanel - Content for the right panel (typically chat or main content)
 * @param rightPanelTitle - Optional title for the right panel
 * @param leftPanelDefaultSize - Default size percentage for left panel (default: 35)
 * @param rightPanelDefaultSize - Default size percentage for right panel (default: 65)
 * @param className - Additional CSS classes for the container
 */
export function TwoPanelTemplate({
  leftPanel,
  rightPanel,
  rightPanelTitle,
  leftPanelDefaultSize = 35,
  rightPanelDefaultSize = 65,
  className,
}: TwoPanelTemplateProps): JSX.Element {
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

      {/* Mobile: Left panel accessible via sheet or bottom nav (to be implemented) */}
      {/* For now, right panel is primary on mobile, left panel hidden */}
      {/* Future: Add Sheet or Drawer for left panel on mobile */}
    </div>
  )
}
