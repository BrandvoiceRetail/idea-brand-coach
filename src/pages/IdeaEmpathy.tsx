import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { EmotionallyIntelligentModule } from "@/components/EmotionallyIntelligentModule";
import {
  Heart,
  Search,
  Target,
  Shield,
  Users,
  Brain,
  ArrowRight,
  CheckCircle,
  Eye,
  Zap,
  PlayCircle,
  MessageCircle,
  Ear,
  Info
} from "lucide-react";

export default function IdeaEmpathy() {
  const [activeTab, setActiveTab] = useState("overview");
  const [completedFramework, setCompletedFramework] = useState(false);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto">
        <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Emotionally Intelligent Module</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Connect with your audience on an emotional level by understanding and responding to their deepest fears, hopes, and desires.
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
          <span>Emotional Connection</span>
          <span>•</span>
          <span>Empathy Building</span>
          <span>•</span>
          <span>Human-Centered Design</span>
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
            <Heart className="w-5 h-5" />
            Assess Emotional Intelligence
          </Button>
        </div>
      </div>

      {/* Beta Learning Module Notice */}
      <div className="flex items-center gap-3 p-4 bg-secondary/10 border border-secondary/20 rounded-lg max-w-2xl mx-auto">
        <Info className="w-5 h-5 text-secondary flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Beta Preview:</span> This is a learning module. For interactive help applying these concepts to your brand, use the{" "}
          <Link to="/idea/consultant" className="text-secondary hover:underline font-medium">Brand Coach</Link>.
        </p>
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
                <Heart className="w-4 h-4" />
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
                    <h2 className="text-2xl font-bold mb-4">The Heart of Human Connection</h2>
                    <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
                      In an increasingly digital world, the brands that win are those that understand and respond 
                      to human emotions with genuine empathy and care.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">❌ Emotionally Disconnected</h3>
                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                          <li>• Focus only on features</li>
                          <li>• Ignore customer feelings</li>
                          <li>• Generic, cold communication</li>
                          <li>• Transactional relationships</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">✅ Emotionally Intelligent</h3>
                        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                          <li>• Understand emotional triggers</li>
                          <li>• Respond with empathy</li>
                          <li>• Create meaningful connections</li>
                          <li>• Build lasting relationships</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emotional Triggers */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">Core Emotional Triggers</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Hope</Badge>
                    <p className="text-xs text-muted-foreground">Future possibilities</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Trust</Badge>
                    <p className="text-xs text-muted-foreground">Reliability & safety</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Belonging</Badge>
                    <p className="text-xs text-muted-foreground">Community & acceptance</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Relief</Badge>
                    <p className="text-xs text-muted-foreground">Problem resolution</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Validation</Badge>
                    <p className="text-xs text-muted-foreground">Confirmation & support</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Aspiration</Badge>
                    <p className="text-xs text-muted-foreground">Growth & achievement</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Empowerment</Badge>
                    <p className="text-xs text-muted-foreground">Control & capability</p>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg">
                    <Badge variant="secondary" className="mb-2">Joy</Badge>
                    <p className="text-xs text-muted-foreground">Happiness & delight</p>
                  </div>
                </div>
              </div>

              {/* Core Components */}
              <div>
                <h2 className="text-2xl font-bold mb-6 text-center">The 3 Pillars of Emotional Intelligence</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Brain className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Understanding Triggers</CardTitle>
                      <CardDescription>Recognize emotional drivers</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Identify what emotions drive your customers' decisions and behaviors.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Pain point analysis</li>
                        <li>• Desire mapping</li>
                        <li>• Fear identification</li>
                        <li>• Motivation discovery</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Authentic Connections</CardTitle>
                      <CardDescription>Build genuine relationships</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create meaningful interactions that resonate with customers' emotional needs.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Empathetic messaging</li>
                        <li>• Personal storytelling</li>
                        <li>• Emotional validation</li>
                        <li>• Authentic communication</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-brand transition-all duration-300">
                    <CardHeader className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Ear className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">Listen & Respond</CardTitle>
                      <CardDescription>Active emotional engagement</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Actively listen to customer feedback and respond with care and understanding.
                      </p>
                      <ul className="text-xs space-y-2 text-muted-foreground">
                        <li>• Feedback analysis</li>
                        <li>• Responsive support</li>
                        <li>• Emotional intelligence</li>
                        <li>• Caring follow-up</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="interactive" className="mt-6">
              <EmotionallyIntelligentModule />
            </TabsContent>

            <TabsContent value="research" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Emotional Research Tools
                  </CardTitle>
                  <CardDescription>
                    AI-powered tools to analyze customer emotions and sentiment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Emotion Research Tools Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Sentiment analysis and emotional trigger identification tools
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
                    Emotional Intelligence Assessment
                  </CardTitle>
                  <CardDescription>
                    Evaluate your brand's emotional intelligence and empathy levels
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">EQ Assessment Coming Soon</h3>
                    <p className="text-muted-foreground mb-4">
                      Comprehensive emotional intelligence evaluation for brands
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
              Your emotional intelligence learning journey
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
                  <Link to="/idea/authenticity" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Authenticity Module
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