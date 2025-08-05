import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Lightbulb,
  Eye,
  Target,
  MessageSquare,
  TrendingUp,
  Wrench,
  Brain,
  Heart,
  Shield,
  Star
} from "lucide-react";
import { Link } from "react-router-dom";
import { CustomerReviewAnalyzer } from "@/components/research/CustomerReviewAnalyzer";
import { BuyerIntentResearch } from "@/components/BuyerIntentResearch";
import { useBrand } from "@/contexts/BrandContext";

interface Step {
  id: number;
  title: string;
  description: string;
  content: string;
  example: string;
  actionSteps: string[];
  icon: React.ReactNode;
  color: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "IDEA-Driven Customer Psychology Research",
    description: "Uncover the emotional and psychological drivers that build customer trust",
    content: "IDEA research goes beyond traditional market research by focusing on the psychological foundations of trust: Insight-driven understanding, Distinctive positioning, Emotional intelligence, and Authentic connection. Use behavioral science to understand not just what customers do, but why they trust certain brands over others.",
    example: "Instead of asking 'What features do you want?', IDEA research asks 'What emotional outcome are you seeking?' For skincare, customers aren't buying products—they're buying confidence, social acceptance, and self-worth. Understanding these deeper motivations allows brands to build authentic trust.",
    actionSteps: [
      "Focus research on emotional triggers and trust factors",
      "Identify distinctive brand positioning opportunities", 
      "Uncover authentic customer pain points and desires",
      "Map customer psychology to the 4 IDEA pillars",
      "Translate insights into brand positioning strategy"
    ],
    icon: <Brain className="h-6 w-6" />,
    color: "from-blue-500 to-indigo-500"
  },
  {
    id: 2,
    title: "Customer Review Psychology Analysis",
    description: "Extract emotional triggers and authenticity gaps from customer feedback",
    content: "Customer reviews reveal the psychological drivers behind purchase decisions and brand loyalty. Analyze language patterns to identify emotional triggers, trust signals, and authenticity gaps that can inform your IDEA brand strategy.",
    example: "Reviews saying 'finally found confidence' reveal emotional transformation desires. Comments about 'feeling ignored by customer service' show authenticity gaps. These insights directly inform your brand's emotional intelligence and authentic positioning.",
    actionSteps: [
      "Analyze emotional language patterns in reviews",
      "Identify trust signals and barriers in feedback",
      "Map pain points to IDEA framework gaps",
      "Extract authenticity indicators from customer stories",
      "Apply insights to Brand Canvas positioning"
    ],
    icon: <MessageSquare className="h-6 w-6" />,
    color: "from-purple-500 to-pink-500"
  },
  {
    id: 3,
    title: "Buyer Intent & Brand Positioning",
    description: "Translate search behavior into brand positioning opportunities using IDEA principles",
    content: "Buyer intent research through the IDEA lens reveals how customers emotionally approach their problems and what kind of brand authority they're seeking. This helps position your brand as the distinctive, emotionally intelligent choice they trust.",
    example: "Search terms like 'best skincare for sensitive skin' reveal customers seeking authoritative expertise and emotional safety. 'Affordable skincare that works' shows price-value tension requiring authentic positioning. Map these intents to IDEA positioning strategies.",
    actionSteps: [
      "Analyze search intent for emotional drivers",
      "Identify brand authority opportunities",
      "Map customer psychology to distinctive positioning",
      "Translate intent patterns into IDEA messaging",
      "Apply insights to customer avatar development"
    ],
    icon: <Target className="h-6 w-6" />,
    color: "from-green-500 to-teal-500"
  }
];

