import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, X, Send, Loader2, Minimize2, Maximize2, Plus, ExternalLink } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface FloatingChatWidgetProps {
  /** Context about the current page to help the AI */
  pageContext?: string;
  /** Initial message placeholder */
  placeholder?: string;
  /** Position of the widget */
  position?: "bottom-right" | "bottom-left";
  /** Start with a fresh chat instead of continuing previous session */
  startFresh?: boolean;
}

export function FloatingChatWidget({
  pageContext,
  placeholder = "Ask about your brand strategy...",
  position = "bottom-right",
  startFresh = false,
}: FloatingChatWidgetProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullSize, setIsFullSize] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Session management - shared with /idea/consultant page
  const {
    sessions,
    currentSessionId,
    isCreating,
    createNewChat,
  } = useChatSessions({ chatbotType: 'idea-framework-consultant' });

  // Chat hook - uses same session system as consultant page
  const { messages, sendMessage, isSending } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // Get current session title for display
  const currentSession = sessions?.find(s => s.id === currentSessionId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Track if we've already created a fresh session for this widget instance
  const [freshSessionCreated, setFreshSessionCreated] = useState(false);

  // Create session when expanding - either fresh or continue existing
  useEffect(() => {
    if (isExpanded && user && !isCreating) {
      // If startFresh mode and we haven't created a session yet, always create new
      if (startFresh && !freshSessionCreated) {
        createNewChat();
        setFreshSessionCreated(true);
      } else if (!startFresh && !currentSessionId) {
        // Normal mode: only create if no existing session
        createNewChat();
      }
    }
  }, [isExpanded, currentSessionId, user, createNewChat, isCreating, startFresh, freshSessionCreated]);

  const handleNewChat = async () => {
    await createNewChat();
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isSending || !currentSessionId) return;

    const messageToSend = pageContext
      ? `[Context: User is on ${pageContext}]\n\n${inputMessage}`
      : inputMessage;

    setInputMessage("");

    try {
      await sendMessage({
        content: messageToSend,
        role: 'user',
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed state - just a chat bubble button
  if (!isExpanded) {
    return (
      <div className={cn(
        "fixed z-[60] animate-fade-in",
        position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
      )}>
        <Button
          onClick={() => setIsExpanded(true)}
          className="rounded-full w-14 h-14 shadow-lg bg-gradient-to-br from-secondary to-primary hover:opacity-90"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </Button>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      </div>
    );
  }

  // Expanded state - chat interface
  return (
    <div className={cn(
      "fixed z-[60] animate-fade-in",
      position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6"
    )}>
      <Card className={cn(
        "shadow-xl transition-all duration-200",
        isFullSize ? "w-[500px] h-[600px]" : "w-[380px] h-[450px]"
      )}>
        {/* Header */}
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Brand Coach</CardTitle>
                {currentSession && (
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {currentSession.title || 'New Chat'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                disabled={isCreating}
                className="h-7 w-7 p-0"
                title="New Chat"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 w-7 p-0"
                title="Open Full Page"
              >
                <Link to="/idea/consultant">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullSize(!isFullSize)}
                className="h-7 w-7 p-0"
                title={isFullSize ? "Smaller" : "Larger"}
              >
                {isFullSize ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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

        <CardContent className="p-0 flex flex-col h-[calc(100%-60px)]">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {!user ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <p>Please sign in to chat with the Brand Coach.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Ask me anything about your brand strategy!</p>
                <p className="text-xs mt-1">I have access to your Avatar and Canvas data.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === 'user' ? (
                        // Strip context prefix from user messages for display
                        <p>{msg.content.replace(/^\[Context:.*?\]\n\n/, '')}</p>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          {user && (
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Textarea
                  placeholder={placeholder}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[40px] max-h-[100px] text-sm resize-none"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || isSending || !currentSessionId}
                  size="sm"
                  className="h-10 w-10 p-0"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
