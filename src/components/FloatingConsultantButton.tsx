import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, X } from "lucide-react";
import { Link } from "react-router-dom";

interface FloatingConsultantButtonProps {
  show?: boolean;
  onDismiss?: () => void;
}

export function FloatingConsultantButton({ 
  show = true, 
  onDismiss 
}: FloatingConsultantButtonProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!show || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-secondary/10 to-primary/10 backdrop-blur-sm border border-secondary/20 rounded-lg p-4 shadow-glow max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Need Strategic Guidance?</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Ask the IDEA Framework Consultant for personalized brand strategy advice
        </p>
        <Button variant="secondary" size="sm" className="w-full shadow-glow" asChild>
          <Link to="/idea/consultant">
            <Users className="w-4 h-4 mr-2" />
            Ask AI Consultant
          </Link>
        </Button>
      </div>
    </div>
  );
}