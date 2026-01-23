import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface BetaComment {
  stepId: string;
  pageUrl: string;
  comment: string;
  timestamp: string;
}

export interface BetaProgress {
  currentStep: number;
  completedSteps: string[];
  comments: BetaComment[];
  mode: 'quick' | 'comprehensive';
  startTime: string;
}

export function useBetaMode() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [betaProgress, setBetaProgress] = useState<BetaProgress>(() => {
    const saved = localStorage.getItem('betaProgress');
    return saved ? JSON.parse(saved) : null;
  });

  // Check if user is in beta mode
  const isBetaMode = betaProgress !== null || location.pathname.startsWith('/beta') || searchParams.get('beta') === 'true';

  // Get beta tester info from localStorage (defined early for use in addComment)
  const getBetaTesterInfo = () => {
    const info = localStorage.getItem('betaTesterInfo');
    return info ? JSON.parse(info) : null;
  };

  // Initialize beta mode from journey page
  const initializeBetaMode = (mode: 'quick' | 'comprehensive') => {
    const progress: BetaProgress = {
      currentStep: 0,
      completedSteps: [],
      comments: [],
      mode,
      startTime: new Date().toISOString()
    };
    setBetaProgress(progress);
    localStorage.setItem('betaProgress', JSON.stringify(progress));
  };

  // Add comment for current step/page (allows multiple comments per page)
  // Saves to both localStorage (for UI) and Supabase (for persistence)
  const addComment = async (stepId: string, comment: string) => {
    if (!betaProgress) return;

    const timestamp = new Date().toISOString();
    const newComment: BetaComment = {
      stepId,
      pageUrl: location.pathname,
      comment,
      timestamp
    };

    // Update local state and localStorage immediately for UI responsiveness
    const updatedProgress = {
      ...betaProgress,
      comments: [...betaProgress.comments, newComment]
    };
    setBetaProgress(updatedProgress);
    localStorage.setItem('betaProgress', JSON.stringify(updatedProgress));

    // Save to Supabase in background
    try {
      const betaTesterInfo = getBetaTesterInfo();
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.functions.invoke('save-beta-comment', {
        body: {
          stepId,
          pageUrl: location.pathname,
          comment,
          timestamp,
          userId: user?.id || null,
          betaTesterId: betaTesterInfo?.id || null
        }
      });

      if (error) {
        console.error('Error saving comment to Supabase:', error);
      }
    } catch (error) {
      console.error('Error saving comment to Supabase:', error);
    }
  };

  // Mark step as complete
  const completeStep = (stepId: string) => {
    if (!betaProgress) return;
    
    const updatedProgress = {
      ...betaProgress,
      completedSteps: [...new Set([...betaProgress.completedSteps, stepId])]
    };

    setBetaProgress(updatedProgress);
    localStorage.setItem('betaProgress', JSON.stringify(updatedProgress));
  };

  // Clear beta mode
  const clearBetaMode = () => {
    setBetaProgress(null);
    localStorage.removeItem('betaProgress');
  };

  // Get single comment for specific step (first one found)
  const getComment = (stepId: string) => {
    return betaProgress?.comments.find(c => c.stepId === stepId)?.comment || '';
  };

  // Get all comments for specific step
  const getComments = (stepId: string): BetaComment[] => {
    return betaProgress?.comments.filter(c => c.stepId === stepId) || [];
  };

  return {
    isBetaMode,
    betaProgress,
    initializeBetaMode,
    addComment,
    completeStep,
    clearBetaMode,
    getComment,
    getComments,
    getBetaTesterInfo
  };
}