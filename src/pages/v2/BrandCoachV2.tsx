import React, { useState, useRef, useEffect } from 'react';
import { TwoPanelTemplate } from '@/components/templates/TwoPanelTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Brain, Lightbulb, Heart, Shield, MessageSquare, Send, User, Bot, Loader2, Menu, Upload, Settings2, Download, Copy, Check, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { usePersistedSessionForm } from '@/hooks/usePersistedSessionField';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSystemKB } from '@/contexts/SystemKBContext';
import { cn } from '@/lib/utils';

/**
 * BrandCoachV2 Demo Page
 *
 * Demonstrates the TwoPanelTemplate component with:
 * - Chat interface on the left panel
 * - Form fields on the right panel
 * - Responsive layout (stacked on mobile, side-by-side on desktop)
 */

export function BrandCoachV2() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latestDiagnostic } = useDiagnostic();

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
  const { messages, sendMessage, isSending, clearChat } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // System KB state (always enabled)
  const { useSystemKB: isSystemKBEnabled } = useSystemKB();

  // Per-session input storage
  const {
    message,
    setMessage,
    context,
    setContext,
    syncStatus,
    isLoading
  } = usePersistedSessionForm({
    sessionId: currentSessionId,
    category: 'consultant',
    debounceDelay: 1000
  });

  // UI state
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showContextField, setShowContextField] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [userDocuments, setUserDocuments] = useState<unknown[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Form fields for the right panel
  const [brandName, setBrandName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [brandValues, setBrandValues] = useState('');

  // Reset states when switching sessions
  useEffect(() => {
    setHasUserTyped(false);
  }, [currentSessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Auto-close sidebar on session selection
  const handleSessionSelect = (sessionId: string) => {
    switchToSession(sessionId);
    setIsSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const fullMessage = context
      ? `Context: ${context}\n\nQuestion: ${message}`
      : message;

    try {
      await sendMessage(
        fullMessage,
        'user',
        {
          userDocuments,
          useSystemKB: isSystemKBEnabled,
          latestDiagnostic: latestDiagnostic || undefined
        }
      );
      setMessage('');
      setContext('');
      setShowContextField(false);
      setHasUserTyped(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const downloadResponse = () => {
    const allMessages = messages.map(m =>
      `${m.role === 'user' ? 'You' : 'Trevor'}: ${m.content}`
    ).join('\n\n');

    const blob = new Blob([allMessages], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyChat = () => {
    const allMessages = messages.map(m =>
      `${m.role === 'user' ? 'You' : 'Trevor'}: ${m.content}`
    ).join('\n\n');

    navigator.clipboard.writeText(allMessages).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
        description: "The conversation has been copied to your clipboard",
      });
    }).catch(() => {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  const handleClearChat = async () => {
    try {
      await clearChat();
      toast({
        title: "Conversation Cleared",
        description: "Your conversation history has been cleared",
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleSaveContext = () => {
    toast({
      title: 'Context Saved',
      description: 'Your brand context has been saved successfully.',
    });
  };

  const frameworkPillars = [
    {
      icon: Brain,
      title: "Insight-Driven",
      description: "Customer motivations & behavioral science",
      color: "bg-blue-500"
    },
    {
      icon: Lightbulb,
      title: "Distinctive",
      description: "Unique positioning & differentiation",
      color: "bg-yellow-500"
    },
    {
      icon: Heart,
      title: "Empathetic",
      description: "Emotional connection & psychology",
      color: "bg-red-500"
    },
    {
      icon: Shield,
      title: "Authentic",
      description: "Trust-building & genuine narratives",
      color: "bg-green-500"
    }
  ];

  // Left Panel: Chat Interface
  const leftPanel = (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle */}
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <ChatSidebar
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  isLoading={isLoadingSessions}
                  isCreating={isCreating}
                  isRegeneratingTitle={isRegeneratingTitle}
                  onCreateNew={createNewChat}
                  onSelectSession={handleSessionSelect}
                  onRenameSession={renameSession}
                  onDeleteSession={deleteSession}
                  onRegenerateTitle={regenerateTitle}
                />
              </SheetContent>
            </Sheet>

            <MessageSquare className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Brand Coach Chat</h2>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <>
                <Button
                  onClick={handleCopyChat}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                >
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={downloadResponse}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleClearChat}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Welcome to IDEA Brand Coach</h2>
              <p className="text-muted-foreground mb-4">
                Get personalized brand strategy guidance powered by the IDEA framework
                (Insight-Driven, Distinctive, Empathetic, Authentic).
              </p>
              <div className="text-left space-y-2">
                <p className="text-sm font-medium">Example questions:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• How do I position my brand to trigger emotional buying decisions?</li>
                  <li>• What psychological triggers work best for my target demographic?</li>
                  <li>• How can I differentiate from competitors using behavioral science?</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-4 py-2',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.created_at && (
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t p-4">
        {/* Context field (collapsible) */}
        {showContextField && (
          <div className="mb-3">
            <Input
              placeholder="Business context (e.g., E-commerce luxury brand, B2B SaaS)"
              value={context}
              onChange={(e) => {
                setHasUserTyped(true);
                setContext(e.target.value);
              }}
              className="text-sm"
            />
          </div>
        )}

        {/* Main input area */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              placeholder="Ask about your brand strategy..."
              value={message}
              onChange={(e) => {
                setHasUserTyped(true);
                setMessage(e.target.value);
              }}
              onKeyDown={handleKeyPress}
              rows={2}
              className="resize-none pr-24"
            />

            {/* Input actions */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowContextField(!showContextField)}
                title="Add context"
              >
                <Settings2 className="h-4 w-4" />
              </Button>

              <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Upload documents"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Documents</DialogTitle>
                  </DialogHeader>
                  <DocumentUpload onDocumentsChange={setUserDocuments} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
            size="lg"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Sync status */}
        {hasUserTyped && syncStatus && syncStatus !== 'synced' && !isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            {syncStatus === 'syncing' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving draft...</span>
              </>
            )}
            {syncStatus === 'offline' && (
              <>
                <span className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span>Offline - draft saved locally</span>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <span className="w-3 h-3 bg-red-500 rounded-full" />
                <span>Error saving draft</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Right Panel: Brand Context Form + IDEA Framework
  const rightPanel = (
    <div className="flex flex-col h-full bg-background p-6 space-y-6 overflow-y-auto">
      {/* IDEA Framework */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            IDEA Framework
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {frameworkPillars.map((pillar, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", pillar.color)}>
                <pillar.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{pillar.title}</p>
                <p className="text-xs text-muted-foreground">{pillar.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Brand Context Form */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Brand Name</Label>
            <Input
              id="brand-name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Enter your brand name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-audience">Target Audience</Label>
            <Textarea
              id="target-audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Describe your target audience"
              className="resize-none min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-values">Brand Values</Label>
            <Textarea
              id="brand-values"
              value={brandValues}
              onChange={(e) => setBrandValues(e.target.value)}
              placeholder="What are your core brand values?"
              className="resize-none min-h-[100px]"
            />
          </div>

          <Button onClick={handleSaveContext} className="w-full">
            Save Context
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <TwoPanelTemplate
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      rightPanelTitle="Brand Context"
    />
  );
}
