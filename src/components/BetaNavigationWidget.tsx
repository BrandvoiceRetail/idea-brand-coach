import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useBetaMode } from '@/hooks/useBetaMode';
import { ArrowLeft, MessageSquare, X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const stepMapping: Record<string, string> = {
  // Core pages
  '/': 'home',
  '/welcome': 'landing',
  '/auth': 'signup',
  '/start-here': 'start-here',
  '/journey': 'journey',

  // Diagnostic flow
  '/diagnostic': 'diagnostic',
  '/diagnostic/results': 'diagnostic-results',

  // Main tools
  '/avatar': 'avatar',
  '/idea/insight': 'interactive-insight',
  '/idea/consultant': 'brand-coach',
  '/canvas': 'brand-canvas',
  '/copy-generator': 'copy-generator',

  // Dashboard
  '/dashboard': 'dashboard',

  // IDEA Framework modules (learning)
  '/idea': 'idea-framework',
  '/idea/distinctive': 'distinctive',
  '/idea/empathy': 'empathy',
  '/idea/authenticity': 'authenticity',

  // Other
  '/subscribe': 'pricing',
  '/research-learning': 'research-learning',
};

export function BetaNavigationWidget() {
  const { isBetaMode, betaProgress, addComment, completeStep, getComments } = useBetaMode();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState('');

  if (!isBetaMode || location.pathname.startsWith('/beta')) {
    return null;
  }

  const currentStepId = stepMapping[location.pathname] || location.pathname;
  const existingComments = getComments(currentStepId);
  const isStepCompleted = betaProgress?.completedSteps.includes(currentStepId) || false;

  const handleSaveComment = () => {
    if (currentStepId && comment.trim()) {
      addComment(currentStepId, comment.trim());
      setComment('');
      setIsExpanded(false);
      toast.success('Comment saved!', {
        duration: 2000,
      });
    }
  };

  const handleCompleteStep = () => {
    if (currentStepId) {
      completeStep(currentStepId);
      toast.success('Step completed!', {
        duration: 2000,
      });
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded ? (
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setIsExpanded(true)}
            className="rounded-full shadow-lg"
            size="sm"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Beta Feedback
          </Button>
          <Button asChild variant="outline" className="rounded-full shadow-lg" size="sm">
            <Link to={`/beta-journey?mode=${betaProgress?.mode || 'quick'}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Beta Journey
            </Link>
          </Button>
        </div>
      ) : (
        <Card className="w-80 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Beta Testing Feedback</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {betaProgress?.mode} mode
              </Badge>
              {isStepCompleted && (
                <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Show previous comments if any */}
            {existingComments.length > 0 && (
              <div className="p-2 bg-muted rounded text-sm max-h-32 overflow-y-auto">
                <strong>Previous comments ({existingComments.length}):</strong>
                {existingComments.map((c, i) => (
                  <p key={i} className="mt-1 text-muted-foreground border-b border-border pb-1 last:border-0">
                    {c.comment}
                  </p>
                ))}
              </div>
            )}

            {/* Always show textarea for new comments */}
            <Textarea
              placeholder="Add your feedback about this page/step..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveComment}
                disabled={!comment.trim()}
                size="sm"
              >
                Save Comment
              </Button>
              {!isStepCompleted && currentStepId && (
                <Button
                  onClick={handleCompleteStep}
                  variant="outline"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={`/beta-journey?mode=${betaProgress?.mode || 'quick'}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Beta Journey
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}