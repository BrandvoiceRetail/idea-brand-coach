import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, CheckCircle, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useAuth } from '@/hooks/useAuth';
import { BetaNavigationWidget } from '@/components/BetaNavigationWidget';
import { ROUTES } from '@/config/routes';
import { captureAlphaEvent } from '@/lib/posthogClient';

interface Question {
  id: string;
  question: string;
  category: 'insight' | 'distinctive' | 'empathetic' | 'authentic';
  options: Array<{
    value: string;
    label: string;
    score: number;
  }>;
}

// One inspection question per pillar. The shopper LOOKS at their live listing and
// scores what they actually see (1 = not visible, 5 = unmistakable), so the result
// reflects the listing, not their intentions.
const diagnosticQuestions: Question[] = [
  {
    id: 'hero-headline',
    question: 'Look at your hero image headline and first bullet. Do they describe what the product does — or why the customer needs it right now?',
    category: 'insight',
    options: [
      { value: '1', label: 'Only what it does', score: 1 },
      { value: '2', label: 'Mostly what it does', score: 2 },
      { value: '3', label: 'A bit of both', score: 3 },
      { value: '4', label: 'Mostly why they need it', score: 4 },
      { value: '5', label: 'Clearly why they need it now', score: 5 }
    ]
  },
  {
    id: 'name-removed',
    question: 'Remove your brand name from your listing. Could it belong to any of your top three competitors?',
    category: 'distinctive',
    options: [
      { value: '1', label: 'Yes, it could be any of them', score: 1 },
      { value: '2', label: 'Probably, with small tweaks', score: 2 },
      { value: '3', label: 'Hard to say', score: 3 },
      { value: '4', label: 'Mostly no, it feels like ours', score: 4 },
      { value: '5', label: 'No, it is unmistakably ours', score: 5 }
    ]
  },
  {
    id: 'bullets-aloud',
    question: 'Read your bullet points aloud. Do they describe what the product does — or how the customer feels when they need it?',
    category: 'empathetic',
    options: [
      { value: '1', label: 'Only what it does', score: 1 },
      { value: '2', label: 'Mostly what it does', score: 2 },
      { value: '3', label: 'A bit of both', score: 3 },
      { value: '4', label: 'Mostly how they feel', score: 4 },
      { value: '5', label: 'Clearly how they feel when they need it', score: 5 }
    ]
  },
  {
    id: 'trust-signals',
    question: 'Count the trust signals a first-time visitor sees in your hero image before scrolling or reading a review. How many?',
    category: 'authentic',
    options: [
      { value: '1', label: 'None', score: 1 },
      { value: '2', label: 'One', score: 2 },
      { value: '3', label: 'Two', score: 3 },
      { value: '4', label: 'Three', score: 4 },
      { value: '5', label: 'Four or more', score: 5 }
    ]
  }
];

export default function FreeDiagnostic() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const progress = ((currentQuestion + 1) / diagnosticQuestions.length) * 100;
  const currentQ = diagnosticQuestions[currentQuestion];
  const hasAnswer = answers[currentQ.id];

  // Funnel: first diagnostic question shown
  useEffect(() => {
    captureAlphaEvent('diagnostic_started');
  }, []);

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: value
    }));
  };

  const handleNext = () => {
    if (!hasAnswer) {
      toast({
        title: "Please select an answer",
        description: "Choose the option that best describes your current situation.",
        variant: "destructive"
      });
      return;
    }

    if (currentQuestion < diagnosticQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      completeDiagnostic();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const completeDiagnostic = () => {
    setIsCompleting(true);

    // One question per pillar, so each pillar % is just (answer / 5) * 100.
    const pillarScore = (category: Question['category']): number => {
      const question = diagnosticQuestions.find(q => q.category === category);
      const option = question?.options.find(opt => opt.value === answers[question.id]);
      return option ? Math.round((option.score / 5) * 100) : 0;
    };

    const averageScores = {
      insight: pillarScore('insight'),
      distinctive: pillarScore('distinctive'),
      empathetic: pillarScore('empathetic'),
      authentic: pillarScore('authentic')
    };

    // Overall is the mean of the four pillar percentages.
    const overallScore = Math.round(
      (averageScores.insight + averageScores.distinctive + averageScores.empathetic + averageScores.authentic) / 4
    );

    // Save to localStorage with overallScore inside scores object
    const diagnosticData = {
      answers,
      scores: {
        ...averageScores,
        overall: overallScore  // Move overallScore inside scores for consistency
      },
      completedAt: new Date().toISOString()
    };

    localStorage.setItem('diagnosticData', JSON.stringify(diagnosticData));

    // Funnel: answers submitted, scores computed (scores only — never answers)
    captureAlphaEvent('diagnostic_completed', {
      overall_score: overallScore,
      score_insight: averageScores.insight,
      score_distinctive: averageScores.distinctive,
      score_empathetic: averageScores.empathetic,
      score_authentic: averageScores.authentic,
    });

    // Navigate to results page
    setIsCompleting(false);
    navigate('/diagnostic/results');
  };


  // NOTE: Sync is intentionally NOT done here to avoid a race condition.
  // The DiagnosticResults page handles syncing after reading localStorage.

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-between items-center mb-4">
              <Button
                variant="ghost"
                onClick={() => navigate(ROUTES.HOME_PAGE)}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </Button>
              <div className="flex-1" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Free Trust Gap Diagnostic</h1>
            <p className="text-muted-foreground mb-6">
              Look at your listing as a first-time shopper would. Score what you actually see — not what you intended to show. 1 = not visible · 5 = unmistakable.
            </p>
            <Progress value={progress} className="mb-4" />
            <p className="text-sm text-muted-foreground">
              Question {currentQuestion + 1} of {diagnosticQuestions.length}
            </p>
          </div>

          {/* Question Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">{currentQ.question}</CardTitle>
              <CardDescription>
                Score what you actually see on your listing right now
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={answers[currentQ.id] || ''} 
                onValueChange={handleAnswer}
                className="space-y-4"
              >
                {currentQ.options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label 
                      htmlFor={option.value} 
                      className="flex-1 cursor-pointer p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/50 transition-colors"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={!hasAnswer || isCompleting}
              className="flex items-center gap-2"
            >
              {currentQuestion === diagnosticQuestions.length - 1 ? (
                <>
                  {isCompleting ? 'Analyzing...' : 'Complete Assessment'}
                  <CheckCircle className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Beta Navigation Widget */}
      <BetaNavigationWidget />
    </div>
  );
}