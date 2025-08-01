import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ContextualHelp } from "@/components/ContextualHelp";
import { 
  Search, 
  Brain, 
  Heart, 
  Users, 
  BarChart,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Target
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InsightData {
  buyerIntent: string;
  buyerMotivation: string;
  emotionalTriggers: string[];
  shopperType: string;
  demographics: string;
}

interface InteractiveIdeaFrameworkProps {
  onComplete: (data: InsightData) => void;
}

export function InteractiveIdeaFramework({ onComplete }: InteractiveIdeaFrameworkProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [insights, setInsights] = useState<InsightData>({
    buyerIntent: "",
    buyerMotivation: "",
    emotionalTriggers: [],
    shopperType: "",
    demographics: ""
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const steps = [
    {
      id: "intent",
      title: "Buyer Intent",
      icon: Search,
      color: "from-blue-500 to-blue-600",
      description: "Discover what drives your customers to search and buy",
      prompt: "What problem does your product or service solve? Think about the specific situations when customers actively search for solutions like yours.",
      examples: [
        "Nike: Customers searching for 'performance running shoes' aren't just buying footwear—they're investing in achieving personal fitness goals.",
        "Slack: Users looking for 'team communication tools' are really seeking to eliminate email chaos and improve collaboration."
      ]
    },
    {
      id: "motivation",
      title: "Buyer Motivation",
      icon: Brain,
      color: "from-purple-500 to-purple-600",
      description: "Understand the deeper psychological drivers",
      prompt: "Why do customers really want your solution? What underlying needs, desires, or aspirations drive their decision beyond the functional benefits?",
      examples: [
        "Tesla: Beyond transportation, buyers are motivated by environmental consciousness and tech innovation status.",
        "Peloton: More than fitness equipment, customers are driven by convenience, community, and personal transformation."
      ]
    },
    {
      id: "triggers",
      title: "Emotional Triggers",
      icon: Heart,
      color: "from-pink-500 to-pink-600",
      description: "Identify what emotionally resonates with your audience",
      prompt: "Which emotions does your brand evoke? Consider the 7 core triggers: Hope, Belonging, Validation, Trust, Relief, Aspiration, Empowerment.",
      examples: [
        "Dove: Triggers validation and belonging by celebrating real beauty and self-acceptance.",
        "Apple: Evokes aspiration and empowerment through innovation and creative self-expression."
      ]
    },
    {
      id: "shopper",
      title: "Shopper Type",
      icon: Users,
      color: "from-green-500 to-green-600",
      description: "Categorize your primary customer behavior",
      prompt: "Based on Shopify's research, which shopper type best describes your main customers?",
      examples: [
        "Cost Sensitive (50%): Price-focused, seeks deals and value",
        "Quality Focused (39%): Prioritizes quality over price",
        "Conscious (9%): Values sustainability and ethics",
        "Connected (2%): Influenced by social commerce and community"
      ]
    },
    {
      id: "demographics",
      title: "Relevant Demographics",
      icon: BarChart,
      color: "from-orange-500 to-orange-600",
      description: "Identify behavior-driven characteristics that matter",
      prompt: "What demographic patterns correlate with your customers' behaviors? Focus on traits that actually influence their purchasing decisions.",
      examples: [
        "Spotify: Age matters less than music consumption habits and discovery preferences.",
        "LinkedIn: Job level and industry are more relevant than traditional age/income demographics."
      ]
    }
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const generateAIGuidance = async (stepId: string, userInput: string) => {
    if (!userInput.trim()) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insight-guidance', {
        body: { 
          stepId, 
          userInput, 
          context: `User is working on ${currentStepData.title} step of the IDEA framework` 
        }
      });

      if (error) throw error;

      toast({
        title: "AI Guidance Generated",
        description: "Check the suggestions below to improve your insights.",
      });

      return data.guidance;
    } catch (error) {
      console.error('Error generating AI guidance:', error);
      toast({
        title: "AI Guidance Unavailable",
        description: "Continue with your current input. AI assistance will be available shortly.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputChange = (value: string) => {
    const key = currentStepData.id === "triggers" ? "emotionalTriggers" : 
                 currentStepData.id === "intent" ? "buyerIntent" :
                 currentStepData.id === "motivation" ? "buyerMotivation" :
                 currentStepData.id === "shopper" ? "shopperType" : "demographics";
    
    setInsights(prev => ({
      ...prev,
      [key]: key === "emotionalTriggers" ? value.split(",").map(t => t.trim()) : value
    }));
  };

  const getCurrentValue = () => {
    const key = currentStepData.id === "triggers" ? "emotionalTriggers" : 
               currentStepData.id === "intent" ? "buyerIntent" :
               currentStepData.id === "motivation" ? "buyerMotivation" :
               currentStepData.id === "shopper" ? "shopperType" : "demographics";
    
    const value = insights[key as keyof InsightData];
    return Array.isArray(value) ? value.join(", ") : value;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(insights);
      toast({
        title: "Framework Complete! 🎉",
        description: "Your IDEA insights have been saved. Ready to build your Avatar 2.0!",
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const Icon = currentStepData.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold">Interactive IDEA Framework</h2>
        </div>
        <Progress value={progress} className="w-full max-w-md mx-auto" />
        <p className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
        </p>
      </div>

      {/* Step Navigation */}
      <div className="flex justify-center space-x-2 overflow-x-auto pb-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <Button
              key={step.id}
              variant={isCurrent ? "default" : isCompleted ? "secondary" : "outline"}
              size="sm"
              className="flex items-center space-x-2 whitespace-nowrap"
              onClick={() => setCurrentStep(index)}
            >
              {isCompleted ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <StepIcon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{step.title}</span>
            </Button>
          );
        })}
      </div>

      {/* Current Step */}
      <Card className="bg-gradient-to-br from-background to-secondary/5 border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${currentStepData.color} rounded-lg flex items-center justify-center`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
              <CardDescription>{currentStepData.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompt */}
          <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
            <p className="font-medium text-primary mb-2">Think About This:</p>
            <p className="text-sm">{currentStepData.prompt}</p>
          </div>

          {/* Examples */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" />
              Real-World Examples
            </h4>
            <div className="grid gap-3">
              {currentStepData.examples.map((example, index) => (
                <div key={index} className="p-3 bg-secondary/10 rounded-lg border">
                  <p className="text-sm text-muted-foreground">{example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold">Your {currentStepData.title}</label>
              <ContextualHelp 
                question={`How do I identify ${currentStepData.title.toLowerCase()} for my brand?`}
                category="idea-framework"
                context={currentStepData.prompt}
              />
            </div>
            <Textarea
              placeholder={`Describe your customers' ${currentStepData.title.toLowerCase()}...`}
              value={getCurrentValue()}
              onChange={(e) => handleInputChange(e.target.value)}
              className="min-h-[120px]"
            />
            
            {getCurrentValue() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateAIGuidance(currentStepData.id, getCurrentValue())}
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Get AI Suggestions
              </Button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={!getCurrentValue().trim()}
              className="flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? "Complete Framework" : "Next Step"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Completion Preview */}
      {currentStep === steps.length - 1 && getCurrentValue().trim() && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Framework Summary
            </CardTitle>
            <CardDescription>Your IDEA insights are ready to power your Avatar 2.0</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Buyer Intent</Badge>
                <Badge variant="secondary">Motivations</Badge>
                <Badge variant="secondary">Emotional Triggers</Badge>
                <Badge variant="secondary">Shopper Type</Badge>
                <Badge variant="secondary">Demographics</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Ready to transform these insights into actionable customer avatars and marketing strategies.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}