import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface BrandData {
  // IDEA Framework Data
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
    missionStatement: string;
    visionStatement: string;
    valueProposition: string;
    brandArchetype: string;
    tonalAttributes: string[];
    visualIdentity: string;
    completed: boolean;
  };
  
  // User Info
  userInfo: {
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
    missionStatement: '',
    visionStatement: '',
    valueProposition: '',
    brandArchetype: '',
    tonalAttributes: [],
    visualIdentity: '',
    completed: false,
  },
  userInfo: {
    name: '',
    email: '',
    company: '',
    industry: '',
  },
};

interface BrandContextType {
  brandData: BrandData;
  updateBrandData: (section: keyof BrandData, data: Partial<BrandData[keyof BrandData]>) => void;
  updateUserInfo: (data: Partial<BrandData['userInfo']>) => void;
  getCompletionPercentage: () => number;
  isToolUnlocked: (tool: 'idea' | 'avatar' | 'canvas' | 'valuelens') => boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [brandData, setBrandData] = useState<BrandData>(initialBrandData);

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
    const completedSections = [
      brandData.insight.completed,
      brandData.distinctive.completed,
      brandData.empathy.completed,
      brandData.authentic.completed,
      brandData.avatar.completed,
      brandData.brandCanvas.completed,
    ].filter(Boolean).length;
    
    return Math.round((completedSections / 6) * 100);
  };

  const isToolUnlocked = (tool: 'idea' | 'avatar' | 'canvas' | 'valuelens') => {
    switch (tool) {
      case 'idea':
        return true; // Always available
      case 'avatar':
        return brandData.insight.completed || brandData.distinctive.completed; // Unlock after any IDEA section
      case 'canvas':
        return brandData.insight.completed && brandData.avatar.completed; // Requires IDEA + Avatar
      case 'valuelens':
        return brandData.brandCanvas.completed; // Requires completed brand canvas
      default:
        return false;
    }
  };

  return (
    <BrandContext.Provider value={{
      brandData,
      updateBrandData,
      updateUserInfo,
      getCompletionPercentage,
      isToolUnlocked,
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