import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import { ServiceProvider } from "@/services/ServiceProvider";
import { SystemKBProvider } from "@/contexts/SystemKBContext";
import { OnboardingTourProvider } from "@/contexts/OnboardingTourContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ROUTES } from "@/config/routes";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ServiceProvider>
        <SystemKBProvider>
          <OnboardingTourProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <OnboardingTour autoStart={true} />
              <Routes>
                <Route path="/" element={<Navigate to={ROUTES.HOME_PAGE} replace />} />
                <Route path="/welcome" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/start-here" element={
                  <BrandProvider>
                    <Layout>
                      <StartHere />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/journey" element={
                  <BrandProvider>
                    <Layout>
                      <Index />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/diagnostic" element={<FreeDiagnostic />} />
                <Route path="/subscribe" element={<PricingPaywall />} />
                <Route path="/diagnostic/results" element={<DiagnosticResults />} />
                <Route path="/dashboard" element={
                  <BrandProvider>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/brand-diagnostic" element={
                  <BrandProvider>
                    <Layout>
                      <BrandDiagnostic />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea-diagnostic" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaDiagnostic />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaFramework />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea/consultant" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaFrameworkConsultant />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/brand-coach" element={<Navigate to="/idea/consultant" replace />} />
                <Route path="/conversations" element={
                  <BrandProvider>
                    <Layout>
                      <ConversationHistory />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea/insight" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaInsight />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea/distinctive" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaDistinctive />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea/empathy" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaEmpathy />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/idea/authenticity" element={
                  <BrandProvider>
                    <Layout>
                      <IdeaAuthenticity />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/avatar" element={
                  <BrandProvider>
                    <Layout>
                      <AvatarBuilder />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/canvas" element={
                  <BrandProvider>
                    <Layout>
                      <BrandCanvas />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/copy-generator" element={
                  <BrandProvider>
                    <Layout>
                      <BrandCopyGenerator />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/research-learning" element={
                  <BrandProvider>
                    <Layout>
                      <ResearchLearning />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="/app" element={<Navigate to={ROUTES.HOME_PAGE} replace />} />
                <Route path="/value-lens" element={<Navigate to="/copy-generator" replace />} />
                <Route path="/beta" element={<BetaWelcome />} />
                <Route path="/beta-journey" element={<BetaJourney />} />
                <Route path="/beta-feedback" element={<BetaFeedback />} />
                <Route path="/test/offline-sync" element={
                  <BrandProvider>
                    <Layout>
                      <TestOfflineSync />
                    </Layout>
                  </BrandProvider>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </OnboardingTourProvider>
        </SystemKBProvider>
      </ServiceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
