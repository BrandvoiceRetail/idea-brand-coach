import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { migrateDiagnosticData } from "@/utils/diagnosticDataMigration";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import { AvatarProvider } from "@/contexts/AvatarContext";
import { ServiceProvider } from "@/services/ServiceProvider";
import { SystemKBProvider } from "@/contexts/SystemKBContext";
import { OnboardingTourProvider } from "@/contexts/OnboardingTourContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AuthGate } from "@/components/AuthGate";
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget";
import { ROUTES, V1_ROUTES } from "@/config/routes";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import BrandDiagnostic from "./pages/BrandDiagnostic";
import FreeDiagnostic from "./pages/FreeDiagnostic";
import DiagnosticResults from "./pages/DiagnosticResults";
import IdeaDiagnostic from "./pages/IdeaDiagnostic";
import IdeaFramework from "./pages/IdeaFramework";
import IdeaFrameworkConsultant from "./pages/IdeaFrameworkConsultant";
import ResearchLearning from "./pages/ResearchLearning";
import IdeaInsight from "./pages/IdeaInsight";
import IdeaDistinctive from "./pages/IdeaDistinctive";
import IdeaEmpathy from "./pages/IdeaEmpathy";
import IdeaAuthenticity from "./pages/IdeaAuthenticity";
import AvatarBuilder from "./pages/AvatarBuilder";
import BrandCanvas from "./pages/BrandCanvas";
import BrandCopyGenerator from "./pages/BrandCopyGenerator";
import ConversationHistory from "./pages/ConversationHistory";
import Auth from "./pages/Auth";
import BetaWelcome from "./pages/BetaWelcome";
import BetaJourney from "./pages/BetaJourney";
import BetaFeedback from "./pages/BetaFeedback";
import NotFound from "./pages/NotFound";
import { TestOfflineSync } from "./pages/TestOfflineSync";
import { StartHere } from "./pages/StartHere";
import PricingPaywall from "./pages/PricingPaywall";
import { BrandCoachV2 } from "./pages/v2/BrandCoachV2";
import FeatureGate from "@/components/FeatureGate";
import FeatureFlagAdmin from "./pages/admin/FeatureFlagAdmin";
import TestChapterNavigation from "./pages/TestChapterNavigation";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (renamed from cacheTime in React Query v5)
      refetchOnWindowFocus: false,
      retry: 1,
      // Deduplicate queries within 2 seconds
      refetchInterval: false,
    },
  },
});
const App = () => {
  // Run data migration on app load
  useEffect(() => {
    migrateDiagnosticData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider>
        <AuthProvider>
          <AuthGate>
            <BrandProvider>
              <AvatarProvider>
                <SystemKBProvider>
                  <OnboardingTourProvider>
                    <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <ScrollToTop />
                      <OnboardingTour autoStart={true} />
                      <BetaFeedbackWidget />

                    <Routes>
                <Route path="/" element={<Navigate to={ROUTES.HOME_PAGE} replace />} />

                <Route path="/welcome" element={<Landing />} />

                <Route path="/auth" element={<Auth />} />

                <Route path="/start-here" element={<Navigate to="/v1/start-here" replace />} />

                <Route path="/journey" element={<Navigate to="/v1/journey" replace />} />

                <Route path="/diagnostic" element={<Navigate to="/v1/diagnostic" replace />} />

                <Route path="/subscribe" element={<Navigate to="/v1/subscribe" replace />} />

                <Route path="/diagnostic/results" element={<Navigate to="/v1/diagnostic/results" replace />} />

                <Route path="/dashboard" element={<Navigate to="/v1/dashboard" replace />} />

                <Route path="/brand-diagnostic" element={<Navigate to="/v1/brand-diagnostic" replace />} />

                <Route path="/idea-diagnostic" element={<Navigate to="/v1/idea-diagnostic" replace />} />

                <Route path="/idea" element={<Navigate to="/v1/idea" replace />} />

                <Route path="/idea/consultant" element={<Navigate to="/v1/idea/consultant" replace />} />

                <Route path="/brand-coach" element={<Navigate to="/v1/idea/consultant" replace />} />

                <Route path="/v2/coach" element={
                  <FeatureGate feature="BRAND_COACH_V2">
                    <BrandCoachV2 />
                  </FeatureGate>
                } />

                <Route path="/conversations" element={<Navigate to="/v1/conversations" replace />} />

                <Route path="/idea/insight" element={<Navigate to="/v1/idea/insight" replace />} />

                <Route path="/idea/distinctive" element={<Navigate to="/v1/idea/distinctive" replace />} />

                <Route path="/idea/empathy" element={<Navigate to="/v1/idea/empathy" replace />} />

                <Route path="/idea/authenticity" element={<Navigate to="/v1/idea/authenticity" replace />} />

                <Route path="/avatar" element={<Navigate to="/v1/avatar" replace />} />

                <Route path="/canvas" element={<Navigate to="/v1/canvas" replace />} />

                <Route path="/copy-generator" element={<Navigate to="/v1/copy-generator" replace />} />

                <Route path="/research-learning" element={<Navigate to="/v1/research-learning" replace />} />

                <Route path="/app" element={<Navigate to={ROUTES.HOME_PAGE} replace />} />

                <Route path="/value-lens" element={<Navigate to="/v1/copy-generator" replace />} />

                <Route path="/beta" element={<BetaWelcome />} />

                <Route path="/beta-journey" element={<BetaJourney />} />

                <Route path="/beta-feedback" element={<BetaFeedback />} />

                <Route path="/test/offline-sync" element={
                  <Layout>
                    <TestOfflineSync />
                  </Layout>
                } />

                <Route path={ROUTES.FEATURE_FLAG_ADMIN} element={
                  <Layout>
                    <FeatureFlagAdmin />
                  </Layout>
                } />

                <Route path="/test/chapter-navigation" element={
                  <Layout>
                    <TestChapterNavigation />
                  </Layout>
                } />

                {/* V1 Routes - Legacy support */}
                <Route path="/v1/start-here" element={
                  <Layout>
                    <StartHere />
                  </Layout>
                } />

                <Route path="/v1/journey" element={
                  <Layout>
                    <Index />
                  </Layout>
                } />

                <Route path="/v1/diagnostic" element={<FreeDiagnostic />} />

                <Route path="/v1/subscribe" element={<PricingPaywall />} />

                <Route path="/v1/diagnostic/results" element={<DiagnosticResults />} />

                <Route path="/v1/dashboard" element={
                  <Layout>
                    <Dashboard />
                  </Layout>
                } />

                <Route path="/v1/brand-diagnostic" element={
                  <Layout>
                    <BrandDiagnostic />
                  </Layout>
                } />

                <Route path="/v1/idea-diagnostic" element={
                  <Layout>
                    <IdeaDiagnostic />
                  </Layout>
                } />

                <Route path="/v1/idea" element={
                  <Layout>
                    <IdeaFramework />
                  </Layout>
                } />

                <Route path="/v1/idea/consultant" element={
                  <Layout>
                    <IdeaFrameworkConsultant />
                  </Layout>
                } />

                <Route path="/v1/conversations" element={
                  <Layout>
                    <ConversationHistory />
                  </Layout>
                } />

                <Route path="/v1/idea/insight" element={
                  <Layout>
                    <IdeaInsight />
                  </Layout>
                } />

                <Route path="/v1/idea/distinctive" element={
                  <Layout>
                    <IdeaDistinctive />
                  </Layout>
                } />

                <Route path="/v1/idea/empathy" element={
                  <Layout>
                    <IdeaEmpathy />
                  </Layout>
                } />

                <Route path="/v1/idea/authenticity" element={
                  <Layout>
                    <IdeaAuthenticity />
                  </Layout>
                } />

                <Route path="/v1/avatar" element={
                  <Layout>
                    <AvatarBuilder />
                  </Layout>
                } />

                <Route path="/v1/canvas" element={
                  <Layout>
                    <BrandCanvas />
                  </Layout>
                } />

                <Route path="/v1/copy-generator" element={
                  <Layout>
                    <BrandCopyGenerator />
                  </Layout>
                } />

                <Route path="/v1/research-learning" element={
                  <Layout>
                    <ResearchLearning />
                  </Layout>
                } />

                <Route path="*" element={<NotFound />} />

                    </Routes>
                  </BrowserRouter>
                    </TooltipProvider>
                  </OnboardingTourProvider>
                </SystemKBProvider>
              </AvatarProvider>
            </BrandProvider>
          </AuthGate>
        </AuthProvider>
      </ServiceProvider>
    </QueryClientProvider>
  );
};
export default App;
