import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  Send,
  Star,
  Bug,
  Lightbulb,
  Heart,
  FileText,
  ArrowLeft
} from "lucide-react";
import { useBetaMode } from "@/hooks/useBetaMode";

const feedbackAreas = [
  { id: "navigation", label: "Navigation & Layout" },
  { id: "diagnostic", label: "Brand Diagnostic" },
  { id: "results", label: "Results & Insights" },
  { id: "tools", label: "Brand Tools" },
  { id: "signup", label: "Sign-up Process" },
  { id: "performance", label: "Speed & Performance" },
];

export default function BetaFeedback() {
  const [overallRating, setOverallRating] = useState<string>("");
  const [likedMost, setLikedMost] = useState("");
  const [improvements, setImprovements] = useState("");
  const [issues, setIssues] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [wouldRecommend, setWouldRecommend] = useState<string>("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { betaProgress, getBetaTesterInfo } = useBetaMode();

  // Pre-populate tested areas based on completed steps
  useEffect(() => {
    if (betaProgress?.completedSteps) {
      setSelectedAreas(betaProgress.completedSteps);
    }
  }, [betaProgress]);

  const handleAreaToggle = (areaId: string) => {
    setSelectedAreas(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get current user if logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get beta tester info
      const { getBetaTesterInfo } = useBetaMode();
      const betaTesterInfo = getBetaTesterInfo();
      
      // Submit feedback to our edge function
      const { data, error } = await supabase.functions.invoke('save-beta-feedback', {
        body: {
          overallRating,
          likedMost,
          improvements,
          issues,
          selectedAreas,
          wouldRecommend,
          email,
          userId: user?.id || null,
          betaTesterId: betaTesterInfo?.id || null
        }
      });

      if (error) {
        throw error;
      }
      
      toast({
        title: "Thank you! 🎉",
        description: "Your feedback has been submitted successfully.",
      });

      // Reset form
      setOverallRating("");
      setLikedMost("");
      setImprovements("");
      setIssues("");
      setSelectedAreas([]);
      setWouldRecommend("");
      setEmail("");
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="max-w-3xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4">
            Beta Feedback
          </Badge>
          <h1 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Share Your Experience
          </h1>
          <p className="text-muted-foreground">
            Your insights help us build a better brand coaching experience for everyone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Overall Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Overall Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={overallRating} onValueChange={setOverallRating}>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {[
                    { value: "5", label: "Excellent", emoji: "🤩" },
                    { value: "4", label: "Good", emoji: "😊" },
                    { value: "3", label: "Okay", emoji: "😐" },
                    { value: "2", label: "Poor", emoji: "😕" },
                    { value: "1", label: "Very Poor", emoji: "😞" }
                  ].map((rating) => (
                    <div key={rating.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={rating.value} id={rating.value} />
                      <Label htmlFor={rating.value} className="cursor-pointer">
                        <span className="text-lg mr-2">{rating.emoji}</span>
                        {rating.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* What did you like most? */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                What did you like most?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Tell us what stood out positively during your testing..."
                value={likedMost}
                onChange={(e) => setLikedMost(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Areas for improvement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                What could be improved?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Share your suggestions for making the experience better..."
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Issues encountered */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-primary" />
                Any issues or bugs?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe any technical issues, broken links, or confusing elements..."
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Areas tested */}
          <Card>
            <CardHeader>
              <CardTitle>Which areas did you test?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Help us understand which parts of the app you explored.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {feedbackAreas.map((area) => (
                  <div key={area.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={area.id}
                      checked={selectedAreas.includes(area.id)}
                      onCheckedChange={() => handleAreaToggle(area.id)}
                    />
                    <Label htmlFor={area.id} className="cursor-pointer">
                      {area.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Would recommend */}
          <Card>
            <CardHeader>
              <CardTitle>Would you recommend this to other entrepreneurs?</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={wouldRecommend} onValueChange={setWouldRecommend}>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="definitely" id="definitely" />
                    <Label htmlFor="definitely">Definitely - it's really valuable</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="probably" id="probably" />
                    <Label htmlFor="probably">Probably - with some improvements</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="maybe" id="maybe" />
                    <Label htmlFor="maybe">Maybe - it has potential</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unlikely" id="unlikely" />
                    <Label htmlFor="unlikely">Unlikely - needs significant work</Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Optional email */}
          <Card>
            <CardHeader>
              <CardTitle>Stay in touch (optional)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Leave your email if you'd like updates on improvements or to participate in future testing.
              </p>
            </CardHeader>
            <CardContent>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </CardContent>
          </Card>

          {/* Step-by-Step Comments */}
          {betaProgress?.comments && betaProgress.comments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Step-by-Step Comments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {betaProgress.comments.map((comment, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{comment.stepId.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to={`/beta/journey?mode=${betaProgress?.mode || 'quick'}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Journey
              </Link>
            </Button>
            
            <Button type="submit" disabled={isSubmitting} size="lg">
              {isSubmitting ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Thank you note */}
        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <MessageSquare className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Thank You for Being a Beta Tester!</h3>
            <p className="text-sm text-muted-foreground">
              Your feedback directly shapes the future of IDEA Brand Coach™. 
              We truly appreciate the time you've invested in helping us improve.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}