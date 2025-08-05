import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Save, Lock, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { AIAssistant } from "@/components/AIAssistant";
import { BrandCanvasPDFExport } from "@/components/BrandCanvasPDFExport";

export default function BrandCanvas() {
  const { toast } = useToast();
  const { brandData, updateBrandData, getCompletionPercentage, isToolUnlocked } = useBrand();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    setIsUnlocked(isToolUnlocked('canvas'));
    
    // Auto-populate from IDEA Framework data
    if (brandData.insight.completed && !brandData.brandCanvas.missionStatement) {
      updateBrandData('brandCanvas', {
        missionStatement: brandData.insight.brandPurpose || "",
        valueProposition: brandData.insight.consumerInsight || "",
      });
    }
  }, [brandData, isToolUnlocked, updateBrandData]);

  const completionPercentage = getCompletionPercentage();

  const handleSave = () => {
    updateBrandData('brandCanvas', { completed: true });
    toast({
      title: "Brand Canvas Saved",
      description: "Your brand canvas has been saved and is ready for ValueLens AI Copy Generation."
    });
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-secondary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Brand Canvas Builder</h1>
          <p className="text-muted-foreground mb-8 text-sm sm:text-base">
            Unlock this tool by completing the IDEA Strategic Brand Framework™ and Avatar Builder
          </p>
        </div>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Complete Prerequisites
            </CardTitle>
            <CardDescription>
              To access the Brand Canvas Builder, you need to complete these steps first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Progress</span>
                <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {brandData.insight.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={brandData.insight.completed ? "text-foreground" : "text-muted-foreground"}>
                  Complete IDEA Strategic Brand Framework™ - Insight Section
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {brandData.avatar.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={brandData.avatar.completed ? "text-foreground" : "text-muted-foreground"}>
                  Complete Avatar 2.0 Builder
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/idea">Complete IDEA Strategic Brand Framework™</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/avatar">Complete Avatar Builder</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">IDEA Brand Canvas™ Builder</h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-6">
          Build your complete brand strategy using the IDEA Strategic Brand Framework™
        </p>
        
        {/* Brand Canvas Introduction */}
        <Card className="bg-gradient-card shadow-card mb-8 text-left">
          <CardHeader>
            <CardTitle className="text-xl">About the IDEA Brand Canvas™</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm sm:text-base">
            <p>
              Building a strong, conversion-driven brand strategy doesn't have to be overwhelming but many sellers do struggle with unclear messaging, weak positioning, and fragmented branding, leading to low trust, poor engagement, and inconsistent sales.
            </p>
            <p>
              That's why the IDEA Brand Canvas™ was created—a structured, fill-in-the-box approach that simplifies and systematizes brand strategy. Instead of getting lost in complex branding exercises, this worksheet guides you step by step to create a clear, compelling brand identity that resonates with your customers and drives conversions.
            </p>
            <p>
              The IDEA Brand Canvas™ covers all the critical elements of brand strategy, making it easy to define and refine your brand with clarity and confidence. Below is a detailed breakdown of each element and how it fits within the IDEA Strategic Brand Framework.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {/* Brand Purpose */}
              <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-4 rounded-lg border border-yellow-500/20">
                <h4 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Brand Purpose
                </h4>
                <p className="text-xs mb-2">The "why" behind your existence—the core reason it goes beyond just selling products.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Identifies customer needs beyond the product</p>
                  <p><strong>Distinctive:</strong> Stands out with a higher mission</p>
                  <p><strong>Empathetic:</strong> Resonates with customer values</p>
                  <p><strong>Authentic:</strong> Aligns with core identity</p>
                </div>
              </div>

              {/* Brand Vision */}
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-4 rounded-lg border border-green-500/20">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Brand Vision
                </h4>
                <p className="text-xs mb-2">Aspirational statement about the future impact the brand seeks to make.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Rooted in evolving customer expectations</p>
                  <p><strong>Distinctive:</strong> Sets unique direction for category leadership</p>
                  <p><strong>Empathetic:</strong> Addresses emotional and societal needs</p>
                  <p><strong>Authentic:</strong> Aligns with long-term commitments</p>
                </div>
              </div>

              {/* Brand Mission */}
              <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-4 rounded-lg border border-blue-500/20">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Brand Mission
                </h4>
                <p className="text-xs mb-2">Actionable steps taken to fulfill the brand's purpose and vision.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Addresses specific customer challenges</p>
                  <p><strong>Distinctive:</strong> Defines unique way of delivering value</p>
                  <p><strong>Empathetic:</strong> Focuses on improving customer lives</p>
                  <p><strong>Authentic:</strong> Ensures consistency in messaging</p>
                </div>
              </div>

              {/* Brand Values */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-4 rounded-lg border border-purple-500/20">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Brand Values
                </h4>
                <p className="text-xs mb-2">Guiding principles that shape how brand interacts with customers and stakeholders.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Reflects what customers value beyond products</p>
                  <p><strong>Distinctive:</strong> Sets brand apart through ethical standpoint</p>
                  <p><strong>Empathetic:</strong> Aligns with customer beliefs</p>
                  <p><strong>Authentic:</strong> Actions consistently reflect promises</p>
                </div>
              </div>

              {/* Positioning Statement */}
              <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 p-4 rounded-lg border border-red-500/20">
                <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Positioning Statement
                </h4>
                <p className="text-xs mb-2">Defines how the brand stands out in the market and why it's the best choice.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Addresses customer pain points directly</p>
                  <p><strong>Distinctive:</strong> Highlights unique solution offered</p>
                  <p><strong>Empathetic:</strong> Aligns with customer aspirations</p>
                  <p><strong>Authentic:</strong> Builds credibility through transparency</p>
                </div>
              </div>

              {/* Value Proposition */}
              <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 p-4 rounded-lg border border-teal-500/20">
                <h4 className="font-semibold text-teal-700 dark:text-teal-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  Value Proposition
                </h4>
                <p className="text-xs mb-2">Clear, compelling statement of why customers should buy from you vs competitors.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Understands customer pain points</p>
                  <p><strong>Distinctive:</strong> Clearly differentiates from competitors</p>
                  <p><strong>Empathetic:</strong> Addresses practical and emotional benefits</p>
                  <p><strong>Authentic:</strong> Reinforces trust through transparency</p>
                </div>
              </div>

              {/* Brand Personality */}
              <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 p-4 rounded-lg border border-amber-500/20">
                <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  Brand Personality
                </h4>
                <p className="text-xs mb-2">Human-like traits that influence how the brand speaks and interacts.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Based on what attracts target audience</p>
                  <p><strong>Distinctive:</strong> Establishes unique, recognizable identity</p>
                  <p><strong>Empathetic:</strong> Creates emotional connection through traits</p>
                  <p><strong>Authentic:</strong> Consistent across all communications</p>
                </div>
              </div>

              {/* Brand Voice */}
              <div className="bg-gradient-to-br from-slate-500/10 to-gray-500/10 p-4 rounded-lg border border-slate-500/20">
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                  Brand Voice
                </h4>
                <p className="text-xs mb-2">Tone, language, and communication style used across all platforms.</p>
                <div className="text-xs space-y-1">
                  <p><strong>Insight-Driven:</strong> Matches customer communication preferences</p>
                  <p><strong>Distinctive:</strong> Creates unique, recognizable voice</p>
                  <p><strong>Empathetic:</strong> Resonates emotionally with audience</p>
                  <p><strong>Authentic:</strong> Consistent across marketing and support</p>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg mt-6 border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">How the IDEA Framework Brings Your Brand Strategy to Life</h4>
              <p className="text-xs">
                Using the IDEA Strategic Brand Framework alongside the Avatar 2.0 Tool, we simplify the branding process into a practical, easy-to-use system. 
                Instead of guessing or overcomplicating brand strategy, the IDEA Brand Canvas helps you fill in key brand elements in a structured, 
                intuitive way—all on a single unified document. This method ensures that every part of your brand is aligned, consistent, 
                and designed to attract, engage, and convert your ideal customers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Canvas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mission & Vision */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Mission & Vision</CardTitle>
              <CardDescription>Define your brand's purpose and future aspirations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mission">Mission Statement</Label>
                  {brandData.insight.completed && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateBrandData('brandCanvas', { 
                        missionStatement: brandData.insight.brandPurpose || "Transform customer lives through innovative solutions that deliver genuine value and meaningful impact." 
                      })}
                    >
                      Import from IDEA
                    </Button>
                  )}
                </div>
                <Textarea
                  id="mission"
                  placeholder="What is your brand's core purpose? Why do you exist?"
                  value={brandData.brandCanvas.missionStatement}
                  onChange={(e) => updateBrandData('brandCanvas', { missionStatement: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  prompt="Help improve this mission statement based on the IDEA Strategic Brand Framework™"
                  currentValue={brandData.brandCanvas.missionStatement}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { missionStatement: suggestion })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vision">Vision Statement</Label>
                <Textarea
                  id="vision"
                  placeholder="What future are you working towards? Where do you see your brand in 5-10 years?"
                  value={brandData.brandCanvas.visionStatement}
                  onChange={(e) => updateBrandData('brandCanvas', { visionStatement: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  prompt="Help improve this vision statement to be more aspirational and distinctive"
                  currentValue={brandData.brandCanvas.visionStatement}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { visionStatement: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Value Proposition */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Value Proposition</CardTitle>
              <CardDescription>What unique value do you deliver to customers?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="valueProposition">Core Value Proposition</Label>
                  {(brandData.insight.completed || brandData.avatar.completed) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const avatarInsights = brandData.avatar.completed ? 
                          ` for ${brandData.avatar.psychographics?.values?.slice(0,2).join(' and ') || 'quality-focused'} customers who value ${brandData.avatar.goals?.slice(0,2).join(' and ') || 'excellence and results'}` : '';
                        updateBrandData('brandCanvas', { 
                          valueProposition: `We deliver unique solutions that address real customer needs${avatarInsights}, combining innovation with proven results to create meaningful transformation in their lives.` 
                        });
                      }}
                    >
                      Import from IDEA + Avatar
                    </Button>
                  )}
                </div>
                <Textarea
                  id="valueProposition"
                  placeholder="What specific problems do you solve? What unique benefits do you provide?"
                  value={brandData.brandCanvas.valueProposition}
                  onChange={(e) => updateBrandData('brandCanvas', { valueProposition: e.target.value })}
                  rows={4}
                />
                <AIAssistant
                  prompt="Help create a compelling value proposition based on our avatar insights and distinctive positioning"
                  currentValue={brandData.brandCanvas.valueProposition}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { valueProposition: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Archetype & Personality */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Personality</CardTitle>
              <CardDescription>Define your brand's character and tone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="archetype">Brand Archetype</Label>
                <Select
                  value={brandData.brandCanvas.brandArchetype}
                  onValueChange={(value) => updateBrandData('brandCanvas', { brandArchetype: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your brand archetype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="innocent">The Innocent</SelectItem>
                    <SelectItem value="everyman">The Everyman</SelectItem>
                    <SelectItem value="hero">The Hero</SelectItem>
                    <SelectItem value="outlaw">The Outlaw</SelectItem>
                    <SelectItem value="explorer">The Explorer</SelectItem>
                    <SelectItem value="creator">The Creator</SelectItem>
                    <SelectItem value="ruler">The Ruler</SelectItem>
                    <SelectItem value="magician">The Magician</SelectItem>
                    <SelectItem value="lover">The Lover</SelectItem>
                    <SelectItem value="caregiver">The Caregiver</SelectItem>
                    <SelectItem value="jester">The Jester</SelectItem>
                    <SelectItem value="sage">The Sage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tonal Attributes</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {brandData.brandCanvas.tonalAttributes.map((attribute, index) => (
                    <Badge key={index} variant="secondary">
                      {attribute}
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Add tonal attributes (friendly, professional, innovative, etc.)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = (e.target as HTMLInputElement).value.trim();
                      if (value && !brandData.brandCanvas.tonalAttributes.includes(value)) {
                        updateBrandData('brandCanvas', {
                          tonalAttributes: [...brandData.brandCanvas.tonalAttributes, value]
                        });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Brand Strategy Sections */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Positioning</CardTitle>
              <CardDescription>Define how you want to be perceived in the market</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="positioning">Positioning Statement</Label>
                <Textarea
                  id="positioning"
                  placeholder="For [target customer], [brand] is the [category] that [unique benefit] because [reason to believe]"
                  value={brandData.distinctive.positioning}
                  onChange={(e) => updateBrandData('distinctive', { positioning: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  prompt="Help create a compelling positioning statement based on our customer avatar and distinctive advantages"
                  currentValue={brandData.distinctive.positioning}
                  onSuggestion={(suggestion) => updateBrandData('distinctive', { positioning: suggestion })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandValues">Core Brand Values</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {brandData.authentic.brandValues.map((value, index) => (
                    <Badge key={index} variant="secondary">
                      {value}
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Add brand values (integrity, innovation, quality, etc.)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = (e.target as HTMLInputElement).value.trim();
                      if (value && !brandData.authentic.brandValues.includes(value)) {
                        updateBrandData('authentic', {
                          brandValues: [...brandData.authentic.brandValues, value]
                        });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandPromise">Brand Promise</Label>
                <Textarea
                  id="brandPromise"
                  placeholder="What promise do you make to your customers? What can they always expect from you?"
                  value={brandData.authentic.brandPromise}
                  onChange={(e) => updateBrandData('authentic', { brandPromise: e.target.value })}
                  rows={2}
                />
                <AIAssistant
                  prompt="Help create a compelling brand promise that aligns with our mission and customer expectations"
                  currentValue={brandData.authentic.brandPromise}
                  onSuggestion={(suggestion) => updateBrandData('authentic', { brandPromise: suggestion })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Brand Data Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">IDEA Insights</span>
                <Badge variant={brandData.insight.completed ? "default" : "outline"}>
                  {brandData.insight.completed ? "Complete" : "Pending"}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Avatar Profile</span>
                <Badge variant={brandData.avatar.completed ? "default" : "outline"}>
                  {brandData.avatar.completed ? "Complete" : "Pending"}
                </Badge>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-sm mb-2">
                  <span>Canvas Progress</span>
                  <span>75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Complete your brand canvas to unlock the ValueLens AI Copy Generator
              </p>
              
              <Button 
                onClick={handleSave}
                className="w-full"
                disabled={!brandData.brandCanvas.missionStatement || !brandData.brandCanvas.valueProposition}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Canvas
              </Button>

              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/valuelens">
                    Generate AI Copy
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                
                <BrandCanvasPDFExport 
                  brandCanvas={brandData.brandCanvas}
                  companyName={brandData.userInfo.company || "Your Brand"}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}