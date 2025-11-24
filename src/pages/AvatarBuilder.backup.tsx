import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Target, Save, Share, Plus, X, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { AIAssistant } from "@/components/AIAssistant";
import { AvatarPDFExport } from "@/components/AvatarPDFExport";

interface Avatar {
  name: string;
  demographics: {
    age: string;
    income: string;
    location: string;
    lifestyle: string;
  };
  psychographics: {
    values: string[];
    fears: string[];
    desires: string[];
    triggers: string[];
  };
  buyingBehavior: {
    intent: string;
    decisionFactors: string[];
    shoppingStyle: string;
    priceConsciousness: string;
  };
  voiceOfCustomer: string;
}

export default function AvatarBuilder() {
  const { toast } = useToast();
  const { brandData, updateBrandData } = useBrand();
  const [avatar, setAvatar] = useState<Avatar>({
    name: "",
    demographics: {
      age: "",
      income: "",
      location: "",
      lifestyle: ""
    },
    psychographics: {
      values: [],
      fears: [],
      desires: [],
      triggers: []
    },
    buyingBehavior: {
      intent: "",
      decisionFactors: [],
      shoppingStyle: "",
      priceConsciousness: ""
    },
    voiceOfCustomer: ""
  });

  const [newTag, setNewTag] = useState("");
  const [currentSection, setCurrentSection] = useState<"values" | "fears" | "desires" | "triggers" | "decisionFactors">("values");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<{
    keyPhrases: string[];
    sentiment: { positive: number; negative: number; neutral: number };
    insights: string[];
  } | null>(null);

  const addTag = (section: keyof Avatar["psychographics"] | "decisionFactors") => {
    if (!newTag.trim()) return;
    
    if (section === "decisionFactors") {
      setAvatar(prev => ({
        ...prev,
        buyingBehavior: {
          ...prev.buyingBehavior,
          decisionFactors: [...prev.buyingBehavior.decisionFactors, newTag.trim()]
        }
      }));
    } else {
      setAvatar(prev => ({
        ...prev,
        psychographics: {
          ...prev.psychographics,
          [section]: [...prev.psychographics[section], newTag.trim()]
        }
      }));
    }
    setNewTag("");
  };

  const removeTag = (section: keyof Avatar["psychographics"] | "decisionFactors", index: number) => {
    if (section === "decisionFactors") {
      setAvatar(prev => ({
        ...prev,
        buyingBehavior: {
          ...prev.buyingBehavior,
          decisionFactors: prev.buyingBehavior.decisionFactors.filter((_, i) => i !== index)
        }
      }));
    } else {
      setAvatar(prev => ({
        ...prev,
        psychographics: {
          ...prev.psychographics,
          [section]: prev.psychographics[section].filter((_, i) => i !== index)
        }
      }));
    }
  };

  const suggestedValues = ["Family", "Success", "Health", "Freedom", "Security", "Adventure", "Growth", "Quality"];
  const suggestedFears = ["Wasting money", "Making wrong choice", "Looking foolish", "Missing out", "Not fitting in"];
  const suggestedDesires = ["Save time", "Feel confident", "Be admired", "Feel secure", "Transform lifestyle"];

  const analyzeVoiceOfCustomer = async (type: 'phrases' | 'sentiment') => {
    if (!avatar.voiceOfCustomer.trim()) {
      toast({
        title: "No content to analyze",
        description: "Please paste some customer reviews or feedback first.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Simulate AI analysis - replace with actual AI service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockKeyPhrases = [
        "excellent customer service",
        "easy to use",
        "great value for money",
        "highly recommend",
        "fast shipping",
        "quality product"
      ];

      const mockSentiment = {
        positive: 75,
        negative: 15,
        neutral: 10
      };

      const mockInsights = [
        "Customers frequently mention ease of use as a key benefit",
        "Customer service quality is a major differentiator",
        "Value perception is strongly tied to product quality",
        "Shipping speed significantly impacts satisfaction"
      ];

      setAnalysisResults({
        keyPhrases: mockKeyPhrases,
        sentiment: mockSentiment,
        insights: mockInsights
      });

      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed customer feedback for ${type === 'phrases' ? 'key phrases' : 'sentiment'}.`
      });

    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze the content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Avatar 2.0 Builder</h1>
        <p className="text-muted-foreground">
          Create detailed behavioral avatars that capture emotional drivers and subconscious motivators
        </p>
      </div>

      <Tabs defaultValue="demographics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="psychographics">Psychology</TabsTrigger>
          <TabsTrigger value="behavior">Buying Behavior</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>

        {/* Demographics Tab */}
        <TabsContent value="demographics">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Basic Demographics</CardTitle>
              <CardDescription>
                Start with the foundational characteristics of your ideal customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Avatar Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Busy Professional Mom"
                    value={avatar.name}
                    onChange={(e) => setAvatar(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Age Range</Label>
                  <Select
                    value={avatar.demographics.age}
                    onValueChange={(value) => setAvatar(prev => ({
                      ...prev,
                      demographics: { ...prev.demographics, age: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select age range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18-24">18-24</SelectItem>
                      <SelectItem value="25-34">25-34</SelectItem>
                      <SelectItem value="35-44">35-44</SelectItem>
                      <SelectItem value="45-54">45-54</SelectItem>
                      <SelectItem value="55-64">55-64</SelectItem>
                      <SelectItem value="65+">65+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="income">Income Level</Label>
                  <Select
                    value={avatar.demographics.income}
                    onValueChange={(value) => setAvatar(prev => ({
                      ...prev,
                      demographics: { ...prev.demographics, income: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select income level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under-30k">Under $30k</SelectItem>
                      <SelectItem value="30k-50k">$30k - $50k</SelectItem>
                      <SelectItem value="50k-75k">$50k - $75k</SelectItem>
                      <SelectItem value="75k-100k">$75k - $100k</SelectItem>
                      <SelectItem value="100k-150k">$100k - $150k</SelectItem>
                      <SelectItem value="150k+">$150k+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location Type</Label>
                  <Select
                    value={avatar.demographics.location}
                    onValueChange={(value) => setAvatar(prev => ({
                      ...prev,
                      demographics: { ...prev.demographics, location: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urban">Urban</SelectItem>
                      <SelectItem value="suburban">Suburban</SelectItem>
                      <SelectItem value="rural">Rural</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lifestyle">Lifestyle Description</Label>
                <Textarea
                  id="lifestyle"
                  placeholder="Describe their typical day, family situation, work life, hobbies..."
                  value={avatar.demographics.lifestyle}
                  onChange={(e) => setAvatar(prev => ({
                    ...prev,
                    demographics: { ...prev.demographics, lifestyle: e.target.value }
                  }))}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Psychographics Tab */}
        <TabsContent value="psychographics">
          <div className="space-y-6">
            {/* Values */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle>Core Values</CardTitle>
                <CardDescription>What matters most to them in life?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {avatar.psychographics.values.map((value, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {value}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeTag("values", index)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a core value..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addTag("values");
                      }
                    }}
                  />
                  <Button onClick={() => addTag("values")} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Suggestions:</span>
                  {suggestedValues.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setNewTag(value);
                        addTag("values");
                      }}
                      className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fears */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle>Fears & Anxieties</CardTitle>
                <CardDescription>What keeps them up at night?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {avatar.psychographics.fears.map((fear, index) => (
                    <Badge key={index} variant="destructive" className="flex items-center gap-1">
                      {fear}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeTag("fears", index)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a fear or anxiety..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addTag("fears");
                      }
                    }}
                  />
                  <Button onClick={() => addTag("fears")} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Suggestions:</span>
                  {suggestedFears.map((fear) => (
                    <button
                      key={fear}
                      onClick={() => {
                        setNewTag(fear);
                        addTag("fears");
                      }}
                      className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      {fear}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Desires */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle>Desires & Aspirations</CardTitle>
                <CardDescription>What do they want to achieve or become?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {avatar.psychographics.desires.map((desire, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1 border-secondary text-secondary">
                      {desire}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeTag("desires", index)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a desire or aspiration..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addTag("desires");
                      }
                    }}
                  />
                  <Button onClick={() => addTag("desires")} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Suggestions:</span>
                  {suggestedDesires.map((desire) => (
                    <button
                      key={desire}
                      onClick={() => {
                        setNewTag(desire);
                        addTag("desires");
                      }}
                      className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    >
                      {desire}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Buying Behavior Tab */}
        <TabsContent value="behavior">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Buying Behavior</CardTitle>
              <CardDescription>How do they research, decide, and purchase?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="intent">Buying Intent</Label>
                  <Select
                    value={avatar.buyingBehavior.intent}
                    onValueChange={(value) => setAvatar(prev => ({
                      ...prev,
                      buyingBehavior: { ...prev.buyingBehavior, intent: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select buying intent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="impulse">Impulse buyer</SelectItem>
                      <SelectItem value="research">Heavy researcher</SelectItem>
                      <SelectItem value="comparison">Comparison shopper</SelectItem>
                      <SelectItem value="loyal">Brand loyal</SelectItem>
                      <SelectItem value="deal-seeker">Deal seeker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shopping-style">Shopping Style</Label>
                  <Select
                    value={avatar.buyingBehavior.shoppingStyle}
                    onValueChange={(value) => setAvatar(prev => ({
                      ...prev,
                      buyingBehavior: { ...prev.buyingBehavior, shoppingStyle: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shopping style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online-only">Online only</SelectItem>
                      <SelectItem value="store-only">Store only</SelectItem>
                      <SelectItem value="omnichannel">Both online & store</SelectItem>
                      <SelectItem value="mobile-first">Mobile-first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price-consciousness">Price Consciousness</Label>
                  <Select
                    value={avatar.buyingBehavior.priceConsciousness}
                    onValueChange={(value) => setAvatar(prev => ({
                      ...prev,
                      buyingBehavior: { ...prev.buyingBehavior, priceConsciousness: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select price sensitivity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very-sensitive">Very price sensitive</SelectItem>
                      <SelectItem value="somewhat-sensitive">Somewhat price sensitive</SelectItem>
                      <SelectItem value="value-focused">Value-focused</SelectItem>
                      <SelectItem value="quality-focused">Quality over price</SelectItem>
                      <SelectItem value="premium">Premium buyer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Decision Factors */}
              <div className="space-y-4">
                <Label>Key Decision Factors</Label>
                <div className="flex flex-wrap gap-2">
                  {avatar.buyingBehavior.decisionFactors.map((factor, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {factor}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeTag("decisionFactors", index)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a decision factor..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addTag("decisionFactors");
                      }
                    }}
                  />
                  <Button onClick={() => addTag("decisionFactors")} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Voice of Customer</CardTitle>
              <CardDescription>
                Paste real customer reviews, comments, or feedback to extract their voice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste customer reviews, testimonials, comments, or any customer feedback here. This helps capture their actual language and concerns..."
                value={avatar.voiceOfCustomer}
                onChange={(e) => setAvatar(prev => ({ ...prev, voiceOfCustomer: e.target.value }))}
                rows={10}
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => analyzeVoiceOfCustomer('phrases')}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Extract Key Phrases
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => analyzeVoiceOfCustomer('sentiment')}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Analyze Sentiment
                </Button>
              </div>

              {analysisResults && (
                <div className="space-y-4 mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-sm">Analysis Results</h4>
                  
                  {analysisResults.keyPhrases.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Key Phrases</h5>
                      <div className="flex flex-wrap gap-2">
                        {analysisResults.keyPhrases.map((phrase, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {phrase}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="text-sm font-medium mb-2">Sentiment Analysis</h5>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-16">Positive:</span>
                        <div className="flex-1 bg-secondary/20 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${analysisResults.sentiment.positive}%` }}
                          />
                        </div>
                        <span className="text-xs">{analysisResults.sentiment.positive}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-16">Negative:</span>
                        <div className="flex-1 bg-secondary/20 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ width: `${analysisResults.sentiment.negative}%` }}
                          />
                        </div>
                        <span className="text-xs">{analysisResults.sentiment.negative}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-16">Neutral:</span>
                        <div className="flex-1 bg-secondary/20 rounded-full h-2">
                          <div 
                            className="bg-gray-500 h-2 rounded-full" 
                            style={{ width: `${analysisResults.sentiment.neutral}%` }}
                          />
                        </div>
                        <span className="text-xs">{analysisResults.sentiment.neutral}%</span>
                      </div>
                    </div>
                  </div>

                  {analysisResults.insights.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Key Insights</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {analysisResults.insights.map((insight, index) => (
                          <li key={index} className="text-xs text-muted-foreground">
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          variant="coach" 
          size="lg" 
          className="flex items-center space-x-2"
          onClick={() => {
            // Save to BrandContext
            updateBrandData('avatar', {
              demographics: {
                age: avatar.demographics.age,
                gender: '',
                income: avatar.demographics.income,
                location: avatar.demographics.location,
                occupation: ''
              },
              psychographics: {
                interests: [],
                values: avatar.psychographics.values,
                lifestyle: avatar.demographics.lifestyle,
                personality: []
              },
              painPoints: avatar.psychographics.fears,
              goals: avatar.psychographics.desires,
              preferredChannels: [],
              completed: true
            });
            
            toast({
              title: "Avatar Saved",
              description: "Your avatar profile has been saved and integrated with your brand data."
            });
          }}
        >
          <Save className="w-4 h-4" />
          <span>Save Avatar</span>
        </Button>
        <div className="w-full">
          <AvatarPDFExport avatar={avatar} analysisResults={analysisResults} />
        </div>
      </div>
    </div>
  );
}