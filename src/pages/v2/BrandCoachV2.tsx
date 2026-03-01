import React, { useState, useRef, useEffect } from 'react';
import { TwoPanelTemplate } from '@/components/templates/TwoPanelTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Send, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * BrandCoachV2 Demo Page
 *
 * Demonstrates the TwoPanelTemplate component with:
 * - Chat interface on the left panel
 * - Form fields on the right panel
 * - Responsive layout (stacked on mobile, side-by-side on desktop)
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function BrandCoachV2() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your IDEA Brand Coach. I can help you develop your brand strategy using the IDEA framework (Insight-Driven, Distinctive, Empathetic, Authentic). How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Form fields for the right panel
  const [brandName, setBrandName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [brandValues, setBrandValues] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessageInput('');
    setIsSending(true);

    // Simulate AI response (in real implementation, this would call the backend)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'This is a demo response. In the full implementation, I would provide personalized brand coaching based on the IDEA framework and your inputs.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsSending(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveContext = () => {
    toast({
      title: 'Context Saved',
      description: 'Your brand context has been saved successfully.',
    });
  };

  // Left Panel: Chat Interface
  const leftPanel = (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Brand Coach Chat</h2>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {message.role === 'user' && (
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
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your brand strategy..."
            className="resize-none min-h-[60px]"
            disabled={isSending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Right Panel: Brand Context Form
  const rightPanel = (
    <div className="flex flex-col h-full bg-background p-6 space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>IDEA Framework</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong className="text-blue-500">Insight-Driven:</strong>
            <p className="text-muted-foreground">
              Customer motivations & behavioral science
            </p>
          </div>
          <div>
            <strong className="text-yellow-500">Distinctive:</strong>
            <p className="text-muted-foreground">
              Unique positioning & differentiation
            </p>
          </div>
          <div>
            <strong className="text-red-500">Empathetic:</strong>
            <p className="text-muted-foreground">
              Emotional connection & psychology
            </p>
          </div>
          <div>
            <strong className="text-green-500">Authentic:</strong>
            <p className="text-muted-foreground">
              Trust-building & genuine narratives
            </p>
          </div>
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
