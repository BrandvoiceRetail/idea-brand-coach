import { VideoPlayer } from "@/components/VideoPlayer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
            Welcome to IDEA Brand Coach! Watch this introduction video to get started with your brand transformation
            journey.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started with IDEA Brand Coach</CardTitle>
            <CardDescription>
              Learn how to use the IDEA framework (Identify, Discover, Execute, Analyze) to build and grow your brand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VideoPlayer
              videoId="1145686648"
              platform="vimeo"
              hash="1e858fb0d6"
              title="Getting Started with IDEA Brand Coach"
            />
          </CardContent>
        </Card>

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
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
