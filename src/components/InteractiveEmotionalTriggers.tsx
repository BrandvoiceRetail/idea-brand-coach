import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, CheckCircle, Lightbulb } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";

interface EmotionalTrigger {
  id: string;
  name: string;
  icon: string;
  description: string;
  examples: string[];
  color: string;
}

const emotionalTriggers: EmotionalTrigger[] = [
  {
    id: "hope",
    name: "Hope",
    icon: "🌟",
    description: "The promise of a better future or positive outcome",
    examples: ["Transformation stories", "Before/after results", "Aspirational content"],
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
  },
  {
    id: "belonging",
    name: "Belonging",
    icon: "🤝",
    description: "Connection to a community or shared identity",
    examples: ["Community features", "Shared values", "Inclusive messaging"],
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
  },
  {
    id: "validation",
    name: "Validation",
    icon: "✅",
    description: "Confirmation of good choices and experiences",
    examples: ["Customer testimonials", "Expert endorsements", "Awards & recognition"],
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  },
  {
    id: "trust",
    name: "Trust",
    icon: "🛡️",
    description: "Confidence in reliability and authenticity",
    examples: ["Transparency", "Guarantees", "Proven track record"],
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
  },
  {
    id: "relief",
    name: "Relief",
    icon: "😌",
    description: "Ease from stress, pain, or difficulty",
    examples: ["Problem-solving", "Convenience", "Stress reduction"],
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
  },
  {
    id: "aspiration",
    name: "Aspiration",
    icon: "🚀",
    description: "Desire for self-improvement and achievement",
    examples: ["Success stories", "Skill development", "Status enhancement"],
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300"
  },
  {
    id: "empowerment",
    name: "Empowerment",
    icon: "💪",
    description: "Control and confidence in decision-making",
    examples: ["Educational content", "Tool customization", "Self-service options"],
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
  }
];

export function InteractiveEmotionalTriggers() {
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { updateBrandData } = useBrand();

  const handleTriggerToggle = (triggerId: string) => {
    setSelectedTriggers(prev => 
      prev.includes(triggerId) 
        ? prev.filter(id => id !== triggerId)
        : [...prev, triggerId]
    );
  };

  const handleSaveSelection = () => {
    // Save to brand context (temporarily store in customerNeeds)
    updateBrandData('empathy', {
      customerNeeds: selectedTriggers
    });
    
    setShowResults(true);
  };

  const getSelectedTriggerData = () => {
    return emotionalTriggers.filter(trigger => selectedTriggers.includes(trigger.id));
  };

  if (showResults) {
    const selectedData = getSelectedTriggerData();
    
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Emotional Triggers Selected!
            </CardTitle>
            <CardDescription>
              You've identified {selectedData.length} key emotional triggers for your brand
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Selected Emotional Triggers</CardTitle>
            <CardDescription>
              These triggers will be used to enhance your brand messaging and strategy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedData.map((trigger, index) => (
              <div key={trigger.id} className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">{trigger.icon}</span>
                  <h4 className="font-semibold">{trigger.name}</h4>
                  <Badge className={trigger.color}>
                    {index === 0 ? "Primary" : index === 1 ? "Secondary" : "Supporting"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{trigger.description}</p>
                <div className="flex flex-wrap gap-1">
                  {trigger.examples.map((example, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button 
            onClick={() => setShowResults(false)}
            variant="outline"
          >
            Modify Selection
          </Button>
          <Button 
            onClick={() => {
              setSelectedTriggers([]);
              setShowResults(false);
            }}
            variant="outline"
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Interactive Emotional Triggers
          </CardTitle>
          <CardDescription>
            Select the emotional triggers that best resonate with your brand and audience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {emotionalTriggers.map((trigger) => (
                <div 
                  key={trigger.id} 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedTriggers.includes(trigger.id) 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50 hover:bg-primary/2'
                  }`}
                  onClick={() => handleTriggerToggle(trigger.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      checked={selectedTriggers.includes(trigger.id)}
                      onChange={() => handleTriggerToggle(trigger.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{trigger.icon}</span>
                        <h4 className="font-medium">{trigger.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{trigger.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {trigger.examples.map((example, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {example}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <h4 className="font-medium mb-1">💡 Pro Tip</h4>
                  <p className="text-sm text-muted-foreground">
                    Select 2-4 triggers that best represent your brand's emotional connection with customers. 
                    Focus on quality over quantity for stronger brand messaging.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveSelection}
              disabled={selectedTriggers.length === 0}
              className="w-full"
              size="lg"
            >
              Save Selected Triggers ({selectedTriggers.length})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}