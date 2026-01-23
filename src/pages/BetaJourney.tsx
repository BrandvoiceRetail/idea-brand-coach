import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, ArrowRight, Home, MessageSquare, Timer, FileText } from "lucide-react";
import { useBetaMode } from "@/hooks/useBetaMode";

const quickTestSteps = [
  {
    id: "start-here",
    title: "Start Here",
    description: "Watch introduction videos and get oriented",
    tasks: [
      "Watch the intro video explaining the IDEA framework",
      "Understand the overall workflow",
      "Note if anything is unclear"
    ],
    link: "/start-here",
    estimatedTime: "2-3 mins"
  },
  {
    id: "avatar",
    title: "Avatar 2.0",
    description: "Build your ideal customer persona",
    tasks: [
      "Fill out customer demographics and psychographics",
      "Define pain points and motivations",
      "Test the AI suggestions feature"
    ],
    link: "/avatar",
    estimatedTime: "3-5 mins"
  },
  {
    id: "interactive-insight",
    title: "Interactive Insight",
    description: "Get AI-powered insights based on your Avatar",
    tasks: [
      "Review the insights generated from your Avatar data",
      "Try the 'Get AI Auto Suggestions' feature",
      "Accept or reject AI suggestions"
    ],
    link: "/idea/insight",
    estimatedTime: "2-3 mins"
  },
  {
    id: "brand-canvas",
    title: "Brand Canvas",
    description: "Build your visual brand strategy",
    tasks: [
      "Explore each section of the canvas",
      "Test AI-generated content suggestions",
      "Try exporting/downloading your canvas"
    ],
    link: "/canvas",
    estimatedTime: "3-4 mins"
  },
  {
    id: "brand-coach",
    title: "Brand Coach",
    description: "Chat with the AI brand consultant",
    tasks: [
      "Ask a question about your brand strategy",
      "See if responses reference your Avatar/Canvas data",
      "Test follow-up questions"
    ],
    link: "/idea/consultant",
    estimatedTime: "2-3 mins"
  }
];

const comprehensiveTestSteps = [
  {
    id: "landing",
    title: "Landing Page",
    description: "Review the public-facing landing page",
    tasks: [
      "Review the hero section and value proposition",
      "Check if the messaging is clear and compelling",
      "Test the call-to-action buttons"
    ],
    link: "/welcome",
    estimatedTime: "2 mins"
  },
  {
    id: "diagnostic",
    title: "Free Diagnostic",
    description: "Complete the brand diagnostic assessment",
    tasks: [
      "Answer all 6 diagnostic questions",
      "Note any confusing questions",
      "Check if questions feel relevant"
    ],
    link: "/diagnostic",
    estimatedTime: "3-5 mins"
  },
  {
    id: "diagnostic-results",
    title: "Diagnostic Results",
    description: "Review your diagnostic results and insights",
    tasks: [
      "Review your overall score",
      "Read through each category breakdown",
      "Check if recommendations make sense"
    ],
    link: "/diagnostic/results",
    estimatedTime: "2 mins"
  },
  {
    id: "signup",
    title: "Create Account",
    description: "Sign up to access the full app",
    tasks: [
      "Create a new account or sign in",
      "Note the signup process ease",
      "Check email verification (if required)"
    ],
    link: "/auth",
    estimatedTime: "2 mins"
  },
  ...quickTestSteps,
  {
    id: "journey",
    title: "Journey Page",
    description: "Explore the Strategic Brand Building Journey",
    tasks: [
      "Review the step-by-step journey layout",
      "Check if the flow is intuitive",
      "Note any missing or confusing steps"
    ],
    link: "/journey",
    estimatedTime: "2 mins"
  },
  {
    id: "copy-generator",
    title: "Copy Generator",
    description: "Generate brand copy using AI",
    tasks: [
      "Try generating different types of copy",
      "Test if copy reflects your brand voice",
      "Check quality and relevance of outputs"
    ],
    link: "/copy-generator",
    estimatedTime: "3-4 mins"
  },
  {
    id: "export",
    title: "Export Strategy Document",
    description: "Download your complete brand strategy",
    tasks: [
      "Export your strategy as PDF from Brand Canvas",
      "Review the document for completeness",
      "Check if all your inputs are included"
    ],
    link: "/canvas",
    estimatedTime: "2 mins"
  }
];

