/**
 * Feature Registry - Single Source of Truth
 *
 * Centralized configuration for all features including:
 * - Launch phase (P0, P1, P2)
 * - Display names and descriptions
 * - Status messaging ("Coming Soon", "Under Development", etc.)
 * - Navigation visibility
 * - Route information
 *
 * This ensures consistent messaging across:
 * - Dashboard
 * - Navigation bar
 * - Coming soon pages
 * - Feature cards
 * - Any other location referencing features
 */

import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  FileText,
  Brain,
  Users,
  TrendingUp,
  BookOpen,
  Target,
  BarChart,
  Palette,
  Sparkles,
  FileCheck,
  Clock,
} from 'lucide-react';

export type DeploymentPhase = 'P0' | 'P1' | 'P2';

export interface Feature {
  /** Unique feature identifier */
  id: string;

  /** Display name shown in navigation and UI */
  name: string;

  /** Short description for cards/previews */
  shortDescription: string;

  /** Full description for coming soon pages */
  fullDescription: string;

  /** Minimum phase required to enable this feature */
  phase: DeploymentPhase;

  /** Route path */
  route: string;

  /** Icon component */
  icon: LucideIcon;

  /** Status message when not available */
  statusMessage: string;

  /** Estimated release date/timeframe */
  estimatedRelease: string;

  /** Show in main navigation? */
  showInNav: boolean;

  /** Category for organization */
  category: 'core' | 'diagnostic' | 'consultant' | 'collaboration' | 'analytics';

  /** Require authentication to access? */
  requiresAuth: boolean;
}

/**
 * Complete feature registry
 * Add new features here and they'll automatically appear correctly everywhere
 */
