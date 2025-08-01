import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextualHelp } from "@/components/ContextualHelp";
import { useToast } from "@/hooks/use-toast";
import { 
  Lightbulb, 
  Star, 
  Heart, 
  Shield, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Sparkles,
  Target,
  Users,
  TrendingUp,
  Award
} from "lucide-react";

interface IdeaFrameworkData {
  // Insight Driven
  targetAudience: string;
  customerPains: string[];
  emotionalTriggers: string[];
  buyingMotivations: string;
  
  // Distinctive/Different
  uniqueValue: string;
  brandPersonality: string[];
  competitiveDifference: string;
  brandAssets: string[];
  
  // Emotionally Intelligent
  empathyStatements: string[];
  emotionalBenefits: string;
  brandTone: string;
  customerFeelings: string;
  
  // Authoritative & Authentic
  brandValues: string[];
  brandStory: string;
  brandPromise: string;
  transparencyCommitment: string;
}

const initialData: IdeaFrameworkData = {
  targetAudience: "",
  customerPains: [],
  emotionalTriggers: [],
  buyingMotivations: "",
  uniqueValue: "",
  brandPersonality: [],
  competitiveDifference: "",
  brandAssets: [],
  empathyStatements: [],
  emotionalBenefits: "",
  brandTone: "",
  customerFeelings: "",
  brandValues: [],
  brandStory: "",
  brandPromise: "",
  transparencyCommitment: ""
};

