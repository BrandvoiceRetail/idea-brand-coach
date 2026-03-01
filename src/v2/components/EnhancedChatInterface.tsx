/**
 * EnhancedChatInterface
 * An enhanced chat interface that wraps ChatSidebar and adds field extraction capabilities
 * Enables parsing structured data from AI responses and applying values to fields
 *
 * @example
 * ```tsx
 * <EnhancedChatInterface
 *   chatbotType="idea-framework-consultant"
 *   onFieldExtracted={(field, value) => console.log(`${field}: ${value}`)}
 *   showFieldExtraction
 * />
 * ```
 */

import { useState, useRef, useEffect } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Send,
  Loader2,
  Check,
  Copy,
  Download,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { ChatbotType } from '@/types/chat';
import { cn } from '@/lib/utils';
import { ImperativePanelHandle } from 'react-resizable-panels';

/**
 * Field extraction result from AI message
 */
export interface ExtractedField {
  /** Field identifier (e.g., 'brand_promise', 'target_audience') */
  fieldId: string;
  /** Field label for display */
  label: string;
  /** Extracted value */
  value: string;
}

interface EnhancedChatInterfaceProps {
  /** Type of chatbot to use */
  chatbotType?: ChatbotType;
  /** Whether to show field extraction UI */
  showFieldExtraction?: boolean;
  /** Callback when a field is extracted from AI response */
  onFieldExtracted?: (field: string, value: string) => void;
  /** Callback when user applies an extracted value */
  onApplyField?: (field: string, value: string) => void;
  /** Custom extraction patterns (regex) for identifying fields */
  extractionPatterns?: Record<string, RegExp>;
  /** Additional CSS class */
  className?: string;
}

export function EnhancedChatInterface({
  chatbotType = 'idea-framework-consultant',
  showFieldExtraction = true,
  onFieldExtracted,
  onApplyField,
  extractionPatterns,
  className,
}: EnhancedChatInterfaceProps): JSX.Element {
  const [inputMessage, setInputMessage] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  // Session management
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
    chatbotType,
    autoCreate: true,
  });

  // Chat operations
  const { messages, sendMessage, isSending } = useChat({
    chatbotType,
    sessionId: currentSessionId,
  });

  // Toggle sidebar collapse state
  const toggleSidebar = (): void => {
    const panel = sidebarPanelRef.current;
    if (panel) {
      if (isSidebarCollapsed) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Extract fields from the latest assistant message
  useEffect(() => {
    if (!showFieldExtraction || messages.length === 0) return;

    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    if (assistantMessages.length === 0) return;

    const latestMessage = assistantMessages[assistantMessages.length - 1];
    const fields = extractFieldsFromContent(latestMessage.content, extractionPatterns);

    setExtractedFields(fields);

    // Notify parent of extracted fields
    if (onFieldExtracted && fields.length > 0) {
      fields.forEach((field) => onFieldExtracted(field.fieldId, field.value));
    }
  }, [messages, showFieldExtraction, extractionPatterns, onFieldExtracted]);

  // Handle sending a message
  const handleSend = async (): Promise<void> => {
    if (!inputMessage.trim() || isSending || !currentSessionId) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');

    try {
      await sendMessage({
        content: messageContent,
        role: 'user',
      });
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputMessage(messageContent); // Restore message on error
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Copy field value to clipboard
  const handleCopyField = async (fieldId: string, value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFieldId(fieldId);
      setTimeout(() => setCopiedFieldId(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Apply extracted field
  const handleApplyField = (field: ExtractedField): void => {
    if (onApplyField) {
      onApplyField(field.fieldId, field.value);
    }
  };

  // Export chat history
  const handleExportChat = (): void => {
    const chatText = messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n---\n\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentSessionId || 'export'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar Panel */}
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

        {/* Main Chat Panel */}
        <ResizablePanel defaultSize={75} minSize={50}>
          <div className="flex flex-col h-full">
            {/* Header with controls */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                >
                  {isSidebarCollapsed ? (
                    <PanelLeft className="w-4 h-4" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4" />
                  )}
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Badge variant="secondary">{chatbotType}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportChat}
                disabled={messages.length === 0}
                title="Export chat"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages area */}
            <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">Start a conversation with the Brand Coach.</p>
                  <p className="text-xs mt-2">
                    I have access to your brand data and can help with strategy.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
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
                        <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                      </div>
                    </div>
                  ))}

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

            {/* Extracted Fields Display */}
            {showFieldExtraction && extractedFields.length > 0 && (
              <div className="px-4 py-3 border-t bg-muted/30 shrink-0">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Extracted Fields ({extractedFields.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {extractedFields.map((field) => (
                      <div
                        key={field.fieldId}
                        className="p-2 bg-background rounded border space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                              {field.label}
                            </p>
                            <p className="text-sm mt-1 line-clamp-2">{field.value}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyField(field.fieldId, field.value)}
                              title="Copy value"
                              className="h-7 w-7 p-0"
                            >
                              {copiedFieldId === field.fieldId ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                            {onApplyField && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApplyField(field)}
                                title="Apply value"
                                className="h-7 px-2 text-xs"
                              >
                                Apply
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Input area */}
            <div className="px-4 py-3 border-t shrink-0">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  placeholder="Ask about your brand strategy..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[50px] max-h-[100px] resize-none"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || isSending || !currentSessionId}
                  className="h-auto px-4"
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
    </div>
  );
}

/**
 * Extract structured field data from AI message content
 * Looks for common patterns like "FIELD_NAME: value" or custom patterns
 */
function extractFieldsFromContent(
  content: string,
  customPatterns?: Record<string, RegExp>
): ExtractedField[] {
  const fields: ExtractedField[] = [];

  // Default pattern: FINAL TEXT: value
  const finalTextMatch = content.match(/FINAL TEXT:\s*(.+?)(?:\n\n|$)/s);
  if (finalTextMatch) {
    fields.push({
      fieldId: 'final_text',
      label: 'Final Text',
      value: finalTextMatch[1].trim(),
    });
  }

  // Custom patterns
  if (customPatterns) {
    Object.entries(customPatterns).forEach(([fieldId, pattern]) => {
      const match = content.match(pattern);
      if (match && match[1]) {
        fields.push({
          fieldId,
          label: formatFieldLabel(fieldId),
          value: match[1].trim(),
        });
      }
    });
  }

  // Common field patterns
  const commonPatterns: Record<string, RegExp> = {
    brand_promise: /BRAND PROMISE:\s*(.+?)(?:\n\n|$)/si,
    target_audience: /TARGET AUDIENCE:\s*(.+?)(?:\n\n|$)/si,
    value_proposition: /VALUE PROPOSITION:\s*(.+?)(?:\n\n|$)/si,
    key_message: /KEY MESSAGE:\s*(.+?)(?:\n\n|$)/si,
  };

  Object.entries(commonPatterns).forEach(([fieldId, pattern]) => {
    const match = content.match(pattern);
    if (match && match[1] && !fields.some((f) => f.fieldId === fieldId)) {
      fields.push({
        fieldId,
        label: formatFieldLabel(fieldId),
        value: match[1].trim(),
      });
    }
  });

  return fields;
}

/**
 * Format field ID into human-readable label
 */
function formatFieldLabel(fieldId: string): string {
  return fieldId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
