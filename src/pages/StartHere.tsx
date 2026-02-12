import { CollapsibleVideo } from "@/components/CollapsibleVideo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * StartHere page - Introduction and training videos for new users
 * Provides video tutorials to walk users through the IDEA framework process
 */
export function StartHere(): JSX.Element {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Start Here</h1>
          <p className="text-muted-foreground text-lg">
            Welcome to IDEA Brand Coach! Watch this introduction video
            to get started with your brand transformation journey.
          </p>
        </div>

        <CollapsibleVideo
          videoId="1145686648"
          platform="vimeo"
          hash="1e858fb0d6"
          title="Getting Started with IDEA Brand Coach"
          description="Learn how to use the IDEA framework (Identify, Discover, Execute, Analyze) to build and grow your brand"
          storageKey="startHere_intro"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">After watching the introduction, you can:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Complete your free brand diagnostic</li>
                <li>Explore the brand canvas</li>
                <li>Chat with your AI brand coach</li>
                <li>Access additional training videos</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">If you have questions or need support:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Use the AI chat for instant guidance</li>
                <li>Check our video library for tutorials</li>
                <li>Review the documentation</li>
                <li>Email us at <a href="mailto:contact@ideabrandconsultancy.com" className="text-primary hover:underline">contact@ideabrandconsultancy.com</a></li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-hero rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to Build a Brand That Resonates?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Start with our free brand diagnostic to discover your brand's hidden potential and get actionable insights in minutes.
          </p>
          <Button asChild size="lg" variant="coach" className="text-lg px-8 py-6 shadow-glow">
            <Link to="/diagnostic">
              Get Your Free Brand Diagnostic
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <p className="text-sm text-primary-foreground/80 mt-4">
            No credit card required • 5-minute assessment • Instant results
          </p>
        </div>
      </div>
    </div>
  );
}
