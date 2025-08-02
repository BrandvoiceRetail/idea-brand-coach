import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function Index() {
  const navigate = useNavigate();
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
      icon: <Lightbulb className="h-6 w-6" />,
      href: "/insight-driven-learning"
    },
    {
      letter: "D",
      title: "Distinctive",
      description: "Stand out with unique brand assets and positioning",
      color: "from-green-500 to-emerald-500",
      icon: <Star className="h-6 w-6" />,
      href: "/distinctive-learning"
    },
    {
      letter: "E",
      title: "Empathetic",
      description: "Connect emotionally with your audience",
      color: "from-pink-500 to-rose-500",
      icon: <Heart className="h-6 w-6" />,
      href: "/emotionally-intelligent-learning"
    },
    {
      letter: "A",
      title: "Authentic",
      description: "Build genuine, transparent brand relationships",
      color: "from-blue-500 to-indigo-500",
      icon: <Shield className="h-6 w-6" />,
      href: "/authenticity-learning"
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
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-2">
            <TrendingUp className="h-4 w-4 mr-2" />
            AI-Powered Brand Strategy Platform
          </Badge>
          
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
            IDEA Brand Coach™
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Transform from guessing to knowing your customers. Build trust-driven, emotionally resonant brands 
            using the IDEA Strategic Brand Framework™ and AI-powered tools.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button asChild size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-glow">
              <Link to="/brand-diagnostic">
                Start Free Brand Diagnostic
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
              <Link to="/dashboard">
                Explore Tools
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
            <h2 className="text-3xl font-bold mb-4">Interactive Learning Modules</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Master the IDEA Strategic Brand Framework™ through hands-on, step-by-step learning experiences
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ideaPillars.map((pillar, index) => (
              <Card 
                key={index} 
                className={`bg-gradient-to-br ${pillar.color} text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105`}
                onClick={() => {
                  console.log('Pillar clicked:', pillar.title, pillar.href);
                  navigate(pillar.href);
                }}
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">{pillar.letter}</span>
                  </div>
                  <div className="mb-3">
                    {pillar.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{pillar.title}</h3>
                  <p className="text-white/90 text-sm">{pillar.description}</p>
                  <div className="mt-4 text-white/80 text-xs">
                    Click to explore →
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Research Module */}
          <div className="mt-8 text-center">
            <Card className="max-w-md mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105" onClick={() => navigate('/research-learning')}>
              <CardContent className="p-6">
                <div className="mb-4">
                  <Search className="h-8 w-8 text-white mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Strategic Brand Research</h3>
                <p className="text-white/90 leading-relaxed mb-4">Learn comprehensive research methods to uncover customer insights and emotional drivers</p>
                <div className="text-white/80 text-sm">
                  Click to explore →
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Build a Winning Brand</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools and frameworks to develop, test, and optimize your brand strategy
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:shadow-lg transition-all duration-300 bg-gradient-card">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  Real Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">87%</div>
                  <div className="text-sm text-muted-foreground">Improved customer engagement after using IDEA Strategic Brand Framework™</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">64%</div>
                  <div className="text-sm text-muted-foreground">Increase in conversion rates with optimized messaging</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">92%</div>
                  <div className="text-sm text-muted-foreground">Users report clearer brand positioning</div>
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
            <Link to="/brand-diagnostic">
              Get Your Free Brand Diagnostic
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