export function ResearchModule() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("learning");
  const { updateBrandData } = useBrand();

  const progress = (completedSteps.size / steps.length) * 100;

  const markStepComplete = (stepId: number) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const allStepsCompleted = completedSteps.size === steps.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Search className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">IDEA Research Hub</h1>
        </div>
        <p className="text-lg text-muted-foreground mb-4">
          Research tools designed specifically for the IDEA Strategic Brand Framework™
        </p>
        <div className="bg-muted/30 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-primary font-semibold mb-1 flex items-center justify-center gap-1">
                <Lightbulb className="h-4 w-4" />
                Insight Driven
              </div>
              <div className="text-muted-foreground">Customer psychology research</div>
            </div>
            <div className="text-center">
              <div className="text-primary font-semibold mb-1 flex items-center justify-center gap-1">
                <Star className="h-4 w-4" />
                Distinctive
              </div>
              <div className="text-muted-foreground">Positioning opportunities</div>
            </div>
            <div className="text-center">
              <div className="text-primary font-semibold mb-1 flex items-center justify-center gap-1">
                <Heart className="h-4 w-4" />
                Emotionally Intelligent
              </div>
              <div className="text-muted-foreground">Emotional trigger analysis</div>
            </div>
            <div className="text-center">
              <div className="text-primary font-semibold mb-1 flex items-center justify-center gap-1">
                <Shield className="h-4 w-4" />
                Authentic
              </div>
              <div className="text-muted-foreground">Trust gap identification</div>
            </div>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              IDEA Research Methods
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Research Tools
            </TabsTrigger>
          </TabsList>

          {activeTab === "learning" && (
            <TabsContent value="learning" className="mt-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Progress value={progress} className="w-64" />
                <span className="text-sm font-medium">{Math.round(progress)}% Complete</span>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Learning Module Content */}
      {activeTab === "learning" && (
        <>
          {/* Step Navigation */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {steps.map((step, index) => (
              <Button
                key={step.id}
                variant={currentStep === index ? "default" : "outline"}
                onClick={() => setCurrentStep(index)}
                className="flex items-center gap-2"
              >
                {completedSteps.has(step.id) && <CheckCircle className="h-4 w-4" />}
                <span className="hidden sm:inline">Step {step.id}:</span> {step.title}
              </Button>
            ))}
          </div>

          {!allStepsCompleted ? (
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${steps[currentStep].color} text-white`}>
                    {steps[currentStep].icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      Step {steps[currentStep].id}: {steps[currentStep].title}
                    </CardTitle>
                    <CardDescription>{steps[currentStep].description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Key Learning */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Key Learning
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {steps[currentStep].content}
                  </p>
                </div>

                {/* Real-World Examples */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-500" />
                    Real-World Examples
                  </h3>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm leading-relaxed">{steps[currentStep].example}</p>
                  </div>
                </div>

                {/* Action Steps */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Action Steps
                  </h3>
                  <ul className="space-y-2">
                    {steps[currentStep].actionSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                          {index + 1}
                        </div>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Navigation and Completion */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-3">
                    {!completedSteps.has(steps[currentStep].id) && (
                      <Button
                        variant="outline"
                        onClick={() => markStepComplete(steps[currentStep].id)}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Complete
                      </Button>
                    )}
                    
                    <Button
                      onClick={handleNext}
                      disabled={currentStep === steps.length - 1}
                      className="flex items-center gap-2"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Completion Summary */
            <Card className="text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold mb-4">IDEA Research Methods Complete!</h2>
                <p className="text-muted-foreground mb-6">
                  You now understand how to research customer psychology using the IDEA framework. Apply your knowledge with our specialized tools.
                </p>
                
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {steps.map(step => (
                    <Badge key={step.id} variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {step.title}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  <Button onClick={() => setActiveTab("tools")}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Apply IDEA Research
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/brand-canvas">Build Brand Canvas</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/avatar-builder">Create Customer Avatar</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/idea-framework-consultant">Get AI Guidance</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* IDEA Research Tools */}
      {activeTab === "tools" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  Customer Review Psychology Analyzer
                </CardTitle>
                <CardDescription>
                  Extract emotional triggers and authenticity gaps for IDEA positioning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="outline" className="text-xs">Emotional Intelligence</Badge>
                  <Badge variant="outline" className="text-xs">Authenticity</Badge>
                  <Badge variant="outline" className="text-xs">Trust Signals</Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  IDEA Buyer Intent Research
                </CardTitle>
                <CardDescription>
                  Translate search behavior into distinctive brand positioning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="outline" className="text-xs">Insight Driven</Badge>
                  <Badge variant="outline" className="text-xs">Distinctive</Badge>
                  <Badge variant="outline" className="text-xs">Authority</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="reviews" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reviews">Review Psychology Analyzer</TabsTrigger>
              <TabsTrigger value="intent">IDEA Intent Research</TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="mt-6">
              <CustomerReviewAnalyzer />
            </TabsContent>

            <TabsContent value="intent" className="mt-6">
              <BuyerIntentResearch onInsightsGenerated={(insights) => {
                console.log("IDEA insights generated:", insights);
                // These insights are now focused on IDEA framework positioning
              }} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}