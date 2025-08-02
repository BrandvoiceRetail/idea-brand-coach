import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Lightbulb, 
  Users, 
  BarChart, 
  TrendingUp, 
  CheckCircle,
  ArrowRight,
  Brain,
  Heart,
  Target,
  Search
} from "lucide-react";

interface Step {
  id: string;
  title: string;
  description: string;
  content: string;
  example: string;
  icon: any;
  color: string;
}

const steps: Step[] = [
  {
    id: "avatar",
    title: "Understand Your Customer Avatar",
    description: "Build a multi-dimensional view of your target audience",
    content: "Use the Avatar 2.0 tool to build a multi-dimensional view of your target audience. While traditional demographic data (age, income, education) is important, Avatar 2.0 digs deeper into your customer's motivations, emotional triggers, and shopping behaviors. This understanding allows you to tailor your brand messaging and positioning to align with their values and needs.",
    example: "A skincare brand targeting Millennials might discover through Avatar 2.0 that their customers are motivated by the desire for healthy, natural products, driven by concerns about sustainability and self-care. This insight allows the brand to position itself not just as a skincare solution, but as part of a larger lifestyle choice aligned with wellness and environmental responsibility.",
    icon: Users,
    color: "from-blue-500 to-blue-600"
  },
  {
    id: "data",
    title: "Leverage Behavioral and Emotional Data",
    description: "Combine qualitative and quantitative insights",
    content: "Brands that succeed with insight-driven strategies often combine qualitative research (such as focus groups or customer interviews) with quantitative data (such as purchasing patterns, website analytics, or social media engagement). This enables them to gather behavioral data (what customers do) alongside emotional data (how customers feel).",
    example: "Netflix combines viewing behavior data (what shows users watch, when they pause, rewind) with emotional preference data (ratings, reviews, genre preferences) to create personalized recommendations that feel emotionally relevant to each user.",
    icon: BarChart,
    color: "from-purple-500 to-purple-600"
  },
  {
    id: "anticipate",
    title: "Anticipate Customer Needs",
    description: "Stay ahead of consumer expectations",
    content: "Brands must anticipate future customer needs, not just react to current ones. This requires tracking shifts in consumer behavior, cultural trends, and technological advancements. By being proactive, brands can introduce solutions before customers even realize they need them. Successful brands don't just respond to current demands; they anticipate future customer needs, staying ahead of consumer expectations.",
    example: "Apple anticipated the need for seamless device integration before customers knew they wanted it. The ecosystem approach (iPhone, iPad, Mac, Apple Watch working together) solved problems customers didn't know they had, creating unprecedented brand loyalty.",
    icon: TrendingUp,
    color: "from-green-500 to-green-600"
  }
];

export function InsightDrivenModule() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepData = steps[currentStep];

  const markStepComplete = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
  };

  const handleNext = () => {
    markStepComplete();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isCurrentStepComplete = completedSteps.has(currentStep);
  const allStepsComplete = completedSteps.size === steps.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Insight Driven Learning Module</h1>
            <p className="text-muted-foreground">The Foundation of Strategic Planning</p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto">
          <p className="text-lg text-muted-foreground leading-relaxed">
            At the heart of the IDEA Strategic Brand Framework™ is the principle that all effective branding starts with a deep, insight-driven understanding of your audience. This goes beyond traditional market research and demographic profiling; it requires a deep dive into the psychographic and emotional insights of your customers.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="text-center space-y-4">
        <Progress value={progress} className="w-full max-w-md mx-auto" />
        <p className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
        </p>
      </div>

      {/* Step Navigation */}
      <div className="flex justify-center space-x-2 overflow-x-auto pb-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = completedSteps.has(index);
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

      {/* Current Step Content */}
      <Card className="bg-gradient-to-br from-background to-secondary/5 border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${currentStepData.color} rounded-lg flex items-center justify-center`}>
              <currentStepData.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
              <CardDescription>{currentStepData.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Content */}
          <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
            <h4 className="font-semibold text-primary mb-3">Key Learning:</h4>
            <p className="text-sm leading-relaxed">{currentStepData.content}</p>
          </div>

          {/* Example */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" />
              Real-World Example
            </h4>
            <div className="p-4 bg-secondary/10 rounded-lg border">
              <p className="text-sm text-muted-foreground leading-relaxed">{currentStepData.example}</p>
            </div>
          </div>

          {/* Action Items */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-800 dark:text-green-400 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Action Steps for Your Brand
            </h4>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
              {currentStepData.id === "avatar" && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Complete your Avatar 2.0 profile using our interactive tool</li>
                  <li>Identify your customers' core motivations and emotional triggers</li>
                  <li>Map their shopping behaviors and decision-making patterns</li>
                </ul>
              )}
              {currentStepData.id === "data" && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Conduct customer interviews or surveys to gather qualitative insights</li>
                  <li>Analyze your website analytics, social media engagement, and sales data</li>
                  <li>Look for patterns between what customers say and what they do</li>
                </ul>
              )}
              {currentStepData.id === "anticipate" && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Monitor industry trends and emerging consumer behaviors</li>
                  <li>Set up Google Alerts for relevant keywords in your industry</li>
                  <li>Follow thought leaders and trendsetters in your market</li>
                </ul>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            
            <div className="flex items-center space-x-2">
              {!isCurrentStepComplete && (
                <Button
                  variant="secondary"
                  onClick={markStepComplete}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Complete
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                disabled={currentStep === steps.length - 1}
                className="flex items-center gap-2"
              >
                Next Step
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Summary */}
      {allStepsComplete && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Module Complete!
            </CardTitle>
            <CardDescription>You've mastered the Insight Driven principles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              You now understand how to build deep customer insights that go beyond demographics. 
              You're ready to create customer avatars that capture the emotional and behavioral drivers 
              behind purchasing decisions.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Customer Psychology</Badge>
              <Badge variant="secondary">Behavioral Data</Badge>
              <Badge variant="secondary">Trend Anticipation</Badge>
              <Badge variant="secondary">Avatar 2.0</Badge>
            </div>
            <div className="flex space-x-3 pt-2">
              <Button asChild className="flex-1">
                <a href="/avatar">
                  <Users className="w-4 h-4 mr-2" />
                  Start Avatar 2.0 Builder
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/idea/distinctiveness">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Next: Distinctive/Different
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}