import { bindAnalyticsToConsent } from "@/lib/posthogClient";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { ClerkAuthProvider } from "@/components/auth/ClerkAuthProvider";
import { isClerkConfigured } from "@/config/clerkConfig";
import { BrandProvider } from "@/contexts/BrandContext";
import { AvatarProvider } from "@/contexts/AvatarContext";
import { VersionProvider } from "@/contexts/VersionContext";
import { ServiceProvider } from "@/services/ServiceProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SystemKBProvider } from "@/contexts/SystemKBContext";
import { OnboardingTourProvider } from "@/contexts/OnboardingTourContext";
import { FieldReviewProvider } from "@/contexts/FieldReviewContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AuthGate } from "@/components/AuthGate";
import { RequireInternal } from "@/components/RequireInternal";
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ROUTES } from "@/config/routes";
import { CURRENT_SURFACE } from "@/config/surface";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import BetaWelcome from "./pages/BetaWelcome";
import BetaJourney from "./pages/BetaJourney";
import BetaFeedback from "./pages/BetaFeedback";
import NotFound from "./pages/NotFound";
import { TestOfflineSync } from "./pages/TestOfflineSync";
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
import PrivacyPolicy from "./pages/PrivacyPolicy";
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
import V5Alpha from "./pages/v5/V5Alpha";
import { V4_ROUTES } from "@/config/v4";
// Bind analytics to the consent store before the React tree mounts so the auth
// listener can identify the user as soon as a session arrives. PostHog starts
// ONLY with a stored analytics opt-in (GDPR); no key set is still a safe no-op.
bindAnalyticsToConsent();

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
// Flag-gated auth provider: Clerk (native Supabase third-party auth) when
// configured, else the existing Supabase-Auth provider. Both supply the same
// AuthContext, so the rest of the tree is identical in either mode.
const AppAuthProvider = isClerkConfigured() ? ClerkAuthProvider : AuthProvider;

