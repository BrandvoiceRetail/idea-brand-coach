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
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    if (storageKey) {
      // Check if user has visited before
      const hasVisited = localStorage.getItem(`${storageKey}_visited`);
      if (hasVisited) {
        setIsReturningUser(true);
        // Get their preference
        const preference = localStorage.getItem(`${storageKey}_expanded`);
        setIsExpanded(preference === 'true');
      } else {
        // First time visitor - show expanded
        setIsExpanded(true);
        localStorage.setItem(`${storageKey}_visited`, 'true');
      }
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
          !isExpanded && isReturningUser 
            ? `line-clamp-${maxLines}` 
            : ''
        }`}
      >
        {children}
      </div>
      
      {isReturningUser && (
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
      )}
    </div>
  );
}