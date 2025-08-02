import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Lightbulb,
  Eye,
  Target,
  MessageSquare,
  BarChart3,
  Users,
  Bot,
  TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";

interface Step {
  id: number;
  title: string;
  description: string;
  content: string;
  example: string;
  actionSteps: string[];
  icon: React.ReactNode;
  color: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Customer Reviews & Feedback Analysis",
    description: "Uncover emotional drivers through direct customer feedback across multiple platforms",
    content: "Customer reviews reveal direct emotional responses—pain points, desires, and frustrations that traditional research often misses. Think like a detective and gather data from multiple sources to uncover hidden insights about what truly drives customer decisions.",
    example: "Amazon reviews for skincare products often reveal emotional language like 'finally found confidence' or 'frustrated with breakouts.' These insights help brands understand that customers aren't just buying skincare—they're seeking emotional transformation and self-esteem.",
    actionSteps: [
      "Collect reviews from Amazon, Google, Yelp, Facebook, and Reddit",
      "Identify recurring emotional language and pain points",
      "Use AI tools like MonkeyLearn for sentiment analysis at scale",
      "Document unmet needs for product or messaging refinement",
      "Compare competitor reviews to find positioning opportunities"
    ],
    icon: <MessageSquare className="h-6 w-6" />,
    color: "from-blue-500 to-indigo-500"
  },
  {
    id: 2,
    title: "Amazon-Specific Research Methods",
    description: "Leverage Amazon's data ecosystem for deep customer insights and competitive intelligence",
    content: "Amazon provides unfiltered insights into customer expectations, pre-purchase hesitations, and buying behaviors. From reviews to Q&A sections to search data, Amazon is a goldmine for understanding customer psychology and decision-making processes.",
    example: "Analyzing Amazon Q&A sections for fitness equipment reveals customers asking 'Will this work in small apartments?' and 'Is assembly difficult?' This shows emotional concerns about space anxiety and competence fears, not just product specifications.",
    actionSteps: [
      "Analyze Amazon customer reviews for emotional patterns",
      "Study Q&A sections to understand pre-purchase concerns",
      "Track Best Seller Rank trends to identify emotional triggers",
      "Use search term reports to decode customer intent",
      "Apply tools like Helium 10 and ReviewMeta for deeper analysis"
    ],
    icon: <BarChart3 className="h-6 w-6" />,
    color: "from-orange-500 to-red-500"
  },
  {
    id: 3,
    title: "Social Media Listening & UGC",
    description: "Capture authentic emotional reactions through social media conversations and user content",
    content: "Social media conversations reflect authentic, real-time emotional reactions to brands and products. This research reveals how customers naturally describe products in their own words and uncovers emerging emotional trends that competitors may have overlooked.",
    example: "TikTok videos about productivity apps often use phrases like 'finally organized my life' or 'reduced my anxiety.' This emotional language reveals that customers aren't just buying organization tools—they're seeking peace of mind and life control.",
    actionSteps: [
      "Monitor Twitter, Instagram, TikTok, Reddit, and Facebook Groups",
      "Collect influencer and customer video reviews",
      "Identify natural language patterns customers use",
      "Spot emerging emotional trends and frustrations",
      "Use tools like Sprout Social for automated sentiment analysis"
    ],
    icon: <Users className="h-6 w-6" />,
    color: "from-purple-500 to-pink-500"
  },
  {
    id: 4,
    title: "AI-Powered Research & Automation",
    description: "Scale your research efforts using AI tools to process massive amounts of customer data",
    content: "AI tools enable brands to automate research and uncover customer insights at unprecedented scale. From sentiment analysis to trend detection, AI can process massive amounts of data faster and identify patterns that manual research might miss.",
    example: "Using ChatGPT to analyze 10,000 customer service emails reveals that 60% of complaints contain emotional language about 'feeling ignored' rather than technical issues. This insight shifts customer service training from technical skills to empathy and emotional intelligence.",
    actionSteps: [
      "Use Google Trends and Exploding Topics for behavioral shifts",
      "Apply ChatGPT/Claude for customer persona generation",
      "Implement Lexalytics for AI-powered sentiment analysis",
      "Deploy Hotjar for visual customer interaction tracking",
      "Create automated research workflows for continuous insights"
    ],
    icon: <Bot className="h-6 w-6" />,
    color: "from-green-500 to-teal-500"
  }
];

export function ResearchModule() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const progress = (completedSteps.size / steps.length) * 100;

  const markStepComplete = (stepId: number) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const allStepsCompleted = completedSteps.size === steps.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Search className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold">Strategic Brand Research</h1>
        </div>
        <p className="text-lg text-muted-foreground mb-6">
          Uncover customer insights and emotional drivers through comprehensive research methods
        </p>
        <div className="flex items-center justify-center gap-4 mb-6">
          <Progress value={progress} className="w-64" />
          <span className="text-sm font-medium">{Math.round(progress)}% Complete</span>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {steps.map((step, index) => (
          <Button
            key={step.id}
            variant={currentStep === index ? "default" : "outline"}
            onClick={() => setCurrentStep(index)}
            className="flex items-center gap-2"
          >
            {completedSteps.has(step.id) && <CheckCircle className="h-4 w-4" />}
            <span className="hidden sm:inline">Step {step.id}:</span> {step.title}
          </Button>
        ))}
      </div>

      {!allStepsCompleted ? (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-r ${steps[currentStep].color} text-white`}>
                {steps[currentStep].icon}
              </div>
              <div>
                <CardTitle className="text-xl">
                  Step {steps[currentStep].id}: {steps[currentStep].title}
                </CardTitle>
                <CardDescription>{steps[currentStep].description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Key Learning */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Key Learning
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {steps[currentStep].content}
              </p>
            </div>

            {/* Real-World Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-500" />
                Real-World Examples
              </h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm leading-relaxed">{steps[currentStep].example}</p>
              </div>
            </div>

            {/* Action Steps */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                Action Steps
              </h3>
              <ul className="space-y-2">
                {steps[currentStep].actionSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      {index + 1}
                    </div>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Navigation and Completion */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-3">
                {!completedSteps.has(steps[currentStep].id) && (
                  <Button
                    variant="outline"
                    onClick={() => markStepComplete(steps[currentStep].id)}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark Complete
                  </Button>
                )}
                
                <Button
                  onClick={handleNext}
                  disabled={currentStep === steps.length - 1}
                  className="flex items-center gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Completion Summary */
        <Card className="text-center">
          <CardContent className="pt-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Research Module Complete!</h2>
            <p className="text-muted-foreground mb-6">
              You now have comprehensive research methods to uncover customer insights and emotional drivers for your brand strategy.
            </p>
            
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {steps.map(step => (
                <Badge key={step.id} variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {step.title}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild>
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/brand-canvas">Apply to Brand Canvas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}