export const FEATURES: Record<string, Feature> = {
  // ========================================
  // P0 Features - Beta Launch
  // ========================================

  BRAND_DIAGNOSTIC: {
    id: 'BRAND_DIAGNOSTIC',
    name: 'Brand Diagnostic',
    shortDescription: '6-question IDEA framework assessment',
    fullDescription: 'Complete a comprehensive 6-question diagnostic to assess your brand across the IDEA framework (Identify, Discover, Execute, Analyze). Get instant insights and personalized recommendations.',
    phase: 'P0',
    route: '/diagnostic',
    icon: FileCheck,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: true,
    category: 'diagnostic',
    requiresAuth: false,
  },

  BRAND_AVATAR: {
    id: 'BRAND_AVATAR',
    name: 'Brand Avatar',
    shortDescription: 'Define your ideal customer persona',
    fullDescription: 'Build detailed customer personas with demographics, psychographics, pain points, and motivations. Use AI to generate insights and validate assumptions.',
    phase: 'P0',
    route: '/avatar',
    icon: Users,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: true,
    category: 'diagnostic',
    requiresAuth: true,
  },

  INTERACTIVE_INSIGHT: {
    id: 'INTERACTIVE_INSIGHT',
    name: 'Interactive Insight',
    shortDescription: 'Deep customer insights and interactive learning',
    fullDescription: 'Dive deep into customer insights with interactive modules covering buyer intent research, emotional triggers, and the IDEA framework.',
    phase: 'P0',
    route: '/idea/insight',
    icon: Sparkles,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: true,
    category: 'diagnostic',
    requiresAuth: true,
  },

  BRAND_COACH_CHAT: {
    id: 'BRAND_COACH_CHAT',
    name: 'Brand Coach',
    shortDescription: 'AI-powered brand consulting with RAG',
    fullDescription: 'Chat with our AI brand consultant powered by GPT-4 and RAG technology. Get personalized advice based on your brand diagnostic results and uploaded documents.',
    phase: 'P0',
    route: '/idea/consultant',
    icon: MessageSquare,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: true,
    category: 'consultant',
    requiresAuth: true,
  },

  BRAND_CANVAS: {
    id: 'BRAND_CANVAS',
    name: 'Brand Canvas',
    shortDescription: 'Visual brand strategy builder',
    fullDescription: 'Create and visualize your complete brand strategy on an interactive canvas. Export to PDF for presentations and stakeholder alignment.',
    phase: 'P0',
    route: '/canvas',
    icon: Palette,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: true,
    category: 'core',
    requiresAuth: true,
  },

  BRAND_COPY_GENERATOR: {
    id: 'BRAND_COPY_GENERATOR',
    name: 'Brand Copy Generator',
    shortDescription: 'AI-powered brand copywriting',
    fullDescription: 'Generate compelling brand copy, taglines, and messaging using AI trained on your brand voice and positioning.',
    phase: 'P0',
    route: '/value-lens',
    icon: FileText,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: true,
    category: 'core',
    requiresAuth: true,
  },

  DASHBOARD: {
    id: 'DASHBOARD',
    name: 'Dashboard',
    shortDescription: 'Your brand coaching dashboard',
    fullDescription: 'Access all your brand coaching tools, view your progress, and manage your brand strategy from one central location.',
    phase: 'P1',
    route: '/dashboard',
    icon: BarChart,
    statusMessage: 'Coming Soon',
    estimatedRelease: 'Q1 2026',
    showInNav: true,
    category: 'core',
    requiresAuth: true,
  },

  DOCUMENT_UPLOAD: {
    id: 'DOCUMENT_UPLOAD',
    name: 'Document Upload',
    shortDescription: 'Upload brand documents for personalized insights',
    fullDescription: 'Upload your brand documents, presentations, and research to build your personalized knowledge base. The AI consultant will reference these in conversations.',
    phase: 'P0',
    route: '/documents',
    icon: FileText,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: false,
    category: 'core',
    requiresAuth: true,
  },

  CONVERSATION_HISTORY: {
    id: 'CONVERSATION_HISTORY',
    name: 'Conversation History',
    shortDescription: 'Access past consultant sessions',
    fullDescription: 'Review your conversation history with the Brand Coach GPT. All insights and recommendations are saved and searchable.',
    phase: 'P0',
    route: '/history',
    icon: Clock,
    statusMessage: 'Available Now',
    estimatedRelease: 'Live',
    showInNav: false,
    category: 'core',
    requiresAuth: true,
  },

  // ========================================
  // P1 Features - Enhanced Collaboration
  // ========================================

  IDEA_FRAMEWORK: {
    id: 'IDEA_FRAMEWORK',
    name: 'IDEA Framework',
    shortDescription: 'Learn the IDEA Strategic Brand Framework',
    fullDescription: 'Deep dive into the IDEA Strategic Brand Framework™ - a practical, step-by-step process to build trust, stand out in crowded markets, and turn hesitant browsers into loyal buyers.',
    phase: 'P1',
    route: '/idea',
    icon: BookOpen,
    statusMessage: 'Coming Soon',
    estimatedRelease: 'Q1 2026',
    showInNav: true,
    category: 'core',
    requiresAuth: false,
  },

  FRAMEWORK_SUBMISSIONS: {
    id: 'FRAMEWORK_SUBMISSIONS',
    name: 'Framework Submissions',
    shortDescription: 'Track your IDEA framework progress',
    fullDescription: 'View all your completed framework assessments, track progress over time, and see how your brand strategy evolves.',
    phase: 'P1',
    route: '/submissions',
    icon: Target,
    statusMessage: 'Coming Soon',
    estimatedRelease: 'Q1 2026',
    showInNav: true,
    category: 'diagnostic',
    requiresAuth: true,
  },

  TEAM_COLLABORATION: {
    id: 'TEAM_COLLABORATION',
    name: 'Team Collaboration',
    shortDescription: 'Invite team members to collaborate',
    fullDescription: 'Invite team members to collaborate on brand strategy. Share insights, documents, and consultant conversations with controlled access.',
    phase: 'P1',
    route: '/team',
    icon: Users,
    statusMessage: 'Coming Soon',
    estimatedRelease: 'Q2 2026',
    showInNav: true,
    category: 'collaboration',
    requiresAuth: true,
  },

  // ========================================
  // P2 Features - Advanced Analytics
  // ========================================

  BRAND_ANALYTICS: {
    id: 'BRAND_ANALYTICS',
    name: 'Brand Analytics',
    shortDescription: 'Track brand performance metrics',
    fullDescription: 'Comprehensive analytics dashboard tracking your brand health scores, consultation patterns, and strategic progress over time.',
    phase: 'P2',
    route: '/analytics',
    icon: BarChart,
    statusMessage: 'Coming in 2026',
    estimatedRelease: 'Q3 2026',
    showInNav: true,
    category: 'analytics',
    requiresAuth: true,
  },

  COMPETITIVE_ANALYSIS: {
    id: 'COMPETITIVE_ANALYSIS',
    name: 'Competitive Analysis',
    shortDescription: 'AI-powered competitor insights',
    fullDescription: 'Automatically analyze your competitors using AI. Track their positioning, messaging, and identify opportunities for differentiation.',
    phase: 'P2',
    route: '/competitive-analysis',
    icon: TrendingUp,
    statusMessage: 'Coming in 2026',
    estimatedRelease: 'Q3 2026',
    showInNav: true,
    category: 'analytics',
    requiresAuth: true,
  },

  BRAND_INSIGHTS_LIBRARY: {
    id: 'BRAND_INSIGHTS_LIBRARY',
    name: 'Insights Library',
    shortDescription: 'Curated brand strategy resources',
    fullDescription: 'Access a curated library of brand strategy frameworks, case studies, and best practices. AI-powered recommendations based on your brand profile.',
    phase: 'P2',
    route: '/library',
    icon: BookOpen,
    statusMessage: 'Coming in 2026',
    estimatedRelease: 'Q4 2026',
    showInNav: true,
    category: 'core',
    requiresAuth: true,
  },

  AI_WORKSHOP_FACILITATOR: {
    id: 'AI_WORKSHOP_FACILITATOR',
    name: 'AI Workshop Facilitator',
    shortDescription: 'Guided brand strategy workshops',
    fullDescription: 'Run interactive brand strategy workshops guided by AI. Perfect for team alignment sessions and strategic planning meetings.',
    phase: 'P2',
    route: '/workshop',
    icon: Sparkles,
    statusMessage: 'Coming in 2026',
    estimatedRelease: 'Q4 2026',
    showInNav: false,
    category: 'collaboration',
    requiresAuth: true,
  },
} as const;