export default function InteractiveIdeaBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [frameworkData, setFrameworkData] = useState<IdeaFrameworkData>(initialData);
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [newItem, setNewItem] = useState("");
  const { toast } = useToast();

  const steps = [
    { 
      id: "insight", 
      title: "Insight Driven", 
      icon: <Lightbulb className="w-5 h-5" />,
      color: "from-yellow-500 to-orange-500",
      description: "Understand your customers deeply"
    },
    { 
      id: "distinctive", 
      title: "Distinctive/Different", 
      icon: <Star className="w-5 h-5" />,
      color: "from-green-500 to-emerald-500",
      description: "Stand out from the competition"
    },
    { 
      id: "emotional", 
      title: "Emotionally Intelligent", 
      icon: <Heart className="w-5 h-5" />,
      color: "from-pink-500 to-rose-500",
      description: "Connect on an emotional level"
    },
    { 
      id: "authentic", 
      title: "Authoritative & Authentic", 
      icon: <Shield className="w-5 h-5" />,
      color: "from-blue-500 to-indigo-500",
      description: "Build trust and credibility"
    }
  ];

  const progress = ((completedSections.length) / steps.length) * 100;

  const addToArray = (field: keyof IdeaFrameworkData, value: string) => {
    if (!value.trim()) return;
    
    setFrameworkData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value.trim()]
    }));
    setNewItem("");
  };

  const removeFromArray = (field: keyof IdeaFrameworkData, index: number) => {
    setFrameworkData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  const updateField = (field: keyof IdeaFrameworkData, value: string) => {
    setFrameworkData(prev => ({ ...prev, [field]: value }));
  };

  const saveProgress = () => {
    localStorage.setItem('ideaFrameworkData', JSON.stringify(frameworkData));
    localStorage.setItem('ideaCompletedSections', JSON.stringify(completedSections));
    toast({
      title: "Progress Saved",
      description: "Your IDEA Framework progress has been saved."
    });
  };

  const markSectionComplete = (stepIndex: number) => {
    if (!completedSections.includes(stepIndex)) {
      setCompletedSections(prev => [...prev, stepIndex]);
      toast({
        title: "Section Completed! 🎉",
        description: `Great work on the ${steps[stepIndex].title} section!`,
      });
    }
  };

  useEffect(() => {
    // Load saved progress
    const savedData = localStorage.getItem('ideaFrameworkData');
    const savedSections = localStorage.getItem('ideaCompletedSections');
    
    if (savedData) setFrameworkData(JSON.parse(savedData));
    if (savedSections) setCompletedSections(JSON.parse(savedSections));
  }, []);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const emotionalTriggerSuggestions = [
    "Hope", "Belonging", "Validation", "Trust", "Relief", "Aspiration", "Empowerment"
  ];

  const personalityTraits = [
    "Innovative", "Trustworthy", "Fun", "Sophisticated", "Caring", "Bold", "Reliable", "Creative"
  ];

  const coreValues = [
    "Quality", "Innovation", "Sustainability", "Customer-First", "Transparency", "Excellence", "Community", "Growth"
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Interactive IDEA Framework Builder</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Build your strategic brand framework step-by-step with AI-powered guidance
        </p>
        
        {/* Progress */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {steps.map((step, index) => (
          <Card 
            key={step.id} 
            className={`cursor-pointer transition-all duration-300 ${
              index === currentStep 
                ? 'ring-2 ring-primary shadow-lg' 
                : completedSections.includes(index)
                ? 'bg-secondary/50'
                : 'hover:shadow-md'
            }`}
            onClick={() => setCurrentStep(index)}
          >
            <CardContent className="p-4 text-center">
              <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                {completedSections.includes(index) ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <div className="text-white">{step.icon}</div>
                )}
              </div>
              <h3 className="font-semibold text-sm">{step.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              {index === currentStep && (
                <Badge variant="default" className="mt-2">Current</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Area */}
      <Card className="shadow-xl">
        <CardHeader className={`bg-gradient-to-r ${steps[currentStep].color} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {steps[currentStep].icon}
              <div>
                <CardTitle className="text-white">{steps[currentStep].title}</CardTitle>
                <CardDescription className="text-white/90">
                  {steps[currentStep].description}
                </CardDescription>
              </div>
            </div>
            <ContextualHelp 
              question="How do I complete this section effectively?"
              category="idea-framework" 
              context={`Building ${steps[currentStep].title} section of IDEA Framework`}
            />
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {/* Step Content */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Insight Driven: Understanding Your Customers</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetAudience" className="text-base font-semibold">
                    Who is your ideal customer? (Be specific)
                  </Label>
                  <Textarea
                    id="targetAudience"
                    placeholder="Describe your target audience in detail - demographics, psychographics, behaviors..."
                    value={frameworkData.targetAudience}
                    onChange={(e) => updateField('targetAudience', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Think beyond age and location. What drives them? What are their daily struggles?
                  </p>
                </div>

                <div>
                  <Label className="text-base font-semibold">Customer Pain Points</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add a customer pain point..."
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('customerPains', newItem)}
                    />
                    <Button onClick={() => addToArray('customerPains', newItem)}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {frameworkData.customerPains.map((pain, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="cursor-pointer"
                        onClick={() => removeFromArray('customerPains', index)}
                      >
                        {pain} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold">Emotional Triggers</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Which emotional triggers resonate with your audience?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {emotionalTriggerSuggestions.map(trigger => (
                      <Badge 
                        key={trigger}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-white"
                        onClick={() => addToArray('emotionalTriggers', trigger)}
                      >
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {frameworkData.emotionalTriggers.map((trigger, index) => (
                      <Badge 
                        key={index} 
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => removeFromArray('emotionalTriggers', index)}
                      >
                        {trigger} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="buyingMotivations" className="text-base font-semibold">
                    What ultimately motivates them to buy?
                  </Label>
                  <Textarea
                    id="buyingMotivations"
                    placeholder="Describe the deeper motivations that drive purchase decisions..."
                    value={frameworkData.buyingMotivations}
                    onChange={(e) => updateField('buyingMotivations', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Distinctive/Different: What Makes You Unique</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="uniqueValue" className="text-base font-semibold">
                    What's your unique value proposition?
                  </Label>
                  <Textarea
                    id="uniqueValue"
                    placeholder="What makes your brand uniquely valuable to customers? What can't competitors replicate?"
                    value={frameworkData.uniqueValue}
                    onChange={(e) => updateField('uniqueValue', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Focus on what you do differently, not just better.
                  </p>
                </div>

                <div>
                  <Label className="text-base font-semibold">Brand Personality Traits</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    How would you describe your brand's personality?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {personalityTraits.map(trait => (
                      <Badge 
                        key={trait}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-white"
                        onClick={() => addToArray('brandPersonality', trait)}
                      >
                        {trait}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {frameworkData.brandPersonality.map((trait, index) => (
                      <Badge 
                        key={index} 
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => removeFromArray('brandPersonality', index)}
                      >
                        {trait} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="competitiveDifference" className="text-base font-semibold">
                    How do you differ from competitors?
                  </Label>
                  <Textarea
                    id="competitiveDifference"
                    placeholder="Specifically describe how you're different from your main competitors..."
                    value={frameworkData.competitiveDifference}
                    onChange={(e) => updateField('competitiveDifference', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label className="text-base font-semibold">Distinctive Brand Assets</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add a distinctive brand asset (colors, fonts, symbols, etc.)..."
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('brandAssets', newItem)}
                    />
                    <Button onClick={() => addToArray('brandAssets', newItem)}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {frameworkData.brandAssets.map((asset, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeFromArray('brandAssets', index)}
                      >
                        {asset} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Emotionally Intelligent: Connect with Hearts</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Empathy Statements</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Write statements that show you understand your customers' feelings
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="We understand that you feel..."
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('empathyStatements', newItem)}
                    />
                    <Button onClick={() => addToArray('empathyStatements', newItem)}>Add</Button>
                  </div>
                  <div className="space-y-2 mt-3">
                    {frameworkData.empathyStatements.map((statement, index) => (
                      <div 
                        key={index} 
                        className="p-3 bg-secondary/20 rounded-lg cursor-pointer hover:bg-secondary/30"
                        onClick={() => removeFromArray('empathyStatements', index)}
                      >
                        "{statement}" <span className="text-xs text-muted-foreground ml-2">×</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="emotionalBenefits" className="text-base font-semibold">
                    What emotional benefits do you provide?
                  </Label>
                  <Textarea
                    id="emotionalBenefits"
                    placeholder="How does your brand make customers feel? What emotional outcomes do you deliver?"
                    value={frameworkData.emotionalBenefits}
                    onChange={(e) => updateField('emotionalBenefits', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="brandTone" className="text-base font-semibold">
                    What's your brand's communication tone?
                  </Label>
                  <Textarea
                    id="brandTone"
                    placeholder="Describe how your brand communicates - friendly, professional, playful, authoritative, etc."
                    value={frameworkData.brandTone}
                    onChange={(e) => updateField('brandTone', e.target.value)}
                    className="mt-2"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="customerFeelings" className="text-base font-semibold">
                    How should customers feel after interacting with your brand?
                  </Label>
                  <Textarea
                    id="customerFeelings"
                    placeholder="Describe the emotional state customers should have after engaging with your brand..."
                    value={frameworkData.customerFeelings}
                    onChange={(e) => updateField('customerFeelings', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Authoritative & Authentic: Build Trust</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Core Brand Values</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    What values does your brand stand for?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {coreValues.map(value => (
                      <Badge 
                        key={value}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-white"
                        onClick={() => addToArray('brandValues', value)}
                      >
                        {value}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {frameworkData.brandValues.map((value, index) => (
                      <Badge 
                        key={index} 
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => removeFromArray('brandValues', index)}
                      >
                        {value} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="brandStory" className="text-base font-semibold">
                    What's your brand story?
                  </Label>
                  <Textarea
                    id="brandStory"
                    placeholder="Tell the story behind your brand - why it exists, what inspired it, and where it's going..."
                    value={frameworkData.brandStory}
                    onChange={(e) => updateField('brandStory', e.target.value)}
                    className="mt-2"
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Authentic stories build emotional connections and trust.
                  </p>
                </div>

                <div>
                  <Label htmlFor="brandPromise" className="text-base font-semibold">
                    What's your brand promise?
                  </Label>
                  <Textarea
                    id="brandPromise"
                    placeholder="What do you consistently promise and deliver to every customer?"
                    value={frameworkData.brandPromise}
                    onChange={(e) => updateField('brandPromise', e.target.value)}
                    className="mt-2"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="transparencyCommitment" className="text-base font-semibold">
                    How do you demonstrate transparency?
                  </Label>
                  <Textarea
                    id="transparencyCommitment"
                    placeholder="Describe how you're transparent with customers about your processes, values, and business practices..."
                    value={frameworkData.transparencyCommitment}
                    onChange={(e) => updateField('transparencyCommitment', e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-8 border-t">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={saveProgress} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Progress
              </Button>
              
              <Button 
                onClick={() => markSectionComplete(currentStep)}
                disabled={completedSections.includes(currentStep)}
                variant={completedSections.includes(currentStep) ? "secondary" : "default"}
                className="flex items-center gap-2"
              >
                {completedSections.includes(currentStep) ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    Mark Complete
                  </>
                )}
              </Button>
            </div>

            <Button 
              onClick={nextStep}
              disabled={currentStep === steps.length - 1}
              className="flex items-center gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Completion Summary */}
      {completedSections.length === steps.length && (
        <Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-4">IDEA Framework Complete! 🎉</h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Congratulations! You've built a comprehensive strategic brand framework. 
              Now it's time to bring these insights to life with customer avatars and messaging.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="secondary" size="lg" className="bg-white text-green-600 hover:bg-white/90">
                Download Framework Summary
              </Button>
              <Button variant="outline" size="lg" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                Build Avatar 2.0
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}