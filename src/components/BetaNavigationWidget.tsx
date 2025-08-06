import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useBetaMode } from '@/hooks/useBetaMode';
import { ArrowLeft, MessageSquare, X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const stepMapping: Record<string, string> = {
  '/': 'explore',
  '/diagnostic': 'diagnostic',
  '/diagnostic/results': 'results',
  '/auth': 'signup',
  '/dashboard': 'dashboard',
  '/canvas': 'tools',
  '/avatar': 'tools'
};

export function BetaNavigationWidget() {
  const { isBetaMode, betaProgress, addComment, completeStep, getComment } = useBetaMode();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState('');

  if (!isBetaMode || location.pathname.startsWith('/beta')) {
    return null;
  }

  const currentStepId = stepMapping[location.pathname];
  const existingComment = getComment(currentStepId || 'unknown');
  const isStepCompleted = betaProgress?.completedSteps.includes(currentStepId || '') || false;

  const handleSaveComment = () => {
    if (currentStepId && comment.trim()) {
      addComment(currentStepId, comment.trim());
      setComment('');
      setIsExpanded(false);
    }
  };

  const handleCompleteStep = () => {
    if (currentStepId) {
      completeStep(currentStepId);
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
            <Link to={`/beta/journey?mode=${betaProgress?.mode || 'quick'}`}>
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
            {existingComment ? (
              <div className="p-2 bg-muted rounded text-sm">
                <strong>Your previous comment:</strong>
                <p className="mt-1">{existingComment}</p>
              </div>
            ) : (
              <>
                <Textarea
                  placeholder="Add your feedback about this page/step..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="text-sm"
                  rows={3}
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
              </>
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={`/beta/journey?mode=${betaProgress?.mode || 'quick'}`}>
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