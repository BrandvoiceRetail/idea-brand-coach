import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Copy, RefreshCw, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { PaywallModal } from "@/components/PaywallModal";
import { usePersistedField } from "@/hooks/usePersistedField";
import { supabase } from "@/integrations/supabase/client";

interface BrandCopyInput {
  productName: string;
  category: string;
  features: string[];
  targetAudience: string;
  emotionalPayoff: string;
  tone: string;
  format: string;
  additionalContext: string;
}

const copyFormats = [
  { value: "amazon-bullet", label: "Amazon Bullet Points" },
  { value: "pdp-description", label: "Product Description" },
  { value: "ad-headline", label: "Ad Headline" },
  { value: "social-caption", label: "Social Media Caption" },
  { value: "email-subject", label: "Email Subject Line" },
  { value: "tiktok-hook", label: "TikTok Hook" },
  { value: "landing-hero", label: "Landing Page Hero" }
];

const emotionalPayoffs = [
  "Confidence & Self-Assurance",
  "Peace of Mind & Security", 
  "Status & Recognition",
  "Time Freedom & Convenience",
  "Health & Vitality",
  "Love & Connection",
  "Achievement & Success",
  "Transformation & Growth"
];

const toneOptions = [
  "Professional & Trustworthy",
  "Friendly & Conversational", 
  "Urgent & Compelling",
  "Luxurious & Premium",
  "Casual & Relatable",
  "Educational & Helpful",
  "Bold & Confident"
];

