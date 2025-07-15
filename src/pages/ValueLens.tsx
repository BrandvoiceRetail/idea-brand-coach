import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Zap, Copy, Download, RefreshCw, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ValueLensInput {
  productName: string;
  category: string;
  features: string[];
  targetAvatar: string;
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
  const [input, setInput] = useState<ValueLensInput>({
    productName: "",
    category: "",
    features: [],
    targetAvatar: "",
    emotionalPayoff: "",
    tone: "",
    format: "",
    additionalContext: ""
  });
  
  const [newFeature, setNewFeature] = useState("");
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setInput(prev => ({
      ...prev,
      features: [...prev.features, newFeature.trim()]
    }));
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    setInput(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const generateCopy = async () => {
    if (!input.productName || !input.format) {
      toast({
        title: "Missing Information",
        description: "Please fill in at least the product name and format.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate AI generation (in real implementation, this would call GPT-4)
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

  const generateSampleCopy = () => {
    const formatType = copyFormats.find(f => f.value === input.format)?.label || "Copy";
    
    if (input.format === "amazon-bullet") {
      return `• TRANSFORM YOUR ${input.category.toUpperCase()} EXPERIENCE - ${input.productName} delivers the ${input.emotionalPayoff.toLowerCase()} you've been searching for
• PREMIUM QUALITY THAT SHOWS - Built with superior materials that not only perform better but make you feel confident in your choice
• INSTANT RESULTS YOU'LL LOVE - See immediate improvements that justify every penny and give you that satisfaction of making the right decision
• TRUSTED BY THOUSANDS - Join customers who've discovered the difference quality makes in their daily routine
• 100% SATISFACTION PROMISE - We're so confident you'll love ${input.productName}, we guarantee your complete satisfaction or your money back`;
    }
    
    if (input.format === "ad-headline") {
      return `Finally! The ${input.category} That Delivers Real ${input.emotionalPayoff} (Without The Premium Price Tag)`;
    }
    
    if (input.format === "social-caption") {
      return `POV: You just discovered the ${input.category} that actually works 🤯

I was skeptical too... but ${input.productName} has completely changed how I feel about ${input.category.toLowerCase()}.

The ${input.emotionalPayoff.toLowerCase()} I get from this is unmatched. Finally something that delivers on its promises!

Who else is tired of products that overpromise and underdeliver? 👇

#${input.category.replace(/\s+/g, '')} #ProductReview #WorthIt`;
    }

    return `Transform your ${input.category.toLowerCase()} experience with ${input.productName}. 

Designed for people who value ${input.emotionalPayoff.toLowerCase()}, this isn't just another product - it's your solution to finally getting the results you deserve.

${input.features.length > 0 ? `✓ ${input.features.join('\n✓ ')}` : ''}

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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">ValueLens™ AI Copy Generator</h1>
        <p className="text-muted-foreground">
          Transform product features into emotionally resonant copy that converts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    value={input.productName}
                    onChange={(e) => setInput(prev => ({ ...prev, productName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Phone Accessories"
                    value={input.category}
                    onChange={(e) => setInput(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Key Features</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {input.features.map((feature, index) => (
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
                <Label htmlFor="targetAvatar">Target Avatar</Label>
                <Textarea
                  id="targetAvatar"
                  placeholder="Describe your ideal customer (or select from saved avatars)..."
                  value={input.targetAvatar}
                  onChange={(e) => setInput(prev => ({ ...prev, targetAvatar: e.target.value }))}
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
                  value={input.emotionalPayoff}
                  onValueChange={(value) => setInput(prev => ({ ...prev, emotionalPayoff: value }))}
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
                <Label htmlFor="tone">Brand Tone</Label>
                <Select
                  value={input.tone}
                  onValueChange={(value) => setInput(prev => ({ ...prev, tone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone of voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {tone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Copy Format *</Label>
                <Select
                  value={input.format}
                  onValueChange={(value) => setInput(prev => ({ ...prev, format: value }))}
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

              <div className="space-y-2">
                <Label htmlFor="additionalContext">Additional Context</Label>
                <Textarea
                  id="additionalContext"
                  placeholder="Any specific requirements, competitor info, or brand guidelines..."
                  value={input.additionalContext}
                  onChange={(e) => setInput(prev => ({ ...prev, additionalContext: e.target.value }))}
                  rows={3}
                />
              </div>

              <Button 
                onClick={generateCopy}
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
                  <div className="flex gap-2">
                    <Button onClick={copyCopy} size="sm" variant="outline">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                {generatedCopy 
                  ? `${copyFormats.find(f => f.value === input.format)?.label || "Copy"} generated with emotional resonance`
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
                  <p>Fill in the details and click "Generate" to see your copy</p>
                </div>
              )}
            </CardContent>
          </Card>

          {generatedCopy && (
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle>Copy Analysis</CardTitle>
                <CardDescription>
                  How this copy leverages behavioral triggers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Emotional Positioning</p>
                      <p className="text-sm text-muted-foreground">
                        Leads with the desired emotional outcome rather than features
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Social Proof Integration</p>
                      <p className="text-sm text-muted-foreground">
                        Includes trust signals and community validation
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Risk Reversal</p>
                      <p className="text-sm text-muted-foreground">
                        Addresses purchase anxiety with guarantees or assurances
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                    <div>
                      <p className="font-medium">Future Self Appeal</p>
                      <p className="text-sm text-muted-foreground">
                        Helps customer visualize their improved future state
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}