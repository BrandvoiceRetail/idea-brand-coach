import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Brain, ChevronRight, RotateCcw, Download } from "lucide-react";

interface Question {
  id: string;
  category: "insight" | "distinctiveness" | "empathy" | "authenticity";
  question: string;
  options: { value: string; label: string; score: number }[];
}

const questions: Question[] = [
  {
    id: "insight1",
    category: "insight",
    question: "How well do you understand what motivates your customers beyond the product features?",
    options: [
      { value: "very-well", label: "Very well - I know their deep emotional drivers", score: 5 },
      { value: "somewhat", label: "Somewhat - I understand basic needs", score: 3 },
      { value: "surface", label: "Surface level - mostly demographics", score: 2 },
      { value: "not-sure", label: "Not sure - I'm guessing most of the time", score: 1 }
    ]
  },
  {
    id: "insight2", 
    category: "insight",
    question: "When customers describe your product, do they focus on emotional benefits or functional features?",
    options: [
      { value: "emotional", label: "Primarily emotional benefits and transformation", score: 5 },
      { value: "mixed", label: "Mix of emotional and functional", score: 3 },
      { value: "functional", label: "Mostly functional features", score: 2 },
      { value: "unsure", label: "I don't have enough customer feedback", score: 1 }
    ]
  },
  {
    id: "distinctiveness1",
    category: "distinctiveness", 
    question: "What makes your brand different from competitors in your customers' minds?",
    options: [
      { value: "unique-story", label: "Unique brand story and emotional positioning", score: 5 },
      { value: "better-quality", label: "Better quality or service", score: 3 },
      { value: "price", label: "Lower price or better value", score: 2 },
      { value: "not-different", label: "Honestly, not much difference", score: 1 }
    ]
  },
  {
    id: "empathy1",
    category: "empathy",
    question: "How well does your messaging address your customers' fears and anxieties?",
    options: [
      { value: "directly", label: "Directly addresses their biggest fears", score: 5 },
      { value: "somewhat", label: "Touches on some concerns", score: 3 },
      { value: "indirectly", label: "Indirectly through benefits", score: 2 },
      { value: "not-at-all", label: "Doesn't really address fears", score: 1 }
    ]
  },
  {
    id: "authenticity1",
    category: "authenticity",
    question: "How genuine and consistent is your brand voice across all touchpoints?",
    options: [
      { value: "very-consistent", label: "Very consistent and genuinely reflects our values", score: 5 },
      { value: "mostly-consistent", label: "Mostly consistent with minor variations", score: 3 },
      { value: "somewhat-varied", label: "Somewhat varied depending on platform", score: 2 },
      { value: "inconsistent", label: "Inconsistent or feels forced", score: 1 }
    ]
  }
];

export default function IdeaDiagnostic() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleAnswer = (questionId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: score }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const resetDiagnostic = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
  };

  const calculateScores = () => {
    const categories = ["insight", "distinctiveness", "empathy", "authenticity"] as const;
    const scores: Record<string, { total: number; count: number; percentage: number }> = {};

    categories.forEach(category => {
      const categoryQuestions = questions.filter(q => q.category === category);
      const categoryAnswers = categoryQuestions
        .map(q => answers[q.id])
        .filter(score => score !== undefined);
      
      const total = categoryAnswers.reduce((sum, score) => sum + score, 0);
      const maxPossible = categoryQuestions.length * 5;
      const percentage = Math.round((total / maxPossible) * 100);
      
      scores[category] = { total, count: categoryAnswers.length, percentage };
    });

    const overall = Math.round(
      Object.values(scores).reduce((sum, cat) => sum + cat.percentage, 0) / categories.length
    );

    return { categories: scores, overall };
  };

  if (showResults) {
    const scores = calculateScores();
    
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-secondary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Your IDEA Brand Score</h1>
          <p className="text-muted-foreground">Complete analysis of your brand's emotional resonance</p>
        </div>

        {/* Overall Score */}
        <Card className="bg-gradient-card shadow-brand">
          <CardContent className="p-8 text-center">
            <div className="text-6xl font-bold text-secondary mb-2">{scores.overall}%</div>
            <p className="text-xl font-semibold mb-2">Overall Brand Health</p>
            <p className="text-muted-foreground">
              {scores.overall >= 80 ? "Excellent brand foundation!" :
               scores.overall >= 60 ? "Good foundation with room for improvement" :
               scores.overall >= 40 ? "Moderate foundation - focus on key areas" :
               "Significant opportunity for brand strengthening"}
            </p>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(scores.categories).map(([category, data]) => (
            <Card key={category} className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="capitalize">{category}</CardTitle>
                <CardDescription>
                  {category === "insight" && "Understanding customer motivations"}
                  {category === "distinctiveness" && "Standing out from competitors"}
                  {category === "empathy" && "Connecting with customer emotions"}
                  {category === "authenticity" && "Genuine and consistent voice"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold">{data.percentage}%</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      data.percentage >= 80 ? "bg-green-100 text-green-800" :
                      data.percentage >= 60 ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {data.percentage >= 80 ? "Strong" :
                       data.percentage >= 60 ? "Moderate" : "Needs Work"}
                    </span>
                  </div>
                  <Progress value={data.percentage} className="h-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Items */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle>Recommended Next Steps</CardTitle>
            <CardDescription>Priority actions to improve your brand health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scores.overall < 60 && (
              <div className="p-4 bg-secondary/10 rounded-lg">
                <h4 className="font-semibold mb-2">🎯 Start with Avatar 2.0 Builder</h4>
                <p className="text-sm text-muted-foreground">
                  Build a deep understanding of your customer's emotional drivers and motivations.
                </p>
              </div>
            )}
            {scores.categories.empathy.percentage < 60 && (
              <div className="p-4 bg-secondary/10 rounded-lg">
                <h4 className="font-semibold mb-2">💝 Improve Emotional Connection</h4>
                <p className="text-sm text-muted-foreground">
                  Use ValueLens to create copy that addresses customer fears and desires.
                </p>
              </div>
            )}
            {scores.categories.distinctiveness.percentage < 60 && (
              <div className="p-4 bg-secondary/10 rounded-lg">
                <h4 className="font-semibold mb-2">⭐ Develop Brand Differentiation</h4>
                <p className="text-sm text-muted-foreground">
                  Create a unique brand story and positioning that sets you apart.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="coach" size="lg">
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
          <Button variant="outline" size="lg" onClick={resetDiagnostic}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Assessment
          </Button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">IDEA Brand Diagnostic</h1>
        <p className="text-muted-foreground">
          Discover your brand's emotional resonance and trust-building potential
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="capitalize text-secondary">
            {currentQ.category}
          </CardTitle>
          <CardDescription className="text-lg font-medium text-foreground">
            {currentQ.question}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={answers[currentQ.id]?.toString()}
            onValueChange={(value) => handleAnswer(currentQ.id, parseInt(value))}
            className="space-y-4"
          >
            {currentQ.options.map((option) => (
              <div key={option.value} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem 
                  value={option.score.toString()} 
                  id={option.value}
                  className="mt-1"
                />
                <Label 
                  htmlFor={option.value} 
                  className="text-sm font-medium leading-relaxed cursor-pointer flex-1"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
        >
          Previous
        </Button>
        <Button 
          variant="coach" 
          onClick={nextQuestion}
          disabled={!answers[currentQ.id]}
          className="flex items-center space-x-2"
        >
          <span>{currentQuestion === questions.length - 1 ? "See Results" : "Next Question"}</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}