import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lightbulb, Target, Heart, Shield, ChevronRight, ChevronLeft, CheckCircle, Sparkles, Users, Trophy, Lock, Unlock } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useToast } from '@/hooks/use-toast';
import { AIAssistant } from '@/components/AIAssistant';
import { ContextualHelp } from '@/components/ContextualHelp';

const realWorldExamples = {
  insight: {
    nike: {
      brand: "Nike",
      example: "Nike identified that athletes (professional and amateur) don't just want performance gear—they want to feel empowered and capable of achieving greatness.",
      marketInsight: "Athletic performance is as much about mental confidence as physical capability",
      consumerInsight: "People buy Nike to feel like they can 'Just Do It'—not just perform better"
    },
    patagonia: {
      brand: "Patagonia", 
      example: "Patagonia understood that outdoor enthusiasts care deeply about preserving the environments they love to explore.",
      marketInsight: "Environmental consciousness drives purchasing decisions in outdoor gear",
      consumerInsight: "Customers want brands that align with their values of environmental stewardship"
    }
  },
  distinctive: {
    apple: {
      brand: "Apple",
      example: "Apple's distinctive positioning: 'Think Different' - premium, minimalist design that makes technology personal and intuitive.",
      uniqueValue: "Seamless integration between all devices and services",
      positioning: "Premium technology that's beautifully simple"
    },
    tesla: {
      brand: "Tesla",
      example: "Tesla positioned itself not as a car company, but as a sustainable energy company that happens to make cars.",
      uniqueValue: "Sustainable transportation with cutting-edge technology",
      positioning: "Accelerating the world's transition to sustainable energy"
    }
  },
  empathy: {
    dove: {
      brand: "Dove",
      example: "Dove's 'Real Beauty' campaign showed genuine empathy for women who felt pressure from unrealistic beauty standards.",
      emotionalConnection: "Every woman deserves to feel beautiful in her own skin",
      customerNeeds: ["Self-acceptance", "Confidence", "Authentic representation"]
    },
    airbnb: {
      brand: "Airbnb",
      example: "Airbnb empathizes with travelers who want authentic, local experiences rather than sterile hotel stays.",
      emotionalConnection: "Belong anywhere - experience places like a local",
      customerNeeds: ["Authentic experiences", "Connection", "Feeling at home"]
    }
  },
  authentic: {
    patagonia_values: {
      brand: "Patagonia",
      example: "Patagonia's authentic commitment to environmental causes - they donate profits and encourage customers to buy less.",
      brandValues: ["Environmental responsibility", "Quality over quantity", "Activism"],
      brandPromise: "Build the best product, cause no unnecessary harm, use business to inspire solutions to environmental crisis"
    },
    ben_jerrys: {
      brand: "Ben & Jerry's",
      example: "Ben & Jerry's authentic social activism - they take real stands on social issues, even when controversial.",
      brandValues: ["Social justice", "Environmental sustainability", "Quality ingredients"],
      brandPromise: "Make the best ice cream while making the world a better place"
    }
  }
};