const App = () => {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <ServiceProvider>
        <AppAuthProvider>
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
                      <ConsentBanner />

                    {/*
                      SURFACE ROUTING — default-deny. Exactly ONE customer surface
                      (CURRENT_SURFACE). Every path is one of four tiers, enforced by
                      src/config/surface.ts + src/config/__tests__/surface.test.ts:
                        • customer — the one surface + public entry
                        • infra    — auth / legal / settings / callbacks / 404
                        • internal — auth + allowlist; bounced to the surface for customers
                        • legacy   — redirects to CURRENT_SURFACE (deleted-on-promotion)
                      Promoting a new UI = repoint CURRENT_SURFACE + move its routes into the
                      customer tier + DELETE the old ones. See ADR-APP-VS-MCP-SURFACE (D5).
                    */}
                    <Routes>
                {/* ── Customer surface (the one surface) ─────────────────────── */}
                <Route path="/" element={<VersionGate />} />
                <Route path="/welcome" element={<Landing />} />
                {/* /v5 — nav-less Avatar 2.0 build theatre. PUBLIC: creates an anonymous
                    Supabase session on demand and converts it at the save step, so it must
                    NOT be wrapped in auth. */}
                <Route path="/v5" element={<ErrorBoundary><V5Alpha /></ErrorBoundary>} />

                {/* ── Infra (public/gated, not a surface) ────────────────────── */}
                <Route path="/auth" element={<Auth />} />
                {/* Public privacy notice (GDPR Art. 13/14) — reachable signed-out. */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                {/* OAuth 2.1 consent (MCP connector authorization). PUBLIC — the page
                    self-handles auth, bouncing to /auth with a return param; must NOT be gated. */}
                <Route path="/oauth/consent" element={<OAuthConsent />} />
                <Route path={ROUTES.SETTINGS} element={<Layout><SettingsPage /></Layout>} />
                <Route path={`${ROUTES.SETTINGS}/:section`} element={<Layout><SettingsPage /></Layout>} />
                <Route path={ROUTES.FIGMA_CALLBACK} element={<FigmaCallback />} />

                {/* ── Internal (auth + allowlist; NEVER customer-reachable) ───── */}
                {/* Admin dashboards keep AdminGate's explicit access-denied notice. */}
                <Route path={ROUTES.FEATURE_FLAG_ADMIN} element={
                  <AdminGate><Layout><FeatureFlagAdmin /></Layout></AdminGate>
                } />
                <Route path={ROUTES.COACH_EVALS_ADMIN} element={
                  <AdminGate><Layout><CoachEvalsAdmin /></Layout></AdminGate>
                } />
                {/* /v4 spine — retained for internal use; a customer who deep-links it is
                    bounced to the surface by RequireInternal. */}
                <Route path={V4_ROUTES.ROOT} element={
                  <RequireInternal><ErrorBoundary><V4Layout /></ErrorBoundary></RequireInternal>
                }>
                  <Route index element={<V4Onboarding />} />
                  <Route path="start" element={<V4OnboardingChoice />} />
                  <Route path="connect" element={<V4ConnectorSetup />} />
                  <Route path="diagnose" element={<V4Diagnose />} />
                  <Route path="analyse" element={<V4Analyse />} />
                  <Route path="fix" element={<V4Fix />} />
                  <Route path="remeasure" element={<V4Remeasure />} />
                  <Route path="defend" element={<V4Defend />} />
                </Route>
                <Route path="/v2/coach" element={
                  <RequireInternal>
                    <FeatureGate feature="BRAND_COACH_V2">
                      <ErrorBoundary><BrandCoachV2 /></ErrorBoundary>
                    </FeatureGate>
                  </RequireInternal>
                } />
                <Route path="/v2/funnel" element={<RequireInternal><FunnelTracker /></RequireInternal>} />
                <Route path={ROUTES.FOCUS_SURFACE} element={
                  <RequireInternal><Layout><FocusSurface /></Layout></RequireInternal>
                } />
                <Route path="/beta" element={<RequireInternal><BetaWelcome /></RequireInternal>} />
                <Route path="/beta-journey" element={<RequireInternal><BetaJourney /></RequireInternal>} />
                <Route path="/beta-feedback" element={<RequireInternal><BetaFeedback /></RequireInternal>} />
                <Route path="/test/offline-sync" element={
                  <RequireInternal><Layout><TestOfflineSync /></Layout></RequireInternal>
                } />
                <Route path="/test/chapter-navigation" element={
                  <RequireInternal><Layout><TestChapterNavigation /></Layout></RequireInternal>
                } />

                {/* ── Legacy → redirect to the current surface (default-deny) ──── */}
                {/* Every deprecated path funnels to CURRENT_SURFACE. The old v1/v2/v3
                    pages are removed from the tree — git history is the archive, not a
                    live /vN. See ADR-APP-VS-MCP-SURFACE (D5). */}
                <Route path="/diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v2/diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v3/diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v4/tools" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/start-here" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/start-here" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/journey" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/journey" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/subscribe" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/subscribe" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/diagnostic/results" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/diagnostic/results" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/diagnostic/bridge" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/diagnostic/bridge" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/dashboard" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/dashboard" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/brand-diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/brand-diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea-diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea-diagnostic" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea/consultant" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea/consultant" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/brand-coach" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/conversations" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/conversations" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea/insight" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea/insight" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea/distinctive" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea/distinctive" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea/empathy" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea/empathy" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/idea/authenticity" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/idea/authenticity" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/avatar" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/avatar" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/canvas" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/canvas" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/copy-generator" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/copy-generator" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/research-learning" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/research-learning" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/v1/integrations" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/value-lens" element={<Navigate to={CURRENT_SURFACE} replace />} />
                <Route path="/app" element={<Navigate to={CURRENT_SURFACE} replace />} />

                {/* True 404 for genuinely unknown paths. */}
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
        </AppAuthProvider>
      </ServiceProvider>
    </QueryClientProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
};
export default App;
