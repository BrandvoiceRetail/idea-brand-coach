/**
 * FieldChatModal
 * A modal dialog for field-level AI chat conversations
 * Allows users to interactively refine field values with AI assistance
 * Uses shared ChatSidebar component for consistent UX with consultant page
 */

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Loader2, Send, Check, MessageSquare, PanelLeftClose, PanelLeft } from 'lucide-react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useChat } from '@/hooks/useChat';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImperativePanelHandle } from 'react-resizable-panels';

export interface FieldChatConfig {
  /** Unique identifier for the field (e.g., 'avatar.demographics', 'canvas.brand_promise') */
  fieldId: string;
  /** Human-readable label for the field */
  fieldLabel: string;
  /** Current value of the field (for context) */
  currentValue?: string;
  /** System prompt to prepend for field-specific guidance */
  systemPrompt?: string;
}

interface FieldChatModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Field configuration */
  field: FieldChatConfig;
  /** Callback when user applies a value to the field */
  onApplyValue: (value: string) => void;
}

export function FieldChatModal({
  open,
  onOpenChange,
  field,
  onApplyValue,
}: FieldChatModalProps): JSX.Element {
  const [inputMessage, setInputMessage] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  // Collapse sidebar on mount (since we start with defaultSize > 0 for proper panel behavior)
  useEffect(() => {
    if (open && sidebarPanelRef.current) {
      // Small delay to ensure panel is mounted
      setTimeout(() => {
        sidebarPanelRef.current?.collapse();
      }, 50);
    }
  }, [open]);

  const { toast } = useToast();

  // Session management - filtered to this field only
  const {
    sessions,
    currentSessionId,
    isLoadingSessions,
    isCreating,
    isRegeneratingTitle,
    createNewChat,
    renameSession,
    deleteSession,
    regenerateTitle,
    switchToSession,
  } = useChatSessions({
    chatbotType: 'idea-framework-consultant',
    conversationType: 'field',
    fieldId: field.fieldId,
    fieldLabel: field.fieldLabel,
    autoCreate: false, // Don't auto-create, let user start fresh
  });

  // Chat for current session
  const { messages, sendMessage, isSending } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // Toggle sidebar collapse state
  const toggleSidebar = () => {
    const panel = sidebarPanelRef.current;
    if (panel) {
      if (isSidebarCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  // Apply value and close modal
  const handleApplyValue = (value: string) => {
    onApplyValue(value);
    onOpenChange(false);
    toast({
      title: 'Updated',
      description: `${field.fieldLabel} has been updated.`,
      duration: 2000,
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isSending) return;

    // Build contextual message with field info
    const contextualMessage = buildContextualMessage(inputMessage, field);
    setInputMessage('');

    try {
      // If no session yet, create one first
      if (!currentSessionId) {
        await createNewChat();
      }
      await sendMessage({
        content: contextualMessage,
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

  // Extract final text from assistant message
  const extractFinalText = (content: string): string | null => {
    const finalTextMatch = content.match(/FINAL TEXT:\s*(.+?)(?:\n\n|$)/s);
    if (finalTextMatch) {
      return finalTextMatch[1].trim();
    }
    return null;
  };

  // Get the last assistant message's final text
  const getLastFinalText = (): string | null => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) return null;
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    return extractFinalText(lastMessage.content);
  };

  const lastFinalText = getLastFinalText();

  // Quick prompts for common actions
  const quickPrompts = [
    { label: 'Improve', prompt: `Please improve the current value for ${field.fieldLabel}. Make it more compelling and clear.` },
    { label: 'Shorten', prompt: `Please create a shorter, more concise version of the current ${field.fieldLabel}.` },
    { label: 'Expand', prompt: `Please expand on the current ${field.fieldLabel} with more detail and depth.` },
    { label: 'Generate', prompt: `Please generate a new ${field.fieldLabel} based on my brand strategy and avatar data.` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[650px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">Brand Coach Assistant</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground flex items-center gap-1">
                  Working on: <Badge variant="secondary">{field.fieldLabel}</Badge>
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Show history" : "Hide history"}
            >
              {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Sidebar */}
          <ResizablePanel
            ref={sidebarPanelRef}
            defaultSize={25}
            minSize={15}
            maxSize={35}
            collapsible={true}
            collapsedSize={0}
            onCollapse={() => setIsSidebarCollapsed(true)}
            onExpand={() => setIsSidebarCollapsed(false)}
          >
            <ChatSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              isLoading={isLoadingSessions}
              isCreating={isCreating}
              isRegeneratingTitle={isRegeneratingTitle}
              onCreateNew={createNewChat}
              onSelectSession={switchToSession}
              onRenameSession={renameSession}
              onDeleteSession={deleteSession}
              onRegenerateTitle={regenerateTitle}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main chat area */}
          <ResizablePanel defaultSize={75} minSize={50}>
            <div className="flex flex-col h-full overflow-hidden">
              {/* Current Value Display */}
              {field.currentValue && (
                <div className="px-6 py-3 bg-muted/50 border-b shrink-0">
                  <p className="text-xs text-muted-foreground mb-1">Current value:</p>
                  <p className="text-sm line-clamp-2">{field.currentValue}</p>
                </div>
              )}

              {/* Quick Prompts - only show when no messages */}
              {messages.length === 0 && (
                <div className="px-6 py-2 border-b flex gap-2 flex-wrap shrink-0">
                  {quickPrompts.map((qp) => (
                    <Button
                      key={qp.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInputMessage(qp.prompt);
                        inputRef.current?.focus();
                      }}
                      disabled={isSending}
                    >
                      {qp.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
                {isLoadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Start a conversation about your {field.fieldLabel}.</p>
                    <p className="text-xs mt-1">I have access to your Avatar, Canvas, and brand data.</p>
                    {sessions.length > 0 && (
                      <p className="text-xs mt-2">
                        Click the sidebar icon to view past conversations.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => {
                      const finalText = msg.role === 'assistant' ? extractFinalText(msg.content) : null;
                      // Strip context prefix from display
                      const displayContent = msg.role === 'user'
                        ? msg.content.replace(/^\[Field:.*?\]\n(?:\[Current Value:.*?\]\n)?(?:\[Response Format:[\s\S]*?\]\n)?(?:\[Field Instructions:.*?\]\n\n)?User: /s, '')
                        : msg.content.replace(/FINAL TEXT:\s*.+?(?:\n\n|$)/s, '').trim();

                      return (
                        <div
                          key={index}
                          className={cn(
                            'flex',
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] rounded-lg px-4 py-3',
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            <div className="whitespace-pre-wrap text-sm">
                              {displayContent}
                            </div>

                            {/* Show final text in highlighted box */}
                            {finalText && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <p className="text-xs text-muted-foreground mb-2">Suggested text:</p>
                                <div className="bg-background/50 border rounded p-2 text-sm">
                                  {finalText}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isSending && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="px-6 py-4 border-t space-y-3 shrink-0">
                {/* Update Field button - shown when AI has provided final text */}
                {lastFinalText && (
                  <Button
                    onClick={() => handleApplyValue(lastFinalText)}
                    className="w-full"
                    size="lg"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Update {field.fieldLabel}
                  </Button>
                )}

                <div className="flex gap-2">
                  <Textarea
                    ref={inputRef}
                    placeholder={lastFinalText ? "Ask for changes or refinements..." : `Ask about ${field.fieldLabel}...`}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[50px] max-h-[100px] resize-none"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!inputMessage.trim() || isSending}
                    className="h-auto px-4"
                    variant={lastFinalText ? "outline" : "default"}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Build a contextual message that includes field information
 */
function buildContextualMessage(content: string, field: FieldChatConfig): string {
  const contextParts: string[] = [];

  // Add field context
  contextParts.push(`[Field: ${field.fieldLabel}]`);

  // Add current value if available
  if (field.currentValue) {
    contextParts.push(`[Current Value: ${field.currentValue}]`);
  }

  // Add concise response instructions
  contextParts.push(`[Response Format: Be conversational and helpful. When the user is ready for a final answer, end your response with the exact text to use on a new line after "FINAL TEXT:" - this text will be applied directly to the field. Keep responses concise - 2-3 sentences max for explanations.]`);

  // Add system prompt if provided
  if (field.systemPrompt) {
    contextParts.push(`[Field Instructions: ${field.systemPrompt}]`);
  }

  // Combine context with user message
  return `${contextParts.join('\n')}\n\nUser: ${content}`;
}

/**
 * FieldChatButton
 * A button component to trigger the field chat modal
 */
interface FieldChatButtonProps {
  field: FieldChatConfig;
  onApplyValue: (value: string) => void;
  className?: string;
}

export function FieldChatButton({ field, onApplyValue, className }: FieldChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn('h-8 w-8 p-0', className)}
        title={`Chat about ${field.fieldLabel}`}
      >
        <MessageSquare className="w-4 h-4" />
      </Button>

      <FieldChatModal
        open={isOpen}
        onOpenChange={setIsOpen}
        field={field}
        onApplyValue={onApplyValue}
      />
    </>
  );
}
