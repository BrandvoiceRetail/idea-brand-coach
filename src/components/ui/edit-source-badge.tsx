import * as React from "react"
import { Edit, Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EditSource } from "@/types/field-metadata"

export interface EditSourceBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  source: EditSource;
}

/**
 * EditSourceBadge Component
 * Displays a visual indicator showing whether a field was manually edited or AI-generated
 * - Manual edits: Shows ✏️ icon with blue styling
 * - AI edits: Shows 🤖 icon with purple styling
 */
function EditSourceBadge({ source, className, ...props }: EditSourceBadgeProps): JSX.Element {
  const isManual = source === 'manual';

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        isManual
          ? "text-blue-600 border-blue-600 bg-blue-50"
          : "text-purple-600 border-purple-600 bg-purple-50",
        className
      )}
      {...props}
    >
      {isManual ? (
        <>
          <Edit className="w-3 h-3" />
          <span>Manual</span>
        </>
      ) : (
        <>
          <Bot className="w-3 h-3" />
          <span>AI</span>
        </>
      )}
    </Badge>
  );
}

export { EditSourceBadge }
