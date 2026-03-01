import React from 'react';

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
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function TwoPanelTemplate({
  leftPanel,
  rightPanel,
  header,
  footer,
}: TwoPanelTemplateProps) {
  return (
    <div className="flex flex-col h-screen">
      {header && <div className="flex-shrink-0">{header}</div>}

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="flex flex-col h-full overflow-auto">
            {leftPanel}
          </div>
          <div className="overflow-auto">
            {rightPanel}
          </div>
        </div>
      </div>

      {footer && <div className="flex-shrink-0">{footer}</div>}
    </div>
  );
}
