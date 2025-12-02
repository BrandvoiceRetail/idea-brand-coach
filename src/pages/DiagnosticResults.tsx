import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Star,
  Lightbulb,
  Heart,
  Shield,
  Download,
  UserPlus,
  MessageSquare
} from 'lucide-react';
import { BetaNavigationWidget } from '@/components/BetaNavigationWidget';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useAuth } from '@/hooks/useAuth';

interface DiagnosticData {
  answers: Record<string, string>;
  scores: {
    insight: number;
    distinctive: number;
    empathetic: number;
    authentic: number;
  };
  overallScore: number;
  completedAt: string;
}

const categoryDetails = {
  insight: {
    icon: <Lightbulb className="w-6 h-6" />,
    title: 'Insight Driven',
    description: 'Understanding customer motivations and emotional triggers',
    color: 'from-yellow-500 to-orange-500'
  },
  distinctive: {
    icon: <Star className="w-6 h-6" />,
    title: 'Distinctive',
    description: 'Standing out with unique brand assets and positioning',
    color: 'from-green-500 to-emerald-500'
  },
  empathetic: {
    icon: <Heart className="w-6 h-6" />,
    title: 'Empathetic',
    description: 'Connecting emotionally with your audience',
    color: 'from-pink-500 to-rose-500'
  },
  authentic: {
    icon: <Shield className="w-6 h-6" />,
    title: 'Authentic',
    description: 'Building genuine, transparent brand relationships',
    color: 'from-blue-500 to-indigo-500'
  }
};

export default function DiagnosticResults() {
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latestDiagnostic, isLoadingLatest, syncFromLocalStorage } = useDiagnostic();

  useEffect(() => {
    // First try to get from database if user is authenticated
    if (user && latestDiagnostic) {
      setDiagnosticData({
        answers: latestDiagnostic.answers as any,
        scores: {
          insight: latestDiagnostic.scores.insight,
          distinctive: latestDiagnostic.scores.distinctive,
          empathetic: latestDiagnostic.scores.empathetic,
          authentic: latestDiagnostic.scores.authentic,
        },
        overallScore: latestDiagnostic.scores.overall,
        completedAt: latestDiagnostic.completed_at
      });
    } else {
      // Fall back to localStorage for non-authenticated users
      const savedData = localStorage.getItem('diagnosticData');
      if (savedData) {
        setDiagnosticData(JSON.parse(savedData));
      } else if (!isLoadingLatest) {
        // Redirect to diagnostic if no data found
        navigate('/diagnostic');
      }
    }
  }, [user, latestDiagnostic, isLoadingLatest, navigate]);

  if (isLoadingLatest || !diagnosticData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading your results...</h2>
          <p className="text-muted-foreground">Please wait while we analyze your brand assessment.</p>
        </div>
      </div>
    );
  }

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-green-600', icon: <CheckCircle2 className="w-4 h-4" /> };
    if (score >= 60) return { level: 'Good', color: 'text-blue-600', icon: <TrendingUp className="w-4 h-4" /> };
    if (score >= 40) return { level: 'Fair', color: 'text-yellow-600', icon: <AlertCircle className="w-4 h-4" /> };
    return { level: 'Needs Improvement', color: 'text-red-600', icon: <AlertCircle className="w-4 h-4" /> };
  };

  const overallLevel = getScoreLevel(diagnosticData.overallScore);

  const getRecommendations = () => {
    const weakestArea = Object.entries(diagnosticData.scores).reduce((min, [key, value]) => 
      value < min.score ? { area: key, score: value } : min, 
      { area: '', score: 100 }
    );

    const recommendations = {
      insight: "Focus on customer research and behavioral analysis to understand what truly motivates your audience.",
      distinctive: "Develop unique brand assets and positioning that clearly differentiate you from competitors.",
      empathetic: "Create deeper emotional connections through storytelling and authentic customer experiences.",
      authentic: "Build transparency and trust through genuine brand communication and consistent values."
    };

    return recommendations[weakestArea.area as keyof typeof recommendations];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Badge variant="outline" className="px-4 py-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Assessment Complete
              </Badge>
            </div>
            <h1 className="text-3xl font-bold mb-4">Your Brand Diagnostic Results</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Based on the IDEA Strategic Brand Framework™, here's how your brand measures up across the four critical dimensions.
            </p>
          </div>

          {/* Overall Score */}
          <Card className="mb-8 bg-gradient-hero text-primary-foreground border-0">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Overall Brand Health Score</h2>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-5xl font-bold">{diagnosticData.overallScore}%</div>
                <div className="flex items-center gap-2">
                  {overallLevel.icon}
                  <span className="text-lg font-semibold">{overallLevel.level}</span>
                </div>
              </div>
              <Progress value={diagnosticData.overallScore} className="mb-4 bg-white/20" />
              <p className="text-primary-foreground/90">
                Your brand shows {overallLevel.level.toLowerCase()} performance across the IDEA framework dimensions.
              </p>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {Object.entries(diagnosticData.scores).map(([category, score]) => {
              const details = categoryDetails[category as keyof typeof categoryDetails];
              const level = getScoreLevel(score);
              
              return (
                <Card key={category} className="border-border/50 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-12 h-12 bg-gradient-to-r ${details.color} rounded-lg flex items-center justify-center text-white`}>
                        {details.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{details.title}</CardTitle>
                        <CardDescription className="text-sm">{details.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold">{score}%</span>
                      <div className={`flex items-center gap-1 ${level.color}`}>
                        {level.icon}
                        <span className="text-sm font-medium">{level.level}</span>
                      </div>
                    </div>
                    <Progress value={score} className="mb-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recommendations */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Key Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {getRecommendations()}
              </p>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brand Coach CTA or Create Account CTA */}
            {user ? (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Get Personalized Coaching
                  </CardTitle>
                  <CardDescription>
                    Start a conversation with your AI Brand Coach based on these results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Personalized guidance based on your scores</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Strategic recommendations</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Actionable next steps</span>
                    </div>
                  </div>
                  <Button 
                    asChild 
                    className="w-full"
                  >
                    <button onClick={() => navigate('/idea/consultant')}>
                      Start Brand Coaching
                      <MessageSquare className="w-4 h-4 ml-2" />
                    </button>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Save & Unlock Premium Tools
                  </CardTitle>
                  <CardDescription>
                    Sign in or create an account to save these results and access subscription plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Save diagnostic results permanently</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>AI Brand Coach with personalized guidance</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Access Avatar 2.0 Builder</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Interactive learning modules</span>
                    </div>
                  </div>
                  <Button
                    asChild
                    className="w-full"
                  >
                    <button onClick={() => navigate('/auth?redirect=/subscribe')}>
                      Sign In or Sign Up
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Download Results */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Download Results
                </CardTitle>
                <CardDescription>
                  Get a PDF summary of your brand assessment results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Take your results with you and share them with your team. The PDF includes your scores, recommendations, and next steps.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    // This will be implemented later with PDF generation
                    alert('PDF download will be available after account creation');
                  }}
                >
                  Download PDF Report
                  <Download className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="text-muted-foreground"
            >
              ← Back to Home
            </Button>
          </div>
        </div>
      </div>
      <BetaNavigationWidget />
    </div>
  );
}