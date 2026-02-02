import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BrandData {
  // IDEA Strategic Brand Framework™ Data
  insight: {
    marketInsight: string;
    consumerInsight: string;
    brandPurpose: string;
    completed: boolean;
  };
  distinctive: {
    uniqueValue: string;
    differentiators: string[];
    positioning: string;
    completed: boolean;
  };
  empathy: {
    emotionalConnection: string;
    customerNeeds: string[];
    brandPersonality: string;
    completed: boolean;
  };
  authentic: {
    brandValues: string[];
    brandStory: string;
    brandPromise: string;
    completed: boolean;
  };
  
  // Avatar Data
  avatar: {
    demographics: {
      age: string;
      gender: string;
      income: string;
      location: string;
      occupation: string;
    };
    psychographics: {
      interests: string[];
      values: string[];
      lifestyle: string;
      personality: string[];
    };
    painPoints: string[];
    goals: string[];
    preferredChannels: string[];
    completed: boolean;
  };
  
  // Brand Canvas Data
  brandCanvas: {
    brandPurpose: string;
    brandVision: string;
    brandMission: string;
    brandValues: string[];
    positioningStatement: string;
    valueProposition: string;
    brandPersonality: string[];
    brandVoice: string;
    completed: boolean;
  };
  
  // User Info
  userInfo: {
    userId: string;
    name: string;
    email: string;
    company: string;
    industry: string;
  };
}

const initialBrandData: BrandData = {
  insight: {
    marketInsight: '',
    consumerInsight: '',
    brandPurpose: '',
    completed: false,
  },
  distinctive: {
    uniqueValue: '',
    differentiators: [],
    positioning: '',
    completed: false,
  },
  empathy: {
    emotionalConnection: '',
    customerNeeds: [],
    brandPersonality: '',
    completed: false,
  },
  authentic: {
    brandValues: [],
    brandStory: '',
    brandPromise: '',
    completed: false,
  },
  avatar: {
    demographics: {
      age: '',
      gender: '',
      income: '',
      location: '',
      occupation: '',
    },
    psychographics: {
      interests: [],
      values: [],
      lifestyle: '',
      personality: [],
    },
    painPoints: [],
    goals: [],
    preferredChannels: [],
    completed: false,
  },
  brandCanvas: {
    brandPurpose: '',
    brandVision: '',
    brandMission: '',
    brandValues: [],
    positioningStatement: '',
    valueProposition: '',
    brandPersonality: [],
    brandVoice: '',
    completed: false,
  },
  userInfo: {
    userId: '',
    name: '',
    email: '',
    company: '',
    industry: '',
  },
};

interface SyncPayload {
  diagnosticCompleted?: boolean;
  avatarCompleted?: boolean;
  insightsCompleted?: boolean;
}

interface BrandContextType {
  brandData: BrandData;
  updateBrandData: (section: keyof BrandData, data: Partial<BrandData[keyof BrandData]>) => void;
  updateUserInfo: (data: Partial<BrandData['userInfo']>) => void;
  getCompletionPercentage: () => number;
  isToolUnlocked: () => boolean;
  getRecommendedNextStep: () => string;
  syncWithDatabase: (payload: SyncPayload) => Promise<void>;
  isInitializing: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [brandData, setBrandData] = useState<BrandData>(initialBrandData);
  const [isInitializing, setIsInitializing] = useState(true);
  const { user } = useAuth();

  // Load diagnostic status from database on mount
  useEffect(() => {
    const loadDiagnosticStatus = async () => {
      setIsInitializing(true);
      if (user) {
        try {
          const { data } = await supabase
            .from('diagnostic_submissions')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (data) {
            setBrandData(prev => ({
              ...prev,
              insight: { ...prev.insight, completed: true }
            }));
          }
        } catch (error) {
          // No diagnostic found, which is fine
          console.log('No diagnostic found for user');
        }
      }
      setIsInitializing(false);
    };

    loadDiagnosticStatus();
  }, [user]);

  const updateBrandData = (section: keyof BrandData, data: Partial<BrandData[keyof BrandData]>) => {
    setBrandData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...data,
      },
    }));
  };

  const updateUserInfo = (data: Partial<BrandData['userInfo']>) => {
    setBrandData(prev => ({
      ...prev,
      userInfo: {
        ...prev.userInfo,
        ...data,
      },
    }));
  };

  const getCompletionPercentage = () => {
    // Calculate completion for Brand Canvas specifically
    const canvasFields = [
      brandData.brandCanvas.brandPurpose,
      brandData.brandCanvas.brandVision,
      brandData.brandCanvas.brandMission,
      brandData.brandCanvas.brandValues.length > 0,
      brandData.brandCanvas.positioningStatement,
      brandData.brandCanvas.valueProposition,
      brandData.brandCanvas.brandPersonality.length > 0,
      brandData.brandCanvas.brandVoice,
    ];
    
    const completedCanvasFields = canvasFields.filter(field => 
      typeof field === 'boolean' ? field : Boolean(field)
    ).length;
    
    return Math.round((completedCanvasFields / 8) * 100);
  };

  const isToolUnlocked = () => {
    return true; // All tools are always available
  };

  const getRecommendedNextStep = () => {
    // Return smart guidance instead of locks
    if (!brandData.insight.completed && !brandData.distinctive.completed &&
        !brandData.empathy.completed && !brandData.authentic.completed) {
      return 'Start with IDEA Framework for best results';
    }
    if (!brandData.avatar.completed) {
      return 'Build your customer avatar to enhance targeting';
    }
    if (!brandData.brandCanvas.completed) {
      return 'Complete your brand canvas for comprehensive strategy';
    }
    return 'All core modules completed!';
  };

  const syncWithDatabase = async (payload: SyncPayload) => {
    // Sync method to update state from external sources
    // This allows the sync hook to update multiple fields at once
    setBrandData(prev => {
      const updated = { ...prev };

      if (payload.diagnosticCompleted !== undefined) {
        updated.insight = { ...updated.insight, completed: payload.diagnosticCompleted };
      }

      if (payload.avatarCompleted !== undefined) {
        updated.avatar = { ...updated.avatar, completed: payload.avatarCompleted };
      }

      if (payload.insightsCompleted !== undefined) {
        // For insights module, we also mark the insight section as complete
        updated.insight = { ...updated.insight, completed: payload.insightsCompleted };
      }

      return updated;
    });
  };

  return (
    <BrandContext.Provider value={{
      brandData,
      updateBrandData,
      updateUserInfo,
      getCompletionPercentage,
      isToolUnlocked,
      getRecommendedNextStep,
      syncWithDatabase,
      isInitializing,
    }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};