import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  Lightbulb
} from "lucide-react";

export default function Landing() {
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
      description: "Uncover deep customer motivations and emotional triggers",
      color: "from-yellow-500 to-orange-500",
      icon: <Lightbulb className="h-6 w-6" />
    },
    {
      letter: "D",
      title: "Distinctive",
      description: "Stand out with unique brand assets and positioning",
      color: "from-green-500 to-emerald-500",
      icon: <Star className="h-6 w-6" />
    },
    {
      letter: "E",
      title: "Empathetic",
      description: "Connect emotionally with your audience",
      color: "from-pink-500 to-rose-500",
      icon: <Heart className="h-6 w-6" />
    },
    {
      letter: "A",
      title: "Authentic",
      description: "Build genuine, transparent brand relationships",
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
              <Button asChild variant="ghost" className="text-primary-foreground">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Link to="/diagnostic">Free Diagnostic</Link>
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
            Build Brands That Resonate
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Transform from guessing to knowing your customers. Master strategic brand building through our comprehensive learning modules and interactive tools powered by the proven IDEA Strategic Brand Framework™.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button asChild size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-glow">
              <Link to="/diagnostic">
                Take Your Free Brand Diagnostic
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
              <Link to="/auth">
                Sign Up to Access Full Platform
              </Link>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
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
                        <Link to="/auth">Sign Up to Access</Link>
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
                      <Link to="/auth">Sign Up to Access</Link>
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
            <h2 className="text-3xl font-bold mb-4">Professional Brand Building Tools</h2>
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
                        <Link to="/auth">Sign Up to Access</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-hero rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to Build a Brand That Resonates?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Start with our free brand diagnostic to discover your brand's hidden potential and get actionable insights in minutes.
          </p>
          <Button asChild size="lg" variant="coach" className="text-lg px-8 py-6 shadow-glow">
            <Link to="/diagnostic">
              Take Your Free Brand Diagnostic
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