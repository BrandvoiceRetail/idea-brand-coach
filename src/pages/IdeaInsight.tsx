import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { ContextualHelp } from "@/components/ContextualHelp";
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
  BarChart,
  FileText,
  Download
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
          <p className="text-muted-foreground mb-6">
            As Martin Lindstrom explains in Buyology, emotion outweighs logic in most purchasing decisions. Research by Gerald Zaltman shows emotions drive 95% of decisions. Understanding these seven triggers helps create lasting connections with customers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="p-6 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-yellow-600 mb-3 flex items-center gap-2">
                🌟 Hope
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Hope is one of the most compelling emotional drivers. When a shopper encounters a product, they're imagining what it could do for them.
              </p>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> A skincare line isn't just bottles—it's the promise of brighter, smoother skin and feeling youthful again.
                </p>
              </div>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
                🤝 Belonging
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Shopping is often about identity. People want to buy from brands that reflect who they are and what they value.
              </p>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> A toy brand celebrating modern parenting or skincare highlighting diverse beauty sends the message "We see you."
                </p>
              </div>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-green-600 mb-3 flex items-center gap-2">
                ✅ Validation
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Everyone seeks validation—assurance of smart choices and acknowledgment of their experiences and challenges.
              </p>
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> A brand targeting parents who want screen-free toys affirms their desire to nurture development meaningfully.
                </p>
              </div>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-indigo-600 mb-3 flex items-center gap-2">
                🛡️ Trust
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Trust is the foundation of every successful brand-customer relationship. Shoppers need confidence that products will deliver.
              </p>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> Transparency in sourcing sustainable materials or demonstrating effective features builds confidence.
                </p>
              </div>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-purple-600 mb-3 flex items-center gap-2">
                😌 Relief
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                In a world of stress and overwhelm, relief is powerful. Shoppers want brands that make life easier and solve problems.
              </p>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> Hair serum combating thinning or face cream smoothing lines provides emotional weight-lifting relief.
                </p>
              </div>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-md transition-all">
              <h4 className="font-semibold text-pink-600 mb-3 flex items-center gap-2">
                🚀 Aspiration
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Every shopper has a vision of their ideal self. They're investing in that vision, aligning purchases with the future they want.
              </p>
              <div className="p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> Gender-neutral face cream embraces individuality; a play kitchen nurtures creativity and builds memories.
                </p>
              </div>
            </div>

            <div className="p-6 border rounded-lg hover:shadow-md transition-all md:col-span-2 lg:col-span-1">
              <h4 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                💪 Empowerment
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Consumers want to feel in control of their choices, confident in decisions that align with their values and goals.
              </p>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Example:</strong> Brands positioning as partners offering tools rather than pushing products create empowerment and loyalty.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Practical Tools & Worksheets */}
      <div className="space-y-8">
        <h2 className="text-3xl font-bold text-center">Practical Tools & Worksheets</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold">IDEA Brand Canvas</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              A comprehensive worksheet to capture customer insights and translate them into powerful brand statements using the IDEA framework.
            </p>
            <div className="space-y-3 mb-4">
              <div className="text-sm">
                <strong>Includes:</strong>
                <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                  <li>• Customer Avatar 2.0 template</li>
                  <li>• Emotional trigger identification</li>
                  <li>• Brand purpose & vision statements</li>
                  <li>• Distinctive positioning framework</li>
                </ul>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href="https://storage.googleapis.com/msgsndr/PRr8SFqs3PfSKaJPAtE1/media/688cd4e06bfb1c80bc7fdfdf.pdf" target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-2" />
                Download Brand Canvas
              </a>
            </Button>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-semibold">AI-Powered Insight Research</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Use AI to conduct deep dive research on your customer's emotional triggers and decision patterns using the Avatar 2.0 structure.
            </p>
            <ContextualHelp 
              question="Help me identify which emotional triggers influence my customer's purchase decisions using the Avatar 2.0 Deep Dive Forensic Structure"
              category="customer-research"
              context="Use the IDEA framework to analyze buyer intent, motivation, emotional triggers, pre/post-purchase emotional states, shopper types, and relevant demographics. Focus on the 7 core emotional triggers: Hope, Belonging, Validation, Trust, Relief, Aspiration, and Empowerment."
            />
          </Card>
        </div>
      </div>

      {/* Tools & Next Steps */}
      <div className="bg-muted/30 p-8 rounded-lg">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-6 text-center">Ready to Apply These Insights?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold">Build Your Avatar 2.0</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Transform your customer understanding by creating a comprehensive avatar that integrates behavioral insights and emotional triggers.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Progress value={85} className="flex-1" />
                <span className="text-sm text-muted-foreground">5 min setup</span>
              </div>
              <Button className="w-full" asChild>
                <Link to="/avatar">
                  Start Avatar Builder <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Target className="h-8 w-8 text-primary" />
                <h3 className="text-xl font-semibold">Assess Your Insights</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Take our Brand Diagnostic to evaluate how well you understand your customers using the IDEA framework.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Progress value={70} className="flex-1" />
                <span className="text-sm text-muted-foreground">10 min assessment</span>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/diagnostic">
                  Take Diagnostic <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </Card>
          </div>
        </div>
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