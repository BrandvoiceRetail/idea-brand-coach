import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  BookOpen, 
  Lightbulb, 
  Star, 
  Heart, 
  Shield, 
  ArrowRight,
  Target,
  Users,
  TrendingUp
} from "lucide-react";

export default function IdeaFramework() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="w-20 h-20 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-10 h-10 text-secondary-foreground" />
        </div>
        <h1 className="text-4xl font-bold mb-4">The IDEA Strategic Brand Framework™</h1>
        <p className="text-xl text-muted-foreground mb-6">
          A practical, step-by-step process to build trust, stand out in crowded markets, 
          and turn hesitant browsers into loyal buyers.
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Based on Behavioral Science</span>
          <span>•</span>
          <span>Authentically Human Brands</span>
          <span>•</span>
          <span>Capture Hearts & Convert</span>
        </div>
      </div>

      {/* Framework Overview */}
      <Card className="bg-gradient-card shadow-brand">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">The Four Pillars of Trust</h2>
            <p className="text-muted-foreground">
              Create brands that people trust, remember, and choose through these interconnected principles
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Insight Driven */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto">
                <Lightbulb className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Insight Driven</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Gather deep insights about customers' motivations and emotional triggers
                </p>
              </div>
            </div>

            {/* Distinctive/Different */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <Star className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Distinctive/Different</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Stand out at both product and brand level with distinctive assets
                </p>
              </div>
            </div>

            {/* Emotionally Intelligent */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Emotionally Intelligent</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Connect with audience through understanding emotional cues
                </p>
              </div>
            </div>

            {/* Authoritative & Authentic */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Authoritative & Authentic</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Be genuine, transparent and create an attractive brand persona
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 p-6 bg-secondary/10 rounded-lg">
            <h4 className="font-bold text-xl mb-2">TRUST</h4>
            <p className="text-muted-foreground">
              All four pillars work together to build the ultimate goal: unshakeable customer trust
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Deep Dive Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Insight Driven */}
        <Card className="hover:shadow-brand transition-all duration-300">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Insight Driven</CardTitle>
                <CardDescription>Understanding Customer Psychology</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move beyond demographics to psychographics. Understand the emotional and psychological 
              drivers behind customer behavior through behavioral science.
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Target className="w-4 h-4 mr-2 text-yellow-600" />
                <span>Buyer Intent Analysis</span>
              </div>
              <div className="flex items-center text-sm">
                <Users className="w-4 h-4 mr-2 text-yellow-600" />
                <span>Motivation Mapping</span>
              </div>
              <div className="flex items-center text-sm">
                <Heart className="w-4 h-4 mr-2 text-yellow-600" />
                <span>Emotional Trigger Identification</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/idea/insight">
                Explore Insight Module <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Distinctive/Different */}
        <Card className="hover:shadow-brand transition-all duration-300">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Distinctive/Different</CardTitle>
                <CardDescription>Brand Differentiation Strategy</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stand out in customers' minds with unique positioning and distinctive brand assets 
              that create memorable, ownable brand experiences.
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                <span>Unique Value Proposition</span>
              </div>
              <div className="flex items-center text-sm">
                <Star className="w-4 h-4 mr-2 text-green-600" />
                <span>Brand Personality</span>
              </div>
              <div className="flex items-center text-sm">
                <Target className="w-4 h-4 mr-2 text-green-600" />
                <span>Market Positioning</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/idea/distinctive">
                Explore Distinctiveness <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Emotionally Intelligent */}
        <Card className="hover:shadow-brand transition-all duration-300">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Emotionally Intelligent</CardTitle>
                <CardDescription>Empathy & Emotional Connection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect with your audience on an emotional level by understanding and responding 
              to their deepest fears, hopes, and desires.
            </p>
            <div className="space-y-2">
              <Badge variant="secondary" className="text-xs">Hope</Badge>
              <Badge variant="secondary" className="text-xs">Belonging</Badge>
              <Badge variant="secondary" className="text-xs">Validation</Badge>
              <Badge variant="secondary" className="text-xs">Trust</Badge>
              <Badge variant="secondary" className="text-xs">Relief</Badge>
              <Badge variant="secondary" className="text-xs">Aspiration</Badge>
              <Badge variant="secondary" className="text-xs">Empowerment</Badge>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/idea/empathy">
                Explore Empathy Module <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Authoritative & Authentic */}
        <Card className="hover:shadow-brand transition-all duration-300">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Authoritative & Authentic</CardTitle>
                <CardDescription>Genuine Brand Voice</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Be genuine, transparent, and true to your brand's values. Create an attractive 
              brand persona that customers trust and want to engage with.
            </p>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                <span>Brand Transparency</span>
              </div>
              <div className="flex items-center text-sm">
                <Users className="w-4 h-4 mr-2 text-blue-600" />
                <span>Consistent Voice</span>
              </div>
              <div className="flex items-center text-sm">
                <Heart className="w-4 h-4 mr-2 text-blue-600" />
                <span>Value Alignment</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/idea/authenticity">
                Explore Authenticity <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* AI Consultant Section */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-secondary/20 shadow-glow">
        <CardContent className="p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">IDEA Framework Consultant</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Get personalized AI guidance from our IDEA Strategic Brand Framework expert. 
              Ask questions, upload your documents, and receive tailored strategic advice 
              to strengthen your brand foundation.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <Badge variant="secondary" className="text-xs">Behavioral Science</Badge>
              <Badge variant="secondary" className="text-xs">Strategic Guidance</Badge>
              <Badge variant="secondary" className="text-xs">Document Analysis</Badge>
              <Badge variant="secondary" className="text-xs">24/7 Available</Badge>
            </div>
            <Button variant="secondary" size="lg" asChild className="shadow-glow">
              <Link to="/idea/consultant">
                <Users className="w-4 h-4 mr-2" />
                Ask the IDEA Consultant
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Card className="bg-gradient-hero text-center">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-primary-foreground mb-4">
            Ready to Build Your IDEA Brand?
          </h2>
          <p className="text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
            Start with our diagnostic to identify your brand's strengths and areas for improvement, 
            then dive deep into each IDEA component.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="coach" size="lg" asChild>
              <Link to="/idea/insight">Start with Insights</Link>
            </Button>
            <Button variant="outline" size="lg" className="bg-white/10 text-primary-foreground border-primary-foreground/20 hover:bg-white/20" asChild>
              <Link to="/diagnostic">Take Brand Diagnostic</Link>
            </Button>
            <Button variant="outline" size="lg" className="bg-white/10 text-primary-foreground border-primary-foreground/20 hover:bg-white/20" asChild>
              <Link to="/avatar">Build Avatar 2.0</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}