import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleDescriptionProps {
  children: React.ReactNode;
  maxLines?: number;
  storageKey?: string;
}

export function CollapsibleDescription({ 
  children, 
  maxLines = 3, 
  storageKey 
}: CollapsibleDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (storageKey) {
      // Get user's saved preference
      const preference = localStorage.getItem(`${storageKey}_expanded`);
      setIsExpanded(preference === 'true');
    }
  }, [storageKey]);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    if (storageKey) {
      localStorage.setItem(`${storageKey}_expanded`, newState.toString());
    }
  };

  return (
    <div className="space-y-3">
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          !isExpanded 
            ? 'line-clamp-3' 
            : ''
        }`}
        style={{
          display: !isExpanded ? '-webkit-box' : 'block',
          WebkitLineClamp: !isExpanded ? maxLines : 'none',
          WebkitBoxOrient: 'vertical' as const,
          overflow: !isExpanded ? 'hidden' : 'visible'
        }}
      >
        {children}
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={toggleExpanded}
        className="h-auto p-0 text-primary hover:text-primary/80"
      >
        {isExpanded ? (
          <>
            Show Less <ChevronUp className="w-4 h-4 ml-1" />
          </>
        ) : (
          <>
            Show More <ChevronDown className="w-4 h-4 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}