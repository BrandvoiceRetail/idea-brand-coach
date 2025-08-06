import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Users, Target } from "lucide-react";
import { Link } from "react-router-dom";

export default function BetaWelcome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 text-sm">
            Beta Testing Program
          </Badge>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Welcome Beta Tester!
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Help us perfect the IDEA Brand Coach™ by testing our core features and sharing your insights.
          </p>
        </div>

        {/* Testing Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-primary" />
                <CardTitle>Quick Test</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Perfect for busy testers. Focus on key flows and critical features.
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>5-10 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Core diagnostic flow</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Basic navigation test</span>
                </div>
              </div>
              <Button asChild className="w-full">
                <Link to="/beta/journey?mode=quick">
                  Start Quick Test
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-primary" />
                <CardTitle>Comprehensive Test</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Deep dive into all features. Help us identify edge cases and improvements.
              </p>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>15-25 minutes</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>All diagnostic modules</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Advanced features</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Brand tools exploration</span>
                </div>
              </div>
              <Button asChild className="w-full" variant="default">
                <Link to="/beta/journey?mode=comprehensive">
                  Start Comprehensive Test
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* What We're Looking For */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              What We're Looking For
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Usability</h4>
                <p className="text-sm text-muted-foreground">
                  Is the interface intuitive? Can you complete tasks easily?
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Value</h4>
                <p className="text-sm text-muted-foreground">
                  Do the insights and recommendations feel valuable and actionable?
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Technical Issues</h4>
                <p className="text-sm text-muted-foreground">
                  Any bugs, broken links, or performance issues you encounter.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Your feedback is invaluable in helping us create the best possible experience.
          </p>
          <Button variant="outline" asChild>
            <Link to="/">
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}