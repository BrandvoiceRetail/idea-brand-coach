import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import BrandDiagnostic from "./pages/BrandDiagnostic";
import FreeDiagnostic from "./pages/FreeDiagnostic";
import DiagnosticResults from "./pages/DiagnosticResults";
import IdeaDiagnostic from "./pages/IdeaDiagnostic";
import IdeaFramework from "./pages/IdeaFramework";
import IdeaFrameworkConsultant from "./pages/IdeaFrameworkConsultant";
import InteractiveIdeaBuilder from "./pages/InteractiveIdeaBuilder";
import IdeaInsight from "./pages/IdeaInsight";
import InsightDrivenLearning from "./pages/InsightDrivenLearning";
import DistinctiveLearning from "./pages/DistinctiveLearning";
import EmotionallyIntelligentLearning from "./pages/EmotionallyIntelligentLearning";
import AuthenticityLearning from "./pages/AuthenticityLearning";
import ResearchLearning from "./pages/ResearchLearning";
import AvatarBuilder from "./pages/AvatarBuilder";
import BrandCanvas from "./pages/BrandCanvas";
import ValueLens from "./pages/ValueLens";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/diagnostic" element={<FreeDiagnostic />} />
              <Route path="/diagnostic/results" element={<DiagnosticResults />} />
              <Route path="/app" element={
                <Layout>
                  <Index />
                </Layout>
              } />
              <Route path="/dashboard" element={
                <Layout>
                  <Dashboard />
                </Layout>
              } />
              <Route path="/brand-diagnostic" element={
                <Layout>
                  <BrandDiagnostic />
                </Layout>
              } />
              <Route path="/idea-diagnostic" element={
                <Layout>
                  <IdeaDiagnostic />
                </Layout>
              } />
              <Route path="/idea" element={
                <Layout>
                  <IdeaFramework />
                </Layout>
              } />
              <Route path="/idea/consultant" element={
                <Layout>
                  <IdeaFrameworkConsultant />
                </Layout>
              } />
              <Route path="/idea/builder" element={
                <Layout>
                  <InteractiveIdeaBuilder />
                </Layout>
              } />
              <Route path="/idea/insight" element={
                <Layout>
                  <IdeaInsight />
                </Layout>
              } />
              <Route path="/insight-driven-learning" element={
                <Layout>
                  <InsightDrivenLearning />
                </Layout>
              } />
              <Route path="/distinctive-learning" element={
                <Layout>
                  <DistinctiveLearning />
                </Layout>
              } />
              <Route path="/emotionally-intelligent-learning" element={
                <Layout>
                  <EmotionallyIntelligentLearning />
                </Layout>
              } />
              <Route path="/authenticity-learning" element={
                <Layout>
                  <AuthenticityLearning />
                </Layout>
              } />
              <Route path="/research-learning" element={
                <Layout>
                  <ResearchLearning />
                </Layout>
              } />
              <Route path="/avatar" element={
                <Layout>
                  <AvatarBuilder />
                </Layout>
              } />
              <Route path="/canvas" element={
                <Layout>
                  <BrandCanvas />
                </Layout>
              } />
              <Route path="/valuelens" element={
                <Layout>
                  <ValueLens />
                </Layout>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
      </TooltipProvider>
    </BrandProvider>
  </AuthProvider>
  </QueryClientProvider>
);

export default App;
