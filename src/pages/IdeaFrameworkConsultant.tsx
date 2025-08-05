import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Brain, Lightbulb, Heart, Shield, MessageSquare, Loader2, Download, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useAuth } from '@/hooks/useAuth';

const IdeaFrameworkConsultant = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ question: string; answer: string; timestamp: string }>>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [showContinueConversation, setShowContinueConversation] = useState(false);

  const handleConsultation = async () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter your question or challenge",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Prepare enhanced context with user documents and conversation history
      let enhancedContext = context.trim();
      
      // Add conversation context for continuity
      if (conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-3); // Last 3 exchanges for context
        const historyContext = recentHistory.map(item => 
          `Previous Q: ${item.question}\nPrevious A: ${item.answer}`
        ).join('\n\n');
        
        enhancedContext = enhancedContext 
          ? `${enhancedContext}\n\n### Conversation Context:\n${historyContext}`
          : `### Conversation Context:\n${historyContext}`;
      }
      
      if (userDocuments.length > 0) {
        const documentContent = userDocuments
          .filter(doc => doc.status === 'completed' && doc.extracted_content)
          .map(doc => `### Document: ${doc.filename}\n${doc.extracted_content}`)
          .join('\n\n');
        
        if (documentContent) {
          enhancedContext = enhancedContext 
            ? `${enhancedContext}\n\n### User Knowledge Base:\n${documentContent}`
            : `### User Knowledge Base:\n${documentContent}`;
        }
      }

      const { data, error } = await supabase.functions.invoke('idea-framework-consultant', {
        body: { 
          message: message.trim(),
          context: enhancedContext || undefined
        }
      });

      if (error) throw error;

      const consultationResponse = data?.response || 'No response received';
      setResponse(consultationResponse);
      
      // Add to conversation history with timestamp
      const timestamp = new Date().toISOString();
      setConversationHistory(prev => [...prev, {
        question: message.trim(),
        answer: consultationResponse,
        timestamp
      }]);

      // Generate follow-up suggestions
      generateFollowUpSuggestions(consultationResponse);

      // Clear the message input but keep conversation active
      setMessage('');
      setShowContinueConversation(true);
      
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
    } finally {
      setIsLoading(false);
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

  const startNewConversation = () => {
    setShowContinueConversation(false);
    setFollowUpSuggestions([]);
    setMessage('');
    setResponse(null);
  };

  const downloadResponse = () => {
    if (!response) return;
    
    const currentDate = new Date().toLocaleDateString();
    const content = `IDEA Framework Consultation - ${currentDate}\n\n` +
                   `Question: ${conversationHistory[conversationHistory.length - 1]?.question || 'Current consultation'}\n\n` +
                   `Strategic Guidance:\n${response}\n\n` +
                   `---\nGenerated by IDEA Framework Consultant\nCreated by Trevor Bradford • IDEA Strategic Brand Framework™`;
    
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
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-6">
            <img 
              src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png" 
              alt="Trevor Bradford" 
              className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
            />
            <div className="text-left">
              <h1 className="text-4xl font-bold text-primary">AI Trevor Bradford</h1>
              <p className="text-xl text-muted-foreground">Your AI Strategic Partner</p>
              <p className="text-sm text-muted-foreground mt-1">
                Based on Trevor Bradford's IDEA Strategic Brand Framework™
              </p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Get personalized strategic guidance powered by behavioral science, customer psychology, 
            and proven brand strategy methodology from Trevor Bradford.
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

          {/* Knowledge Base Area */}
          <div className="lg:col-span-1 space-y-6">
            <DocumentUpload onDocumentsChange={setUserDocuments} />
          </div>
        </div>

        {/* Response Area - Full Width */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Strategic Guidance</CardTitle>
              {response && (
                <div className="flex items-center gap-2">
                  {showContinueConversation && (
                    <Button 
                      onClick={startNewConversation}
                      variant="outline" 
                      size="sm"
                    >
                      New Conversation
                    </Button>
                  )}
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
            {response ? (
              <>
                <div className="prose prose-sm max-w-none mb-6">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {response}
                  </div>
                </div>

                {/* Continue Conversation Interface */}
                {showContinueConversation && (
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
                        rows={3}
                      />
                      <Button 
                        onClick={handleConsultation} 
                        disabled={isLoading || !message.trim()}
                        className="w-full"
                        size="sm"
                      >
                        {isLoading ? (
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
                )}
                
                {/* Privacy Notice */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Privacy Notice</p>
                      <p>IDEA Framework Consultant does not save responses. All consultations are private and temporary. Use the download button to save your guidance locally.</p>
                    </div>
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
              <CardTitle>Consultation History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {conversationHistory.slice().reverse().map((item, index) => (
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
                  <strong>Brand Strategist, Ecommerce Expert, Conversion Master, Author</strong><br/>
                  Creator of the IDEA Strategic Brand Framework™<br/><br/>
                  
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
                  src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png" 
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
  );
};

export default IdeaFrameworkConsultant;