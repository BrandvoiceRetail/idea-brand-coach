import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { DistinctiveModule } from "@/components/DistinctiveModule";
import { 
  Star, 
  Search, 
  Target, 
  Heart, 
  Users, 
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Brain,
  Eye,
  Zap,
  PlayCircle
} from "lucide-react";

export default function IdeaDistinctive() {
  const [activeTab, setActiveTab] = useState("overview");
  const [completedFramework, setCompletedFramework] = useState(false);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Star className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Distinctive/Different Module</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Stand out in customers' minds with unique positioning and distinctive brand assets that create memorable, ownable brand experiences.
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Brand Differentiation</span>
          <span>•</span>
          <span>Unique Positioning</span>
          <span>•</span>
          <span>Distinctive Assets</span>
        </div>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button 
            size="lg" 
            onClick={() => setActiveTab("interactive")}
            className="flex items-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            Start Learning Journey
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setActiveTab("assessment")}
            className="flex items-center gap-2"
          >
            <Target className="w-5 h-5" />
            Assess Your Brand
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
              <TabsTrigger value="interactive" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Learning</span>
              </TabsTrigger>
              <TabsTrigger value="research" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Research</span>
              </TabsTrigger>
              <TabsTrigger value="assessment" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Assessment</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Key Principle */}
              <Card className="bg-gradient-card shadow-brand">
                <CardContent className="p-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Standing Out in Crowded Markets</h2>
                    <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
                      In today's saturated markets, being distinctive isn't optional—it's essential for survival. 
                      Learn how to create memorable brand experiences that customers can't ignore.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">❌ Generic Brands</h3>
                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                          <li>• Blend into the background</li>
                          <li>• Compete only on price</li>
                          <li>• Easily forgotten</li>
                          <li>• No emotional connection</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">✅ Distinctive Brands</h3>
                        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                          <li>• Stand out visually & conceptually</li>
                          <li>• Command premium pricing</li>
                          <li>• Memorable and ownable</li>
                          <li>• Create lasting relationships</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Core Components */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">The 3 Pillars of Distinctiveness</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Unique Value</CardTitle>
                      <CardDescription>Your distinctive promise</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        What unique benefit do you offer that competitors can't or won't match?
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Core differentiators</li>
                        <li>• Unmatched benefits</li>
                        <li>• Ownable positioning</li>
                        <li>• Value articulation</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Brand Assets</CardTitle>
                      <CardDescription>Memorable brand elements</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Visual and conceptual elements that make your brand instantly recognizable.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Visual identity</li>
                        <li>• Brand personality</li>
                        <li>• Tone of voice</li>
                        <li>• Signature experiences</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Market Position</CardTitle>
                      <CardDescription>Strategic differentiation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        How you position yourself relative to competitors in customers' minds.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Competitive advantage</li>
                        <li>• Category ownership</li>
                        <li>• Perception gaps</li>
                        <li>• Strategic positioning</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="interactive" className="mt-6">
              <DistinctiveModule />
            </TabsContent>

            <TabsContent value="research" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Competitive Research Tools
                  </CardTitle>
                  <CardDescription>
                    AI-powered tools to analyze your competitive landscape and identify differentiation opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Research Tools Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      AI-powered competitive analysis and differentiation opportunity identification
                    </p>
                    <Badge variant="secondary">In Development</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assessment" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Distinctiveness Assessment
                  </CardTitle>
                  <CardDescription>
                    Evaluate how distinctive your brand is compared to competitors
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Brain className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Assessment Tool Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Comprehensive evaluation of your brand's distinctiveness
                    </p>
                    <Badge variant="secondary">In Development</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      {completedFramework && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Module Progress
            </CardTitle>
            <CardDescription>
              Your distinctiveness learning journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm">Completed Learning Module</span>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-4">Next Steps</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" asChild>
                  <Link to="/idea/empathy" className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Empathy Module
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/avatar" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Build Customer Avatar
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}