
import { useState, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  Menu,
  X,
  LogOut,
  User,
  Home as HomeIcon,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { BetaNavigationWidget } from "@/components/BetaNavigationWidget";
import { getNavigationFeatures, getCurrentPhase } from "@/config/features";
import { usePriorityNav } from "@/hooks/usePriorityNav";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Get all navigation items based on current deployment phase
  const allNavItems = useMemo(() => {
    const currentPhase = getCurrentPhase();
    const features = getNavigationFeatures(currentPhase);

    const items: NavItem[] = [];

    features.forEach((feature, index) => {
      items.push({
        name: feature.name,
        href: feature.route,
        icon: feature.icon,
      });

      // Insert Home after the first feature (Brand Diagnostic) - only for P1+
      if (index === 0 && currentPhase !== 'P0') {
        items.push({ name: "Home", href: "/", icon: HomeIcon });
      }
    });

    return items;
  }, []);

  // Dynamic Priority+ navigation
  const { visibleItems, overflowItems, measureRef } = usePriorityNav({
    items: allNavItems,
    containerRef: navContainerRef,
    moreButtonWidth: 80,
    userMenuWidth: user ? 50 : 0,
    itemGap: 4,
  });

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
          <div className="flex items-center h-16 sm:h-20 md:h-24 gap-2">
            {/* Logo - fixed minimum size, never shrinks */}
            <Link to="/start-here" className="flex-shrink-0">
              <img 
                src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png" 
                alt="IDEA Brand Coach" 
                className="h-12 sm:h-16 md:h-20 w-auto min-w-[120px] sm:min-w-[150px] object-contain"
              />
            </Link>

            {/* Desktop Navigation - Dynamic Priority+ */}
            <div 
              ref={navContainerRef}
              className="hidden md:flex items-center flex-1 min-w-0"
            >
              {/* Visible nav items */}
              <nav className="flex items-center gap-1">
                {visibleItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      ref={(node) => measureRef(node, index)}
                      to={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-secondary text-secondary-foreground shadow-brand"
                          : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/20"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Overflow nav items - "More" dropdown */}
              {overflowItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/20 ml-1 flex-shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      <span className="ml-1">More</span>
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    {overflowItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.href;
                      return (
                        <DropdownMenuItem key={item.name} asChild>
                          <Link
                            to={item.href}
                            className={`flex items-center gap-2 cursor-pointer ${
                              isActive ? "bg-accent" : ""
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Spacer to push user menu to the right */}
              <div className="flex-1" />

              {/* User dropdown menu */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary/20 flex-shrink-0"
                    >
                      <User className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {user.email}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary-foreground ml-auto"
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
              {allNavItems.map((item) => {
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
              
              {user && (
                <>
                  <div className="border-t border-primary-foreground/20 my-2" />
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 text-primary-foreground/80 mb-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm truncate">{user.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        signOut();
                      }}
                      className="w-full justify-start text-primary-foreground/80 hover:text-primary-foreground"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </>
              )}
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
