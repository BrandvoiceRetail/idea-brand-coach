import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  MessageSquare, 
  TrendingUp, 
  Heart, 
  AlertTriangle, 
  Star, 
  BarChart3,
  Download,
  Upload,
  Lightbulb,
  Shield,
  Brain,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useBrand } from "@/contexts/BrandContext";

interface IdeaInsight {
  pillar: 'insight' | 'distinctive' | 'emotional' | 'authentic';
  finding: string;
  brandingImplication: string;
  positioning: string;
}

interface SentimentResult {
  overall: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface KeywordAnalysis {
  word: string;
  frequency: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface ReviewAnalysis {
  sentiment: SentimentResult;
  keywords: KeywordAnalysis[];
  ideaInsights: IdeaInsight[];
  emotionalTriggers: string[];
  trustGaps: string[];
  recommendations: string[];
}

export function CustomerReviewAnalyzer() {
  const [reviewText, setReviewText] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const { updateBrandData } = useBrand();

  const analyzeReviews = async () => {
    if (!reviewText.trim() && !productUrl.trim()) {
      toast.error("Please provide either review text or a product URL");
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Simulate analysis - in real implementation, this would call an AI service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockAnalysis: ReviewAnalysis = {
        sentiment: {
          overall: 78,
          positive: 65,
          negative: 20,
          neutral: 15
        },
        keywords: [
          { word: "quality", frequency: 45, sentiment: 'positive' },
          { word: "expensive", frequency: 23, sentiment: 'negative' },
          { word: "comfortable", frequency: 31, sentiment: 'positive' },
          { word: "durable", frequency: 28, sentiment: 'positive' },
          { word: "slow delivery", frequency: 12, sentiment: 'negative' }
        ],
        ideaInsights: [
          {
            pillar: 'emotional',
            finding: 'Customers express confidence boost from product appearance',
            brandingImplication: 'Brand should position as confidence-builder, not just functional product',
            positioning: 'Focus messaging on emotional transformation and self-esteem enhancement'
          },
          {
            pillar: 'authentic',
            finding: 'Trust concerns around pricing and value perception',
            brandingImplication: 'Need transparent value communication and social proof',
            positioning: 'Address pricing objections with clear value proposition and testimonials'
          },
          {
            pillar: 'distinctive',
            finding: 'Quality and durability mentioned as key differentiators',
            brandingImplication: 'Position quality as distinctive advantage over competitors',
            positioning: 'Emphasize superior materials and craftsmanship in brand messaging'
          },
          {
            pillar: 'insight',
            finding: 'Delivery concerns reveal customer anticipation psychology',
            brandingImplication: 'Understand customer journey includes excitement management',
            positioning: 'Improve delivery communication to enhance overall brand experience'
          }
        ],
        emotionalTriggers: [
          "Confidence boost from appearance",
          "Relief from solving a persistent problem",
          "Excitement about improved functionality",
          "Satisfaction with quality materials"
        ],
        trustGaps: [
          "Price sensitivity and value concerns",
          "Delivery expectations not met",
          "Size/fit uncertainty before purchase",
          "Product durability questions"
        ],
        recommendations: [
          "EMOTIONAL: Emphasize confidence and transformation in messaging",
          "AUTHENTIC: Address pricing with transparent value proposition",
          "DISTINCTIVE: Highlight quality and durability as key differentiators",
          "INSIGHT: Improve delivery communication to manage expectations",
          "POSITIONING: Position as premium solution for emotional outcomes"
        ]
      };

      setAnalysis(mockAnalysis);
      toast.success("IDEA Analysis complete! Behavioral insights generated.");
    } catch (error) {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyToBrandCanvas = () => {
    if (!analysis) return;
    
    // For now, just show success message - integration with brand canvas will be enhanced later
    toast.success("Ready to apply insights to Brand Canvas! Visit the Brand Canvas page to integrate these findings.");
  };

  const exportResults = () => {
    if (!analysis) return;
    
    const data = JSON.stringify(analysis, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'review-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Analysis exported successfully!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            IDEA Customer Review Psychology Analyzer
          </CardTitle>
          <CardDescription>
            Extract emotional triggers, trust gaps, and positioning insights using the IDEA framework
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="space-y-4">
            <TabsList>
              <TabsTrigger value="text">Paste Reviews</TabsTrigger>
              <TabsTrigger value="url">Product URL</TabsTrigger>
              <TabsTrigger value="upload">Upload File</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div>
                <Label htmlFor="review-text">Customer Reviews</Label>
                <Textarea
                  id="review-text"
                  placeholder="Paste customer reviews here (separate multiple reviews with line breaks)..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="min-h-[200px] mt-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div>
                <Label htmlFor="product-url">Product URL</Label>
                <Input
                  id="product-url"
                  placeholder="https://amazon.com/product-page or other review URL"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  We'll extract and analyze reviews from the product page
                </p>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Upload CSV or text file with reviews</p>
                <Button variant="outline">Choose File</Button>
              </div>
            </TabsContent>

            <Button 
              onClick={analyzeReviews} 
              disabled={isAnalyzing}
              className="w-full"
              variant="coach"
            >
              {isAnalyzing ? "Analyzing with IDEA Framework..." : "Analyze for IDEA Insights"}
            </Button>
          </Tabs>
        </CardContent>
      </Card>

      {analysis && (
        <div className="space-y-6">
          {/* Sentiment Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Sentiment Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{analysis.sentiment.overall}%</div>
                  <div className="text-sm text-muted-foreground">Overall Positive</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Positive</span>
                    <span>{analysis.sentiment.positive}%</span>
                  </div>
                  <Progress value={analysis.sentiment.positive} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Negative</span>
                    <span>{analysis.sentiment.negative}%</span>
                  </div>
                  <Progress value={analysis.sentiment.negative} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Neutral</span>
                    <span>{analysis.sentiment.neutral}%</span>
                  </div>
                  <Progress value={analysis.sentiment.neutral} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keywords & Themes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Key Themes & Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {analysis.keywords.map((keyword, index) => (
                  <Badge
                    key={index}
                    variant={keyword.sentiment === 'positive' ? 'default' : 
                           keyword.sentiment === 'negative' ? 'destructive' : 'secondary'}
                    className="flex items-center gap-1"
                  >
                    {keyword.word} ({keyword.frequency})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* IDEA Framework Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                IDEA Framework Insights
              </CardTitle>
              <CardDescription>
                Strategic insights mapped to the four IDEA pillars
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.ideaInsights.map((insight, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={
                        insight.pillar === 'insight' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                        insight.pillar === 'distinctive' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                        insight.pillar === 'emotional' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      }>
                        {insight.pillar === 'insight' && <Lightbulb className="h-3 w-3 mr-1" />}
                        {insight.pillar === 'distinctive' && <Star className="h-3 w-3 mr-1" />}
                        {insight.pillar === 'emotional' && <Heart className="h-3 w-3 mr-1" />}
                        {insight.pillar === 'authentic' && <Shield className="h-3 w-3 mr-1" />}
                        {insight.pillar.charAt(0).toUpperCase() + insight.pillar.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mb-2">{insight.finding}</p>
                    <p className="text-xs text-muted-foreground mb-2">{insight.brandingImplication}</p>
                    <p className="text-xs text-primary">{insight.positioning}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Emotional Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Emotional Triggers
                </CardTitle>
                <CardDescription>
                  Psychological drivers that motivate customer behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.emotionalTriggers.map((trigger, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                      <span className="text-sm">{trigger}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Trust Gaps
                </CardTitle>
                <CardDescription>
                  Areas where brand authenticity needs improvement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.trustGaps.map((gap, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />
                      <span className="text-sm">{gap}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* IDEA Recommendations & Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                IDEA Strategic Recommendations
              </CardTitle>
              <CardDescription>
                Actionable insights for brand positioning and messaging
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {analysis.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      {index + 1}
                    </div>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-6 pt-4 border-t flex flex-wrap gap-3">
                <Button onClick={applyToBrandCanvas} className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Apply to Brand Canvas
                </Button>
                <Button asChild variant="outline">
                  <Link to="/brand-canvas">View Brand Canvas</Link>
                </Button>
                <Button onClick={exportResults} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}