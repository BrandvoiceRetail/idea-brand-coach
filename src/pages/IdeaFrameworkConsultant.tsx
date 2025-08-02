import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Brain, Lightbulb, Heart, Shield, MessageSquare, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const IdeaFrameworkConsultant = () => {
  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{id: number, question: string, answer: string}>>([]);
  const { toast } = useToast();

  const handleConsultation = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter your branding question or challenge.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('idea-framework-consultant', {
        body: { message, context }
      });

      if (error) throw error;

      setResponse(data.response);
      setConversationHistory(prev => [
        ...prev,
        { id: Date.now(), question: message, answer: data.response }
      ]);
      setMessage('');
      setContext('');
    } catch (error) {
      console.error('Error getting consultation:', error);
      toast({
        title: "Consultation failed",
        description: "Failed to get strategic guidance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary">IDEA Framework Consultant</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get strategic guidance powered by behavioral science, customer psychology, and the proven IDEA Strategic Brand Framework™
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
                Strategic Consultation
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
                  rows={4}
                />
              </div>

              <Button 
                onClick={handleConsultation} 
                disabled={isLoading || !message.trim()}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Getting Strategic Guidance...
                  </>
                ) : (
                  'Get IDEA Framework Guidance'
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

          {/* Response Area */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Strategic Guidance</CardTitle>
            </CardHeader>
            <CardContent>
              {response ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {response}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Your strategic guidance will appear here</p>
                  <p className="text-sm mt-2">Ask a question to get personalized IDEA Framework insights</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Consultation History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {conversationHistory.slice().reverse().map((item) => (
                <div key={item.id} className="border-l-4 border-primary pl-4 space-y-2">
                  <div className="font-medium text-sm">Q: {item.question}</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{item.answer}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <Card className="bg-gradient-hero text-primary-foreground">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Powered by Behavioral Science</h3>
            <p className="mb-4">
              This consultant integrates insights from Cialdini, Kahneman, Lindstrom, Harhut, and other leading behavioral scientists
            </p>
            <p className="text-sm opacity-90">
              Created by Trevor Bradford • IDEA Strategic Brand Framework™ Creator
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IdeaFrameworkConsultant;