import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandProvider } from "@/contexts/BrandContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import BrandDiagnostic from "./pages/BrandDiagnostic";
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
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/brand-diagnostic" element={<BrandDiagnostic />} />
              <Route path="/diagnostic" element={<IdeaDiagnostic />} />
              <Route path="/idea" element={<IdeaFramework />} />
              <Route path="/idea/consultant" element={<IdeaFrameworkConsultant />} />
              <Route path="/idea/builder" element={<InteractiveIdeaBuilder />} />
              <Route path="/idea/insight" element={<IdeaInsight />} />
               <Route path="/insight-driven-learning" element={<InsightDrivenLearning />} />
               <Route path="/distinctive-learning" element={<DistinctiveLearning />} />
        <Route path="/emotionally-intelligent-learning" element={<EmotionallyIntelligentLearning />} />
          <Route path="/authenticity-learning" element={<AuthenticityLearning />} />
          <Route path="/research-learning" element={<ResearchLearning />} />
                <Route path="/avatar" element={<AvatarBuilder />} />
                <Route path="/canvas" element={<BrandCanvas />} />
                <Route path="/valuelens" element={<ValueLens />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </BrandProvider>
  </AuthProvider>
  </QueryClientProvider>
);

export default App;
