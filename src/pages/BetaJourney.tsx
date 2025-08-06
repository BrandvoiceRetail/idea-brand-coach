import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ArrowRight, Home, MessageSquare, Timer } from "lucide-react";

const quickTestSteps = [
  {
    id: "explore",
    title: "Explore Homepage",
    description: "Browse the homepage and get familiar with the layout",
    tasks: [
      "Notice the hero section and main value proposition",
      "Check the navigation menu",
      "Look for any confusing elements"
    ],
    link: "/",
    estimatedTime: "2 mins"
  },
  {
    id: "diagnostic",
    title: "Take Free Diagnostic",
    description: "Complete the brand diagnostic to see your results",
    tasks: [
      "Click 'Get Your Free Diagnostic'",
      "Answer all questions honestly",
      "Note any confusing questions"
    ],
    link: "/free-diagnostic",
    estimatedTime: "3-5 mins"
  },
  {
    id: "results",
    title: "Review Your Results",
    description: "Examine your diagnostic results and insights",
    tasks: [
      "Review your overall score",
      "Read through each category breakdown",
      "Check if recommendations make sense"
    ],
    link: "/diagnostic-results",
    estimatedTime: "2 mins"
  }
];

const comprehensiveTestSteps = [
  ...quickTestSteps,
  {
    id: "signup",
    title: "Create Account",
    description: "Sign up to access advanced features",
    tasks: [
      "Create a new account or sign in",
      "Note the signup process ease",
      "Check email verification (if required)"
    ],
    link: "/auth",
    estimatedTime: "2 mins"
  },
  {
    id: "dashboard",
    title: "Explore Dashboard",
    description: "Navigate the authenticated user dashboard",
    tasks: [
      "Check the dashboard layout",
      "Explore available tools and modules",
      "Test navigation between sections"
    ],
    link: "/dashboard",
    estimatedTime: "3 mins"
  },
  {
    id: "tools",
    title: "Test Brand Tools",
    description: "Try the brand canvas and avatar builder",
    tasks: [
      "Create a simple brand canvas",
      "Try the avatar builder",
      "Test any other available tools"
    ],
    link: "/brand-canvas",
    estimatedTime: "5-7 mins"
  }
];

export default function BetaJourney() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "quick";
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const steps = mode === "quick" ? quickTestSteps : comprehensiveTestSteps;
  const totalTime = mode === "quick" ? "5-10 minutes" : "15-25 minutes";

  const markStepComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId]);
    }
  };

  const progress = (completedSteps.length / steps.length) * 100;

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
            const isCurrent = index === currentStep;
            
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
              <Link to="/beta/feedback">
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