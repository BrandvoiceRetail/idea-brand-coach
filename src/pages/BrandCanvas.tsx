import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Save, Lock, CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/contexts/BrandContext";
import { AIAssistant } from "@/components/AIAssistant";

export default function BrandCanvas() {
  const { toast } = useToast();
  const { brandData, updateBrandData, getCompletionPercentage, isToolUnlocked } = useBrand();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    setIsUnlocked(isToolUnlocked('canvas'));
  }, [brandData, isToolUnlocked]);

  const completionPercentage = getCompletionPercentage();

  const handleSave = () => {
    updateBrandData('brandCanvas', { completed: true });
    toast({
      title: "Brand Canvas Saved",
      description: "Your brand canvas has been saved and is ready for ValueLens AI Copy Generation."
    });
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-secondary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Brand Canvas Builder</h1>
          <p className="text-muted-foreground mb-8">
            Unlock this tool by completing the IDEA Framework and Avatar Builder
          </p>
        </div>

        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Complete Prerequisites
            </CardTitle>
            <CardDescription>
              To access the Brand Canvas Builder, you need to complete these steps first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Progress</span>
                <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {brandData.insight.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={brandData.insight.completed ? "text-foreground" : "text-muted-foreground"}>
                  Complete IDEA Framework - Insight Section
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {brandData.avatar.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={brandData.avatar.completed ? "text-foreground" : "text-muted-foreground"}>
                  Complete Avatar 2.0 Builder
                </span>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button asChild variant="outline">
                <Link to="/idea/builder">Complete IDEA Framework</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/avatar">Complete Avatar Builder</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Brand Canvas Builder</h1>
        <p className="text-muted-foreground">
          Consolidate your IDEA Framework and Avatar insights into a comprehensive brand strategy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Canvas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mission & Vision */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Mission & Vision</CardTitle>
              <CardDescription>Define your brand's purpose and future aspirations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="mission">Mission Statement</Label>
                <Textarea
                  id="mission"
                  placeholder="What is your brand's core purpose? Why do you exist?"
                  value={brandData.brandCanvas.missionStatement}
                  onChange={(e) => updateBrandData('brandCanvas', { missionStatement: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  prompt="Help improve this mission statement based on the IDEA framework"
                  currentValue={brandData.brandCanvas.missionStatement}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { missionStatement: suggestion })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vision">Vision Statement</Label>
                <Textarea
                  id="vision"
                  placeholder="What future are you working towards? Where do you see your brand in 5-10 years?"
                  value={brandData.brandCanvas.visionStatement}
                  onChange={(e) => updateBrandData('brandCanvas', { visionStatement: e.target.value })}
                  rows={3}
                />
                <AIAssistant
                  prompt="Help improve this vision statement to be more aspirational and distinctive"
                  currentValue={brandData.brandCanvas.visionStatement}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { visionStatement: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Value Proposition */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Value Proposition</CardTitle>
              <CardDescription>What unique value do you deliver to customers?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="valueProposition">Core Value Proposition</Label>
                <Textarea
                  id="valueProposition"
                  placeholder="What specific problems do you solve? What unique benefits do you provide?"
                  value={brandData.brandCanvas.valueProposition}
                  onChange={(e) => updateBrandData('brandCanvas', { valueProposition: e.target.value })}
                  rows={4}
                />
                <AIAssistant
                  prompt="Help create a compelling value proposition based on our avatar insights and distinctive positioning"
                  currentValue={brandData.brandCanvas.valueProposition}
                  onSuggestion={(suggestion) => updateBrandData('brandCanvas', { valueProposition: suggestion })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Archetype & Personality */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>Brand Personality</CardTitle>
              <CardDescription>Define your brand's character and tone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="archetype">Brand Archetype</Label>
                <Select
                  value={brandData.brandCanvas.brandArchetype}
                  onValueChange={(value) => updateBrandData('brandCanvas', { brandArchetype: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your brand archetype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="innocent">The Innocent</SelectItem>
                    <SelectItem value="everyman">The Everyman</SelectItem>
                    <SelectItem value="hero">The Hero</SelectItem>
                    <SelectItem value="outlaw">The Outlaw</SelectItem>
                    <SelectItem value="explorer">The Explorer</SelectItem>
                    <SelectItem value="creator">The Creator</SelectItem>
                    <SelectItem value="ruler">The Ruler</SelectItem>
                    <SelectItem value="magician">The Magician</SelectItem>
                    <SelectItem value="lover">The Lover</SelectItem>
                    <SelectItem value="caregiver">The Caregiver</SelectItem>
                    <SelectItem value="jester">The Jester</SelectItem>
                    <SelectItem value="sage">The Sage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tonal Attributes</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {brandData.brandCanvas.tonalAttributes.map((attribute, index) => (
                    <Badge key={index} variant="secondary">
                      {attribute}
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Add tonal attributes (friendly, professional, innovative, etc.)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = (e.target as HTMLInputElement).value.trim();
                      if (value && !brandData.brandCanvas.tonalAttributes.includes(value)) {
                        updateBrandData('brandCanvas', {
                          tonalAttributes: [...brandData.brandCanvas.tonalAttributes, value]
                        });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Brand Data Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">IDEA Insights</span>
                <Badge variant={brandData.insight.completed ? "default" : "outline"}>
                  {brandData.insight.completed ? "Complete" : "Pending"}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Avatar Profile</span>
                <Badge variant={brandData.avatar.completed ? "default" : "outline"}>
                  {brandData.avatar.completed ? "Complete" : "Pending"}
                </Badge>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-sm mb-2">
                  <span>Canvas Progress</span>
                  <span>75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Complete your brand canvas to unlock the ValueLens AI Copy Generator
              </p>
              
              <Button 
                onClick={handleSave}
                className="w-full"
                disabled={!brandData.brandCanvas.missionStatement || !brandData.brandCanvas.valueProposition}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Canvas
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link to="/valuelens">
                  Generate AI Copy
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}