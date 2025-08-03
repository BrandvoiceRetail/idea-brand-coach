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
                <BrandProvider>
                  <Layout>
                    <Index />
                  </Layout>
                </BrandProvider>
              } />
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
              <Route path="/idea/builder" element={
                <BrandProvider>
                  <Layout>
                    <InteractiveIdeaBuilder />
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
              <Route path="/insight-driven-learning" element={
                <BrandProvider>
                  <Layout>
                    <InsightDrivenLearning />
                  </Layout>
                </BrandProvider>
              } />
              <Route path="/distinctive-learning" element={
                <BrandProvider>
                  <Layout>
                    <DistinctiveLearning />
                  </Layout>
                </BrandProvider>
              } />
              <Route path="/emotionally-intelligent-learning" element={
                <BrandProvider>
                  <Layout>
                    <EmotionallyIntelligentLearning />
                  </Layout>
                </BrandProvider>
              } />
              <Route path="/authenticity-learning" element={
                <BrandProvider>
                  <Layout>
                    <AuthenticityLearning />
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
              <Route path="/valuelens" element={
                <BrandProvider>
                  <Layout>
                    <ValueLens />
                  </Layout>
                </BrandProvider>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
