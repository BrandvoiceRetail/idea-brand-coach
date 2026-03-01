import * as React from "react"
import { History } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EditSourceBadge } from "@/components/ui/edit-source-badge"
import { cn } from "@/lib/utils"
import type { KnowledgeEntry } from "@/lib/knowledge-base/interfaces"

export interface FieldHistoryPopoverProps {
  history: KnowledgeEntry[];
  fieldLabel?: string;
  className?: string;
}

/**
 * FieldHistoryPopover Component
 * Displays the edit history of a field in a popover
 * Shows version history with timestamps, edit sources, and content previews
 */
function FieldHistoryPopover({
  history,
  fieldLabel = "Field",
  className
}: FieldHistoryPopoverProps): JSX.Element {
  const sortedHistory = React.useMemo(() => {
    return [...history].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [history]);

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() !== new Date(date).getFullYear() ? 'numeric' : undefined
    });
  };

  const truncateContent = (content: string, maxLength: number = 60): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          title={`View ${fieldLabel} history`}
        >
          <History className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Edit History</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {fieldLabel} - {history.length} {history.length === 1 ? 'version' : 'versions'}
          </p>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {sortedHistory.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No edit history available
              </div>
            ) : (
              <div className="space-y-2">
                {sortedHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "p-3 rounded-md border transition-colors",
                      entry.isCurrentVersion
                        ? "bg-primary/5 border-primary/20"
                        : "bg-card border-border hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {entry.metadata?.editSource && (
                          <EditSourceBadge source={entry.metadata.editSource} />
                        )}
                        {entry.isCurrentVersion && (
                          <span className="text-xs font-medium text-primary">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.updatedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground break-words">
                      {truncateContent(entry.content)}
                    </p>
                    {entry.version && (
                      <div className="text-xs text-muted-foreground mt-2">
                        v{entry.version}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export { FieldHistoryPopover }
