import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Heart, CheckCircle, BarChart, Target } from "lucide-react";

interface TriggerScore {
  trigger: string;
  score: number;
  description: string;
  examples: string[];
  icon: string;
  color: string;
}

interface EmotionalTriggerAssessmentProps {
  onAssessmentComplete: (results: TriggerScore[]) => void;
}

const emotionalTriggers = [
  {
    name: "Hope",
    icon: "🌟",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    description: "The promise of a better future or positive outcome",
    examples: ["Transformation stories", "Before/after results", "Aspirational content"]
  },
  {
    name: "Belonging",
    icon: "🤝",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    description: "Connection to a community or shared identity",
    examples: ["Community features", "Shared values", "Inclusive messaging"]
  },
  {
    name: "Validation",
    icon: "✅",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    description: "Confirmation of good choices and experiences",
    examples: ["Customer testimonials", "Expert endorsements", "Awards & recognition"]
  },
  {
    name: "Trust",
    icon: "🛡️",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    description: "Confidence in reliability and authenticity",
    examples: ["Transparency", "Guarantees", "Proven track record"]
  },
  {
    name: "Relief",
    icon: "😌",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    description: "Ease from stress, pain, or difficulty",
    examples: ["Problem-solving", "Convenience", "Stress reduction"]
  },
  {
    name: "Aspiration",
    icon: "🚀",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
    description: "Desire for self-improvement and achievement",
    examples: ["Success stories", "Skill development", "Status enhancement"]
  },
  {
    name: "Empowerment",
    icon: "💪",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    description: "Control and confidence in decision-making",
    examples: ["Educational content", "Tool customization", "Self-service options"]
  }
];

const assessmentQuestions = [
  {
    id: "customer-motivation",
    question: "What primarily motivates your customers to seek your product/service?",
    options: [
      { value: "solve-problem", text: "Solve an immediate problem", triggers: ["Relief", "Trust"] },
      { value: "improve-life", text: "Improve their quality of life", triggers: ["Hope", "Aspiration"] },
      { value: "connect-others", text: "Connect with like-minded people", triggers: ["Belonging", "Validation"] },
      { value: "gain-control", text: "Gain more control over their situation", triggers: ["Empowerment", "Trust"] }
    ]
  },
  {
    id: "customer-fears",
    question: "What are your customers' biggest fears or concerns?",
    options: [
      { value: "making-mistakes", text: "Making the wrong choice", triggers: ["Trust", "Validation"] },
      { value: "missing-out", text: "Missing out on opportunities", triggers: ["Hope", "Aspiration"] },
      { value: "being-judged", text: "Being judged by others", triggers: ["Belonging", "Validation"] },
      { value: "losing-control", text: "Losing control of their situation", triggers: ["Empowerment", "Relief"] }
    ]
  },
  {
    id: "success-feeling",
    question: "How do customers want to feel after using your product/service?",
    options: [
      { value: "confident", text: "Confident and empowered", triggers: ["Empowerment", "Validation"] },
      { value: "connected", text: "Connected and understood", triggers: ["Belonging", "Validation"] },
      { value: "accomplished", text: "Accomplished and successful", triggers: ["Aspiration", "Hope"] },
      { value: "secure", text: "Secure and worry-free", triggers: ["Trust", "Relief"] }
    ]
  },
  {
    id: "brand-promise",
    question: "What's the core promise your brand makes to customers?",
    options: [
      { value: "transformation", text: "Personal transformation", triggers: ["Hope", "Aspiration"] },
      { value: "community", text: "Belonging to something special", triggers: ["Belonging", "Validation"] },
      { value: "reliability", text: "Dependable solutions", triggers: ["Trust", "Relief"] },
      { value: "empowerment", text: "Tools for self-improvement", triggers: ["Empowerment", "Aspiration"] }
    ]
  },
  {
    id: "messaging-style",
    question: "Which messaging style resonates most with your audience?",
    options: [
      { value: "inspirational", text: "Inspirational and uplifting", triggers: ["Hope", "Aspiration"] },
      { value: "authentic", text: "Authentic and relatable", triggers: ["Trust", "Belonging"] },
      { value: "supportive", text: "Supportive and understanding", triggers: ["Relief", "Validation"] },
      { value: "empowering", text: "Empowering and action-oriented", triggers: ["Empowerment", "Trust"] }
    ]
  }
];