export type FeatureId = keyof typeof FEATURES;

/**
 * Get feature by ID
 */
export function getFeature(id: FeatureId): Feature {
  return FEATURES[id];
}

/**
 * Get all features for a specific phase (including all previous phases)
 */
export function getFeaturesForPhase(phase: DeploymentPhase): Feature[] {
  const phaseHierarchy: Record<DeploymentPhase, DeploymentPhase[]> = {
    'P0': ['P0'],
    'P1': ['P0', 'P1'],
    'P2': ['P0', 'P1', 'P2'],
  };

  const enabledPhases = phaseHierarchy[phase];

  return Object.values(FEATURES).filter(feature =>
    enabledPhases.includes(feature.phase)
  );
}

/**
 * Get features that should appear in navigation for current phase
 */
export function getNavigationFeatures(currentPhase: DeploymentPhase): Feature[] {
  return getFeaturesForPhase(currentPhase).filter(feature => feature.showInNav);
}

/**
 * Check if feature is enabled in current phase
 */
export function isFeatureAvailable(featureId: FeatureId, currentPhase: DeploymentPhase): boolean {
  const feature = FEATURES[featureId];
  const enabledFeatures = getFeaturesForPhase(currentPhase);
  return enabledFeatures.includes(feature);
}

/**
 * Get display status for a feature (for UI badges, buttons, etc.)
 */
export function getFeatureStatus(featureId: FeatureId, currentPhase: DeploymentPhase): {
  available: boolean;
  statusMessage: string;
  estimatedRelease: string;
} {
  const feature = FEATURES[featureId];
  const available = isFeatureAvailable(featureId, currentPhase);

  return {
    available,
    statusMessage: available ? 'Available Now' : feature.statusMessage,
    estimatedRelease: available ? 'Live' : feature.estimatedRelease,
  };
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(
  category: Feature['category'],
  currentPhase: DeploymentPhase
): Feature[] {
  return getFeaturesForPhase(currentPhase).filter(f => f.category === category);
}

/**
 * Hook for React components to get feature info
 */
export function useFeatureConfig(featureId: FeatureId) {
  const currentPhase = (import.meta.env.VITE_DEPLOYMENT_PHASE || 'P0') as DeploymentPhase;
  const feature = FEATURES[featureId];
  const status = getFeatureStatus(featureId, currentPhase);

  return {
    ...feature,
    ...status,
  };
}

/**
 * Get current deployment phase from environment
 */
export function getCurrentPhase(): DeploymentPhase {
  return (import.meta.env.VITE_DEPLOYMENT_PHASE || 'P0') as DeploymentPhase;
}

// Development helper
if (import.meta.env.DEV) {
  const currentPhase = getCurrentPhase();
  const enabled = getFeaturesForPhase(currentPhase);
  const inNav = getNavigationFeatures(currentPhase);

  console.log('[Feature Registry]', {
    phase: currentPhase,
    totalFeatures: Object.keys(FEATURES).length,
    enabledFeatures: enabled.length,
    navFeatures: inNav.length,
    features: enabled.map(f => f.id),
  });
}
