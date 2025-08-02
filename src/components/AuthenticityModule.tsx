import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Lightbulb,
  Eye,
  Target,
  Compass,
  HandHeart,
  Eye as EyeIcon
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
    title: "Define Your Core Values",
    description: "Establish clear values that guide your mission and business operations",
    content: "What does your brand stand for? What are the values that drive your mission? Authentic brands have a clear set of values that guide not only their marketing efforts but their entire business model. Your values should be more than just words—they should reflect how you conduct business, treat customers, and produce your products.",
    example: "Ben & Jerry's has built its brand on a foundation of social justice and environmental activism. From fighting for climate change to advocating for marriage equality, Ben & Jerry's doesn't just make ice cream; it uses its platform to champion important social causes. This authenticity strengthens its connection with socially conscious consumers.",
    actionSteps: [
      "Identify 3-5 core values that define your brand's purpose",
      "Ensure values reflect genuine beliefs, not market trends",
      "Document how each value influences business decisions",
      "Communicate values clearly across all brand materials",
      "Regularly assess whether actions align with stated values"
    ],
    icon: <Compass className="h-6 w-6" />,
    color: "from-blue-500 to-indigo-500"
  },
  {
    id: 2,
    title: "Align Actions with Values",
    description: "Ensure your brand's actions consistently reflect your stated values and promises",
    content: "Your brand's actions should consistently reflect your values. If your brand promises sustainability, you need to ensure your supply chain, materials, and production processes all align with that promise. Authenticity is built on consistency, and customers will quickly lose trust if they see a disconnect between your messaging and actions.",
    example: "Patagonia doesn't just talk about environmental responsibility—they actively donate profits to environmental causes, use recycled materials, and encourage customers to repair rather than replace their products. Their actions consistently demonstrate their commitment to environmental stewardship, building credibility and trust.",
    actionSteps: [
      "Audit all business operations for value alignment",
      "Identify gaps between promises and current practices",
      "Create action plans to close alignment gaps",
      "Establish accountability measures for value-driven decisions",
      "Regularly review and adjust practices to maintain consistency"
    ],
    icon: <HandHeart className="h-6 w-6" />,
    color: "from-green-500 to-emerald-500"
  },
  {
    id: 3,
    title: "Be Transparent and Honest",
    description: "Build trust through open communication and honest business practices",
    content: "Transparency is a critical component of authenticity. In today's digital world, customers expect brands to be open about how they operate, especially when it comes to sensitive issues like data privacy, sourcing, and environmental impact. When you make mistakes, admit them. When you achieve milestones, celebrate them with your customers.",
    example: "Buffer openly shares their salary formula, revenue metrics, and diversity statistics. When they face challenges or make mistakes, they publish detailed blog posts explaining what happened and how they're addressing it. This radical transparency has built a loyal community that trusts and advocates for the brand.",
    actionSteps: [
      "Identify areas where transparency can build trust",
      "Create clear communication protocols for mistakes and successes",
      "Share behind-the-scenes content that demonstrates values",
      "Establish regular reporting on key commitments and progress",
      "Respond openly and honestly to customer concerns and feedback"
    ],
    icon: <EyeIcon className="h-6 w-6" />,
    color: "from-amber-500 to-orange-500"
  }
];

export function AuthenticityModule() {
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
          <Shield className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold">Authentic Branding</h1>
        </div>
        <p className="text-lg text-muted-foreground mb-6">
          Build trust and credibility by staying true to your core values and maintaining transparency
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
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Module Complete!</h2>
            <p className="text-muted-foreground mb-6">
              You've mastered authentic branding. You now understand how to define core values, align actions with values, and build trust through transparency.
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
                <Link to="/avatar">Build Customer Avatars</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/emotionally-intelligent-learning">Previous Module</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}