import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  UserPlus,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { BetaNavigationWidget } from '@/components/BetaNavigationWidget';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import { DiagnosticResultsPDFExport } from '@/components/export/DiagnosticResultsPDFExport';
import { TrustGapScorecard } from '@/components/diagnostic/TrustGapScorecard';
import { ProductImportCta } from '@/components/diagnostic/ProductImportCta';
import { useServices } from '@/services/ServiceProvider';
import type {
  ImportedProduct,
  TrustGapEvidence,
} from '@/services/interfaces/IProductDataService';

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

/** Parse localStorage diagnostic data, handling both old and new formats */
function parseDiagnosticFromLocalStorage(): DiagnosticData | null {
  const savedData = localStorage.getItem('diagnosticData');
  if (!savedData) return null;

  try {
    const parsed = JSON.parse(savedData);
    if (!parsed.scores) return null;

    // Handle new format: overallScore lives inside scores.overall
    const overallScore = parsed.overallScore ?? parsed.scores?.overall ?? 0;

    return {
      answers: parsed.answers ?? {},
      scores: {
        insight: parsed.scores.insight ?? 0,
        distinctive: parsed.scores.distinctive ?? 0,
        empathetic: parsed.scores.empathetic ?? 0,
        authentic: parsed.scores.authentic ?? 0,
      },
      overallScore,
      completedAt: parsed.completedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default function DiagnosticResults() {
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [importedProducts, setImportedProducts] = useState<ImportedProduct[]>([]);
  const [evidence, setEvidence] = useState<TrustGapEvidence | undefined>(undefined);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { productDataService } = useServices();
  const { latestDiagnostic, isLoadingLatest, syncFromLocalStorage, isSyncing } = useDiagnostic();

  // Stable key for the imported evidence: changes only when the set of products
  // changes, so the Trust Gap interpretation refetches exactly once per import.
  const evidenceKey = evidence && importedProducts.length
    ? importedProducts.map((product) => product.id).join(',')
    : undefined;

  // Load any previously imported products + rebuild evidence (authed users only).
  // Both states are set together AFTER the evidence is built — setting products
  // first would define evidenceKey while evidence is still undefined, and the
  // interpretation would fire (and cache) an evidence-keyed call with no evidence.
  const refreshImportedProducts = async (): Promise<void> => {
    try {
      const products = await productDataService.getProducts();
      const builtEvidence = products.length
        ? await productDataService.buildTrustGapEvidence(products)
        : undefined;
      setImportedProducts(products);
      setEvidence(builtEvidence);
    } catch (error) {
      console.error('[DiagnosticResults] failed to load imported products:', error);
    }
  };

  useEffect(() => {
    if (user) {
      void refreshImportedProducts();
    } else {
      setImportedProducts([]);
      setEvidence(undefined);
    }
    // refreshImportedProducts is stable for this purpose; re-run only on user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 1. For non-authenticated users, load from localStorage immediately
  useEffect(() => {
    if (!user) {
      const localData = parseDiagnosticFromLocalStorage();
      if (localData) {
        setDiagnosticData(localData);
      }
      setIsInitialized(true);
    }
  }, [user]);

  // 2. For authenticated users, sync localStorage to DB in background (once)
  useEffect(() => {
    if (user && !hasSynced && localStorage.getItem('diagnosticData')) {
      setHasSynced(true);
      syncFromLocalStorage().catch(console.error);
    }
  }, [user, hasSynced, syncFromLocalStorage]);

  // 3. For authenticated users, prefer DB data but fallback to localStorage
  useEffect(() => {
    if (user && !isLoadingLatest) {
      if (latestDiagnostic) {
        // Use fresh data from database
        setDiagnosticData({
          answers: latestDiagnostic.answers as unknown as Record<string, string>,
          scores: {
            insight: latestDiagnostic.scores.insight,
            distinctive: latestDiagnostic.scores.distinctive,
            empathetic: latestDiagnostic.scores.empathetic,
            authentic: latestDiagnostic.scores.authentic,
          },
          overallScore: latestDiagnostic.scores.overall,
          completedAt: latestDiagnostic.completed_at,
        });
      } else {
        // Fallback to localStorage if no DB data
        const localData = parseDiagnosticFromLocalStorage();
        if (localData) {
          setDiagnosticData(localData);
        }
      }
      setIsInitialized(true);
    }
  }, [user, latestDiagnostic, isLoadingLatest]);

  // 4. Redirect only when we're sure there's no data anywhere
  useEffect(() => {
    if (isInitialized && !diagnosticData && !localStorage.getItem('diagnosticData')) {
      navigate('/diagnostic');
    }
  }, [isInitialized, diagnosticData, navigate]);

  // Show loading spinner while fetching latest data for authenticated users
  // or while syncing localStorage data
  if ((user && (isLoadingLatest || isSyncing)) || (!isInitialized)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-6">
            {/* Loading spinner animation */}
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          </div>
          <h2 className="text-2xl font-bold mb-4">Loading your results...</h2>
          <p className="text-muted-foreground">
            {isSyncing ? 'Syncing your diagnostic data...' : 'Fetching your latest brand assessment...'}
          </p>
        </div>
      </div>
    );
  }

  // Show message if no data is available
  if (!diagnosticData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No diagnostic results found</h2>
          <p className="text-muted-foreground mb-6">Please complete the brand diagnostic first.</p>
          <Button onClick={() => navigate('/diagnostic')}>
            Start Diagnostic
          </Button>
        </div>
      </div>
    );
  }

  const trustGapScores = {
    insight: diagnosticData.scores.insight,
    distinctive: diagnosticData.scores.distinctive,
    empathetic: diagnosticData.scores.empathetic,
    authentic: diagnosticData.scores.authentic,
    overall: diagnosticData.overallScore,
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

          {/* Trust Gap™ 4-Dimension Scorecard with coach-style interpretation */}
          <div className="mb-8">
            <TrustGapScorecard
              scores={trustGapScores}
              evidence={evidence}
              evidenceKey={evidenceKey}
            />
          </div>

          {/* Import your Amazon listing to ground the read in real evidence */}
          <div className="mb-8">
            <ProductImportCta
              importedProducts={importedProducts}
              onImportComplete={refreshImportedProducts}
            />
          </div>

          {/* Download + help */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              {/* Download Results Section */}
              <div className="pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Download Your Results</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Take your results with you and share them with your team. The PDF includes your scores, recommendations, and next steps.
                </p>
                {user ? (
                  <DiagnosticResultsPDFExport
                    diagnosticData={diagnosticData}
                    companyName={user.email?.split('@')[0] || 'Your Brand'}
                    className="w-full"
                  />
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      alert('PDF download will be available after account creation');
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF Report
                  </Button>
                )}
              </div>

              {/* CTA Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Would you like some help with this?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => window.open('https://calendly.com/trevor-bradford-idea/30min', '_blank')}
                    className="w-full"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book a Free 30 Minute Consultation
                  </Button>
                  <Button
                    onClick={() => navigate('/idea/consultant')}
                    className="w-full"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chat with your AI Brand Coach
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trevor Bradford Introduction */}
          <Card className="mb-8 border-primary/20">
            <CardContent className="pt-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <img
                  src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png"
                  alt="Trevor Bradford"
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                />
                <div className="text-center md:text-left flex-1">
                  <h2 className="text-2xl font-bold mb-2">Trevor Bradford</h2>
                  <p className="text-lg text-muted-foreground mb-2">
                    Brand Strategist, E-commerce Expert, Author
                  </p>
                  <p className="text-sm text-primary font-medium mb-4">
                    Creator of the IDEA Strategic Brand Framework™
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Get personalized strategic guidance powered by behavioral science, customer psychology,
                    and proven brand strategy methodology. Consult directly with Trevor Bradford.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Account CTA for non-authenticated users */}
          {!user && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 mb-8">
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

          {/* Back to Home */}
          <div className="text-center mt-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate(ROUTES.HOME_PAGE)}
              className="text-muted-foreground"
            >
              ← Back to Start
            </Button>
          </div>
        </div>
      </div>
      <BetaNavigationWidget />
    </div>
  );
}