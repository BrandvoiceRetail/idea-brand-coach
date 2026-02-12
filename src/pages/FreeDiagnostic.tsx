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

const diagnosticQuestions: Question[] = [
  {
    id: 'customer-understanding',
    question: 'How well do you understand your customers\' emotional triggers?',
    category: 'insight',
    options: [
      { value: '1', label: 'I have basic demographic data', score: 1 },
      { value: '2', label: 'I know their pain points', score: 2 },
      { value: '3', label: 'I understand their motivations', score: 3 },
      { value: '4', label: 'I know their emotional triggers', score: 4 },
      { value: '5', label: 'I have deep behavioral insights', score: 5 }
    ]
  },
  {
    id: 'market-position',
    question: 'How distinctive is your brand in the marketplace?',
    category: 'distinctive',
    options: [
      { value: '1', label: 'We blend in with competitors', score: 1 },
      { value: '2', label: 'We have some unique features', score: 2 },
      { value: '3', label: 'We stand out in key areas', score: 3 },
      { value: '4', label: 'We have a unique position', score: 4 },
      { value: '5', label: 'We own our category space', score: 5 }
    ]
  },
  {
    id: 'emotional-connection',
    question: 'How emotionally connected are your customers to your brand?',
    category: 'empathetic',
    options: [
      { value: '1', label: 'They see us as transactional', score: 1 },
      { value: '2', label: 'They appreciate our service', score: 2 },
      { value: '3', label: 'They prefer us to competitors', score: 3 },
      { value: '4', label: 'They feel understood by us', score: 4 },
      { value: '5', label: 'They are emotionally invested', score: 5 }
    ]
  },
  {
    id: 'brand-authenticity',
    question: 'How authentic and transparent is your brand communication?',
    category: 'authentic',
    options: [
      { value: '1', label: 'We focus on selling features', score: 1 },
      { value: '2', label: 'We share some company values', score: 2 },
      { value: '3', label: 'We show our personality', score: 3 },
      { value: '4', label: 'We are transparent about our process', score: 4 },
      { value: '5', label: 'We authentically share our story', score: 5 }
    ]
  },
  {
    id: 'messaging-clarity',
    question: 'How clear and compelling is your brand messaging?',
    category: 'insight',
    options: [
      { value: '1', label: 'We struggle to explain what we do', score: 1 },
      { value: '2', label: 'We can describe our features', score: 2 },
      { value: '3', label: 'We communicate our benefits', score: 3 },
      { value: '4', label: 'We articulate our value clearly', score: 4 },
      { value: '5', label: 'Our message is compelling and memorable', score: 5 }
    ]
  },
  {
    id: 'visual-identity',
    question: 'How distinctive and memorable is your visual brand identity?',
    category: 'distinctive',
    options: [
      { value: '1', label: 'We look like everyone else', score: 1 },
      { value: '2', label: 'We have basic branding', score: 2 },
      { value: '3', label: 'We have some unique elements', score: 3 },
      { value: '4', label: 'Our brand is recognizable', score: 4 },
      { value: '5', label: 'Our brand is iconic', score: 5 }
    ]
  }
];

export default function FreeDiagnostic() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const { user } = useAuth();
  const { syncFromLocalStorage } = useDiagnostic();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const progress = ((currentQuestion + 1) / diagnosticQuestions.length) * 100;
  const currentQ = diagnosticQuestions[currentQuestion];
  const hasAnswer = answers[currentQ.id];

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
    
    // Calculate scores by category
    const scores = {
      insight: 0,
      distinctive: 0,
      empathetic: 0,
      authentic: 0
    };

    const categoryCount = {
      insight: 0,
      distinctive: 0,
      empathetic: 0,
      authentic: 0
    };

    diagnosticQuestions.forEach(question => {
      const answer = answers[question.id];
      if (answer) {
        const option = question.options.find(opt => opt.value === answer);
        if (option) {
          scores[question.category] += option.score;
          categoryCount[question.category]++;
        }
      }
    });

    // Calculate averages
    const averageScores = {
      insight: Math.round((scores.insight / categoryCount.insight) * 20), // Convert to percentage
      distinctive: Math.round((scores.distinctive / categoryCount.distinctive) * 20),
      empathetic: Math.round((scores.empathetic / categoryCount.empathetic) * 20),
      authentic: Math.round((scores.authentic / categoryCount.authentic) * 20)
    };

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

    // Navigate to results page
    setIsCompleting(false);
    navigate('/diagnostic/results');
  };


  // Auto-sync if user signs in while on this page
  useEffect(() => {
    const syncData = async () => {
      if (user && localStorage.getItem('diagnosticData')) {
        try {
          await syncFromLocalStorage();
        } catch (error) {
          console.error('Error syncing diagnostic:', error);
        }
      }
    };
    syncData();
  }, [user, syncFromLocalStorage]);

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
            <h1 className="text-3xl font-bold mb-4">Free Brand Diagnostic</h1>
            <p className="text-muted-foreground mb-6">
              Discover your brand's strengths and opportunities with our IDEA Framework™ assessment
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
                Select the option that best describes your current situation
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