
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { 
  Brain, 
  Target, 
  MessageSquare, 
  Search, 
  Zap, 
  BarChart, 
  BookOpen,
  Menu,
  X,
  LogOut,
  User,
  FlaskConical
} from "lucide-react";
import { BetaNavigationWidget } from "@/components/BetaNavigationWidget";

const navItems = [
  { name: "Home", href: "/", icon: Brain },
  { name: "Brand Diagnostic", href: "/diagnostic", icon: Brain },
  { name: "Dashboard", href: "/dashboard", icon: BarChart },
  { name: "IDEA Framework", href: "/idea", icon: BookOpen },
  { name: "Brand Coach", href: "/idea/consultant", icon: MessageSquare },
  { name: "Avatar 2.0", href: "/avatar", icon: Target },
  { name: "Brand Canvas", href: "/canvas", icon: MessageSquare },
  { name: "ValueLens", href: "/value-lens", icon: Zap },
  { name: "Beta Testing", href: "/beta", icon: FlaskConical },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();

  // Show auth page without layout if not authenticated and not on auth or home page
  if (!user && location.pathname !== '/auth' && location.pathname !== '/' && location.pathname !== '/diagnostic') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to IDEA Brand Coach</h1>
          <p className="text-muted-foreground mb-6">Please sign in to access your brand coaching tools.</p>
          <Link to="/auth">
            <Button>Sign In / Sign Up</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-primary border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center mr-8">
              <img 
                src="/lovable-uploads/deb8c3dd-04b6-4d99-8cb3-07a33cf70ebb.png" 
                alt="IDEA Brand Coach - Build Emotionally Resonant Brands" 
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  console.error('Logo failed to load:', e);
                }}
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <nav className="flex space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        isActive
                          ? "bg-secondary text-secondary-foreground shadow-brand"
                          : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/20"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              
              {user && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 text-primary-foreground/80">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={signOut}
                    className="text-primary-foreground/80 hover:text-primary-foreground"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-primary/90 backdrop-blur-sm border-t border-primary-foreground/20">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/20"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <BetaNavigationWidget />
    </div>
  );
}
