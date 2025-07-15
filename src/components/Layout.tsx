import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  Target, 
  MessageSquare, 
  Search, 
  Zap, 
  BarChart, 
  BookOpen,
  Menu,
  X
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: BarChart },
  { name: "IDEA Diagnostic", href: "/diagnostic", icon: Brain },
  { name: "Avatar Builder", href: "/avatar", icon: Target },
  { name: "ValueLens", href: "/valuelens", icon: Zap },
  { name: "Brand Canvas", href: "/canvas", icon: MessageSquare },
  { name: "Listing Optimizer", href: "/optimizer", icon: Search },
  { name: "Resources", href: "/resources", icon: BookOpen },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-primary shadow-brand border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-secondary rounded-md flex items-center justify-center">
                <Brain className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">IDEA Brand Coach</h1>
                <p className="text-sm text-primary-foreground/80">Build Emotionally Resonant Brands</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
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