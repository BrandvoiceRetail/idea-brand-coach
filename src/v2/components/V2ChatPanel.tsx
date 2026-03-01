import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { usePanelCommunication } from '@/v2/contexts/PanelCommunicationContext';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

export function V2ChatPanel() {
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
  } = useChatSessions({ chatbotType: 'idea-framework-consultant' });

  // Chat for current session
  const { messages, sendMessage, isSending } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // Panel communication for inter-panel updates
  const { notifyChatContextUpdate, sendMessage: sendPanelMessage } = usePanelCommunication();

  const [inputMessage, setInputMessage] = React.useState('');

  // Extract fields from assistant messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // If it's an assistant message, analyze it for context and field values
      if (lastMessage.role === 'assistant') {
        const content = lastMessage.content.toLowerCase();

        // Notify book panel of context update
        notifyChatContextUpdate(lastMessage.content);

        // Check for IDEA framework concepts and extract field values
        const fieldPatterns = {
          brand_purpose: /brand purpose[:\s]+([^.]+)/i,
          target_audience: /target audience[:\s]+([^.]+)/i,
          core_values: /core values[:\s]+([^.]+)/i,
          brand_promise: /brand promise[:\s]+([^.]+)/i,
          competitive_advantage: /competitive advantage[:\s]+([^.]+)/i,
        };

        const extractedFields: Record<string, string> = {};

        Object.entries(fieldPatterns).forEach(([fieldId, pattern]) => {
          const match = lastMessage.content.match(pattern);
          if (match && match[1]) {
            extractedFields[fieldId] = match[1].trim();
          }
        });

        // If we extracted any fields, notify the fields panel
        if (Object.keys(extractedFields).length > 0) {
          sendPanelMessage({
            type: 'fields_populated',
            sourcePanel: 'center',
            targetPanel: 'left',
            payload: {
              fields: extractedFields,
            },
          });
        }
      }
    }
  }, [messages, notifyChatContextUpdate, sendPanelMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const messageToSend = inputMessage;
    setInputMessage('');

    // Notify book panel about the user's message context
    notifyChatContextUpdate(messageToSend);

    await sendMessage(messageToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex">
      {/* Chat Sidebar */}
      <div className="w-64 border-r h-full">
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={switchToSession}
          onCreateNew={createNewChat}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
          onRegenerateTitle={regenerateTitle}
          isLoading={isLoadingSessions}
          isCreating={isCreating}
          isRegeneratingTitle={isRegeneratingTitle}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ask me anything about your brand strategy, IDEA framework, or get personalized coaching.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about your brand strategy..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] resize-none"
              disabled={isSending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="px-8"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Send'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}