export default function BetaJourney() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "quick";
  const { initializeBetaMode, betaProgress, addComment, completeStep, getComments } = useBetaMode();
  const [stepComments, setStepComments] = useState<Record<string, string>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const steps = mode === "quick" ? quickTestSteps : comprehensiveTestSteps;
  const totalTime = mode === "quick" ? "12-18 minutes" : "25-35 minutes";

  // Initialize beta mode when component mounts
  useEffect(() => {
    if (!betaProgress || betaProgress.mode !== mode) {
      initializeBetaMode(mode as 'quick' | 'comprehensive');
    }
  }, [mode, betaProgress, initializeBetaMode]);

  // Listen for localStorage changes to refresh comments in real-time
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'betaProgress') {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Also listen for direct localStorage updates (same tab)
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const completedSteps = betaProgress?.completedSteps || [];
  const progress = (completedSteps.length / steps.length) * 100;

  const handleCommentChange = (stepId: string, comment: string) => {
    setStepComments(prev => ({ ...prev, [stepId]: comment }));
  };

  const handleSaveComment = (stepId: string) => {
    const comment = stepComments[stepId];
    if (comment?.trim()) {
      addComment(stepId, comment.trim());
      setStepComments(prev => ({ ...prev, [stepId]: '' }));
    }
  };

  const markStepComplete = (stepId: string) => {
    completeStep(stepId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4">
            {mode === "quick" ? "Quick Test" : "Comprehensive Test"} • {totalTime}
          </Badge>
          <h1 className="text-3xl font-bold mb-4">
            Beta Testing Journey
          </h1>
          <div className="max-w-md mx-auto">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Progress</span>
              <span>{completedSteps.length} of {steps.length} completed</span>
            </div>
            <Progress value={progress} className="mb-4" />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-8">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = false; // No longer tracking current step, all steps are available
            
            return (
              <Card 
                key={step.id} 
                className={`transition-all ${
                  isCurrent ? 'border-primary shadow-lg' : 
                  isCompleted ? 'border-green-500/50 bg-green-50/50' : 
                  'border-muted'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                          isCurrent ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Timer className="h-4 w-4" />
                      {step.estimatedTime}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {step.tasks.map((task, taskIndex) => (
                      <div key={taskIndex} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>

                  {/* Show existing comments if any */}
                  {getComments(step.id).length > 0 && (
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Your feedback ({getComments(step.id).length}):</span>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {getComments(step.id).map((c, i) => (
                          <p key={i} className="text-sm text-muted-foreground border-b border-border pb-1 last:border-0">
                            {c.comment}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Always show add comment section */}
                  <div className="mb-4 space-y-2">
                    <label className="text-sm font-medium">Add notes about this step:</label>
                    <Textarea
                      placeholder="Any observations, issues, or feedback about this step..."
                      value={stepComments[step.id] || ''}
                      onChange={(e) => handleCommentChange(step.id, e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                    {stepComments[step.id]?.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveComment(step.id)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Save Note
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button asChild>
                      <Link to={step.link}>
                        <Home className="mr-2 h-4 w-4" />
                        Go to Page
                      </Link>
                    </Button>
                    {!isCompleted && (
                      <Button 
                        variant="outline"
                        onClick={() => markStepComplete(step.id)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="outline">
            <Link to="/beta">
              Back to Beta Welcome
            </Link>
          </Button>
          
          {progress === 100 && (
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <Link to="/beta-feedback">
                <MessageSquare className="mr-2 h-4 w-4" />
                Share Your Feedback
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}