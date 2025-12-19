import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VideoPlayer } from "@/components/VideoPlayer";
import { cn } from "@/lib/utils";

interface CollapsibleVideoProps {
  videoId: string;
  platform?: "youtube" | "vimeo";
  hash?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  className?: string;
}

/**
 * CollapsibleVideo component - A collapsible container for video content
 *
 * Features:
 * - Collapsed by default to save space
 * - Optional localStorage persistence for open/closed state
 * - Supports YouTube and Vimeo videos
 * - Accessible with keyboard navigation
 *
 * @param videoId - The video ID from YouTube or Vimeo
 * @param platform - The video platform (defaults to "vimeo")
 * @param hash - Privacy hash for unlisted Vimeo videos
 * @param title - Title displayed in the trigger button
 * @param description - Optional description shown below title
 * @param defaultOpen - Whether the video is expanded by default
 * @param storageKey - Optional key for persisting open/closed state
 * @param className - Additional CSS classes for the container
 */
export function CollapsibleVideo({
  videoId,
  platform = "vimeo",
  hash,
  title,
  description,
  defaultOpen = false,
  storageKey,
  className
}: CollapsibleVideoProps): JSX.Element {
  // Initialize state from localStorage if storageKey provided
  const getInitialState = (): boolean => {
    if (!storageKey) return defaultOpen;
    try {
      const stored = localStorage.getItem(`collapsibleVideo_${storageKey}`);
      return stored !== null ? JSON.parse(stored) : defaultOpen;
    } catch {
      return defaultOpen;
    }
  };

  const [isOpen, setIsOpen] = useState(getInitialState);

  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open);
    if (storageKey) {
      try {
        localStorage.setItem(`collapsibleVideo_${storageKey}`, JSON.stringify(open));
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-secondary/50 hover:bg-secondary/70 rounded-lg transition-colors group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Play className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <div className="pt-4">
          <VideoPlayer
            videoId={videoId}
            platform={platform}
            hash={hash}
            title={title}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
