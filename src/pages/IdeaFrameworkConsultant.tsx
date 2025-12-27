import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Brain, Lightbulb, Heart, Shield, MessageSquare, Loader2, Download, Trash2, PanelLeftClose, PanelLeft, Copy, Check, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ImperativePanelHandle } from 'react-resizable-panels';

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

  // Chat for current session (passing sessionId ensures messages are cached per-session)
  const { messages, sendMessage, isSending, clearChat } = useChat({
    chatbotType: 'idea-framework-consultant',
    sessionId: currentSessionId,
  });

  // Per-session input storage
  const [sessionInputs, setSessionInputs] = useState<Record<string, { message: string; context: string }>>({});
  const [userDocuments, setUserDocuments] = useState<unknown[]>([]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  // Get current session's input values (default to empty strings)
  const currentInputs = currentSessionId ? sessionInputs[currentSessionId] || { message: '', context: '' } : { message: '', context: '' };
  const message = currentInputs.message;
  const context = currentInputs.context;

  // Update input values for current session
  const setMessage = (value: string) => {
    if (!currentSessionId) return;
    setSessionInputs(prev => ({
      ...prev,
      [currentSessionId]: { ...prev[currentSessionId], message: value, context: prev[currentSessionId]?.context || '' }
    }));
  };

  const setContext = (value: string) => {
    if (!currentSessionId) return;
    setSessionInputs(prev => ({
      ...prev,
      [currentSessionId]: { message: prev[currentSessionId]?.message || '', context: value }
    }));
  };

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

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to access the IDEA Framework Consultant",
        variant: "destructive",
      });
      navigate('/auth');
    }
  }, [user, navigate, toast]);

  // Debug helper: Log user ID once on mount
  useEffect(() => {
    if (user) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔑 User ID:', user.id);
      console.log('   (Use this ID for verification scripts)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only log once on mount

  // Generate follow-up suggestions when new assistant message arrives
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        generateFollowUpSuggestions(lastMessage.content);
      }
    }
  }, [messages]);

  // Generate diagnostic-based initial suggestions when no messages yet
  useEffect(() => {
    if (latestDiagnostic && messages.length === 0) {
      const suggestions: string[] = [];
      const scores = latestDiagnostic.scores;

      // Add suggestions based on low scores (areas needing improvement)
      if (scores.insight < 60) {
        suggestions.push("How can I better understand my customers' emotional triggers?");
      }
      if (scores.distinctive < 60) {
        suggestions.push("What makes my brand stand out from competitors?");
      }
      if (scores.empathetic < 60) {
        suggestions.push("How do I build deeper emotional connections with customers?");
      }
      if (scores.authentic < 60) {
        suggestions.push("How can I communicate more authentically as a brand?");
      }

      // If all scores are good, provide growth-focused suggestions
      if (suggestions.length === 0) {
        suggestions.push("How can I maintain my strong brand performance?");
        suggestions.push("What are the next steps to elevate my brand?");
        suggestions.push("How do I scale my brand while keeping it authentic?");
      }

      setInitialSuggestions(suggestions.slice(0, 4));
    }
  }, [latestDiagnostic, messages.length]);

  const handleConsultation = async () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter your question or challenge",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendMessage({
        role: 'user',
        content: message.trim(),
        metadata: { context: context.trim() || undefined }
      });

      toast({
        title: "Consultation Complete",
        description: "Your strategic guidance is ready",
      });
    } catch (error) {
      console.error('Consultation error:', error);
      toast({
        title: "Consultation Failed",
        description: error instanceof Error ? error.message : "Failed to get consultation",
        variant: "destructive",
      });
    }
  };

  const generateFollowUpSuggestions = (response: string) => {
    const suggestions = [];

    // Generate contextual follow-up questions based on response content
    if (response.toLowerCase().includes('positioning')) {
      suggestions.push("How can I test this positioning with my target audience?");
      suggestions.push("What are the risks of this positioning strategy?");
    }

    if (response.toLowerCase().includes('emotion')) {
      suggestions.push("How do I measure emotional impact in my campaigns?");
      suggestions.push("What specific triggers should I avoid?");
    }

    if (response.toLowerCase().includes('brand')) {
      suggestions.push("How do I implement this across different touchpoints?");
      suggestions.push("What metrics should I track to measure success?");
    }

    if (response.toLowerCase().includes('audience')) {
      suggestions.push("How do I expand this to adjacent customer segments?");
      suggestions.push("What research methods can validate these insights?");
    }

    // Always include these generic follow-ups
    suggestions.push("Can you elaborate on the behavioral science behind this?");
    suggestions.push("What are the next steps to implement this strategy?");

    // Randomly select 3-4 suggestions
    const shuffled = suggestions.sort(() => 0.5 - Math.random());
    setFollowUpSuggestions(shuffled.slice(0, 4));
  };

  const handleFollowUpQuestion = (suggestion: string) => {
    setMessage(suggestion);
  };

  const downloadResponse = () => {
    if (messages.length === 0) return;

    const currentDate = new Date().toLocaleDateString();
    const conversationContent = messages
      .map(msg => `${msg.role === 'user' ? 'Q' : 'A'}: ${msg.content}`)
      .join('\n\n');

    const content = `IDEA Framework Consultation - ${currentDate}\n\n${conversationContent}\n\n---\nGenerated by IDEA Framework Consultant\nCreated by Trevor Bradford • IDEA Strategic Brand Framework™`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IDEA-Framework-Consultation-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Complete",
      description: "Your consultation has been downloaded successfully.",
    });
  };

  const handleCopyChat = async () => {
    if (messages.length === 0) return;

    const currentDate = new Date().toLocaleDateString();
    const conversationContent = messages
      .map(msg => `${msg.role === 'user' ? 'Q' : 'A'}: ${msg.content}`)
      .join('\n\n');

    const content = `IDEA Framework Consultation - ${currentDate}\n\n${conversationContent}\n\n---\nGenerated by IDEA Framework Consultant\nCreated by Trevor Bradford • IDEA Strategic Brand Framework™`;

    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "Your consultation has been copied successfully.",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleClearChat = async () => {
    try {
      await clearChat();
      setFollowUpSuggestions([]);
      setMessage('');
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

  const expertiseAreas = [
    "Behavioral Science Integration",
    "Customer Psychology",
    "Brand Positioning",
    "Emotional Triggers",
    "Social Identity Theory",
    "Conversion Optimization",
    "Storytelling Strategy",
    "Market Differentiation"
  ];

  // Get the last assistant message for display
  const lastResponse = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? messages[messages.length - 1].content
    : null;

  // Group messages into conversation pairs for history display
  const conversationHistory = [];
  for (let i = 0; i < messages.length; i += 2) {
    if (messages[i]?.role === 'user' && messages[i + 1]?.role === 'assistant') {
      conversationHistory.push({
        question: messages[i].content,
        answer: messages[i + 1].content,
        timestamp: messages[i].created_at,
      });
    }
  }

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Sidebar */}
        <ResizablePanel
          ref={sidebarPanelRef}
          defaultSize={20}
          minSize={15}
          maxSize={40}
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

        {/* Main Content */}
        <ResizablePanel defaultSize={80} minSize={50}>
          <div className="h-full overflow-auto">
            {/* Sidebar Toggle */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
              >
                {isSidebarCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>

        <div className="p-6">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center space-x-6">
                <img
                  src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png"
                  alt="Trevor Bradford"
                  className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
                />
                <div className="text-left">
                  <h1 className="text-4xl font-bold text-foreground">Trevor Bradford</h1>
                  <p className="text-xl text-foreground">Brand Strategist, E-commerce Expert, Author</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Creator of the IDEA Strategic Brand Framework™
                  </p>
                </div>
              </div>
              <p className="text-lg text-foreground max-w-3xl mx-auto">
                Get personalized strategic guidance powered by behavioral science, customer psychology,
                and proven brand strategy methodology. Consult directly with Trevor Bradford.
              </p>
            </div>

            {/* Framework Overview */}
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-center text-2xl">The IDEA Strategic Brand Framework™</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {frameworkPillars.map((pillar, index) => (
                    <div key={index} className="text-center space-y-3">
                      <div className={`${pillar.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto`}>
                        <pillar.icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="font-semibold text-lg">{pillar.title}</h3>
                      <p className="text-sm text-muted-foreground">{pillar.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Diagnostic Score Summary - Your Brand Profile */}
            {latestDiagnostic && (
              <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Your Brand Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">{latestDiagnostic.scores.overall}</div>
                      <div className="text-sm text-muted-foreground">Overall</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{latestDiagnostic.scores.insight}</div>
                      <div className="text-sm text-muted-foreground">Insight</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{latestDiagnostic.scores.distinctive}</div>
                      <div className="text-sm text-muted-foreground">Distinctive</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{latestDiagnostic.scores.empathetic}</div>
                      <div className="text-sm text-muted-foreground">Empathetic</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{latestDiagnostic.scores.authentic}</div>
                      <div className="text-sm text-muted-foreground">Authentic</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Your consultant uses these scores to provide personalized recommendations
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Initial Suggestions Based on Diagnostic Scores */}
            {initialSuggestions.length > 0 && messages.length === 0 && (
              <Card className="border-dashed border-2 border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    Suggested Questions Based on Your Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {initialSuggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setMessage(suggestion)}
                        className="justify-start h-auto py-3 px-4 text-left whitespace-normal"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expertise Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Specialized Expertise Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {expertiseAreas.map((area, index) => (
                    <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                      {area}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Consultation Interface */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Consult with Trevor Bradford
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="context">Business Context (Optional)</Label>
                    <Input
                      id="context"
                      placeholder="e.g., E-commerce luxury brand, B2B SaaS, etc."
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Your Branding Question or Challenge</Label>
                    <Textarea
                      id="message"
                      placeholder="Describe your branding challenge, target audience question, positioning dilemma, or strategic need..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleConsultation();
                        }
                      }}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Press Enter to send, Shift+Enter for new line
                    </p>
                  </div>

                  <Button
                    onClick={handleConsultation}
                    disabled={isSending || !message.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Getting Strategic Guidance...
                      </>
                    ) : (
                      'Get Strategic Guidance'
                    )}
                  </Button>

                  {/* Example Questions */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Example Questions:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• How do I position my brand to trigger emotional buying decisions?</li>
                      <li>• What psychological triggers work best for my target demographic?</li>
                      <li>• How can I differentiate from competitors using behavioral science?</li>
                      <li>• What storytelling approach will resonate with my audience?</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Knowledge Base Area */}
              <div className="lg:col-span-1 space-y-6">
                <DocumentUpload onDocumentsChange={setUserDocuments} />
              </div>
            </div>

            {/* Response Area - Full Width */}
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Trevor's Strategic Guidance</CardTitle>
                  {lastResponse && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleClearChat}
                        variant="outline"
                        size="sm"
                        disabled={!currentSessionId || messages.length === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear Conversation
                      </Button>
                      <Button
                        onClick={handleCopyChat}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Text
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={downloadResponse}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {lastResponse ? (
                  <>
                    <div className="prose prose-sm max-w-none mb-6">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {lastResponse}
                      </div>
                    </div>

                    {/* Continue Conversation Interface */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Continue the Conversation</h4>
                      </div>

                      {/* Follow-up Suggestions */}
                      {followUpSuggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Quick follow-up questions:</p>
                          <div className="grid grid-cols-1 gap-2">
                            {followUpSuggestions.map((suggestion, index) => (
                              <Button
                                key={index}
                                variant="ghost"
                                size="sm"
                                className="justify-start h-auto p-3 text-left whitespace-normal"
                                onClick={() => handleFollowUpQuestion(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Continue Conversation Input */}
                      <div className="space-y-3">
                        <Label htmlFor="follow-up">Ask a follow-up question:</Label>
                        <Textarea
                          id="follow-up"
                          placeholder="Build on this guidance with additional questions..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleConsultation();
                            }
                          }}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Press Enter to send, Shift+Enter for new line
                        </p>
                        <Button
                          onClick={handleConsultation}
                          disabled={isSending || !message.trim()}
                          className="w-full"
                          size="sm"
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Getting Follow-up Guidance...
                            </>
                          ) : (
                            'Continue Conversation'
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Your strategic guidance will appear here</p>
                    <p className="text-sm mt-2">Ask a question to get personalized IDEA Framework insights</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conversation History */}
            {conversationHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Consultation History (Last 10 Exchanges)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {conversationHistory.slice(-10).reverse().map((item, index) => (
                    <div key={index} className="border-l-4 border-primary pl-4 space-y-2">
                      <div className="font-medium text-sm">Q: {item.question}</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{item.answer}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* About Trevor & Personal Consultation */}
            <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-2xl font-semibold mb-4">Want to Work Directly with Trevor?</h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      While this AI consultant provides 24/7 strategic guidance based on Trevor Bradford's methodology,
                      sometimes you need the personal touch of working directly with the creator of the IDEA Strategic
                      Brand Framework™.
                    </p>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      With over 35 years of experience in branding as an agency owner, including 15 years in online retail, Trevor has collaborated with a wide range of clients from nationwide retailers, globally famous brands and emerging entrepreneurs.<br/><br/>

                      Trevor is an industry authority on branding and marketing and has helped hundreds of e-commerce entrepreneurs build trust-first strategies that drive sales conversions and reduce true advertising cost of sale (TACOS).
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        size="lg"
                        onClick={() => window.open('https://calendly.com/trevor-bradford-idea/30min', '_blank')}
                      >
                        Book Personal Consultation
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => window.open('https://www.linkedin.com/in/trevor-bradford-51982b9/', '_blank')}
                      >
                        Connect on LinkedIn
                      </Button>
                    </div>
                  </div>
                  <div className="text-center">
                    <img
                      src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png"
                      alt="Trevor Bradford"
                      className="w-48 h-48 rounded-full object-cover mx-auto border-4 border-primary/20 mb-4"
                    />
                    <h4 className="text-xl font-semibold">Trevor Bradford</h4>
                    <p className="text-muted-foreground">Creator, IDEA Strategic Brand Framework™</p>
                    <p className="text-sm text-muted-foreground mt-2">Behavioral Brand Strategist & Author</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <Card className="bg-gradient-hero text-primary-foreground">
              <CardContent className="p-8 text-center">
                <h3 className="text-xl font-semibold mb-2">Powered by Behavioral Science</h3>
                <p className="mb-4">
                  This AI consultant integrates insights from Cialdini, Kahneman, Lindstrom, Harhut, and other leading behavioral scientists
                </p>
                <p className="text-sm opacity-90">
                  Created by Trevor Bradford • IDEA Strategic Brand Framework™ Creator
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
  );
};

export default IdeaFrameworkConsultant;
