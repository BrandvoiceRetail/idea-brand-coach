import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { 
  Lightbulb, 
  Search, 
  Target, 
  Heart, 
  Users, 
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Brain,
  Eye,
  MessageSquare,
  BarChart
} from "lucide-react";

export default function IdeaInsight() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lightbulb className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Insight Driven</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Gather deep insights about your customers' motivations and emotional triggers. 
          Move from guessing to knowing through behavioral science.
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Beyond Demographics</span>
          <span>•</span>
          <span>Behavioral Psychology</span>
          <span>•</span>
          <span>Emotional Intelligence</span>
        </div>
      </div>

      {/* Key Principle */}
      <Card className="bg-gradient-card shadow-brand">
        <CardContent className="p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">From Guessing to Knowing</h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
              The IDEA Framework's adoption of behavioral insights marks a shift from outdated 
              demographic segmentation to forensic, behavior-driven understanding of customers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">❌ Traditional Approach</h3>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <li>• Age, income, marital status</li>
                  <li>• Broad demographic categories</li>
                  <li>• Assumption-based targeting</li>
                  <li>• Surface-level insights</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">✅ Avatar 2.0 Approach</h3>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• Behavioral patterns & intent</li>
                  <li>• Emotional triggers & motivations</li>
                  <li>• Data-driven insights</li>
                  <li>• Subconscious understanding</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The 5 Core Components */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-center">The 5 Core Insight Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          
          {/* Buyer Intent */}
          <Card className="hover:shadow-brand transition-all duration-300">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Search className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Buyer Intent</CardTitle>
              <CardDescription>The foundation of precision targeting</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The "why" behind customer actions - their search queries, clicks, and shopping behaviors.
              </p>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>• Search behavior analysis</li>
                <li>• Purchase pattern insights</li>
                <li>• Problem-solution mapping</li>
                <li>• Context-driven needs</li>
              </ul>
            </CardContent>
          </Card>

          {/* Buyer Motivation */}
          <Card className="hover:shadow-brand transition-all duration-300">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Buyer Motivation</CardTitle>
              <CardDescription>Understanding the subconscious "why"</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deeper psychological reasons driving decisions - often subconscious and emotional.
              </p>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>• Social status desires</li>
                <li>• Convenience seeking</li>
                <li>• Self-expression needs</li>
                <li>• Prestige motivations</li>
              </ul>
            </CardContent>
          </Card>

          {/* Emotional Triggers */}
          <Card className="hover:shadow-brand transition-all duration-300">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Emotional Triggers</CardTitle>
              <CardDescription>Keys to deep connection</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Stimuli that resonate with feelings and subconscious desires driving 95% of decisions.
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">Hope</Badge>
                <Badge variant="secondary" className="text-xs">Trust</Badge>
                <Badge variant="secondary" className="text-xs">Relief</Badge>
                <Badge variant="secondary" className="text-xs">Aspiration</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Shopper Types */}
          <Card className="hover:shadow-brand transition-all duration-300">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Shopper Types</CardTitle>
              <CardDescription>Behavioral categorization</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Four research-backed shopping personas from Shopify's 2024 Commerce Report.
              </p>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>• Cost Sensitive (50%): Price-focused</li>
                <li>• Quality Focused (39%): Quality over price</li>
                <li>• Conscious (9%): Sustainability-driven</li>
                <li>• Connected (2%): Social commerce ready</li>
              </ul>
            </CardContent>
          </Card>

          {/* Relevant Demographics */}
          <Card className="hover:shadow-brand transition-all duration-300">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                <BarChart className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg">Relevant Demographics</CardTitle>
              <CardDescription>Behavior-driven data</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Demographics that actually matter - tied to behaviors rather than superficial traits.
              </p>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>• Usage patterns</li>
                <li>• Purchase frequency</li>
                <li>• Channel preferences</li>
                <li>• Lifestyle indicators</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deep Dive: Buyer Intent */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Search className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle>Buyer Intent: The Foundation of Precision Targeting</CardTitle>
              <CardDescription>Understanding the "why" behind customer actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">What is Buyer Intent?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Buyer intent reflects the purpose driving customer search queries, clicks, or shopping behavior. 
                It's not just what they're looking for, but what problem they're trying to solve.
              </p>
              <div className="p-4 bg-secondary/10 rounded-lg">
                <h5 className="font-medium mb-2">Example:</h5>
                <p className="text-sm text-muted-foreground">
                  Search: "ergonomic office chair" reveals not just a functional requirement 
                  but an underlying need to address back pain or improve productivity.
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">How to Leverage Intent</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                  <span>Analyze search behaviors and queries</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                  <span>Map purchase patterns to needs</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                  <span>Use contextual data for insights</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                  <span>Optimize content for intent alignment</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deep Dive: Emotional Triggers */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Heart className="w-6 h-6 text-pink-600" />
            <div>
              <CardTitle>The 7 Emotional Triggers</CardTitle>
              <CardDescription>Powerful forces that create lasting connections</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="p-4 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-yellow-600 mb-2">🌟 Hope</h4>
              <p className="text-sm text-muted-foreground">
                The promise of a brighter future. Not just seeing an object, but imagining transformation.
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-blue-600 mb-2">🤝 Belonging</h4>
              <p className="text-sm text-muted-foreground">
                Being part of something bigger. Reflecting identity and shared values.
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-green-600 mb-2">✅ Validation</h4>
              <p className="text-sm text-muted-foreground">
                Acknowledgment of smart choices and experiences. Being seen and understood.
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-indigo-600 mb-2">🛡️ Trust</h4>
              <p className="text-sm text-muted-foreground">
                Foundation of relationships. Confidence that products deliver on promises.
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-purple-600 mb-2">😌 Relief</h4>
              <p className="text-sm text-muted-foreground">
                Making life easier. Solving problems and lifting emotional burdens.
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-pink-600 mb-2">🚀 Aspiration</h4>
              <p className="text-sm text-muted-foreground">
                Investment in ideal self. Aligning purchases with future vision.
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-md transition-all md:col-span-2 lg:col-span-1">
              <h4 className="font-semibold text-orange-600 mb-2">💪 Empowerment</h4>
              <p className="text-sm text-muted-foreground">
                Feeling capable and in control. Making confident decisions aligned with values.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tools & Next Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Avatar 2.0 Integration */}
        <Card className="hover:shadow-brand transition-all duration-300">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-secondary" />
              <div>
                <CardTitle>Build Your Avatar 2.0</CardTitle>
                <CardDescription>Put insights into practice</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Transform these insights into actionable customer profiles using our Avatar 2.0 Builder.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Customer Understanding</span>
                <span className="text-sm font-medium">65%</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
            <Button className="w-full" asChild>
              <Link to="/avatar">
                Start Avatar 2.0 Builder <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Diagnostic Integration */}
        <Card className="hover:shadow-brand transition-all duration-300">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Brain className="w-6 h-6 text-secondary" />
              <div>
                <CardTitle>Assess Your Insights</CardTitle>
                <CardDescription>Measure current understanding</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Take our IDEA Diagnostic to understand how well you currently know your customers.
            </p>
            <div className="p-3 bg-secondary/10 rounded-lg">
              <div className="flex items-center space-x-2 text-sm">
                <Eye className="w-4 h-4 text-secondary" />
                <span>Insight Score: Needs Assessment</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/diagnostic">
                Take Brand Diagnostic <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="bg-gradient-hero text-center">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-primary-foreground mb-4">
            Ready to Transform Your Customer Understanding?
          </h2>
          <p className="text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
            Move from demographic guessing to behavioral knowing. Start building deeper 
            customer insights that drive real business results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="coach" size="lg" asChild>
              <Link to="/avatar">Build Avatar 2.0</Link>
            </Button>
            <Button variant="outline" size="lg" className="bg-white/10 text-primary-foreground border-primary-foreground/20 hover:bg-white/20" asChild>
              <Link to="/diagnostic">Assess Current State</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}