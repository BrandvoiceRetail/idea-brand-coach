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
import { FloatingConsultantButton } from "@/components/FloatingConsultantButton";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";

export default function BrandCanvas() {
  const { toast } = useToast();
  const { brandData, updateBrandData, getCompletionPercentage, getRecommendedNextStep } = useBrand();

  // Scroll to specific section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    // Auto-populate from IDEA Framework data
    if (brandData.insight.completed && !brandData.brandCanvas.brandPurpose) {
      updateBrandData('brandCanvas', {
        brandPurpose: brandData.insight.brandPurpose || "",
        valueProposition: brandData.insight.consumerInsight || "",
      });
    }
  }, [brandData, updateBrandData]);

  const completionPercentage = getCompletionPercentage();

  const handleSave = () => {
    updateBrandData('brandCanvas', { completed: true });
    toast({
      title: "Brand Canvas Saved",
      description: "Your brand canvas has been saved and is ready for ValueLens AI Copy Generation."
    });
  };

  const recommendedStep = getRecommendedNextStep();

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
        
        {/* Smart Guidance Banner */}
        {recommendedStep !== 'All core modules completed!' && (
          <div className="bg-gradient-to-r from-secondary/10 to-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-primary">💡 Recommended Starting Point</p>
                <p className="text-sm text-muted-foreground">{recommendedStep}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="ml-auto">
                <Link to="/idea">Get Started</Link>
              </Button>
            </div>
          </div>
        )}
        
        {/* Brand Canvas Introduction */}
        <Card className="bg-gradient-card shadow-card mb-8 text-left">
          <CardHeader>
            <CardTitle className="text-xl">About the IDEA Brand Canvas™</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm sm:text-base">
            <CollapsibleDescription maxLines={3} storageKey="brandCanvas_intro">
              <p>
                Building a strong, conversion-driven brand strategy doesn't have to be overwhelming but many sellers do struggle with unclear messaging, weak positioning, and fragmented branding, leading to low trust, poor engagement, and inconsistent sales.
              </p>
              <p>
                That's why the IDEA Brand Canvas™ was created—a structured, fill-in-the-box approach that simplifies and systematizes brand strategy. Instead of getting lost in complex branding exercises, this worksheet guides you step by step to create a clear, compelling brand identity that resonates with your customers and drives conversions.
              </p>
              <p>
                The IDEA Brand Canvas™ covers all the critical elements of brand strategy, making it easy to define and refine your brand with clarity and confidence. Below is a detailed breakdown of each element and how it fits within the IDEA Strategic Brand Framework.
              </p>
            </CollapsibleDescription>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {/* Brand Purpose */}
              <div 
                className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-4 rounded-lg border border-yellow-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('brand-purpose')}
              >
                <h4 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Brand Purpose
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-4 rounded-lg border border-green-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('brand-vision')}
              >
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Brand Vision
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-4 rounded-lg border border-blue-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('brand-mission')}
              >
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Brand Mission
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-4 rounded-lg border border-purple-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('brand-values')}
              >
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Brand Values
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-red-500/10 to-rose-500/10 p-4 rounded-lg border border-red-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('positioning-statement')}
              >
                <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Positioning Statement
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 p-4 rounded-lg border border-teal-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('value-proposition')}
              >
                <h4 className="font-semibold text-teal-700 dark:text-teal-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  Value Proposition
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 p-4 rounded-lg border border-amber-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('brand-personality')}
              >
                <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  Brand Personality
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
              <div 
                className="bg-gradient-to-br from-slate-500/10 to-gray-500/10 p-4 rounded-lg border border-slate-500/20 cursor-pointer hover:scale-105 transition-transform duration-200 hover:shadow-lg"
                onClick={() => scrollToSection('brand-voice')}
              >
                <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                  Brand Voice
                  <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
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
          {/* Brand Purpose */}
          <Card id="brand-purpose" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Purpose</CardTitle>
              <CardDescription>The "why" behind your existence—the core reason beyond just selling products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brandPurpose">Brand Purpose</Label>
                  {brandData.insight.completed && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateBrandData('brandCanvas', { 
                        brandPurpose: brandData.insight.brandPurpose || "Transform customer lives through innovative solutions that deliver genuine value and meaningful impact." 
                      })}
                    >
                      Import from IDEA
                    </Button>
                  )}
                </div>
                <Textarea
                  id="brandPurpose"
                  placeholder="What is your brand's core purpose? Why do you exist beyond making money?"
                  value={brandData.brandCanvas.brandPurpose}
                  onChange={(e) => updateBrandData('brandCanvas', { brandPurpose: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  fieldType="purpose"
                  currentValue={brandData.brandCanvas.brandPurpose}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { brandPurpose: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Vision */}
          <Card id="brand-vision" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Vision</CardTitle>
              <CardDescription>Aspirational statement about the future impact your brand seeks to make</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandVision">Vision Statement</Label>
                <Textarea
                  id="brandVision"
                  placeholder="What future are you working towards? Where do you see your brand's impact in 5-10 years?"
                  value={brandData.brandCanvas.brandVision}
                  onChange={(e) => updateBrandData('brandCanvas', { brandVision: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  fieldType="vision"
                  currentValue={brandData.brandCanvas.brandVision}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { brandVision: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Mission */}
          <Card id="brand-mission" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Mission</CardTitle>
              <CardDescription>Actionable steps taken to fulfill your brand's purpose and vision</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandMission">Mission Statement</Label>
                <Textarea
                  id="brandMission"
                  placeholder="How do you fulfill your purpose? What specific actions do you take?"
                  value={brandData.brandCanvas.brandMission}
                  onChange={(e) => updateBrandData('brandCanvas', { brandMission: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  fieldType="mission"
                  currentValue={brandData.brandCanvas.brandMission}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { brandMission: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Values */}
          <Card id="brand-values" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Values</CardTitle>
              <CardDescription>Guiding principles that shape how your brand interacts with customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newValue">Add Brand Values</Label>
                <div className="flex gap-2">
                  <Input
                    id="newValue"
                    placeholder="Enter a brand value (e.g., Integrity, Innovation)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value && !brandData.brandCanvas.brandValues.includes(value)) {
                          updateBrandData('brandCanvas', { 
                            brandValues: [...brandData.brandCanvas.brandValues, value] 
                          });
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById('newValue') as HTMLInputElement;
                      const value = input.value.trim();
                      if (value && !brandData.brandCanvas.brandValues.includes(value)) {
                        updateBrandData('brandCanvas', { 
                          brandValues: [...brandData.brandCanvas.brandValues, value] 
                        });
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandData.brandCanvas.brandValues.map((value, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer">
                      {value}
                      <button
                        onClick={() => {
                          updateBrandData('brandCanvas', {
                            brandValues: brandData.brandCanvas.brandValues.filter((_, i) => i !== index)
                          });
                        }}
                        className="ml-2 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Positioning Statement */}
          <Card id="positioning-statement" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Positioning Statement</CardTitle>
              <CardDescription>How your brand stands out in the market and why it's the best choice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="positioningStatement">Positioning Statement</Label>
                <Textarea
                  id="positioningStatement"
                  placeholder="For [target audience], [brand] is the [category] that [unique benefit] because [reason to believe]"
                  value={brandData.brandCanvas.positioningStatement}
                  onChange={(e) => updateBrandData('brandCanvas', { positioningStatement: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  fieldType="positioning"
                  currentValue={brandData.brandCanvas.positioningStatement}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { positioningStatement: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Value Proposition */}
          <Card id="value-proposition" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Value Proposition</CardTitle>
              <CardDescription>Clear statement of why customers should buy from you vs competitors</CardDescription>
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
                  fieldType="valueProposition"
                  currentValue={brandData.brandCanvas.valueProposition}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { valueProposition: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Personality */}
          <Card id="brand-personality" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Personality</CardTitle>
              <CardDescription>Human-like traits that influence how your brand speaks and interacts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPersonality">Add Personality Traits</Label>
                <div className="flex gap-2">
                  <Input
                    id="newPersonality"
                    placeholder="Enter personality trait (e.g., Friendly, Professional, Bold)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const trait = (e.target as HTMLInputElement).value.trim();
                        if (trait && !brandData.brandCanvas.brandPersonality.includes(trait)) {
                          updateBrandData('brandCanvas', { 
                            brandPersonality: [...brandData.brandCanvas.brandPersonality, trait] 
                          });
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById('newPersonality') as HTMLInputElement;
                      const trait = input.value.trim();
                      if (trait && !brandData.brandCanvas.brandPersonality.includes(trait)) {
                        updateBrandData('brandCanvas', { 
                          brandPersonality: [...brandData.brandCanvas.brandPersonality, trait] 
                        });
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandData.brandCanvas.brandPersonality.map((trait, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer">
                      {trait}
                      <button
                        onClick={() => {
                          updateBrandData('brandCanvas', {
                            brandPersonality: brandData.brandCanvas.brandPersonality.filter((_, i) => i !== index)
                          });
                        }}
                        className="ml-2 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand Voice */}
          <Card id="brand-voice" className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Voice</CardTitle>
              <CardDescription>Tone, language, and communication style used across all platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandVoice">Brand Voice Description</Label>
                <Textarea
                  id="brandVoice"
                  placeholder="Describe your brand's tone and communication style (e.g., conversational yet professional, warm and approachable)"
                  value={brandData.brandCanvas.brandVoice}
                  onChange={(e) => updateBrandData('brandCanvas', { brandVoice: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  fieldType="voice"
                  currentValue={brandData.brandCanvas.brandVoice}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { brandVoice: suggestion })}
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
                  <span>{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
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
                disabled={!brandData.brandCanvas.brandPurpose || !brandData.brandCanvas.valueProposition}
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
      
      <FloatingConsultantButton 
        show={getCompletionPercentage() > 20} 
      />
    </div>
  );
}