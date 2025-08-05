import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link, useNavigate } from "react-router-dom";
import { useBrand } from "@/contexts/BrandContext";
import { 
  Brain, 
  Target, 
  MessageSquare, 
  Search, 
  Zap, 
  BarChart, 
  BookOpen,
  TrendingUp,
  CheckCircle,
  Clock,
  Heart,
  Star,
  Shield,
  Lightbulb,
  Users,
  ArrowRight,
  PlayCircle,
  Lock
} from "lucide-react";

const coreModules = [
  {
    title: "IDEA Diagnostic",
    description: "Complete brand health assessment using the IDEA Strategic Brand Framework™",
    icon: Brain,
    href: "/diagnostic",
    status: "available" as const
  },
  {
    title: "Avatar 2.0 Builder", 
    description: "Build behavioral customer profiles with emotional triggers and motivations",
    icon: Users,
    href: "/avatar",
    status: "available" as const
  },
  {
    title: "ValueLens Generator",
    description: "AI-powered copy generator for emotionally resonant messaging",
    icon: Zap,
    href: "/valuelens",
    status: "available" as const
  }
];

const ideaModules = [
  {
    title: "Insight Driven",
    description: "Interactive learning module: Deep customer insights and Avatar 2.0",
    icon: Lightbulb,
    href: "/idea/insight",
    status: "available" as const,
    color: "from-yellow-500 to-orange-500"
  },
  {
    title: "Distinctive/Different",
    description: "Stand out at both product and brand level with distinctive assets",
    icon: Star,
    href: "/idea/distinctive",
    status: "available" as const,
    color: "from-green-500 to-emerald-500"
  },
  {
    title: "Emotionally Intelligent", 
    description: "Connect with audience through understanding emotional cues",
    icon: Heart,
    href: "/idea/empathy",
    status: "available" as const,
    color: "from-pink-500 to-rose-500"
  },
  {
    title: "Authoritative & Authentic",
    description: "Be genuine, transparent and create an attractive brand persona",
    icon: Shield,
    href: "/idea/authenticity", 
    status: "available" as const,
    color: "from-blue-500 to-indigo-500"
  }
];

const additionalModules = [
  {
    title: "IDEA Framework Consultant",
    description: "AI-powered strategic guidance expert for the IDEA Strategic Brand Framework™",
    icon: Users,
    href: "/idea/consultant",
    status: "available" as const,
    special: true
  },
  {
    title: "ValueLens Generator",
    description: "AI-powered copy generator for emotionally resonant messaging",
    icon: Zap,
    href: "/valuelens",
    status: "available" as const
  },
  {
    title: "Strategic Brand Research",
    description: "Comprehensive research methods to uncover customer insights and emotional drivers",
    icon: Search,
    href: "/research-learning",
    status: "available" as const
  },
  {
    title: "IDEA Strategic Brand Framework™ Hub",
    description: "Complete guide to the IDEA Strategic Brand Framework™ methodology",
    icon: BookOpen,
    href: "/idea",
    status: "available" as const
  },
  {
    title: "Brand Canvas",
    description: "Visual drag-and-drop canvas for your IDEA Strategic Brand Framework™ strategy",
    icon: MessageSquare,
    href: "/canvas",
    status: "available" as const
  },
  {
    title: "Listing Optimizer",
    description: "Analyze and optimize your product listings for emotional triggers",
    icon: BarChart,
    href: "/optimizer",
    status: "coming-soon" as const
  }
];