export default function InteractiveIdeaBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedExample, setExpandedExample] = useState<string | null>(null);
  const { brandData, updateBrandData, getCompletionPercentage, isToolUnlocked } = useBrand();
  const { toast } = useToast();

  const steps = [
    { 
      id: "insight", 
      title: "Insight", 
      icon: <Lightbulb className="w-5 h-5" />,
      color: "from-yellow-500 to-orange-500",
      description: "Deep customer understanding"
    },
    { 
      id: "distinctive", 
      title: "Distinctive", 
      icon: <Target className="w-5 h-5" />,
      color: "from-green-500 to-emerald-500",
      description: "What makes you unique"
    },
    { 
      id: "empathy", 
      title: "Empathy", 
      icon: <Heart className="w-5 h-5" />,
      color: "from-pink-500 to-rose-500",
      description: "Emotional connection"
    },
    { 
      id: "authentic", 
      title: "Authentic", 
      icon: <Shield className="w-5 h-5" />,
      color: "from-blue-500 to-indigo-500",
      description: "Genuine values & promise"
    }
  ];

  const updateCurrentStepData = (field: string, value: any) => {
    const stepKey = steps[currentStep].id as keyof typeof brandData;
    updateBrandData(stepKey, { [field]: value });
  };

  const markStepComplete = () => {
    const stepKey = steps[currentStep].id as keyof typeof brandData;
    updateBrandData(stepKey, { completed: true });
    
    toast({
      title: "Section Completed! 🎉",
      description: `${steps[currentStep].title} section is now complete.`,
    });

    // Auto-advance to next step if not on last step
    if (currentStep < steps.length - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), 1000);
    }
  };

  const isStepComplete = () => {
    const stepKey = steps[currentStep].id as 'insight' | 'distinctive' | 'empathy' | 'authentic';
    const stepData = brandData[stepKey];
    return 'completed' in stepData ? stepData.completed : false;
  };

  const canCompleteStep = () => {
    switch (currentStep) {
      case 0: // Insight
        return brandData.insight.marketInsight && brandData.insight.consumerInsight && brandData.insight.brandPurpose;
      case 1: // Distinctive
        return brandData.distinctive.uniqueValue && brandData.distinctive.positioning && brandData.distinctive.differentiators.length > 0;
      case 2: // Empathy
        return brandData.empathy.emotionalConnection && brandData.empathy.customerNeeds.length > 0 && brandData.empathy.brandPersonality;
      case 3: // Authentic
        return brandData.authentic.brandValues.length > 0 && brandData.authentic.brandStory && brandData.authentic.brandPromise;
      default:
        return false;
    }
  };

  const addToArray = (field: string, value: string) => {
    if (!value.trim()) return;
    const stepKey = steps[currentStep].id as keyof typeof brandData;
    const currentArray = brandData[stepKey][field] as string[] || [];
    updateBrandData(stepKey, { [field]: [...currentArray, value.trim()] });
  };

  const removeFromArray = (field: string, index: number) => {
    const stepKey = steps[currentStep].id as keyof typeof brandData;
    const currentArray = brandData[stepKey][field] as string[];
    updateBrandData(stepKey, { [field]: currentArray.filter((_, i) => i !== index) });
  };

  const ExampleCard = ({ example, title }: { example: any, title: string }) => (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10">{example.brand}</Badge>
          <span className="text-sm font-medium">{title}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{example.example}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-auto p-0 text-primary"
          onClick={() => setExpandedExample(expandedExample === example.brand ? null : example.brand)}
        >
          {expandedExample === example.brand ? 'Show less' : 'See breakdown'}
        </Button>
        {expandedExample === example.brand && (
          <div className="mt-3 space-y-2 text-sm">
            {Object.entries(example).map(([key, value]) => {
              if (key === 'brand' || key === 'example') return null;
              return (
                <div key={key} className="border-l-2 border-primary/20 pl-3">
                  <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span className="text-muted-foreground">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Interactive IDEA Strategic Brand Framework™</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Build your strategic brand foundation with AI guidance and real-world examples
        </p>
        
        {/* Progress */}
        <div className="max-w-md mx-auto mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Framework Progress</span>
            <span>{getCompletionPercentage()}% Complete</span>
          </div>
          <Progress value={getCompletionPercentage()} className="h-3" />
        </div>

        {/* Unlock Status */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            {isToolUnlocked('avatar') ? <Unlock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-gray-400" />}
            <span className={isToolUnlocked('avatar') ? 'text-green-600' : 'text-gray-400'}>Avatar Builder</span>
          </div>
          <div className="flex items-center gap-2">
            {isToolUnlocked('canvas') ? <Unlock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-gray-400" />}
            <span className={isToolUnlocked('canvas') ? 'text-green-600' : 'text-gray-400'}>Brand Canvas</span>
          </div>
          <div className="flex items-center gap-2">
            {isToolUnlocked('valuelens') ? <Unlock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-gray-400" />}
            <span className={isToolUnlocked('valuelens') ? 'text-green-600' : 'text-gray-400'}>ValueLens AI</span>
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {steps.map((step, index) => {
          const stepId = step.id as 'insight' | 'distinctive' | 'empathy' | 'authentic';
          const stepData = brandData[stepId];
          const isCompleted = 'completed' in stepData ? stepData.completed : false;
          return (
            <Card 
              key={step.id} 
              className={`cursor-pointer transition-all duration-300 ${
                index === currentStep 
                  ? 'ring-2 ring-primary shadow-lg' 
                  : isCompleted
                  ? 'bg-green-50 border-green-200'
                  : 'hover:shadow-md'
              }`}
              onClick={() => setCurrentStep(index)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                  {isCompleted ? (
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
                {isCompleted && (
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">Complete</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
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
                  question={`How do I build the ${steps[currentStep].title} section?`}
                  category="idea-framework" 
                  context={`Building ${steps[currentStep].title} section of IDEA Strategic Brand Framework™`}
                />
              </div>
            </CardHeader>

            <CardContent className="p-8">
              {/* Insight Step */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="marketInsight" className="text-base font-semibold">
                      Market Insight: What key trend or shift do you see in your market?
                    </Label>
                    <Textarea
                      id="marketInsight"
                      placeholder="e.g., 'Consumers are increasingly seeking authentic, transparent brands that align with their values...'"
                      value={brandData.insight.marketInsight}
                      onChange={(e) => updateCurrentStepData('marketInsight', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="market insight"
                      currentValue={brandData.insight.marketInsight}
                      onSuggestion={(suggestion) => updateCurrentStepData('marketInsight', suggestion)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="consumerInsight" className="text-base font-semibold">
                      Consumer Insight: What emotional truth drives your customers?
                    </Label>
                    <Textarea
                      id="consumerInsight"
                      placeholder="e.g., 'Busy professionals want to feel competent and in control, but often feel overwhelmed by too many choices...'"
                      value={brandData.insight.consumerInsight}
                      onChange={(e) => updateCurrentStepData('consumerInsight', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="consumer insight"
                      currentValue={brandData.insight.consumerInsight}
                      onSuggestion={(suggestion) => updateCurrentStepData('consumerInsight', suggestion)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="brandPurpose" className="text-base font-semibold">
                      Brand Purpose: Why does your brand exist beyond profit?
                    </Label>
                    <Textarea
                      id="brandPurpose"
                      placeholder="e.g., 'To empower people to live their healthiest, most confident lives...'"
                      value={brandData.insight.brandPurpose}
                      onChange={(e) => updateCurrentStepData('brandPurpose', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="brand purpose"
                      currentValue={brandData.insight.brandPurpose}
                      onSuggestion={(suggestion) => updateCurrentStepData('brandPurpose', suggestion)}
                    />
                  </div>
                </div>
              )}

              {/* Distinctive Step */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="uniqueValue" className="text-base font-semibold">
                      Unique Value: What makes you truly different?
                    </Label>
                    <Textarea
                      id="uniqueValue"
                      placeholder="e.g., 'The only platform that combines AI-powered personalization with human expert guidance...'"
                      value={brandData.distinctive.uniqueValue}
                      onChange={(e) => updateCurrentStepData('uniqueValue', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="unique value proposition"
                      currentValue={brandData.distinctive.uniqueValue}
                      onSuggestion={(suggestion) => updateCurrentStepData('uniqueValue', suggestion)}
                    />
                  </div>

                  <div>
                    <Label className="text-base font-semibold">Key Differentiators</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Add a key differentiator..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addToArray('differentiators', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <Button onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addToArray('differentiators', input.value);
                        input.value = '';
                      }}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {brandData.distinctive.differentiators.map((diff, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="cursor-pointer"
                          onClick={() => removeFromArray('differentiators', index)}
                        >
                          {diff} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="positioning" className="text-base font-semibold">
                      Brand Positioning Statement
                    </Label>
                    <Textarea
                      id="positioning"
                      placeholder="For [target audience], [brand] is the [category] that [unique benefit] because [reasons to believe]"
                      value={brandData.distinctive.positioning}
                      onChange={(e) => updateCurrentStepData('positioning', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="brand positioning"
                      currentValue={brandData.distinctive.positioning}
                      onSuggestion={(suggestion) => updateCurrentStepData('positioning', suggestion)}
                    />
                  </div>
                </div>
              )}

              {/* Empathy Step */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="emotionalConnection" className="text-base font-semibold">
                      Emotional Connection: How do you want customers to feel?
                    </Label>
                    <Textarea
                      id="emotionalConnection"
                      placeholder="e.g., 'Confident, empowered, and understood - like they have a trusted partner on their journey...'"
                      value={brandData.empathy.emotionalConnection}
                      onChange={(e) => updateCurrentStepData('emotionalConnection', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="emotional connection"
                      currentValue={brandData.empathy.emotionalConnection}
                      onSuggestion={(suggestion) => updateCurrentStepData('emotionalConnection', suggestion)}
                    />
                  </div>

                  <div>
                    <Label className="text-base font-semibold">Customer Needs (Emotional & Functional)</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Add a customer need..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addToArray('customerNeeds', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <Button onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addToArray('customerNeeds', input.value);
                        input.value = '';
                      }}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {brandData.empathy.customerNeeds.map((need, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="cursor-pointer"
                          onClick={() => removeFromArray('customerNeeds', index)}
                        >
                          {need} ×
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="brandPersonality" className="text-base font-semibold">
                      Brand Personality: If your brand were a person, how would you describe them?
                    </Label>
                    <Textarea
                      id="brandPersonality"
                      placeholder="e.g., 'A wise, encouraging mentor who is approachable yet knowledgeable, optimistic but realistic...'"
                      value={brandData.empathy.brandPersonality}
                      onChange={(e) => updateCurrentStepData('brandPersonality', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="brand personality"
                      currentValue={brandData.empathy.brandPersonality}
                      onSuggestion={(suggestion) => updateCurrentStepData('brandPersonality', suggestion)}
                    />
                  </div>
                </div>
              )}

              {/* Authentic Step */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold">Core Brand Values</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Add a core value..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addToArray('brandValues', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <Button onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addToArray('brandValues', input.value);
                        input.value = '';
                      }}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {brandData.authentic.brandValues.map((value, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
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
                      Brand Story: What's your authentic origin story?
                    </Label>
                    <Textarea
                      id="brandStory"
                      placeholder="Tell the story of why you started, what challenges you've overcome, and what drives you..."
                      value={brandData.authentic.brandStory}
                      onChange={(e) => updateCurrentStepData('brandStory', e.target.value)}
                      className="mt-2"
                      rows={4}
                    />
                    <AIAssistant
                      prompt="brand story"
                      currentValue={brandData.authentic.brandStory}
                      onSuggestion={(suggestion) => updateCurrentStepData('brandStory', suggestion)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="brandPromise" className="text-base font-semibold">
                      Brand Promise: What do you commit to deliver?
                    </Label>
                    <Textarea
                      id="brandPromise"
                      placeholder="e.g., 'We promise to always put our customers' success first, delivering solutions that actually work...'"
                      value={brandData.authentic.brandPromise}
                      onChange={(e) => updateCurrentStepData('brandPromise', e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                    <AIAssistant
                      prompt="brand promise"
                      currentValue={brandData.authentic.brandPromise}
                      onSuggestion={(suggestion) => updateCurrentStepData('brandPromise', suggestion)}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                <Button
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  variant="outline"
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <div className="flex gap-3">
                  {canCompleteStep() && !isStepComplete() && (
                    <Button onClick={markStepComplete} variant="default">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Section
                    </Button>
                  )}

                  <Button
                    onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                    disabled={currentStep === steps.length - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Examples Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Real-World Examples
              </CardTitle>
              <CardDescription>
                Learn from successful brands who excel at {steps[currentStep].title.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentStep === 0 && (
                <>
                  <ExampleCard example={realWorldExamples.insight.nike} title="Consumer Insight" />
                  <ExampleCard example={realWorldExamples.insight.patagonia} title="Market Insight" />
                </>
              )}
              {currentStep === 1 && (
                <>
                  <ExampleCard example={realWorldExamples.distinctive.apple} title="Distinctive Positioning" />
                  <ExampleCard example={realWorldExamples.distinctive.tesla} title="Unique Value Prop" />
                </>
              )}
              {currentStep === 2 && (
                <>
                  <ExampleCard example={realWorldExamples.empathy.dove} title="Emotional Connection" />
                  <ExampleCard example={realWorldExamples.empathy.airbnb} title="Customer Empathy" />
                </>
              )}
              {currentStep === 3 && (
                <>
                  <ExampleCard example={realWorldExamples.authentic.patagonia_values} title="Authentic Values" />
                  <ExampleCard example={realWorldExamples.authentic.ben_jerrys} title="Brand Promise" />
                </>
              )}
            </CardContent>
          </Card>

          {/* Progress Tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const stepId = step.id as 'insight' | 'distinctive' | 'empathy' | 'authentic';
                  const stepData = brandData[stepId];
                  const isCompleted = 'completed' in stepData ? stepData.completed : false;
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isCompleted ? 'bg-green-100 text-green-700' : 
                        index === currentStep ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                      </div>
                      <span className={`text-sm ${
                        isCompleted ? 'text-green-700 font-medium' : 
                        index === currentStep ? 'font-medium' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-4" />
              
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{getCompletionPercentage()}%</div>
                <div className="text-sm text-muted-foreground">Framework Complete</div>
              </div>

              {getCompletionPercentage() >= 25 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">Unlocked Tools:</div>
                  {isToolUnlocked('avatar') && (
                    <Badge variant="outline" className="mr-2">Avatar Builder</Badge>
                  )}
                  {isToolUnlocked('canvas') && (
                    <Badge variant="outline" className="mr-2">Brand Canvas</Badge>
                  )}
                  {isToolUnlocked('valuelens') && (
                    <Badge variant="outline" className="mr-2">ValueLens AI</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}