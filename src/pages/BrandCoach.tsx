import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, Lightbulb, Heart, Shield, MessageSquare, Loader2, Sparkles, Download, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useChat } from '@/hooks/useChat';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useAuth } from '@/hooks/useAuth';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useNavigate } from 'react-router-dom';

const BrandCoach = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, sendMessage, isLoading, clearChat } = useChat();
  const { latestDiagnostic } = useDiagnostic();
  const [message, setMessage] = useState('');
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to access the Brand Coach",
        variant: "destructive",
      });
      navigate('/auth');
    }
  }, [user, navigate, toast]);

  // Generate diagnostic-based suggested prompts
  useEffect(() => {
    if (latestDiagnostic && messages.length === 0) {
      const suggestions: string[] = [];
      const scores = latestDiagnostic.scores;

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

      if (suggestions.length === 0) {
        suggestions.push("How can I maintain my strong brand performance?");
        suggestions.push("What are the next steps to elevate my brand?");
      }

      setFollowUpSuggestions(suggestions.slice(0, 3));
    }
  }, [latestDiagnostic, messages.length]);

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter your question",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendMessage({
        role: 'user',
        content: message.trim()
      });
      setMessage('');
      
      toast({
        title: "Response Received",
        description: "Your Brand Coach has responded",
      });
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Chat Failed",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
  };

  const handleClearChat = async () => {
    try {
      await clearChat();
      toast({
        title: "Chat Cleared",
        description: "Your conversation history has been cleared",
      });
    } catch (error) {
      console.error('Clear chat error:', error);
      toast({
        title: "Error",
        description: "Failed to clear chat history",
        variant: "destructive",
      });
    }
  };

  const handleDownloadChat = () => {
    const chatText = messages.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'Brand Coach';
      return `${role}:\n${msg.content}\n`;
    }).join('\n---\n\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-coach-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: "Your conversation has been downloaded",
    });
  };

  const handleCopyChat = async () => {
    const chatText = messages.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'Brand Coach';
      return `${role}:\n${msg.content}`;
    }).join('\n\n---\n\n');

    try {
      await navigator.clipboard.writeText(chatText);
      setIsCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "Your conversation has been copied",
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

  const ideaCategories = [
    { icon: <Lightbulb className="w-5 h-5" />, label: 'Insight', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300' },
    { icon: <Star className="w-5 h-5" />, label: 'Distinctive', color: 'bg-green-500/10 text-green-700 dark:text-green-300' },
    { icon: <Heart className="w-5 h-5" />, label: 'Empathetic', color: 'bg-pink-500/10 text-pink-700 dark:text-pink-300' },
    { icon: <Shield className="w-5 h-5" />, label: 'Authentic', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' }
  ];

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Brain className="w-10 h-10 text-primary" />
              Brand Coach GPT
            </h1>
            <p className="text-muted-foreground text-lg">
              Your AI-powered strategic brand consultant, trained on the IDEA Framework
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={isLoading}
            >
              Clear Chat
            </Button>
          )}
        </div>

        {/* IDEA Framework Badges */}
        <div className="flex flex-wrap gap-2">
          {ideaCategories.map((category, index) => (
            <Badge key={index} variant="secondary" className={`${category.color} flex items-center gap-2 px-3 py-1.5`}>
              {category.icon}
              {category.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Diagnostic Score Summary */}
      {latestDiagnostic && (
        <Card className="mb-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
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
          </CardContent>
        </Card>
      )}

      {/* Document Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Enhance Context (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUpload />
          <p className="text-sm text-muted-foreground mt-2">
            Upload documents to give your Brand Coach more context about your business
          </p>
        </CardContent>
      </Card>

      {/* Suggested Prompts */}
      {followUpSuggestions.length > 0 && messages.length === 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Suggested Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {followUpSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left h-auto py-2 px-3"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation History */}
      {messages.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Conversation
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyChat}
                  disabled={isLoading}
                  className="gap-2"
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
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadChat}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary/10 ml-8'
                    : 'bg-secondary/50 mr-8'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">
                      {msg.role === 'user' ? 'You' : 'Brand Coach'}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg mr-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Brand Coach is thinking...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Textarea
              placeholder="Ask your Brand Coach anything about strategy, messaging, positioning, or IDEA framework..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="min-h-[120px] resize-none"
              disabled={isLoading}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
              <Button 
                onClick={handleSendMessage} 
                disabled={isLoading || !message.trim()}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Missing import
function Star({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

export default BrandCoach;
