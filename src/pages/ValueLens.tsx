import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Copy, RefreshCw, Sparkles, Lock, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { PaywallModal } from "@/components/PaywallModal";

interface ValueLensInput {
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

export default function ValueLens() {
  const { toast } = useToast();
  const { brandData, isToolUnlocked } = useBrand();
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [formData, setFormData] = useState<ValueLensInput>({
    productName: "",
    category: "",
    features: [],
    targetAudience: "",
    emotionalPayoff: "",
    tone: "",
    format: "",
    additionalContext: ""
  });
  
  const [newFeature, setNewFeature] = useState("");
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setIsUnlocked(isToolUnlocked('valuelens'));
  }, [brandData, isToolUnlocked]);

  const handleGenerate = async () => {
    if (!isUnlocked) {
      setShowPaywall(true);
      return;
    }

    if (!formData.productName || !formData.targetAudience) {
      toast({
        title: "Missing Information",
        description: "Please fill in the product name and target audience.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      const sampleCopy = generateSampleCopy();
      setGeneratedCopy(sampleCopy);
      setIsGenerating(false);
      toast({
        title: "Copy Generated!",
        description: "Your ValueLens copy has been created."
      });
    }, 2000);
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, newFeature.trim()]
    }));
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const generateSampleCopy = () => {
    if (formData.format === "amazon-bullet") {
      return `• TRANSFORM YOUR ${formData.category.toUpperCase()} EXPERIENCE - ${formData.productName} delivers the ${formData.emotionalPayoff.toLowerCase()} you've been searching for
• PREMIUM QUALITY THAT SHOWS - Built with superior materials that not only perform better but make you feel confident in your choice
• INSTANT RESULTS YOU'LL LOVE - See immediate improvements that justify every penny and give you that satisfaction of making the right decision
• TRUSTED BY THOUSANDS - Join customers who've discovered the difference quality makes in their daily routine
• 100% SATISFACTION PROMISE - We're so confident you'll love ${formData.productName}, we guarantee your complete satisfaction or your money back`;
    }
    
    if (formData.format === "ad-headline") {
      return `Finally! The ${formData.category} That Delivers Real ${formData.emotionalPayoff} (Without The Premium Price Tag)`;
    }
    
    if (formData.format === "social-caption") {
      return `POV: You just discovered the ${formData.category} that actually works 🤯

I was skeptical too... but ${formData.productName} has completely changed how I feel about ${formData.category.toLowerCase()}.

The ${formData.emotionalPayoff.toLowerCase()} I get from this is unmatched. Finally something that delivers on its promises!

Who else is tired of products that overpromise and underdeliver? 👇

#${formData.category.replace(/\s+/g, '')} #ProductReview #WorthIt`;
    }

    return `Transform your ${formData.category.toLowerCase()} experience with ${formData.productName}. 

Designed for people who value ${formData.emotionalPayoff.toLowerCase()}, this isn't just another product - it's your solution to finally getting the results you deserve.

${formData.features.length > 0 ? `✓ ${formData.features.join('\n✓ ')}` : ''}

Ready to experience the difference? Your future self will thank you.`;
  };

  const copyCopy = () => {
    navigator.clipboard.writeText(generatedCopy);
    toast({
      title: "Copied!",
      description: "Copy has been copied to your clipboard."
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          {isUnlocked ? (
            <Zap className="w-8 h-8 text-secondary-foreground" />
          ) : (
            <Crown className="w-8 h-8 text-secondary-foreground" />
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">ValueLens AI Copy Generator</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {isUnlocked 
            ? "Generate emotionally resonant copy using your brand data and customer insights"
            : "Complete your brand strategy to unlock AI copy generation"
          }
        </p>
        {!isUnlocked && (
          <div className="mt-4 space-y-2">
            <Badge variant="outline">
              <Lock className="w-4 h-4 mr-2" />
              Premium Feature
            </Badge>
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <p className="font-medium mb-2">To unlock ValueLens AI Copy Generator, complete these steps:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {(brandData.insight.completed && brandData.distinctive.completed && 
                    brandData.empathy.completed && brandData.authentic.completed) ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-muted-foreground">□</span>
                  )}
                  <span>Complete all 4 IDEA Framework modules</span>
                </div>
                <div className="flex items-center gap-2">
                  {brandData.avatar.completed ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-muted-foreground">□</span>
                  )}
                  <span>Build your Customer Avatar</span>
                </div>
                <div className="flex items-center gap-2">
                  {brandData.brandCanvas.completed ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-muted-foreground">□</span>
                  )}
                  <span>Complete your Brand Canvas</span>
                </div>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/idea">Complete IDEA Framework</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/avatar">Build Avatar</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link to="/canvas">Complete Canvas</Link>
                </Button>
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
                    value={formData.productName}
                    onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Phone Accessories"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Key Features</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.features.map((feature, index) => (
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
                  value={formData.targetAudience}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
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
                  value={formData.emotionalPayoff}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, emotionalPayoff: value }))}
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
                  value={formData.format}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, format: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select copy format" />
                  </SelectTrigger>
                  <SelectContent>
                    {copyFormats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerate}
                className="w-full"
                variant="coach"
                disabled={isGenerating || !isUnlocked}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : !isUnlocked ? (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Unlock to Generate
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate ValueLens Copy
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
                {generatedCopy && (
                  <Button onClick={copyCopy} size="sm" variant="outline">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {generatedCopy 
                  ? `${copyFormats.find(f => f.value === formData.format)?.label || "Copy"} generated with emotional resonance`
                  : "Your AI-generated copy will appear here"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedCopy ? (
                <div className="space-y-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm font-medium leading-relaxed">
                      {generatedCopy}
                    </pre>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">✓ Emotional Hook</Badge>
                    <Badge variant="outline">✓ Benefit-Focused</Badge>
                    <Badge variant="outline">✓ Trust Signals</Badge>
                    <Badge variant="outline">✓ Clear CTA</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{isUnlocked ? "Fill in the details and click \"Generate\" to see your copy" : "Complete your brand strategy to unlock AI copy generation"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaywallModal 
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="ValueLens AI Copy Generator"
      />
    </div>
  );
}