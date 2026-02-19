import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Bug,
  Sparkles,
  ChevronDown,
  FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBetaMode } from "@/hooks/useBetaMode";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface BetaFeedbackWidgetProps {
  /** Position of the widget */
  position?: "bottom-right" | "bottom-left";
}

export function BetaFeedbackWidget({
  position = "bottom-left",
}: BetaFeedbackWidgetProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { betaProgress, addComment } = useBetaMode();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"general" | "bug" | "idea">("general");
  const [feedbackText, setFeedbackText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if beta feedback widget is enabled
  const isBetaFeedbackEnabled = import.meta.env.VITE_ENABLE_BETA_FEEDBACK === 'true' ||
                                 import.meta.env.VITE_DEPLOYMENT_PHASE === 'P0';

  // Don't show if beta feedback is disabled
  if (!isBetaFeedbackEnabled) {
    return null;
  }

  // Don't show on beta pages themselves
  if (location.pathname.startsWith('/beta')) {
    return null;
  }

  // Only show for logged-in users
  if (!user) {
    return null;
  }

  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || isSending) return;

    setIsSending(true);
    const feedbackWithType = `[${feedbackType.toUpperCase()}] ${feedbackText}`;

    try {
      // Save the feedback with page context
      await addComment(
        `${location.pathname}-widget`,
        feedbackWithType
      );

      // Also save to database for persistence
      const { error } = await supabase.functions.invoke('save-beta-feedback', {
        body: {
          quickFeedback: feedbackWithType,
          pageUrl: location.pathname,
          feedbackType,
          userId: user.id,
          timestamp: new Date().toISOString()
        }
      });

      if (error) throw error;

      toast({
        title: "Feedback sent! 🎉",
        description: "Thank you for helping us improve.",
      });

      // Reset form
      setFeedbackText("");
      setFeedbackType("general");

      // Minimize after sending
      setTimeout(() => setIsMinimized(true), 1500);

    } catch (error) {
      console.error('Error sending feedback:', error);
      toast({
        title: "Error",
        description: "Failed to send feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendFeedback();
    }
  };

  // Collapsed state - just a beta badge button
  if (!isExpanded) {
    return (
      <div className={cn(
        "fixed z-[55] animate-fade-in",
        position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
      )}>
        <Button
          onClick={() => setIsExpanded(true)}
          className="rounded-full shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
          size="sm"
        >
          <FlaskConical className="w-4 h-4 mr-2" />
          Beta Feedback
        </Button>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      </div>
    );
  }

  // Minimized state - just header bar
  if (isMinimized) {
    return (
      <div className={cn(
        "fixed z-[55] animate-fade-in",
        position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
      )}>
        <Card className="shadow-xl w-[320px]">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setIsMinimized(false)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <FlaskConical className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-sm">Beta Feedback</CardTitle>
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </div>
              <div className="flex items-center gap-1">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                    setIsMinimized(false);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Expanded state - full feedback interface
  return (
    <div className={cn(
      "fixed z-[55] animate-fade-in",
      position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
    )}>
      <Card className="shadow-xl w-[380px]">
        {/* Header */}
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Beta Feedback</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Quick feedback on {location.pathname}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-7 w-7 p-0"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-7 w-7 p-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Feedback Type Selector */}
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant={feedbackType === "general" ? "default" : "outline"}
              onClick={() => setFeedbackType("general")}
              className="flex-1"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              General
            </Button>
            <Button
              size="sm"
              variant={feedbackType === "bug" ? "default" : "outline"}
              onClick={() => setFeedbackType("bug")}
              className="flex-1"
            >
              <Bug className="w-3 h-3 mr-1" />
              Bug
            </Button>
            <Button
              size="sm"
              variant={feedbackType === "idea" ? "default" : "outline"}
              onClick={() => setFeedbackType("idea")}
              className="flex-1"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Idea
            </Button>
          </div>

          {/* Feedback Input */}
          <div className="space-y-3">
            <Textarea
              placeholder={
                feedbackType === "bug"
                  ? "Describe the issue you encountered..."
                  : feedbackType === "idea"
                  ? "Share your idea or suggestion..."
                  : "Share your feedback about this page..."
              }
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px] max-h-[150px] text-sm resize-none"
              rows={3}
            />

            <div className="flex items-center justify-between">
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/beta-journey')}
                className="text-xs p-0"
              >
                Full Beta Journey →
              </Button>

              <Button
                onClick={handleSendFeedback}
                disabled={!feedbackText.trim() || isSending}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Helper Text */}
          <div className="mt-3 p-2 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground">
              💡 Your feedback helps us improve! This widget will be removed after beta.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}