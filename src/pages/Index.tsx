import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBrand } from "@/contexts/BrandContext";

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
  Play,
  Clock,
  ChevronRight,
  Award,
  BookOpen,
  PenTool,
  MessageSquare,
  Calendar
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const { brandData, getCompletionPercentage } = useBrand();
  const completionPercentage = getCompletionPercentage();

  const processSteps = [
    {
      step: 1,
      title: "Brand Diagnostic",
      description: "Discover your brand's current strengths and gaps",
      icon: <Search className="h-6 w-6" />,
      time: "5 min",
      href: "/diagnostic",
      color: "from-blue-500 to-indigo-500",
      status: "available"
    },
    {
      step: 2,
      title: "I - Insight Driven",
      description: "Uncover deep customer motivations and emotional triggers",
      icon: <Lightbulb className="h-6 w-6" />,
      time: "15 min",
      href: "/idea/insight",
      color: "from-yellow-500 to-orange-500",
      status: "requires-signup"
    },
    {
      step: 3,
      title: "D - Distinctive",
      description: "Stand out with unique brand assets and positioning",
      icon: <Star className="h-6 w-6" />,
      time: "20 min",
      href: "/idea/distinctive",
      color: "from-green-500 to-emerald-500",
      status: "requires-signup"
    },
    {
      step: 4,
      title: "E - Empathetic",
      description: "Connect emotionally with your audience",
      icon: <Heart className="h-6 w-6" />,
      time: "15 min",
      href: "/idea/empathy",
      color: "from-pink-500 to-rose-500",
      status: "requires-signup"
    },
    {
      step: 5,
      title: "A - Authentic",
      description: "Build genuine, transparent brand relationships",
      icon: <Shield className="h-6 w-6" />,
      time: "15 min",
      href: "/idea/authenticity",
      color: "from-blue-500 to-indigo-500",
      status: "requires-signup"
    }
  ];

  const brandTools = [
    {
      title: "Avatar 2.0 Builder",
      description: "Create detailed customer personas with behavioral triggers",
      icon: <Users className="h-6 w-6" />,
      time: "30 min",
      href: "/avatar",
      status: "requires-signup"
    },
    {
      title: "Brand Canvas",
      description: "Map your complete brand strategy on one page",
      icon: <BookOpen className="h-6 w-6" />,
      time: "45 min",
      href: "/canvas",
      status: "requires-signup"
    },
    {
      title: "ValueLens Generator",
      description: "Generate emotionally resonant copy variations",
      icon: <PenTool className="h-6 w-6" />,
      time: "20 min",
      href: "/value-lens",
      status: "requires-signup"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      {/* Header Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center max-w-4xl mx-auto mb-12">
          <Badge variant="outline" className="mb-6 px-4 py-2">
            <Brain className="h-4 w-4 mr-2" />
            IDEA Strategic Brand Framework™ Process Overview
          </Badge>
          
          <h1 className="text-4xl font-bold mb-6">
            Your Strategic Brand Building Journey
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Follow this proven step-by-step process to build an emotionally resonant brand that converts. Each step builds on the previous one to create a complete brand strategy.
          </p>

          {brandData && (
            <div className="bg-gradient-card rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Your Progress</h3>
                <Badge variant="secondary">{completionPercentage}% Complete</Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Step-by-Step Process Flow */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">The IDEA Framework Process</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Follow this proven 5-step process to build your strategic brand foundation
            </p>
          </div>
          
          <div className="space-y-8">
            {processSteps.map((step, index) => (
              <div key={step.step} className="relative">
                {/* Connector Line */}
                {index < processSteps.length - 1 && (
                  <div className="absolute left-8 top-20 w-0.5 h-12 bg-gradient-to-b from-primary to-primary/50 z-0" />
                )}
                
                <Card className="relative overflow-hidden border-l-4 border-l-primary shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-6">
                      {/* Step Number Circle */}
                      <div className={`flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br ${step.color} text-white flex items-center justify-center font-bold text-xl shadow-lg`}>
                        {step.step}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            {step.icon}
                            <h3 className="text-xl font-bold">{step.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{step.time}</span>
                          </div>
                          {step.status === "requires-signup" && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Premium
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                          {step.description}
                        </p>
                        
                        <div className="flex gap-4">
                          {step.status === "available" ? (
                            <Button asChild>
                              <Link to={step.href}>
                                <Play className="h-4 w-4 mr-2" />
                                Start Step {step.step}
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild variant="outline">
                               <Link to={step.href}>
                                 <Shield className="h-4 w-4 mr-2" />
                                 Get Started Free
                               </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Arrow */}
                      <div className="flex-shrink-0">
                        <ChevronRight className="h-6 w-6 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Building Tools */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Essential Brand Building Tools</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              After completing the IDEA framework, use these tools to implement your strategy
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {brandTools.map((tool, index) => (
              <Card key={index} className="border-border/50 hover:shadow-lg transition-all duration-300 bg-gradient-card">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{tool.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{tool.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {tool.description}
                  </p>
                  
                   <Button asChild variant="outline" className="w-full">
                      <Link to={tool.href}>
                        <Shield className="h-4 w-4 mr-2" />
                        Get Started Free
                      </Link>
                   </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* About Trevor Bradford Section */}
        <div className="mb-16">
          <Card className="bg-gradient-hero text-primary-foreground border-0 shadow-xl">
            <CardContent className="p-12">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Trevor's Image */}
                <div className="text-center lg:text-left">
                  <div className="mb-6">
                    <img 
                      src="/lovable-uploads/2a42657e-2e28-4ddd-b7bf-83ae6a8b6ffa.png" 
                      alt="Trevor Bradford - Brand Strategist" 
                      className="w-48 h-48 rounded-full mx-auto lg:mx-0 object-cover shadow-lg border-4 border-white/20"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Trevor Bradford</h3>
                  <p className="text-primary-foreground/90 mb-6">
                    Brand Strategist, E-commerce Expert, Author
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <Button 
                      asChild 
                      size="lg" 
                      variant="coach" 
                      className="bg-white text-primary hover:bg-white/90"
                    >
                      <a href="https://www.linkedin.com/in/trevor-bradford-51982b9/" target="_blank" rel="noopener noreferrer">
                        View LinkedIn Profile
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    
                    <Button 
                      asChild 
                      size="lg" 
                      variant="outline" 
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <a href="https://calendly.com/trevor-bradford-idea/30min" target="_blank" rel="noopener noreferrer">
                        <Calendar className="mr-2 h-4 w-4" />
                        Book Consultation
                      </a>
                    </Button>
                  </div>
                </div>
                
                {/* Trevor's Bio */}
                <div>
                  <h4 className="text-xl font-bold mb-6">
                    Creator of the IDEA Strategic Brand Framework™
                  </h4>
                  
                    <div className="space-y-4 text-primary-foreground/90 leading-relaxed">
                      <p>
                        Distinguished brand strategist and e-commerce expert with expertise rooted in behavioral sciences. Trevor has systematized how businesses approach branding by integrating customer behavioral triggers with growth strategies.
                      </p>
                      <p>
                        As the author of "What Captures The Heart Goes In The Cart," Trevor combines behavioral science with strategic creativity to help Amazon, Shopify and DTC sellers stand out and scale up.
                      </p>
                      <p>
                        His consultancy work has helped hundreds of entrepreneurs build trust-first strategies that drive sales conversions and reduce advertising costs.
                      </p>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
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