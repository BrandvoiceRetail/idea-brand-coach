import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { InteractiveIdeaFramework } from "@/components/InteractiveIdeaFramework";
import { BuyerIntentResearch } from "@/components/BuyerIntentResearch";
import { EmotionalTriggerAssessment } from "@/components/EmotionalTriggerAssessment";
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
  Download,
  Zap,
  PlayCircle
} from "lucide-react";

export default function IdeaInsight() {
  const [activeTab, setActiveTab] = useState("overview");
  const [completedInsights, setCompletedInsights] = useState<any>(null);
  const [researchData, setResearchData] = useState<any>(null);
  const [triggerResults, setTriggerResults] = useState<any>(null);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lightbulb className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Interactive Insight Module</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Transform static research into actionable customer insights through AI-powered tools and step-by-step guidance.
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Interactive Framework</span>
          <span>•</span>
          <span>AI-Powered Research</span>
          <span>•</span>
          <span>Real-Time Guidance</span>
        </div>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button 
            size="lg" 
            onClick={() => setActiveTab("framework")}
            className="flex items-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            Start Interactive Framework
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setActiveTab("research")}
            className="flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            AI Intent Research
          </Button>
        </div>
      </div>

      {/* Interactive Tools */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20 shadow-lg">
        <CardContent className="p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="framework" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Framework</span>
              </TabsTrigger>
              <TabsTrigger value="research" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Research</span>
              </TabsTrigger>
              <TabsTrigger value="assessment" className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Assessment</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
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

              {/* Interactive Tools Preview */}
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="hover:shadow-brand transition-all duration-300 cursor-pointer" onClick={() => setActiveTab("framework")}>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">Interactive Framework</CardTitle>
                    <CardDescription>Step-by-step guided experience</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Transform the static IDEA framework into an interactive journey with AI guidance and real-world examples.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Zap className="w-4 h-4" />
                      AI-Powered Guidance
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-brand transition-all duration-300 cursor-pointer" onClick={() => setActiveTab("research")}>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">Buyer Intent Research</CardTitle>
                    <CardDescription>AI-powered search analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Analyze search terms and customer behavior patterns to understand what drives purchase decisions.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <BarChart className="w-4 h-4" />
                      Data-Driven Insights
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-brand transition-all duration-300 cursor-pointer" onClick={() => setActiveTab("assessment")}>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">Emotional Assessment</CardTitle>
                    <CardDescription>Trigger identification tool</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Discover which emotional triggers resonate most with your audience through guided assessment.
                    </p>
                    <div className="flex items-center gap-2 text-sm text-pink-600">
                      <Brain className="w-4 h-4" />
                      Psychology-Based
                    </div>
                  </CardContent>
                </Card>
              </div>

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
            </TabsContent>

            <TabsContent value="framework" className="mt-6">
              <InteractiveIdeaFramework 
                onComplete={(data) => {
                  setCompletedInsights(data);
                  // TODO: Save to brand context
                }}
              />
            </TabsContent>

            <TabsContent value="research" className="mt-6">
              <BuyerIntentResearch 
                onInsightsGenerated={(insights) => {
                  setResearchData(insights);
                }}
              />
            </TabsContent>

            <TabsContent value="assessment" className="mt-6">
              <EmotionalTriggerAssessment 
                onAssessmentComplete={(results) => {
                  setTriggerResults(results);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      {(completedInsights || researchData || triggerResults) && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Your Progress
            </CardTitle>
            <CardDescription>
              Completed insights and research data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {completedInsights && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <h4 className="font-medium">IDEA Framework</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">Interactive framework completed</p>
                </div>
              )}
              {researchData && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <h4 className="font-medium">Intent Research</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{researchData.length} search terms analyzed</p>
                </div>
              )}
              {triggerResults && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <h4 className="font-medium">Emotional Assessment</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">Trigger profile generated</p>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
              <h4 className="font-medium mb-2">🚀 Next Steps</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Transform these insights into actionable customer avatars and marketing strategies.
              </p>
              <div className="flex gap-2">
                <Button size="sm" asChild>
                  <Link to="/avatar">Build Avatar 2.0</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/diagnostic">Brand Diagnostic</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}