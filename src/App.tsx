import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import BrandDiagnostic from "./pages/BrandDiagnostic";
import IdeaDiagnostic from "./pages/IdeaDiagnostic";
import IdeaFramework from "./pages/IdeaFramework";
import InteractiveIdeaBuilder from "./pages/InteractiveIdeaBuilder";
import IdeaInsight from "./pages/IdeaInsight";
import AvatarBuilder from "./pages/AvatarBuilder";
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
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/brand-diagnostic" element={<BrandDiagnostic />} />
              <Route path="/diagnostic" element={<IdeaDiagnostic />} />
              <Route path="/idea" element={<IdeaFramework />} />
              <Route path="/idea/builder" element={<InteractiveIdeaBuilder />} />
              <Route path="/idea/insight" element={<IdeaInsight />} />
              <Route path="/avatar" element={<AvatarBuilder />} />
              <Route path="/valuelens" element={<ValueLens />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