// Quick Start Actions for first-time users
const quickStartActions = [
  {
    title: "Start with Brand Diagnostic",
    description: "Get your brand health assessment in 5 minutes",
    href: "/diagnostic",
    icon: Brain,
    primary: true
  },
  {
    title: "Build Your First Avatar",
    description: "Create a detailed customer profile",
    href: "/avatar",
    icon: Users,
    primary: false
  },
  {
    title: "Explore IDEA Strategic Brand Framework™",
    description: "Learn the methodology",
    href: "/idea",
    icon: BookOpen,
    primary: false
  }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { brandData, getCompletionPercentage } = useBrand();
  
  // Calculate real completion percentages
  const overallCompletion = getCompletionPercentage();
  const hasStarted = overallCompletion > 0;
  
  // Calculate specific metrics from actual data
  const avatarsCreated = brandData.avatar.completed ? 1 : 0;
  const diagnosticCompleted = brandData.insight.completed;
  
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-hero rounded-lg p-6 sm:p-8 text-center">
        <div className="flex items-center justify-center mb-6">
          <img 
            src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png" 
            alt="IDEA Brand Coach Logo" 
            className="h-16 sm:h-20 w-auto object-contain"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
          {hasStarted ? `Welcome back to IDEA Brand Coach™` : 'Welcome to IDEA Brand Coach™'}
        </h1>
        <p className="text-lg text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
          {hasStarted 
            ? `Continue building your brand strategy. You're ${overallCompletion}% complete.`
            : 'Build trust-driven, emotionally resonant brands using the IDEA Strategic Brand Framework™. Transform from guessing to knowing your customers.'
          }
        </p>
        {hasStarted ? (
          <Button 
            variant="coach" 
            size="lg" 
            className="shadow-glow"
            onClick={() => navigate('/diagnostic')}
          >
            Continue Your Journey <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button 
            variant="coach" 
            size="lg" 
            className="shadow-glow"
            onClick={() => navigate('/diagnostic')}
          >
            Start Brand Diagnostic <PlayCircle className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Dynamic Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-card shadow-card hover:shadow-brand transition-all duration-300 cursor-pointer" onClick={() => navigate('/diagnostic')}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{overallCompletion}%</p>
                <p className="text-sm text-muted-foreground">Brand Foundation Complete</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Click to {diagnosticCompleted ? 'review' : 'start'} diagnostic</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card hover:shadow-brand transition-all duration-300 cursor-pointer" onClick={() => navigate('/avatar')}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Target className="w-8 h-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{avatarsCreated}</p>
                <p className="text-sm text-muted-foreground">Customer Avatars</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Click to {avatarsCreated > 0 ? 'edit' : 'create'} avatar</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card hover:shadow-brand transition-all duration-300 cursor-pointer relative" onClick={() => navigate('/valuelens')}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Zap className="w-8 h-8 text-secondary" />
                {!brandData.avatar.completed && (
                  <Lock className="w-4 h-4 absolute -top-1 -right-1 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">-</p>
                <p className="text-sm text-muted-foreground">Copy Variants</p>
              </div>
            </div>
            {!brandData.avatar.completed ? (
              <div className="mt-3">
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Complete avatar to unlock</div>
                <div className="text-xs text-muted-foreground">
                  Generate emotionally resonant copy using your customer insights and behavioral triggers
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Ready to use!</div>
                <div className="text-xs text-muted-foreground">
                  Create copy variants that trigger emotional responses based on your avatar data
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Quick Start or Continue Journey */}
          {!hasStarted ? (
            <div>
              <h2 className="text-2xl font-bold mb-6">Quick Start</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {quickStartActions.map((action) => (
                  <Card 
                    key={action.title}
                    className={`hover:shadow-brand transition-all duration-300 cursor-pointer border-2 ${
                      action.primary ? 'border-secondary bg-secondary/5' : 'border-border'
                    }`}
                    onClick={() => navigate(action.href)}
                  >
                    <CardContent className="p-6 text-center">
                      <action.icon className={`w-12 h-12 mx-auto mb-4 ${action.primary ? 'text-secondary' : 'text-muted-foreground'}`} />
                      <h3 className="font-semibold text-lg mb-2">{action.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
                      <Button variant={action.primary ? "default" : "outline"} size="sm">
                        {action.primary ? 'Start Now' : 'Learn More'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-6">Your Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {coreModules.map((module) => (
                  <ModuleCard
                    key={module.title}
                    title={module.title}
                    description={module.description}
                    icon={module.icon}
                    href={module.href}
                    status={module.status}
                  />
                ))}
              </div>
            </div>
          )}

          {/* IDEA Framework Modules */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">IDEA Strategic Brand Framework™</h2>
              <Button variant="outline" size="sm" asChild>
                <Link to="/idea">Learn Framework</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ideaModules.map((module) => (
                <Card 
                  key={module.title} 
                  className={`bg-gradient-to-br ${module.color} text-white shadow-card hover:shadow-brand transition-all duration-300 border-0 cursor-pointer transform hover:scale-105`}
                  onClick={(e) => {
                    console.log('Card clicked!', module.title, module.href);
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(module.href);
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <module.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{module.title}</h3>
                        <p className="text-white/90 text-sm leading-relaxed mb-4">{module.description}</p>
                        <div className="flex items-center text-white/80 text-sm">
                          <span>Click to explore</span>
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Additional Modules */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Additional Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {additionalModules.map((module) => (
                module.special ? (
                  <Card 
                    key={module.title}
                    className="bg-gradient-to-br from-secondary/10 to-primary/10 border-secondary/20 shadow-glow hover:shadow-brand transition-all duration-300 cursor-pointer transform hover:scale-105"
                    onClick={() => navigate(module.href)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-gradient-to-br from-secondary to-primary rounded-lg">
                          <module.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{module.title}</h3>
                          <p className="text-muted-foreground text-sm leading-relaxed mb-4">{module.description}</p>
                          <div className="flex items-center text-secondary text-sm font-medium">
                            <span>Ask Strategic Questions</span>
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <ModuleCard
                    key={module.title}
                    title={module.title}
                    description={module.description}
                    icon={module.icon}
                    href={module.href}
                    status={module.status}
                  />
                )
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Meet Your Brand Strategist */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Meet Your Brand Strategist</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <img 
                  src="/lovable-uploads/9d0d469a-cd07-4743-9db7-d82dea0751e5.png" 
                  alt="Trevor Bradford" 
                  className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                />
                <div>
                  <h4 className="font-semibold">Trevor Bradford</h4>
                  <p className="text-sm text-muted-foreground">Behavioral Brand Strategist</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong>Brand Strategist, Ecommerce Expert, Conversion Master, Author</strong><br/>
                Creator of the IDEA Strategic Brand Framework™<br/><br/>
                
                With over 35 years of experience in branding as an agency owner, including 15 years in online retail, Trevor has collaborated with a wide range of clients from nationwide retailers, globally famous brands and emerging entrepreneurs.<br/><br/>
                
                Trevor is an industry authority on branding and marketing and has helped hundreds of e-commerce entrepreneurs build trust-first strategies that drive sales conversions and reduce true advertising cost of sale (TACOS).
              </p>
              <div className="flex flex-col space-y-2">
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.open('https://calendly.com/trevor-bradford-idea/30min', '_blank')}
                >
                  Book Personal Consultation
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.open('https://www.linkedin.com/in/trevor-bradford-51982b9/', '_blank')}
                >
                  Connect on LinkedIn
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Real Progress */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart className="w-5 h-5" />
                <span>Your Progress</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Brand Foundation</span>
                  <span>{overallCompletion}%</span>
                </div>
                <Progress value={overallCompletion} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Customer Avatar</span>
                  <span>{avatarsCreated > 0 ? '100' : '0'}%</span>
                </div>
                <Progress value={avatarsCreated > 0 ? 100 : 0} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Message Clarity</span>
                  <span>{brandData.brandCanvas.completed ? '100' : '0'}%</span>
                </div>
                <Progress value={brandData.brandCanvas.completed ? 100 : 0} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Next Steps</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!diagnosticCompleted ? (
                  <div className="flex items-start space-x-3 p-3 bg-secondary/10 rounded-lg cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => navigate('/diagnostic')}>
                    <PlayCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Start Brand Diagnostic</p>
                      <p className="text-xs text-muted-foreground">Get your foundation assessment</p>
                    </div>
                  </div>
                ) : avatarsCreated === 0 ? (
                  <div className="flex items-start space-x-3 p-3 bg-secondary/10 rounded-lg cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => navigate('/avatar')}>
                    <PlayCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Build Customer Avatar</p>
                      <p className="text-xs text-muted-foreground">Define your ideal customer</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-3 p-3 bg-secondary/10 rounded-lg cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => navigate('/valuelens')}>
                    <PlayCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Generate Copy Variants</p>
                      <p className="text-xs text-muted-foreground">Create resonant messaging</p>
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium mb-1">Complete your brand foundation:</p>
                  <p>✓ {diagnosticCompleted ? 'Diagnostic completed' : 'Start with diagnostic'}</p>
                  <p>✓ {avatarsCreated > 0 ? 'Avatar created' : 'Build customer avatar'}</p>
                  <p>✓ Generate emotional copy variants</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}