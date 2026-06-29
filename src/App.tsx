import { initPostHog } from "@/lib/posthogClient";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import { AvatarProvider } from "@/contexts/AvatarContext";
import { VersionProvider } from "@/contexts/VersionContext";
import { ServiceProvider } from "@/services/ServiceProvider";
import { SystemKBProvider } from "@/contexts/SystemKBContext";
import { OnboardingTourProvider } from "@/contexts/OnboardingTourContext";
import { FieldReviewProvider } from "@/contexts/FieldReviewContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AuthGate } from "@/components/AuthGate";
import { RequireAuth } from "@/components/RequireAuth";
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ROUTES, V1_ROUTES } from "@/config/routes";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import BrandDiagnostic from "./pages/BrandDiagnostic";
import ProblemSolverDiagnostic from "./pages/v2/ProblemSolverDiagnostic";
import DiagnosticResults from "./pages/DiagnosticResults";
import JourneyBridge from "./components/diagnostic/JourneyBridge";
import IdeaDiagnostic from "./pages/IdeaDiagnostic";
import IdeaFramework from "./pages/IdeaFramework";
import IdeaFrameworkConsultant from "./pages/IdeaFrameworkConsultant";
import ResearchLearning from "./pages/ResearchLearning";
import IdeaInsight from "./pages/IdeaInsight";
import IdeaDistinctive from "./pages/IdeaDistinctive";
import IdeaEmpathy from "./pages/IdeaEmpathy";
import IdeaAuthenticity from "./pages/IdeaAuthenticity";
import BrandCanvas from "./pages/BrandCanvas";
import BrandCopyGenerator from "./pages/BrandCopyGenerator";
import ConversationHistory from "./pages/ConversationHistory";
import Integrations from "./pages/Integrations";
import Auth from "./pages/Auth";
import BetaWelcome from "./pages/BetaWelcome";
import BetaJourney from "./pages/BetaJourney";
import BetaFeedback from "./pages/BetaFeedback";
import NotFound from "./pages/NotFound";
import { TestOfflineSync } from "./pages/TestOfflineSync";
import { StartHere } from "./pages/StartHere";
import PricingPaywall from "./pages/PricingPaywall";
import { BrandCoachV2 } from "./pages/v2/BrandCoachV2";
import { FunnelTracker } from "./components/v2/funnel/FunnelTracker";
import FeatureGate from "@/components/FeatureGate";
import { VersionGate } from "@/components/VersionGate";
import FeatureFlagAdmin from "./pages/admin/FeatureFlagAdmin";
import CoachEvalsAdmin from "./pages/admin/CoachEvalsAdmin";
import { AdminGate } from "@/components/AdminGate";
import FocusSurface from "./pages/FocusSurface";
import TestChapterNavigation from "./pages/TestChapterNavigation";
import SettingsPage from "./pages/SettingsPage";
import FigmaCallback from "./pages/FigmaCallback";
import OAuthConsent from "./pages/OAuthConsent";
import { V4ContextProvider } from "@/contexts/V4ContextStore";
import { V4Layout } from "@/components/v4/V4Layout";
import V4Onboarding from "./pages/v4/V4Onboarding";
import V4OnboardingChoice from "./pages/v4/V4OnboardingChoice";
import V4ConnectorSetup from "./pages/v4/V4ConnectorSetup";
import V4Diagnose from "./pages/v4/V4Diagnose";
import V4Analyse from "./pages/v4/V4Analyse";
import V4Fix from "./pages/v4/V4Fix";
import V4Remeasure from "./pages/v4/V4Remeasure";
import V4Defend from "./pages/v4/V4Defend";
import V4Tools from "./pages/v4/V4Tools";
import { V4_ROUTES } from "@/config/v4";
// Initialise analytics before the React tree mounts so the auth listener can
// identify the user as soon as a session arrives. No-op when no key is set.
initPostHog();

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
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ServiceProvider>
        <AuthProvider>
          <AuthGate>
            <VersionProvider>
              <V4ContextProvider>
              <AvatarProvider>
              <BrandProvider>
                <SystemKBProvider>
                  <FieldReviewProvider>
                    <OnboardingTourProvider>
                      <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <ScrollToTop />
                      <OnboardingTour autoStart={true} />
                      <BetaFeedbackWidget />

                    <Routes>
                <Route path="/" element={<VersionGate />} />

                <Route path="/welcome" element={<Landing />} />

                <Route path="/auth" element={<Auth />} />

                {/* OAuth 2.1 consent (MCP connector authorization). PUBLIC route — the
                    page self-handles auth, bouncing to /auth with a return param that
                    preserves authorization_id; must NOT be wrapped in RequireAuth. */}
                <Route path="/oauth/consent" element={<OAuthConsent />} />

                <Route path="/start-here" element={<Navigate to="/v1/start-here" replace />} />

                <Route path="/journey" element={<Navigate to="/v1/journey" replace />} />

                <Route path="/diagnostic" element={<Navigate to="/v1/diagnostic" replace />} />

                <Route path="/subscribe" element={<Navigate to="/v1/subscribe" replace />} />

                <Route path="/diagnostic/results" element={<Navigate to="/v1/diagnostic/results" replace />} />

                <Route path="/diagnostic/bridge" element={<Navigate to="/v1/diagnostic/bridge" replace />} />

                <Route path="/dashboard" element={<Navigate to="/v1/dashboard" replace />} />

                <Route path="/brand-diagnostic" element={<Navigate to="/v1/brand-diagnostic" replace />} />

                <Route path="/idea-diagnostic" element={<Navigate to="/v1/idea-diagnostic" replace />} />

                <Route path="/idea" element={<Navigate to="/v1/idea" replace />} />

                <Route path="/idea/consultant" element={<Navigate to="/v1/idea/consultant" replace />} />

                <Route path="/brand-coach" element={<Navigate to="/v1/idea/consultant" replace />} />

                <Route path="/v2/coach" element={
                  <RequireAuth>
                    <FeatureGate feature="BRAND_COACH_V2">
                      <ErrorBoundary>
                        <BrandCoachV2 />
                      </ErrorBoundary>
                    </FeatureGate>
                  </RequireAuth>
                } />

                <Route path="/v2/funnel" element={<RequireAuth><FunnelTracker /></RequireAuth>} />

                {/* Reframed "Fix the Trust Gap" 8-screen Problem-Solver flow (Demo v2).
                    Ports idea-brandcoach-DEMO-v2-trevor-spec.html: free diagnostic →
                    auth-gated forensic run → customer profile + Decision Trigger fix.
                    Login-gated in-app review flow — the public guest entry point is
                    /v1/diagnostic (FreeDiagnostic), which stays open. */}
                <Route path="/v2/diagnostic" element={<RequireAuth><ErrorBoundary><ProblemSolverDiagnostic /></ErrorBoundary></RequireAuth>} />

                {/* Review route: the same flow with Movement 1 (Recognition) in front,
                    per Trevor's Revised Entry Experience Brief (IDEA-APP-ENTRY-001 v1.1).
                    Kept separate from /v2 so the live baseline is untouched while Trevor
                    reviews Movement 1 before Movements 2/3 are built. Login-gated. */}
                <Route path="/v3/diagnostic" element={<RequireAuth><ErrorBoundary><ProblemSolverDiagnostic showRecognition /></ErrorBoundary></RequireAuth>} />

                {/* /v4 — the new "one and only" surface (app shell + spine + Loop 1).
                    Old routes stay mounted; VersionGate gates the entry behind
                    VITE_FORCE_V4 (default on in this worktree). RequireAuth wraps the
                    whole group so the surface is login-gated (anon → /auth). Nested
                    under V4Layout so the sidebar + sticky spine stepper + mobile
                    bottom-nav persist across the onboarding + spine screens. */}
                <Route path={V4_ROUTES.ROOT} element={<RequireAuth><ErrorBoundary><V4Layout /></ErrorBoundary></RequireAuth>}>
                  <Route index element={<V4Onboarding />} />
                  {/* Post-signup fork (CHOICE) + the recommended connector setup guide. */}
                  <Route path="start" element={<V4OnboardingChoice />} />
                  <Route path="connect" element={<V4ConnectorSetup />} />
                  <Route path="diagnose" element={<V4Diagnose />} />
                  <Route path="analyse" element={<V4Analyse />} />
                  <Route path="fix" element={<V4Fix />} />
                  <Route path="remeasure" element={<V4Remeasure />} />
                  <Route path="defend" element={<V4Defend />} />
                </Route>

                {/* /v4/tools — standalone trust-signals tool registry (own dark theme,
                    intentionally outside V4Layout so it reads as a public trust page). */}
                <Route path="/v4/tools" element={<V4Tools />} />

                <Route path="/conversations" element={<Navigate to="/v1/conversations" replace />} />

                <Route path="/idea/insight" element={<Navigate to="/v1/idea/insight" replace />} />

                <Route path="/idea/distinctive" element={<Navigate to="/v1/idea/distinctive" replace />} />

                <Route path="/idea/empathy" element={<Navigate to="/v1/idea/empathy" replace />} />

                <Route path="/idea/authenticity" element={<Navigate to="/v1/idea/authenticity" replace />} />

                {/* P4b §4.5: /avatar goes straight to the V2 coach (the V1 builder
                    is gone) — avoids a double hop through /v1/avatar. */}
                <Route path="/avatar" element={<Navigate to="/v2/coach" replace />} />

                <Route path="/canvas" element={<Navigate to="/v1/canvas" replace />} />

                <Route path="/copy-generator" element={<Navigate to="/v1/copy-generator" replace />} />

                <Route path="/research-learning" element={<Navigate to="/v1/research-learning" replace />} />

                <Route path="/app" element={<Navigate to={ROUTES.HOME_PAGE} replace />} />

                <Route path="/value-lens" element={<Navigate to="/v1/copy-generator" replace />} />

                <Route path="/beta" element={<RequireAuth><BetaWelcome /></RequireAuth>} />

                <Route path="/beta-journey" element={<RequireAuth><BetaJourney /></RequireAuth>} />

                <Route path="/beta-feedback" element={<RequireAuth><BetaFeedback /></RequireAuth>} />

                <Route path="/test/offline-sync" element={
                  <Layout>
                    <TestOfflineSync />
                  </Layout>
                } />

                <Route path={ROUTES.FEATURE_FLAG_ADMIN} element={
                  <AdminGate>
                    <Layout>
                      <FeatureFlagAdmin />
                    </Layout>
                  </AdminGate>
                } />

                <Route path={ROUTES.COACH_EVALS_ADMIN} element={
                  <AdminGate>
                    <Layout>
                      <CoachEvalsAdmin />
                    </Layout>
                  </AdminGate>
                } />

                <Route path={ROUTES.FOCUS_SURFACE} element={
                  <Layout>
                    <FocusSurface />
                  </Layout>
                } />

                <Route path={ROUTES.SETTINGS} element={
                  <Layout>
                    <SettingsPage />
                  </Layout>
                } />

                <Route path={`${ROUTES.SETTINGS}/:section`} element={
                  <Layout>
                    <SettingsPage />
                  </Layout>
                } />

                <Route path={ROUTES.FIGMA_CALLBACK} element={<FigmaCallback />} />

                <Route path="/test/chapter-navigation" element={
                  <Layout>
                    <TestChapterNavigation />
                  </Layout>
                } />

                {/* V1 Routes - Legacy support */}
                <Route path="/v1/start-here" element={
                  <RequireAuth>
                    <Layout>
                      <StartHere />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/journey" element={
                  <RequireAuth>
                    <Layout>
                      <Index />
                    </Layout>
                  </RequireAuth>
                } />

                {/* Consolidated (2026-06-29): /v1 uses the one diagnostic engine
                    (ProblemSolverDiagnostic + Recognition), gated like /v2,/v3 —
                    the divergent FreeDiagnostic questionnaire is retired. */}
                <Route path="/v1/diagnostic" element={<RequireAuth><ProblemSolverDiagnostic showRecognition /></RequireAuth>} />

                <Route path="/v1/subscribe" element={<RequireAuth><PricingPaywall /></RequireAuth>} />

                <Route path="/v1/diagnostic/results" element={<DiagnosticResults />} />

                <Route path="/v1/diagnostic/bridge" element={<JourneyBridge />} />

                <Route path="/v1/dashboard" element={
                  <RequireAuth>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/brand-diagnostic" element={
                  <RequireAuth>
                    <Layout>
                      <BrandDiagnostic />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea-diagnostic" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaDiagnostic />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaFramework />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea/consultant" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaFrameworkConsultant />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/conversations" element={
                  <RequireAuth>
                    <Layout>
                      <ConversationHistory />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea/insight" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaInsight />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea/distinctive" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaDistinctive />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea/empathy" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaEmpathy />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/idea/authenticity" element={
                  <RequireAuth>
                    <Layout>
                      <IdeaAuthenticity />
                    </Layout>
                  </RequireAuth>
                } />

                {/* P4b §4.5: the V1 avatar builder is superseded by the V2 coach's
                    multi-avatar header + forensic builder. Redirect to /v2/coach. */}
                <Route path="/v1/avatar" element={<Navigate to="/v2/coach" replace />} />

                <Route path="/v1/canvas" element={
                  <RequireAuth>
                    <Layout>
                      <BrandCanvas />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/copy-generator" element={
                  <RequireAuth>
                    <Layout>
                      <BrandCopyGenerator />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/research-learning" element={
                  <RequireAuth>
                    <Layout>
                      <ResearchLearning />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="/v1/integrations" element={
                  <RequireAuth>
                    <Layout>
                      <Integrations />
                    </Layout>
                  </RequireAuth>
                } />

                <Route path="*" element={<NotFound />} />

                    </Routes>
                  </BrowserRouter>
                      </TooltipProvider>
                    </OnboardingTourProvider>
                  </FieldReviewProvider>
                </SystemKBProvider>
              </BrandProvider>
              </AvatarProvider>
              </V4ContextProvider>
            </VersionProvider>
          </AuthGate>
        </AuthProvider>
      </ServiceProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};
export default App;
