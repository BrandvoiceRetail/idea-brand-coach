import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { 
  Target, 
  Brain, 
  Zap, 
  Users, 
  ArrowRight, 
  CheckCircle, 
  Star,
  TrendingUp,
  Heart,
  Shield,
  Search,
  Lightbulb,
  Calendar
} from "lucide-react";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: <Brain className="h-8 w-8 text-primary" />,
      title: "IDEA Strategic Brand Framework™",
      description: "Build trust-driven, emotionally resonant brands with our proven methodology"
    },
    {
      icon: <Target className="h-8 w-8 text-primary" />,
      title: "Avatar 2.0 Builder",
      description: "Create behavioral customer profiles with deep emotional triggers"
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: "AI-Powered Copy Generation",
      description: "Generate emotionally resonant messaging that converts"
    }
  ];

  const ideaPillars = [
    {
      letter: "I",
      title: "Insight Driven",
      description: "Unlock the emotional triggers that drive your customers' decisions and build strategies that speak to their hearts.",
      color: "from-yellow-500 to-orange-500",
      icon: <Lightbulb className="h-6 w-6" />
    },
    {
      letter: "D",
      title: "Distinctive",
      description: "Craft a brand identity that stands out in a crowded market and leaves a lasting impression.",
      color: "from-green-500 to-emerald-500",
      icon: <Star className="h-6 w-6" />
    },
    {
      letter: "E",
      title: "Empathetic",
      description: "Forge deep emotional connections with your audience by understanding their true needs.",
      color: "from-pink-500 to-rose-500",
      icon: <Heart className="h-6 w-6" />
    },
    {
      letter: "A",
      title: "Authentic",
      description: "Build trust and loyalty by creating a brand that's as real as the people you serve.",
      color: "from-blue-500 to-indigo-500",
      icon: <Shield className="h-6 w-6" />
    }
  ];

  const benefits = [
    "Stop guessing what your customers want",
    "Create messaging that actually converts",
    "Build a distinctive brand position",
    "Connect emotionally with your audience",
    "Generate AI-powered copy variations",
    "Track your brand health progress"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      {/* Header */}
      <header className="bg-gradient-primary shadow-brand border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <img 
                src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png" 
                alt="IDEA Brand Coach - Strategic Brand Framework Platform" 
                className="h-28 w-auto object-contain"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" className="text-primary-foreground hover:bg-white/10">
                <Link to="/auth" style={{ textDecoration: 'none' }}>Sign In</Link>
              </Button>
              <Button asChild className="bg-white text-primary hover:bg-white/90 font-semibold">
                <Link to="/auth" style={{ textDecoration: 'none' }}>Get Started Free</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <Badge variant="outline" className="mb-8 px-4 py-2">
            <TrendingUp className="h-4 w-4 mr-2" />
            AI-Powered Brand Strategy Platform
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Turn Customers Into Lifelong Fans With Brands That Truly Resonate
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Stop Guessing, Start Connecting. Master the proven IDEA Strategic Brand Framework™ to build trust-driven brands that captivate hearts and drive results.
          </p>
          
          <div className="flex justify-center mb-8">
            <Button asChild size="lg" className="text-xl px-12 py-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-glow">
              <Link to="/diagnostic">
                <div className="text-center">
                  <div className="font-bold">Take Free Brand Diagnostic Now</div>
                  <div className="text-base font-normal">Discover Your Brand's Hidden Potential</div>
                </div>
                <ArrowRight className="ml-3 h-6 w-6" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>Free to Start</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>5-Minute Setup</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>Instant Results</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-primary/20 hover:bg-primary/5">
              <Link 
                to="/auth" 
                onClick={() => console.log('Start Your Free Account clicked')}
              >
                Start Your Free Account
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="text-lg px-8 py-6 text-primary hover:bg-primary/5">
              <Link to="/diagnostic">
                Try Free Diagnostic
              </Link>
            </Button>
          </div>
        </div>

        {/* Learning Modules Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Master the IDEA Strategic Brand Framework™</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive learning modules that teach you to build emotionally resonant brands step-by-step
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 inline mr-2" />
              Premium modules require account signup
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ideaPillars.map((pillar, index) => (
              <Card 
                key={index} 
                className={`bg-gradient-to-br ${pillar.color} text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden`}
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">{pillar.letter}</span>
                  </div>
                  <div className="mb-3">
                    {pillar.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{pillar.title}</h3>
                  <p className="text-white/90 text-sm mb-4">{pillar.description}</p>
                  
                  {/* Sign Up Overlay */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <div className="text-center p-4">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-white" />
                      <p className="text-white font-semibold mb-2">Premium Content</p>
                      <Button 
                        asChild 
                        size="sm" 
                        variant="secondary"
                        className="bg-white text-gray-900 hover:bg-gray-100"
                      >
                        <Link to="/auth">Unlock Premium</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Research Module */}
          <div className="mt-8 text-center">
            <Card className="max-w-md mx-auto bg-gradient-to-br from-yellow-300 to-yellow-500 text-gray-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
              <CardContent className="p-6">
                <div className="mb-4">
                  <Search className="h-8 w-8 text-gray-800 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">Strategic Brand Research</h3>
                <p className="text-gray-800/90 leading-relaxed mb-4">Learn comprehensive research methods to uncover customer insights and emotional drivers</p>
                
                {/* Sign Up Overlay */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                  <div className="text-center p-4">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-white" />
                    <p className="text-white font-semibold mb-2">Premium Content</p>
                    <Button 
                      asChild 
                      size="sm" 
                      variant="secondary"
                      className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                       <Link to="/auth">Unlock Premium</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Premium Tools Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">AI-Powered Tools to Build, Test, and Perfect Your Brand Strategy</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Advanced AI-powered tools to develop, test, and optimize your brand strategy
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              <Target className="h-4 w-4 inline mr-2" />
              Professional tools require account creation
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:shadow-lg transition-all duration-300 bg-gradient-card relative overflow-hidden group">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">{feature.description}</p>
                  
                  {/* Sign Up Overlay */}
                  <div className="absolute inset-0 bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="text-center p-4">
                      <Target className="h-8 w-8 mx-auto mb-2 text-primary-foreground" />
                      <p className="text-primary-foreground font-semibold mb-2">Professional Tool</p>
                      <Button 
                        asChild 
                        size="sm" 
                        variant="secondary"
                      >
                        <Link to="/auth">Access Tools</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Sign Up Button Above Benefits */}
        <div className="text-center mb-16">
          <Button asChild size="lg" className="text-xl px-12 py-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-glow">
            <Link 
              to="/auth"
              onClick={() => console.log('Start Building Your Brand Today clicked')}
            >
              <div className="text-center">
                <div className="font-bold">Start Building Your Brand Today</div>
                <div className="text-base font-normal">Join Thousands of Successful Entrepreneurs</div>
              </div>
            </Link>
          </Button>
        </div>

        {/* Benefits and Author Section */}
        <div className="mb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Why Brand Builders Choose IDEA Coach</h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="bg-gradient-card shadow-lg">
              <CardContent className="p-8 space-y-4">
                <div className="text-center mb-4">
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-primary mb-2">Trevor Bradford</h3>
                  <p className="text-sm text-muted-foreground">Brand Strategist, Ecommerce Expert, Conversion Master, Author</p>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
                  <p>
                    Distinguished brand strategist, e-commerce expert, and serial entrepreneur with expertise rooted in behavioral sciences.
                  </p>
                  <p>
                    Trevor has systematized how businesses approach branding by integrating customer behavioral triggers with e-commerce growth strategies.
                  </p>
                </div>
                <div className="mt-6">
                  <Button 
                    asChild 
                    variant="brand" 
                    className="w-full"
                  >
                    <a 
                      href="https://ideabrandconsultancy.com/calendar-page" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Book Free 30-Minute Consultation
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-hero rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to Build a Brand That Resonates?
          </h2>
          <div className="text-left max-w-2xl mx-auto mb-8">
            <p className="text-lg text-primary-foreground/90 mb-4">
              Your Free Brand Diagnostic will reveal:
            </p>
            <ul className="text-primary-foreground/90 space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary-foreground flex-shrink-0" />
                The emotional drivers behind your customers' decisions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary-foreground flex-shrink-0" />
                Key areas where your brand can stand out
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary-foreground flex-shrink-0" />
                Actionable insights to strengthen your brand's connection with your audience
              </li>
            </ul>
            <p className="text-primary-foreground/90">
              No sign-up required. Instant results.
            </p>
          </div>
          <Button asChild size="lg" variant="coach" className="text-lg px-8 py-6 shadow-glow">
            <Link to="/diagnostic">
              Discover Your Brand's Hidden Potential — Take the Free Diagnostic Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <p className="text-sm text-primary-foreground/80 mt-4">
            No credit card required • 5-minute assessment • Instant results
          </p>
        </div>
      </div>
    </div>
  );
}