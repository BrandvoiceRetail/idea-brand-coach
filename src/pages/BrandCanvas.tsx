import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, ArrowRight, Sparkles, CheckCircle, Loader2, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { usePersistedField, usePersistedArrayField } from "@/hooks/usePersistedField";
import { useModuleCompletionStatus } from "@/hooks/useModuleCompletionStatus";
import { AIAssistant } from "@/components/AIAssistant";
import { BrandCanvasPDFExport } from "@/components/BrandCanvasPDFExport";
import { BrandMarkdownExport } from "@/components/export/BrandMarkdownExport";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { CollapsibleDescription } from "@/components/CollapsibleDescription";
import { CollapsibleVideo } from "@/components/CollapsibleVideo";
import type { SyncStatus } from "@/lib/knowledge-base/interfaces";

// Sync status indicator component
function SyncIndicator({ status }: { status: SyncStatus }): JSX.Element | null {
  switch (status) {
    case 'synced':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'syncing':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
    case 'offline':
      return <WifiOff className="w-4 h-4 text-amber-600" />;
    case 'error':
      return <WifiOff className="w-4 h-4 text-red-600" />;
    default:
      return null;
  }
}

export default function BrandCanvas() {
  const { toast } = useToast();
  const { brandData, updateBrandData, getRecommendedNextStep } = useBrand();

  // Module completion status from persisted fields
  const { insightsStatus, avatarStatus, insightsProgress, avatarProgress } = useModuleCompletionStatus();

  // Persisted text fields (local-first with background sync)
  const brandPurpose = usePersistedField({
    fieldIdentifier: 'canvas_brand_purpose',
    category: 'canvas',
    debounceDelay: 1000
  });

  const brandVision = usePersistedField({
    fieldIdentifier: 'canvas_brand_vision',
    category: 'canvas',
    debounceDelay: 1000
  });

  const brandMission = usePersistedField({
    fieldIdentifier: 'canvas_brand_mission',
    category: 'canvas',
    debounceDelay: 1000
  });

  const positioningStatement = usePersistedField({
    fieldIdentifier: 'canvas_positioning_statement',
    category: 'canvas',
    debounceDelay: 1000
  });

  const valueProposition = usePersistedField({
    fieldIdentifier: 'canvas_value_proposition',
    category: 'canvas',
    debounceDelay: 1000
  });

  const brandVoice = usePersistedField({
    fieldIdentifier: 'canvas_brand_voice',
    category: 'canvas',
    debounceDelay: 1000
  });

  // Persisted array fields
  const brandValues = usePersistedArrayField({
    fieldIdentifier: 'canvas_brand_values',
    category: 'canvas'
  });

  const brandPersonality = usePersistedArrayField({
    fieldIdentifier: 'canvas_brand_personality',
    category: 'canvas'
  });

  // Scroll to specific section
  const scrollToSection = (sectionId: string): void => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Calculate completion percentage from persisted fields
  const completionPercentage = useMemo(() => {
    const canvasFields = [
      brandPurpose.value,
      brandVision.value,
      brandMission.value,
      brandValues.value.length > 0,
      positioningStatement.value,
      valueProposition.value,
      brandPersonality.value.length > 0,
      brandVoice.value,
    ];

    const completedCanvasFields = canvasFields.filter(field =>
      typeof field === 'boolean' ? field : Boolean(field)
    ).length;

    return Math.round((completedCanvasFields / 8) * 100);
  }, [
    brandPurpose.value,
    brandVision.value,
    brandMission.value,
    brandValues.value,
    positioningStatement.value,
    valueProposition.value,
    brandPersonality.value,
    brandVoice.value
  ]);

  // Build canvas data object for PDF export and other uses
  const canvasData = useMemo(() => ({
    brandPurpose: brandPurpose.value,
    brandVision: brandVision.value,
    brandMission: brandMission.value,
    brandValues: brandValues.value,
    positioningStatement: positioningStatement.value,
    valueProposition: valueProposition.value,
    brandPersonality: brandPersonality.value,
    brandVoice: brandVoice.value,
    completed: completionPercentage === 100
  }), [
    brandPurpose.value,
    brandVision.value,
    brandMission.value,
    brandValues.value,
    positioningStatement.value,
    valueProposition.value,
    brandPersonality.value,
    brandVoice.value,
    completionPercentage
  ]);

  const recommendedStep = getRecommendedNextStep();

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 bg-background">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">IDEA Brand Canvas™ Builder</h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-6">
          Build your complete brand strategy using the IDEA Strategic Brand Framework™
        </p>
        
        {/* PLACEHOLDER: Add unique video for Brand Canvas page when available
        <CollapsibleVideo
          videoId="UNIQUE_VIDEO_ID"
          platform="vimeo"
          hash="VIDEO_HASH"
          title="How to Complete Your Brand Canvas"
          description="Step-by-step guide to building your complete brand strategy"
          storageKey="canvas_intro"
        />
        */}

        {/* Brand Canvas Introduction */}
        <Card className="bg-card shadow-card border mb-8 text-left">
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
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('brand-purpose')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Brand Purpose
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">The "why" behind your existence—the core reason it goes beyond just selling products.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Identifies customer needs beyond the product</p>
                    <p><strong>Distinctive:</strong> Stands out with a higher mission</p>
                    <p><strong>Empathetic:</strong> Resonates with customer values</p>
                    <p><strong>Authentic:</strong> Aligns with core identity</p>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Vision */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('brand-vision')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Brand Vision
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Aspirational statement about the future impact the brand seeks to make.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Rooted in evolving customer expectations</p>
                    <p><strong>Distinctive:</strong> Sets unique direction for category leadership</p>
                    <p><strong>Empathetic:</strong> Addresses emotional and societal needs</p>
                    <p><strong>Authentic:</strong> Aligns with long-term commitments</p>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Mission */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('brand-mission')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Brand Mission
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Actionable steps taken to fulfill the brand's purpose and vision.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Addresses specific customer challenges</p>
                    <p><strong>Distinctive:</strong> Defines unique way of delivering value</p>
                    <p><strong>Empathetic:</strong> Focuses on improving customer lives</p>
                    <p><strong>Authentic:</strong> Ensures consistency in messaging</p>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Values */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('brand-values')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Brand Values
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Guiding principles that shape how brand interacts with customers and stakeholders.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Reflects what customers value beyond products</p>
                    <p><strong>Distinctive:</strong> Sets brand apart through ethical standpoint</p>
                    <p><strong>Empathetic:</strong> Aligns with customer beliefs</p>
                    <p><strong>Authentic:</strong> Actions consistently reflect promises</p>
                  </div>
                </CardContent>
              </Card>

              {/* Positioning Statement */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('positioning-statement')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Positioning Statement
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Defines how the brand stands out in the market and why it's the best choice.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Addresses customer pain points directly</p>
                    <p><strong>Distinctive:</strong> Highlights unique solution offered</p>
                    <p><strong>Empathetic:</strong> Aligns with customer aspirations</p>
                    <p><strong>Authentic:</strong> Builds credibility through transparency</p>
                  </div>
                </CardContent>
              </Card>

              {/* Value Proposition */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('value-proposition')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Value Proposition
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Clear, compelling statement of why customers should buy from you vs competitors.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Understands customer pain points</p>
                    <p><strong>Distinctive:</strong> Clearly differentiates from competitors</p>
                    <p><strong>Empathetic:</strong> Addresses practical and emotional benefits</p>
                    <p><strong>Authentic:</strong> Reinforces trust through transparency</p>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Personality */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('brand-personality')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Brand Personality
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Human-like traits that influence how the brand speaks and interacts.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Based on what attracts target audience</p>
                    <p><strong>Distinctive:</strong> Establishes unique, recognizable identity</p>
                    <p><strong>Empathetic:</strong> Creates emotional connection through traits</p>
                    <p><strong>Authentic:</strong> Consistent across all communications</p>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Voice */}
              <Card 
                className="bg-card shadow-card border cursor-pointer hover:shadow-brand transition-all duration-200"
                onClick={() => scrollToSection('brand-voice')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-4 h-4 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        Brand Voice
                        <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Tone, language, and communication style used across all platforms.</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p><strong>Insight-Driven:</strong> Matches customer communication preferences</p>
                    <p><strong>Distinctive:</strong> Creates unique, recognizable voice</p>
                    <p><strong>Empathetic:</strong> Resonates emotionally with audience</p>
                    <p><strong>Authentic:</strong> Consistent across marketing and support</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-secondary/50 p-4 rounded-lg mt-6 border">
              <h4 className="font-semibold text-foreground mb-2">How the IDEA Framework Brings Your Brand Strategy to Life</h4>
              <p className="text-xs text-muted-foreground">
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
          <Card id="brand-purpose" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Brand Purpose</CardTitle>
                  <CardDescription>The "why" behind your existence—the core reason beyond just selling products</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brandPurpose" className="flex items-center gap-2">
                    Brand Purpose
                    <SyncIndicator status={brandPurpose.syncStatus} />
                  </Label>
                  {brandData.insight.completed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => brandPurpose.onChange(
                        brandData.insight.brandPurpose || "Transform customer lives through innovative solutions that deliver genuine value and meaningful impact."
                      )}
                    >
                      Import from IDEA
                    </Button>
                  )}
                </div>
                <Textarea
                  id="brandPurpose"
                  placeholder="What is your brand's core purpose? Why do you exist beyond making money?"
                  value={brandPurpose.value}
                  onChange={(e) => brandPurpose.onChange(e.target.value)}
                  rows={3}
                />
                <AIAssistant
                  fieldType="purpose"
                  currentValue={brandPurpose.value}
                  onSuggestion={(suggestion) => brandPurpose.onChange(suggestion)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Vision */}
          <Card id="brand-vision" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Brand Vision</CardTitle>
                  <CardDescription>Aspirational statement about the future impact your brand seeks to make</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandVision" className="flex items-center gap-2">
                  Vision Statement
                  <SyncIndicator status={brandVision.syncStatus} />
                </Label>
                <Textarea
                  id="brandVision"
                  placeholder="What future are you working towards? Where do you see your brand's impact in 5-10 years?"
                  value={brandVision.value}
                  onChange={(e) => brandVision.onChange(e.target.value)}
                  rows={3}
                />
                <AIAssistant
                  fieldType="vision"
                  currentValue={brandVision.value}
                  onSuggestion={(suggestion) => brandVision.onChange(suggestion)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Mission */}
          <Card id="brand-mission" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Brand Mission</CardTitle>
                  <CardDescription>Actionable steps taken to fulfill your brand's purpose and vision</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandMission" className="flex items-center gap-2">
                  Mission Statement
                  <SyncIndicator status={brandMission.syncStatus} />
                </Label>
                <Textarea
                  id="brandMission"
                  placeholder="How do you fulfill your purpose? What specific actions do you take?"
                  value={brandMission.value}
                  onChange={(e) => brandMission.onChange(e.target.value)}
                  rows={3}
                />
                <AIAssistant
                  fieldType="mission"
                  currentValue={brandMission.value}
                  onSuggestion={(suggestion) => brandMission.onChange(suggestion)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Values */}
          <Card id="brand-values" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Brand Values</CardTitle>
                  <CardDescription>Guiding principles that shape how your brand interacts with customers</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newValue" className="flex items-center gap-2">
                  Add Brand Values
                  <SyncIndicator status={brandValues.syncStatus} />
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="newValue"
                    placeholder="Enter a brand value (e.g., Integrity, Innovation)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          brandValues.add(value);
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
                      if (value) {
                        brandValues.add(value);
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandValues.value.map((value, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer">
                      {value}
                      <button
                        onClick={() => brandValues.remove(index)}
                        className="ml-2 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <AIAssistant
                  fieldType="values"
                  currentValue={brandValues.value.join(', ')}
                  onSuggestion={(suggestion) => {
                    const values = suggestion.split(',').map(v => v.trim()).filter(v => v);
                    brandValues.set(values);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Positioning Statement */}
          <Card id="positioning-statement" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Positioning Statement</CardTitle>
                  <CardDescription>How your brand stands out in the market and why it's the best choice</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="positioningStatement" className="flex items-center gap-2">
                  Positioning Statement
                  <SyncIndicator status={positioningStatement.syncStatus} />
                </Label>
                <Textarea
                  id="positioningStatement"
                  placeholder="For [target audience], [brand] is the [category] that [unique benefit] because [reason to believe]"
                  value={positioningStatement.value}
                  onChange={(e) => positioningStatement.onChange(e.target.value)}
                  rows={3}
                />
                <AIAssistant
                  fieldType="positioning"
                  currentValue={positioningStatement.value}
                  onSuggestion={(suggestion) => positioningStatement.onChange(suggestion)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Value Proposition */}
          <Card id="value-proposition" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Value Proposition</CardTitle>
                  <CardDescription>Clear statement of why customers should buy from you vs competitors</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="valueProposition" className="flex items-center gap-2">
                    Core Value Proposition
                    <SyncIndicator status={valueProposition.syncStatus} />
                  </Label>
                  {(brandData.insight.completed || brandData.avatar.completed) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const avatarInsights = brandData.avatar.completed ?
                          ` for ${brandData.avatar.psychographics?.values?.slice(0,2).join(' and ') || 'quality-focused'} customers who value ${brandData.avatar.goals?.slice(0,2).join(' and ') || 'excellence and results'}` : '';
                        valueProposition.onChange(
                          `We deliver unique solutions that address real customer needs${avatarInsights}, combining innovation with proven results to create meaningful transformation in their lives.`
                        );
                      }}
                    >
                      Import from IDEA + Avatar
                    </Button>
                  )}
                </div>
                <Textarea
                  id="valueProposition"
                  placeholder="What specific problems do you solve? What unique benefits do you provide?"
                  value={valueProposition.value}
                  onChange={(e) => valueProposition.onChange(e.target.value)}
                  rows={4}
                />
                <AIAssistant
                  fieldType="valueProposition"
                  currentValue={valueProposition.value}
                  onSuggestion={(suggestion) => valueProposition.onChange(suggestion)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Personality */}
          <Card id="brand-personality" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Brand Personality</CardTitle>
                  <CardDescription>Human-like traits that influence how your brand speaks and interacts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPersonality" className="flex items-center gap-2">
                  Add Personality Traits
                  <SyncIndicator status={brandPersonality.syncStatus} />
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="newPersonality"
                    placeholder="Enter personality trait (e.g., Friendly, Professional, Bold)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const trait = (e.target as HTMLInputElement).value.trim();
                        if (trait) {
                          brandPersonality.add(trait);
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
                      if (trait) {
                        brandPersonality.add(trait);
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandPersonality.value.map((trait, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer">
                      {trait}
                      <button
                        onClick={() => brandPersonality.remove(index)}
                        className="ml-2 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <AIAssistant
                  fieldType="personality"
                  currentValue={brandPersonality.value.join(', ')}
                  onSuggestion={(suggestion) => {
                    const traits = suggestion.split(',').map(t => t.trim()).filter(t => t);
                    brandPersonality.set(traits);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Voice */}
          <Card id="brand-voice" className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">Brand Voice</CardTitle>
                  <CardDescription>Tone, language, and communication style used across all platforms</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandVoice" className="flex items-center gap-2">
                  Brand Voice Description
                  <SyncIndicator status={brandVoice.syncStatus} />
                </Label>
                <Textarea
                  id="brandVoice"
                  placeholder="Describe your brand's tone and communication style (e.g., conversational yet professional, warm and approachable)"
                  value={brandVoice.value}
                  onChange={(e) => brandVoice.onChange(e.target.value)}
                  rows={3}
                />
                <AIAssistant
                  fieldType="voice"
                  currentValue={brandVoice.value}
                  onSuggestion={(suggestion) => brandVoice.onChange(suggestion)}
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/20 border-primary/30 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Brand Data Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm">IDEA Insights</span>
                  {insightsStatus === 'pending' && insightsProgress > 0 && (
                    <span className="text-xs text-muted-foreground">{insightsProgress}% complete</span>
                  )}
                </div>
                <Badge variant={insightsStatus === 'completed' ? "default" : insightsStatus === 'fully-optimized' ? "secondary" : "outline"}>
                  {insightsStatus === 'completed' ? "Completed" : insightsStatus === 'fully-optimized' ? "Fully Optimized" : "Pending"}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm">Avatar Profile</span>
                  {avatarStatus === 'pending' && avatarProgress > 0 && (
                    <span className="text-xs text-muted-foreground">{avatarProgress}% complete</span>
                  )}
                </div>
                <Badge variant={avatarStatus === 'completed' ? "default" : avatarStatus === 'fully-optimized' ? "secondary" : "outline"}>
                  {avatarStatus === 'completed' ? "Completed" : avatarStatus === 'fully-optimized' ? "Fully Optimized" : "Pending"}
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
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/20 border-primary/30 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {/* <Button asChild variant="outline" className="w-full">
                  <Link to="/copy-generator">
                    Generate AI Copy
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button> */}

                <BrandMarkdownExport
                  companyName={brandData.userInfo.company || "Your Brand"}
                  variant="outline"
                  fullWidth
                  includeChats={true}
                />

                <BrandCanvasPDFExport
                  brandCanvas={canvasData}
                  companyName={brandData.userInfo.company || "Your Brand"}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <FloatingChatWidget
        pageContext="Brand Canvas page - building their visual brand strategy"
        placeholder="Ask about your brand canvas..."
      />
    </div>
  );
}