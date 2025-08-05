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
  User
} from "lucide-react";

const navItems = [
  { name: "Home", href: "/app", icon: Brain },
  { name: "Brand Diagnostic", href: "/diagnostic", icon: Brain },
  { name: "Dashboard", href: "/dashboard", icon: BarChart },
  { name: "IDEA Strategic Brand Framework™", href: "/idea", icon: BookOpen },
  { name: "Avatar 2.0", href: "/avatar", icon: Target },
  { name: "Brand Canvas", href: "/canvas", icon: MessageSquare },
  { name: "ValueLens", href: "/valuelens", icon: Zap },
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
      <header className="sticky top-0 z-50 bg-gradient-primary shadow-brand border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/app" className="flex items-center">
              <img 
                src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png" 
                alt="IDEA Brand Coach - Build Emotionally Resonant Brands" 
                className="h-28 w-auto object-contain"
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
    </div>
  );
}