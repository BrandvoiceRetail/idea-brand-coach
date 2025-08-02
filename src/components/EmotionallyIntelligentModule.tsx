import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, 
  Users, 
  Shield, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Lightbulb,
  Eye,
  Target
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
    title: "Understanding Emotional Triggers",
    description: "Identify and leverage the emotional drivers that move customers toward purchase decisions",
    content: "Empathetic brands understand the emotional and psychological needs of their customers—whether it's the need for security, belonging, validation, or self-expression. By identifying key emotional drivers like desire for status, need for security, or wish for connection, you can craft marketing messages that speak directly to the heart of the customer.",
    example: "Airbnb taps into the deep human need for belonging and cultural connection through its 'Belong Anywhere' campaign, emphasizing authentic experiences over mere lodging. Spotify's Wrapped feature creates emotional connection by highlighting users' unique music tastes, creating nostalgia and personal connection. These brands understand that customers aren't just buying products—they're buying feelings and experiences.",
    actionSteps: [
      "Survey your customers about their deeper motivations and fears",
      "Identify the top 3 emotional needs your product/service fulfills",
      "Map customer emotional journey from awareness to purchase",
      "Craft messaging that speaks to these emotional triggers",
      "Test emotional resonance through A/B testing of messaging"
    ],
    icon: <Heart className="h-6 w-6" />,
    color: "from-pink-500 to-rose-500"
  },
  {
    id: 2,
    title: "Creating Authentic Connections",
    description: "Build genuine relationships through personalization and responsive customer care",
    content: "Authentic brands deliver personalized experiences that make customers feel valued as individuals. This involves tailoring recommendations, offering personalized content, listening to feedback, and responding with empathy. Authenticity means being transparent, consistent, and true to your core values even under market pressure.",
    example: "Zappos encourages employees to spend hours helping customers and even sends flowers to those going through difficult times. Ben & Jerry's aligns with social justice causes, using their platform for activism. These brands show that authenticity isn't just about products—it's about demonstrating genuine care and staying true to values in every interaction.",
    actionSteps: [
      "Define your brand's core values and mission clearly",
      "Create personalized customer touchpoints and experiences",
      "Establish feedback collection and response systems",
      "Train team members in empathetic customer interaction",
      "Align all business actions with stated brand values"
    ],
    icon: <Users className="h-6 w-6" />,
    color: "from-blue-500 to-indigo-500"
  },
  {
    id: 3,
    title: "Building Trust Through Transparency",
    description: "Maintain authenticity by being open, honest, and consistent in all brand communications",
    content: "Transparency is critical for authenticity. Customers expect brands to be open about operations, especially regarding data privacy, sourcing, and environmental impact. When you make mistakes, admit them. When you achieve milestones, celebrate with customers. Authentic brands ensure their actions consistently reflect their values across all touchpoints.",
    example: "Patagonia is transparent about their supply chain and environmental impact, even admitting when they fall short of their sustainability goals. They provide detailed information about their manufacturing processes and actively work to improve. This honesty builds stronger customer loyalty than perfect marketing messages ever could.",
    actionSteps: [
      "Audit your brand for value-action alignment gaps",
      "Create transparent communication about your processes",
      "Develop protocols for admitting and addressing mistakes",
      "Share behind-the-scenes content that shows your values in action",
      "Regularly collect and act on customer feedback publicly"
    ],
    icon: <Shield className="h-6 w-6" />,
    color: "from-emerald-500 to-teal-500"
  }
];

export function EmotionallyIntelligentModule() {
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
          <Heart className="h-8 w-8 text-pink-500" />
          <h1 className="text-3xl font-bold">Emotionally Intelligent Branding</h1>
        </div>
        <p className="text-lg text-muted-foreground mb-6">
          Build empathetic connections and authentic relationships that create lasting customer loyalty
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
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-pink-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Module Complete!</h2>
            <p className="text-muted-foreground mb-6">
              You've mastered emotionally intelligent branding. You now understand how to build empathetic connections and maintain authentic relationships with your customers.
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
                <Link to="/distinctive-learning">Previous Module</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}