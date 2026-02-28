import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Brain, Lightbulb, Heart, Shield, MessageSquare, Loader2, Download, Trash2, PanelLeft, Copy, Check, ChevronDown, ChevronUp, Menu, Upload, Settings2, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { usePersistedSessionForm } from '@/hooks/usePersistedSessionField';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { ImageUpload } from '@/components/chat/ImageUpload';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSystemKB } from '@/contexts/SystemKBContext';
import { cn } from '@/lib/utils';
import { ChatImageAttachment } from '@/types/chat';

const IdeaFrameworkConsultant = () => {
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
  const [isFrameworkExpanded, setIsFrameworkExpanded] = useState(true);
  const [showContextField, setShowContextField] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [userDocuments, setUserDocuments] = useState<unknown[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [attachedImages, setAttachedImages] = useState<ChatImageAttachment[]>([]);
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Chat container ref for auto-scrolling
  const chatContainerRef = useRef<HTMLDivElement>(null);

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

  const handleConsultation = async () => {
    if (!message.trim()) return;

    const fullMessage = context
      ? `Context: ${context}\n\nQuestion: ${message}`
      : message;

    try {
      await sendMessage({
        content: fullMessage,
        role: 'user',
        metadata: {
          userDocuments,
          useSystemKB: isSystemKBEnabled,
          latestDiagnostic: latestDiagnostic || undefined,
          images: attachedImages.length > 0 ? attachedImages : undefined
        }
      });
      setMessage('');
      setContext('');
      setShowContextField(false);
      setHasUserTyped(false);
      setAttachedImages([]); // Clear attached images after sending
    } catch (error) {
      console.error('Error sending message:', error);
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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Fixed Header */}
      <div className="flex-none border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
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

            {/* Trevor Branding */}
            <div className="flex items-center gap-3">
              <img
                src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png"
                alt="Trevor Bradford"
                className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
              />
              <div>
                <h1 className="text-lg font-bold">Trevor Bradford • IDEA Framework Consultant</h1>
                <p className="text-xs text-muted-foreground">Brand Strategist, E-commerce Expert, Author</p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
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

        {/* IDEA Framework Bar (Collapsible) */}
        <div className="border-t bg-muted/50">
          <Button
            variant="ghost"
            className="w-full p-2 flex items-center justify-between hover:bg-transparent"
            onClick={() => setIsFrameworkExpanded(!isFrameworkExpanded)}
          >
            <span className="text-sm font-medium">IDEA Strategic Brand Framework™</span>
            {isFrameworkExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {isFrameworkExpanded && (
            <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {frameworkPillars.map((pillar, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", pillar.color)}>
                    <pillar.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pillar.title}</p>
                    <p className="text-xs text-muted-foreground truncate hidden sm:block">{pillar.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Welcome to IDEA Framework Consultation</h2>
                <p className="text-muted-foreground mb-4">
                  Get personalized strategic guidance powered by behavioral science, customer psychology,
                  and proven brand strategy methodology.
                </p>
                <div className="text-left space-y-2">
                  <p className="text-sm font-medium">Example questions:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• How do I position my brand to trigger emotional buying decisions?</li>
                    <li>• What psychological triggers work best for my target demographic?</li>
                    <li>• How can I differentiate from competitors using behavioral science?</li>
                    <li>• What storytelling approach will resonate with my audience?</li>
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
                    "flex gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <img
                      src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png"
                      alt="Trevor"
                      className="w-8 h-8 rounded-full object-cover flex-none"
                    />
                  )}
                  <div className={cn(
                    "max-w-[70%] rounded-lg p-4",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                    {/* Display attached images */}
                    {msg.metadata?.images && msg.metadata.images.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {msg.metadata.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="rounded overflow-hidden border">
                            <img
                              src={image.url}
                              alt={image.filename}
                              className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(image.url, '_blank')}
                              title="Click to view full size"
                            />
                            <p className="text-xs p-1 bg-background/10 truncate">
                              {image.filename}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.created_at && (
                      <p className="text-xs mt-2 opacity-70">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex gap-3">
                  <img
                    src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png"
                    alt="Trevor"
                    className="w-8 h-8 rounded-full object-cover flex-none"
                  />
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Trevor is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Fixed Input Area */}
        <div className="flex-none border-t bg-background p-4">
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
                placeholder="Ask Trevor about your branding challenge..."
                value={message}
                onChange={(e) => {
                  setHasUserTyped(true);
                  setMessage(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleConsultation();
                  }
                }}
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

                <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 relative"
                      title="Attach images"
                    >
                      <Image className="h-4 w-4" />
                      {attachedImages.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {attachedImages.length}
                        </span>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Attach Images</DialogTitle>
                    </DialogHeader>
                    <ImageUpload onImagesChange={setAttachedImages} />
                  </DialogContent>
                </Dialog>

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
              onClick={handleConsultation}
              disabled={isSending || !message.trim()}
              size="lg"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
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
    </div>
  );
};

export default IdeaFrameworkConsultant;