export default function BrandCopyGenerator() {
  const { toast } = useToast();
  const { brandData, getRecommendedNextStep } = useBrand();
  const [showPaywall, setShowPaywall] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Persisted fields for form data
  const productName = usePersistedField({
    fieldIdentifier: 'copy_product_name',
    category: 'copy',
    debounceDelay: 1000
  });

  const category = usePersistedField({
    fieldIdentifier: 'copy_category',
    category: 'copy',
    debounceDelay: 1000
  });

  const features = usePersistedField({
    fieldIdentifier: 'copy_features',
    category: 'copy',
    defaultValue: '[]',
    debounceDelay: 1000
  });

  const targetAudience = usePersistedField({
    fieldIdentifier: 'copy_target_audience',
    category: 'copy',
    debounceDelay: 1000
  });

  const emotionalPayoff = usePersistedField({
    fieldIdentifier: 'copy_emotional_payoff',
    category: 'copy',
    debounceDelay: 1000
  });

  const tone = usePersistedField({
    fieldIdentifier: 'copy_tone',
    category: 'copy',
    debounceDelay: 1000
  });

  const format = usePersistedField({
    fieldIdentifier: 'copy_format',
    category: 'copy',
    debounceDelay: 1000
  });

  const additionalContext = usePersistedField({
    fieldIdentifier: 'copy_additional_context',
    category: 'copy',
    debounceDelay: 1000
  });

  const generatedCopy = usePersistedField({
    fieldIdentifier: 'copy_generated_result',
    category: 'copy',
    debounceDelay: 1000
  });

  // Parse features array
  const featuresList = useMemo(() => {
    try {
      const parsed = JSON.parse(features.value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [features.value]);

  const [newFeature, setNewFeature] = useState("");

  const recommendedStep = getRecommendedNextStep();
  const hasCompletedStrategy = brandData.insight.completed && brandData.distinctive.completed && 
    brandData.empathy.completed && brandData.authentic.completed && 
    brandData.avatar.completed && brandData.brandCanvas.completed;

  const [hasUserContext, setHasUserContext] = useState(false);

  const handleGenerate = async () => {
    if (!productName.value || !targetAudience.value) {
      toast({
        title: "Missing Information",
        description: "Please fill in the product name and target audience.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('brand-copy-generator', {
        body: {
          productName: productName.value,
          category: category.value || '',
          features: featuresList,
          targetAudience: targetAudience.value,
          emotionalPayoff: emotionalPayoff.value || '',
          tone: tone.value || '',
          format: format.value || 'pdp-description',
          additionalContext: additionalContext.value || '',
        }
      });

      if (error) {
        throw error;
      }

      generatedCopy.onChange(data.copy);
      setHasUserContext(data.hasUserContext || false);

      toast({
        title: "Copy Generated!",
        description: data.hasUserContext
          ? "Your brand copy has been created using your brand context."
          : "Your brand copy has been created."
      });
    } catch (error) {
      console.error('Error generating copy:', error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating your copy. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    const newList = [...featuresList, newFeature.trim()];
    features.onChange(JSON.stringify(newList));
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    const newList = featuresList.filter((_, i) => i !== index);
    features.onChange(JSON.stringify(newList));
  };

  const copyCopy = () => {
    navigator.clipboard.writeText(generatedCopy.value);
    toast({
      title: "Copied!",
      description: "Copy has been copied to your clipboard."
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Brand Copy Generator</h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-4">
          Generate emotionally resonant copy using your brand data and customer insights
        </p>
        
        {/* Value Proposition */}
        <div className="bg-muted/30 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-primary font-semibold mb-1">🧠 Behavioral Science</div>
              <div className="text-muted-foreground">Copy triggers emotional responses using proven psychological principles</div>
            </div>
            <div className="text-center">
              <div className="text-primary font-semibold mb-1">🎯 Avatar-Driven</div>
              <div className="text-muted-foreground">Uses your customer avatar data for personalized messaging that resonates</div>
            </div>
            <div className="text-center">
              <div className="text-primary font-semibold mb-1">⚡ Multiple Formats</div>
              <div className="text-muted-foreground">Generate variants for Amazon, ads, social media, emails, and more</div>
            </div>
          </div>
        </div>
        
        {hasCompletedStrategy && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-300">✅ Strategy Complete!</p>
                <p className="text-sm text-muted-foreground">Your brand framework is ready for AI-powered copy generation.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                <span>Product Details</span>
              </CardTitle>
              <CardDescription>
                Tell us about your product and target customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name *</Label>
                  <Input
                    id="productName"
                    placeholder="e.g., UltraGrip Phone Case"
                    value={productName.value}
                    onChange={(e) => productName.onChange(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Phone Accessories"
                    value={category.value}
                    onChange={(e) => category.onChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Key Features</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {featuresList.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {feature}
                      <button
                        onClick={() => removeFeature(index)}
                        className="text-xs hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a key feature..."
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addFeature()}
                  />
                  <Button onClick={addFeature} size="sm" variant="outline">
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">Target Audience *</Label>
                <Textarea
                  id="targetAudience"
                  placeholder="Describe your ideal customer..."
                  value={targetAudience.value}
                  onChange={(e) => targetAudience.onChange(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Copy Parameters</CardTitle>
              <CardDescription>
                Define the emotional angle and style
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emotionalPayoff">Emotional Payoff *</Label>
                <Select
                  value={emotionalPayoff.value}
                  onValueChange={(value) => emotionalPayoff.onChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select emotional benefit" />
                  </SelectTrigger>
                  <SelectContent>
                    {emotionalPayoffs.map((payoff) => (
                      <SelectItem key={payoff} value={payoff}>
                        {payoff}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Copy Format *</Label>
                <Select
                  value={format.value}
                  onValueChange={(value) => format.onChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select copy format" />
                  </SelectTrigger>
                  <SelectContent>
                    {copyFormats.map((formatOption) => (
                      <SelectItem key={formatOption.value} value={formatOption.value}>
                        {formatOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerate}
                className="w-full"
                variant="coach"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate Brand Copy
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Output Section */}
        <div className="space-y-6">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Copy</span>
                {generatedCopy.value && (
                  <Button onClick={copyCopy} size="sm" variant="outline">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {generatedCopy.value
                  ? `${copyFormats.find(f => f.value === format.value)?.label || "Copy"} generated with emotional resonance`
                  : "Your AI-generated copy will appear here"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedCopy.value ? (
                <div className="space-y-4">
                  {/* Context indicator */}
                  {hasUserContext && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
                      <CheckCircle className="w-4 h-4" />
                      <span>Generated using your brand context (avatar, canvas, coach conversations)</span>
                    </div>
                  )}

                  <div className="bg-muted/30 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm font-medium leading-relaxed">
                      {generatedCopy.value}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">✓ Emotional Hook</Badge>
                    <Badge variant="outline">✓ Benefit-Focused</Badge>
                    <Badge variant="outline">✓ Trust Signals</Badge>
                    <Badge variant="outline">✓ Clear CTA</Badge>
                    {hasUserContext && <Badge variant="default">✓ Personalized</Badge>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Fill in the details and click "Generate" to see your copy</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaywallModal 
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="Brand Copy Generator"
      />
    </div>
  );
}