export function EmotionalTriggerAssessment({ onAssessmentComplete }: EmotionalTriggerAssessmentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState<TriggerScore[]>([]);

  const progress = ((currentQuestion + 1) / assessmentQuestions.length) * 100;

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateResults();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateResults = () => {
    const triggerCounts: Record<string, number> = {};
    
    // Initialize counts
    emotionalTriggers.forEach(trigger => {
      triggerCounts[trigger.name] = 0;
    });

    // Count trigger mentions from answers
    Object.entries(answers).forEach(([questionId, selectedValue]) => {
      const question = assessmentQuestions.find(q => q.id === questionId);
      const option = question?.options.find(opt => opt.value === selectedValue);
      
      option?.triggers.forEach(trigger => {
        triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
      });
    });

    // Calculate scores and create results
    const maxCount = Math.max(...Object.values(triggerCounts));
    const triggerResults: TriggerScore[] = emotionalTriggers.map(trigger => {
      const count = triggerCounts[trigger.name] || 0;
      const score = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
      
      return {
        trigger: trigger.name,
        score,
        description: trigger.description,
        examples: trigger.examples,
        icon: trigger.icon,
        color: trigger.color
      };
    }).sort((a, b) => b.score - a.score);

    setResults(triggerResults);
    setIsComplete(true);
    onAssessmentComplete(triggerResults);
  };

  if (isComplete) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Assessment Complete!
            </CardTitle>
            <CardDescription>
              Your emotional trigger profile has been generated based on your responses
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5" />
              Your Emotional Trigger Profile
            </CardTitle>
            <CardDescription>
              Top emotional triggers for your brand and audience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, index) => (
              <div key={result.trigger} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{result.icon}</span>
                    <h4 className="font-medium">{result.trigger}</h4>
                    <Badge className={result.color}>
                      {index === 0 ? "Primary" : index === 1 ? "Secondary" : index === 2 ? "Supporting" : "Opportunity"}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{result.score}%</span>
                </div>
                <Progress value={result.score} className="h-2" />
                <p className="text-sm text-muted-foreground">{result.description}</p>
                
                {index < 3 && (
                  <div className="mt-2 p-3 bg-secondary/10 rounded-lg">
                    <h5 className="text-xs font-medium mb-1">Implementation Ideas:</h5>
                    <div className="flex flex-wrap gap-1">
                      {result.examples.map((example, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {example}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Actionable Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Primary Focus: {results[0]?.trigger}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Make this emotional trigger central to your messaging and brand experience.
                </p>
                <div className="text-xs text-muted-foreground">
                  <strong>Next steps:</strong> Audit your current content and identify opportunities to strengthen this emotional connection.
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Secondary Support: {results[1]?.trigger}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Use this as a supporting theme in your marketing materials and customer touchpoints.
                </p>
              </div>
              
              <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
                <h4 className="font-medium mb-2">💡 Pro Tip</h4>
                <p className="text-sm">
                  Focus on your top 2-3 emotional triggers rather than trying to appeal to all seven. 
                  Consistent emotional messaging creates stronger brand connections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={() => {
            setCurrentQuestion(0);
            setAnswers({});
            setIsComplete(false);
            setResults([]);
          }}
          variant="outline"
          className="w-full"
        >
          Retake Assessment
        </Button>
      </div>
    );
  }

  const currentQ = assessmentQuestions[currentQuestion];
  const hasAnswer = answers[currentQ.id];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Emotional Trigger Assessment
          </CardTitle>
          <CardDescription>
            Question {currentQuestion + 1} of {assessmentQuestions.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="w-full" />
        </CardContent>
      </Card>

      {/* Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{currentQ.question}</CardTitle>
          <CardDescription>
            Select the option that best describes your customers and brand
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup 
            value={answers[currentQ.id] || ""} 
            onValueChange={(value) => handleAnswer(currentQ.id, value)}
          >
            {currentQ.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-secondary/10 transition-colors">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                  {option.text}
                </Label>
                <div className="flex gap-1">
                  {option.triggers.map((trigger) => (
                    <Badge key={trigger} variant="outline" className="text-xs">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </RadioGroup>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={!hasAnswer}
            >
              {currentQuestion === assessmentQuestions.length - 1 ? "Complete Assessment" : "Next Question"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trigger Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">The 7 Emotional Triggers</CardTitle>
          <CardDescription>
            Understanding what drives customer decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {emotionalTriggers.map((trigger) => (
              <div key={trigger.name} className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span>{trigger.icon}</span>
                  <h4 className="font-medium text-sm">{trigger.name}</h4>
                </div>
                <p className="text-xs text-muted-foreground">{trigger.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}