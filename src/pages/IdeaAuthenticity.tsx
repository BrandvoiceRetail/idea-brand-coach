import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { AuthenticityModule } from "@/components/AuthenticityModule";
import { 
  Shield, 
  Search, 
  Target, 
  Heart, 
  Users, 
  CheckCircle2,
  ArrowRight,
  CheckCircle,
  Brain,
  Eye,
  Zap,
  PlayCircle,
  MessageCircle,
  Star
} from "lucide-react";

export default function IdeaAuthenticity() {
  const [activeTab, setActiveTab] = useState("overview");
  const [completedFramework, setCompletedFramework] = useState(false);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Authoritative & Authentic Module</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Be genuine, transparent, and true to your brand's values. Create an attractive brand persona that customers trust and want to engage with.
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Brand Transparency</span>
          <span>•</span>
          <span>Authentic Voice</span>
          <span>•</span>
          <span>Trust Building</span>
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
            <Shield className="w-5 h-5" />
            Assess Authenticity
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
                <Shield className="w-4 h-4" />
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
                    <h2 className="text-2xl font-bold mb-4">The Foundation of Trust</h2>
                    <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
                      In a world of fake news and misleading marketing, authentic brands that stay true to their values 
                      and communicate transparently earn customer trust and loyalty.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">❌ Inauthentic Brands</h3>
                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                          <li>• Make false promises</li>
                          <li>• Hide behind corporate speak</li>
                          <li>• Inconsistent messaging</li>
                          <li>• Values misalignment</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">✅ Authentic Brands</h3>
                        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                          <li>• Deliver on promises</li>
                          <li>• Communicate transparently</li>
                          <li>• Consistent brand voice</li>
                          <li>• Values-driven actions</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Core Values */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">Essential Authenticity Traits</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Honesty</Badge>
                    <p className="text-xs text-muted-foreground">Truthful communication</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Transparency</Badge>
                    <p className="text-xs text-muted-foreground">Open processes</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Consistency</Badge>
                    <p className="text-xs text-muted-foreground">Reliable messaging</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Integrity</Badge>
                    <p className="text-xs text-muted-foreground">Values alignment</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Vulnerability</Badge>
                    <p className="text-xs text-muted-foreground">Human imperfection</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Empathy</Badge>
                    <p className="text-xs text-muted-foreground">Understanding others</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Purpose</Badge>
                    <p className="text-xs text-muted-foreground">Mission-driven</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Accountability</Badge>
                    <p className="text-xs text-muted-foreground">Own mistakes</p>
                  </div>
                </div>
              </div>

              {/* Core Components */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">The 3 Pillars of Authenticity</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Core Values</CardTitle>
                      <CardDescription>Your authentic foundation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Define and live by your core values in everything you do.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Value identification</li>
                        <li>• Mission alignment</li>
                        <li>• Purpose definition</li>
                        <li>• Belief systems</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Aligned Actions</CardTitle>
                      <CardDescription>Walking the talk</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ensure your actions consistently reflect your stated values.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Consistent behavior</li>
                        <li>• Promise delivery</li>
                        <li>• Value demonstration</li>
                        <li>• Integrity maintenance</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Transparent Communication</CardTitle>
                      <CardDescription>Honest and open dialogue</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Communicate openly, honestly, and transparently with your audience.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Open processes</li>
                        <li>• Honest messaging</li>
                        <li>• Transparent policies</li>
                        <li>• Authentic voice</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="interactive" className="mt-6">
              <AuthenticityModule />
            </TabsContent>

            <TabsContent value="research" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Authenticity Research Tools
                  </CardTitle>
                  <CardDescription>
                    AI-powered tools to analyze brand authenticity and transparency
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Authenticity Analysis Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Brand transparency and authenticity measurement tools
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
                    Authenticity Assessment
                  </CardTitle>
                  <CardDescription>
                    Evaluate your brand's authenticity and trustworthiness
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Authenticity Assessment Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Comprehensive authenticity and transparency evaluation
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
              Your authenticity learning journey
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
                  <Link to="/avatar" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Build Customer Avatar
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/canvas" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Create Brand Canvas
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