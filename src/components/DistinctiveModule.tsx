import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Star, 
  Target, 
  Eye, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Lightbulb,
  Palette,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";

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
    title: "Difference vs. Distinctiveness",
    description: "Understanding the crucial distinction between being different and being distinctive",
    content: "Difference refers to tangible or functional aspects that set your product apart from competitors, while distinctiveness focuses on branding elements that make you memorable and instantly recognizable. The strongest brands combine both—ensuring they are meaningfully unique while also being immediately recognizable.",
    example: "Tesla introduced its own fast charger network (difference) and created sleek, minimalist design language (distinctiveness). Apple has innovative technology (difference) but also unmistakable design aesthetics and brand presence (distinctiveness). Coca-Cola's formula may not be vastly different from Pepsi, but its red branding and contour bottle make it unmistakable.",
    actionSteps: [
      "List 3 functional differences your brand has from competitors",
      "Identify 3 visual or emotional elements that make your brand memorable",
      "Assess if you're relying too heavily on one without the other",
      "Create a plan to strengthen your weaker area"
    ],
    icon: <Target className="h-6 w-6" />,
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: 2,
    title: "Build Distinctive Brand Assets",
    description: "Creating memorable visual and verbal elements that make your brand unmistakably yours",
    content: "Distinctive Brand Assets (DBAs) are the logos, colors, typography, taglines, and even sounds that make a brand unmistakably itself. These elements should be memorable and intrinsically tied to your brand's identity. Consistency across all touchpoints ensures customers recognize your brand instantly.",
    example: "McDonald's golden arches, Nike's swoosh, and Tiffany & Co.'s blue boxes are instantly recognizable. KFC's red-and-white buckets, Colonel Sanders iconography, and 'finger-lickin' good' tagline dominate consumer recognition. Old Spice's humorous advertising campaigns make it stand out despite similar product functionality.",
    actionSteps: [
      "Audit your current brand assets (logo, colors, fonts, imagery)",
      "Identify which elements are most memorable to customers",
      "Develop a consistent visual system across all touchpoints",
      "Create or refine your brand tagline or key phrases",
      "Test asset recognition with your target audience"
    ],
    icon: <Palette className="h-6 w-6" />,
    color: "from-purple-500 to-pink-500"
  },
  {
    id: 3,
    title: "Create Salience & Mental Availability",
    description: "Building top-of-mind awareness so customers think of you first in buying situations",
    content: "Salience measures how readily your brand comes to mind in buying situations. Building salience requires consistent, memorable communication across multiple channels. The principle is simple: say less, more often, across more channels. Focus on a few meaningful brand attributes and repeat them until they become second nature to consumers.",
    example: "Volvo has consistently owned the 'safety' message—whenever consumers think about vehicle safety, they think of Volvo. Patagonia differentiates through high-quality gear but gains distinctiveness through environmental activism, making customers think of them for sustainable outdoor lifestyle.",
    actionSteps: [
      "Identify your ONE core brand message or attribute",
      "Map all customer touchpoints where this message appears",
      "Create a content calendar that reinforces this message consistently",
      "Measure brand recall through surveys or testing",
      "Adjust messaging frequency and channels based on results"
    ],
    icon: <Zap className="h-6 w-6" />,
    color: "from-green-500 to-emerald-500"
  }
];

export function DistinctiveModule() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Star className="h-8 w-8 text-green-500" />
          <h1 className="text-3xl font-bold">Distinctive Brand Building</h1>
        </div>
        <p className="text-lg text-muted-foreground mb-6">
          Learn to stand out in a crowded marketplace by building memorable brand assets and mental availability
        </p>
        <div className="flex items-center justify-center gap-4 mb-6">
          <Progress value={progress} className="w-64" />
          <span className="text-sm font-medium">{Math.round(progress)}% Complete</span>
        </div>
      </div>

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
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Module Complete!</h2>
            <p className="text-muted-foreground mb-6">
              You've completed the Distinctive Brand Building module. You now understand how to create memorable brand assets and build mental availability.
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
              <Button asChild>
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/brand-canvas">Apply to Brand Canvas</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/insight-driven-learning">Previous Module</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}