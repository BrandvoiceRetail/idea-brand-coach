import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, X, Sparkles, Loader2, CheckCircle, WifiOff, MessageSquare } from "lucide-react";
import { CollapsibleVideo } from "@/components/CollapsibleVideo";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { AIAssistant } from "@/components/AIAssistant";
import { FieldChatButton } from "@/components/FieldChatModal";
// ARCHIVED: PDF export temporarily disabled
// import { AvatarPDFExport } from "@/components/AvatarPDFExport";
import { usePersistedField } from "@/hooks/usePersistedField";
import type { SyncStatus } from "@/lib/knowledge-base/interfaces";

/**
 * Sync status indicator for the header
 */
function SyncStatusIndicator({ status }: { status: SyncStatus }) {
  if (status === 'synced') return null; // Don't show when synced

  switch (status) {
    case 'syncing':
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Saving changes...</span>
        </div>
      );
    case 'offline':
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <WifiOff className="w-4 h-4" />
          <span>Offline - changes saved locally</span>
        </div>
      );
    default:
      return null;
  }
}

export default function AvatarBuilder() {
  const { toast } = useToast();
  const { brandData, updateBrandData } = useBrand();

  // Migrate to persisted fields with local-first architecture
  const avatarName = usePersistedField({
    fieldIdentifier: 'avatar_name',
    category: 'avatar',
    defaultValue: ''
  });

  // Demographics
  const age = usePersistedField({
    fieldIdentifier: 'avatar_demographics_age',
    category: 'avatar',
    defaultValue: ''
  });

  const income = usePersistedField({
    fieldIdentifier: 'avatar_demographics_income',
    category: 'avatar',
    defaultValue: ''
  });

  const location = usePersistedField({
    fieldIdentifier: 'avatar_demographics_location',
    category: 'avatar',
    defaultValue: ''
  });

  const lifestyle = usePersistedField({
    fieldIdentifier: 'avatar_demographics_lifestyle',
    category: 'avatar',
    defaultValue: '',
    debounceDelay: 1000
  });

  // Psychographics (stored as JSON arrays)
  const values = usePersistedField({
    fieldIdentifier: 'avatar_psychology_values',
    category: 'avatar',
    defaultValue: '[]'
  });

  const fears = usePersistedField({
    fieldIdentifier: 'avatar_psychology_fears',
    category: 'avatar',
    defaultValue: '[]'
  });

  const desires = usePersistedField({
    fieldIdentifier: 'avatar_psychology_desires',
    category: 'avatar',
    defaultValue: '[]'
  });

  const triggers = usePersistedField({
    fieldIdentifier: 'avatar_psychology_triggers',
    category: 'avatar',
    defaultValue: '[]'
  });

  // Buying Behavior
  const intent = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_intent',
    category: 'avatar',
    defaultValue: ''
  });

  const decisionFactors = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_decision_factors',
    category: 'avatar',
    defaultValue: '[]'
  });

  const shoppingStyle = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_shopping_style',
    category: 'avatar',
    defaultValue: ''
  });

  const priceConsciousness = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_price_consciousness',
    category: 'avatar',
    defaultValue: ''
  });

  // Voice of Customer
  const voiceOfCustomer = usePersistedField({
    fieldIdentifier: 'avatar_voice_customer_feedback',
    category: 'avatar',
    defaultValue: '',
    debounceDelay: 1500
  });

  // Local UI state (not persisted)
  const [newTag, setNewTag] = useState("");
  const [currentSection, setCurrentSection] = useState<"values" | "fears" | "desires" | "triggers" | "decisionFactors">("values");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<{
    keyPhrases: string[];
    sentiment: { positive: number; negative: number; neutral: number };
    insights: string[];
  } | null>(null);

  // Helper to parse JSON arrays
  const parseArray = (value: string): string[] => {
    try {
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  };

  // Helper to add tags to arrays
  const addTag = (section: keyof { values: any; fears: any; desires: any; triggers: any } | "decisionFactors") => {
    if (!newTag.trim()) return;

    if (section === "decisionFactors") {
      const current = parseArray(decisionFactors.value);
      decisionFactors.onChange(JSON.stringify([...current, newTag.trim()]));
    } else {
      const fieldMap = { values, fears, desires, triggers };
      const field = fieldMap[section];
      const current = parseArray(field.value);
      field.onChange(JSON.stringify([...current, newTag.trim()]));
    }
    setNewTag("");
  };

  // Helper to remove tags from arrays
  const removeTag = (section: keyof { values: any; fears: any; desires: any; triggers: any } | "decisionFactors", index: number) => {
    if (section === "decisionFactors") {
      const current = parseArray(decisionFactors.value);
      decisionFactors.onChange(JSON.stringify(current.filter((_, i) => i !== index)));
    } else {
      const fieldMap = { values, fears, desires, triggers };
      const field = fieldMap[section];
      const current = parseArray(field.value);
      field.onChange(JSON.stringify(current.filter((_, i) => i !== index)));
    }
  };

  // Calculate overall sync status
  const getOverallSyncStatus = (): SyncStatus => {
    const statuses = [
      avatarName.syncStatus, age.syncStatus, income.syncStatus,
      location.syncStatus, lifestyle.syncStatus, values.syncStatus,
      fears.syncStatus, desires.syncStatus, triggers.syncStatus,
      intent.syncStatus, decisionFactors.syncStatus,
      shoppingStyle.syncStatus, priceConsciousness.syncStatus,
      voiceOfCustomer.syncStatus
    ];

    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'syncing')) return 'syncing';
    if (statuses.some(s => s === 'offline')) return 'offline';
    return 'synced';
  };

  const suggestedValues = ["Family", "Success", "Health", "Freedom", "Security", "Adventure", "Growth", "Quality"];
  const suggestedFears = ["Wasting money", "Making wrong choice", "Looking foolish", "Missing out", "Not fitting in"];
  const suggestedDesires = ["Save time", "Feel confident", "Be admired", "Feel secure", "Transform lifestyle"];

  const analyzeVoiceOfCustomer = async (type: 'phrases' | 'sentiment') => {
    if (!voiceOfCustomer.value.trim()) {
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
    <div className="max-w-4xl mx-auto space-y-8" data-tour="avatar-builder">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Avatar 2.0 Builder</h1>
        <p className="text-muted-foreground">
          Create detailed behavioral avatars that capture emotional drivers and subconscious motivators
        </p>
        <div className="mt-4">
          <SyncStatusIndicator status={getOverallSyncStatus()} />
        </div>
      </div>

      {/* PLACEHOLDER: Add unique video for Avatar page when available
      <CollapsibleVideo
        videoId="UNIQUE_VIDEO_ID"
        platform="vimeo"
        hash="VIDEO_HASH"
        title="How to Build Your Customer Avatar"
        description="Learn how to create detailed behavioral avatars that capture emotional drivers"
        storageKey="avatar_intro"
      />
      */}

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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="name">Avatar Name *</Label>
                    <FieldChatButton
                      field={{
                        fieldId: 'avatar.name',
                        fieldLabel: 'Avatar Name',
                        currentValue: avatarName.value,
                        systemPrompt: 'Help the user create a compelling name for their ideal customer avatar. The name should be descriptive and memorable.'
                      }}
                      onApplyValue={(value) => avatarName.onChange(value)}
                    />
                  </div>
                  <Input
                    id="name"
                    placeholder="e.g., Busy Professional Mom"
                    value={avatarName.value}
                    onChange={(e) => avatarName.onChange(e.target.value)}
                    disabled={avatarName.isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Age Range</Label>
                  <Select
                    value={age.value}
                    onValueChange={age.onChange}
                    disabled={age.isLoading}
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
                    value={income.value}
                    onValueChange={income.onChange}
                    disabled={income.isLoading}
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
                    value={location.value}
                    onValueChange={location.onChange}
                    disabled={location.isLoading}
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="lifestyle">Lifestyle Description</Label>
                  <FieldChatButton
                    field={{
                      fieldId: 'avatar.lifestyle',
                      fieldLabel: 'Lifestyle Description',
                      currentValue: lifestyle.value,
                      systemPrompt: 'Help the user describe their ideal customer\'s lifestyle including typical day, family situation, work life, and hobbies. Make it vivid and relatable.'
                    }}
                    onApplyValue={(value) => lifestyle.onChange(value)}
                  />
                </div>
                <Textarea
                  id="lifestyle"
                  placeholder="Describe their typical day, family situation, work life, hobbies..."
                  value={lifestyle.value}
                  onChange={(e) => lifestyle.onChange(e.target.value)}
                  disabled={lifestyle.isLoading}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Psychographics Tab */}
        <TabsContent value="psychographics">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Psychographic Profile</CardTitle>
              <CardDescription>
                Understand what drives your customer emotionally and psychologically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Values */}
              <div className="space-y-3">
                <Label>Core Values</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {parseArray(values.value).map((value, index) => (
                    <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1">
                      {value}
                      <button
                        onClick={() => removeTag("values", index)}
                        className="ml-2 hover:bg-muted rounded p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a value..."
                    value={currentSection === "values" ? newTag : ""}
                    onChange={(e) => {
                      setCurrentSection("values");
                      setNewTag(e.target.value);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag("values");
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      setCurrentSection("values");
                      addTag("values");
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedValues.map((value) => (
                    <Badge
                      key={value}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        const current = parseArray(values.value);
                        if (!current.includes(value)) {
                          values.onChange(JSON.stringify([...current, value]));
                        }
                      }}
                    >
                      + {value}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Fears */}
              <div className="space-y-3">
                <Label>Primary Fears</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {parseArray(fears.value).map((fear, index) => (
                    <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1">
                      {fear}
                      <button
                        onClick={() => removeTag("fears", index)}
                        className="ml-2 hover:bg-muted rounded p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a fear..."
                    value={currentSection === "fears" ? newTag : ""}
                    onChange={(e) => {
                      setCurrentSection("fears");
                      setNewTag(e.target.value);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag("fears");
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      setCurrentSection("fears");
                      addTag("fears");
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedFears.map((fear) => (
                    <Badge
                      key={fear}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        const current = parseArray(fears.value);
                        if (!current.includes(fear)) {
                          fears.onChange(JSON.stringify([...current, fear]));
                        }
                      }}
                    >
                      + {fear}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Desires */}
              <div className="space-y-3">
                <Label>Deep Desires</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {parseArray(desires.value).map((desire, index) => (
                    <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1">
                      {desire}
                      <button
                        onClick={() => removeTag("desires", index)}
                        className="ml-2 hover:bg-muted rounded p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a desire..."
                    value={currentSection === "desires" ? newTag : ""}
                    onChange={(e) => {
                      setCurrentSection("desires");
                      setNewTag(e.target.value);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag("desires");
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      setCurrentSection("desires");
                      addTag("desires");
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedDesires.map((desire) => (
                    <Badge
                      key={desire}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        const current = parseArray(desires.value);
                        if (!current.includes(desire)) {
                          desires.onChange(JSON.stringify([...current, desire]));
                        }
                      }}
                    >
                      + {desire}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Emotional Triggers */}
              <div className="space-y-3">
                <Label>Emotional Triggers</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {parseArray(triggers.value).map((trigger, index) => (
                    <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1">
                      {trigger}
                      <button
                        onClick={() => removeTag("triggers", index)}
                        className="ml-2 hover:bg-muted rounded p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add an emotional trigger..."
                    value={currentSection === "triggers" ? newTag : ""}
                    onChange={(e) => {
                      setCurrentSection("triggers");
                      setNewTag(e.target.value);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag("triggers");
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      setCurrentSection("triggers");
                      addTag("triggers");
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buying Behavior Tab */}
        <TabsContent value="behavior">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Buying Behavior</CardTitle>
              <CardDescription>
                How your customer makes purchasing decisions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Buying Intent</Label>
                  <Select
                    value={intent.value}
                    onValueChange={intent.onChange}
                    disabled={intent.isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select intent level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate Need</SelectItem>
                      <SelectItem value="researching">Actively Researching</SelectItem>
                      <SelectItem value="considering">Considering Options</SelectItem>
                      <SelectItem value="browsing">Just Browsing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Shopping Style</Label>
                  <Select
                    value={shoppingStyle.value}
                    onValueChange={shoppingStyle.onChange}
                    disabled={shoppingStyle.isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shopping style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="impulsive">Impulsive Buyer</SelectItem>
                      <SelectItem value="researcher">Thorough Researcher</SelectItem>
                      <SelectItem value="bargain-hunter">Bargain Hunter</SelectItem>
                      <SelectItem value="quality-focused">Quality Focused</SelectItem>
                      <SelectItem value="brand-loyal">Brand Loyal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Price Consciousness</Label>
                  <Select
                    value={priceConsciousness.value}
                    onValueChange={priceConsciousness.onChange}
                    disabled={priceConsciousness.isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select price sensitivity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very-high">Very Price Sensitive</SelectItem>
                      <SelectItem value="high">Price Conscious</SelectItem>
                      <SelectItem value="moderate">Balanced</SelectItem>
                      <SelectItem value="low">Quality Over Price</SelectItem>
                      <SelectItem value="very-low">Price Insensitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Decision Factors */}
              <div className="space-y-3">
                <Label>Key Decision Factors</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {parseArray(decisionFactors.value).map((factor, index) => (
                    <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1">
                      {factor}
                      <button
                        onClick={() => removeTag("decisionFactors", index)}
                        className="ml-2 hover:bg-muted rounded p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a decision factor..."
                    value={currentSection === "decisionFactors" ? newTag : ""}
                    onChange={(e) => {
                      setCurrentSection("decisionFactors");
                      setNewTag(e.target.value);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag("decisionFactors");
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      setCurrentSection("decisionFactors");
                      addTag("decisionFactors");
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice of Customer Tab */}
        <TabsContent value="voice">
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Voice of Customer</CardTitle>
              <CardDescription>
                Analyze real customer feedback to extract insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice">Customer Reviews & Feedback</Label>
                  <FieldChatButton
                    field={{
                      fieldId: 'avatar.voice_of_customer',
                      fieldLabel: 'Voice of Customer',
                      currentValue: voiceOfCustomer.value,
                      systemPrompt: 'Help analyze and improve customer voice data. Extract key themes, suggest additional feedback sources, or help synthesize insights from customer reviews.'
                    }}
                    onApplyValue={(value) => voiceOfCustomer.onChange(value)}
                  />
                </div>
                <Textarea
                  id="voice"
                  placeholder="Paste customer reviews, feedback, or testimonials here..."
                  value={voiceOfCustomer.value}
                  onChange={(e) => voiceOfCustomer.onChange(e.target.value)}
                  disabled={voiceOfCustomer.isLoading}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => analyzeVoiceOfCustomer('phrases')}
                  disabled={isAnalyzing || !voiceOfCustomer.value.trim()}
                  variant="outline"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Extract Key Phrases
                </Button>
                <Button
                  onClick={() => analyzeVoiceOfCustomer('sentiment')}
                  disabled={isAnalyzing || !voiceOfCustomer.value.trim()}
                  variant="outline"
                >
                  Analyze Sentiment
                </Button>
              </div>

              {analysisResults && (
                <div className="space-y-4 mt-4">
                  {analysisResults.keyPhrases.length > 0 && (
                    <div>
                      <Label>Key Phrases Detected</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {analysisResults.keyPhrases.map((phrase, index) => (
                          <Badge key={index} variant="secondary">
                            {phrase}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisResults.sentiment && (
                    <div>
                      <Label>Sentiment Analysis</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
                          <div className="text-2xl font-bold text-green-600">{analysisResults.sentiment.positive}%</div>
                          <div className="text-xs text-muted-foreground">Positive</div>
                        </div>
                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/20 rounded">
                          <div className="text-2xl font-bold text-amber-600">{analysisResults.sentiment.neutral}%</div>
                          <div className="text-xs text-muted-foreground">Neutral</div>
                        </div>
                        <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded">
                          <div className="text-2xl font-bold text-red-600">{analysisResults.sentiment.negative}%</div>
                          <div className="text-xs text-muted-foreground">Negative</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {analysisResults.insights.length > 0 && (
                    <div>
                      <Label>Key Insights</Label>
                      <ul className="space-y-2 mt-2">
                        {analysisResults.insights.map((insight, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                            <span>{insight}</span>
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

      {/* ARCHIVED: PDF Export section - temporarily disabled
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Export Avatar Profile</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Download your complete avatar profile as a PDF
              </p>
            </div>
            <AvatarPDFExport
              avatar={{
                name: avatarName.value,
                demographics: {
                  age: age.value,
                  income: income.value,
                  location: location.value,
                  lifestyle: lifestyle.value
                },
                psychographics: {
                  values: parseArray(values.value),
                  fears: parseArray(fears.value),
                  desires: parseArray(desires.value),
                  triggers: parseArray(triggers.value)
                },
                buyingBehavior: {
                  intent: intent.value,
                  decisionFactors: parseArray(decisionFactors.value),
                  shoppingStyle: shoppingStyle.value,
                  priceConsciousness: priceConsciousness.value
                },
                voiceOfCustomer: voiceOfCustomer.value
              }}
            />
          </div>
        </CardContent>
      </Card>
      */}

      {/* Offline notification */}
      {getOverallSyncStatus() === 'offline' && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-200">Working offline</p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                Your changes are saved locally and will sync automatically when you're back online.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}