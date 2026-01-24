/**
 * ConversationHistory
 * A page to view all chat conversations - both field-level and general Brand Coach chats
 * Includes ability to continue conversations directly from this page
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Clock, ChevronRight, Loader2, Send, ExternalLink, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatSession, ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '@/hooks/useChat';

export default function ConversationHistory() {
  const { chatService } = useServices();
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all sessions
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['chat', 'sessions', 'idea-framework-consultant'],
    queryFn: () => chatService.getSessions(),
  });

  // Chat hook for messages and sending - this handles both fetching and updating messages
  const { messages, sendMessage, isSending, isLoading: isLoadingMessages, useSystemKB, toggleSystemKB } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: selectedSession?.id,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Separate sessions by type
  const fieldSessions = sessions.filter(s => s.conversation_type === 'field');
  const generalSessions = sessions.filter(s => s.conversation_type !== 'field');

  // Group field sessions by page context
  const groupedFieldSessions = fieldSessions.reduce((acc, session) => {
    const page = session.page_context || 'Other';
    if (!acc[page]) acc[page] = [];
    acc[page].push(session);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const getPageLabel = (path: string): string => {
    const labels: Record<string, string> = {
      '/avatar': 'Avatar Builder',
      '/canvas': 'Brand Canvas',
      '/idea/insight': 'Interactive Insight',
      '/copy-generator': 'Copy Generator',
    };
    return labels[path] || path;
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isSending || !selectedSession) return;

    const message = inputMessage;
    setInputMessage('');

    try {
      await sendMessage({
        content: message,
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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Conversation History</h1>
            <p className="text-muted-foreground">
              Review all your AI conversations in one place
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <CardDescription>
                {sessions.length} total conversations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="w-full justify-start px-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="field">Field Chats</TabsTrigger>
                  <TabsTrigger value="general">Brand Coach</TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[500px]">
                  {/* All Sessions */}
                  <TabsContent value="all" className="m-0">
                    {isLoadingSessions ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No conversations yet</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {sessions.map((session) => (
                          <SessionItem
                            key={session.id}
                            session={session}
                            isSelected={selectedSession?.id === session.id}
                            onClick={() => setSelectedSession(session)}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Field Sessions */}
                  <TabsContent value="field" className="m-0">
                    {Object.entries(groupedFieldSessions).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No field conversations yet</p>
                        <p className="text-xs mt-1">Start by clicking the chat icon next to any field</p>
                      </div>
                    ) : (
                      Object.entries(groupedFieldSessions).map(([page, pageSessions]) => (
                        <div key={page} className="border-b last:border-0">
                          <div className="px-4 py-2 bg-muted/50">
                            <span className="text-sm font-medium">{getPageLabel(page)}</span>
                          </div>
                          <div className="divide-y">
                            {pageSessions.map((session) => (
                              <SessionItem
                                key={session.id}
                                session={session}
                                isSelected={selectedSession?.id === session.id}
                                onClick={() => setSelectedSession(session)}
                                formatDate={formatDate}
                                showFieldBadge
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* General Sessions */}
                  <TabsContent value="general" className="m-0">
                    {generalSessions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No Brand Coach conversations yet</p>
                        <Link to="/idea/consultant" className="text-primary hover:underline text-sm">
                          Start a conversation
                        </Link>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {generalSessions.map((session) => (
                          <SessionItem
                            key={session.id}
                            session={session}
                            isSelected={selectedSession?.id === session.id}
                            onClick={() => setSelectedSession(session)}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Message View */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {selectedSession ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedSession.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatDate(selectedSession.updated_at)}
                        {selectedSession.conversation_type === 'field' && selectedSession.field_label && (
                          <Badge variant="secondary" className="ml-2">
                            {selectedSession.field_label}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={useSystemKB ? "default" : "outline"}
                        size="sm"
                        onClick={toggleSystemKB}
                        className="text-xs"
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        {useSystemKB ? "IDEA KB: ON" : "IDEA KB: OFF"}
                      </Button>
                      {selectedSession.conversation_type !== 'field' && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/idea/consultant">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Continue Chat
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No messages in this conversation</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg, index) => (
                          <MessageBubble key={index} message={msg} />
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

                  {/* Chat Input */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Continue the conversation..."
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
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: ChatSession;
  isSelected: boolean;
  onClick: () => void;
  formatDate: (date: string) => string;
  showFieldBadge?: boolean;
}

function SessionItem({ session, isSelected, onClick, formatDate, showFieldBadge }: SessionItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{session.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDate(session.updated_at)}</span>
          {showFieldBadge && session.field_label && (
            <Badge variant="outline" className="text-xs">
              {session.field_label}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  // Strip context prefix from user messages
  const displayContent = message.role === 'user'
    ? message.content.replace(/^\[Field:.*?\]\n(?:\[Current Value:.*?\]\n)?(?:\[Instructions:.*?\]\n\n)?User: /s, '')
    : message.content;

  return (
    <div
      className={cn(
        'flex',
        message.role === 'user' ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        <div className="whitespace-pre-wrap text-sm">
          {displayContent}
        </div>
        <div className="text-xs opacity-60 mt-1">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
