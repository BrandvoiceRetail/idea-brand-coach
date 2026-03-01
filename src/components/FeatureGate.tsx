/**
 * Feature Gate Component
 *
 * Conditionally renders content based on deployment phase.
 * Shows "Coming Soon" or "Under Development" for disabled features.
 *
 * Usage:
 *   <FeatureGate feature="BRAND_CANVAS" fallback={<ComingSoon />}>
 *     <BrandCanvasPage />
 *   </FeatureGate>
 */

import { ReactNode } from 'react';
import { FEATURES, isFeatureAvailable, type Feature, type FeatureId, type DeploymentPhase } from '@/config/features';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import ComingSoon from './ComingSoon';

interface FeatureGateProps {
  /** Feature ID to check */
  feature: FeatureId;

  /** Content to show when feature is enabled */
  children: ReactNode;

  /** Custom fallback when feature is disabled (optional) */
  fallback?: ReactNode;

  /** Coming Soon page config (used if no custom fallback) */
  comingSoonConfig?: {
    title: string;
    description: string;
    icon?: 'construction' | 'sparkles';
    estimatedRelease?: string;
    showCTA?: boolean;
    ctaText?: string;
    onCTAClick?: () => void;
  };
}

export default function FeatureGate({
  feature,
  children,
  fallback,
  comingSoonConfig,
}: FeatureGateProps): JSX.Element {
  // First check dynamic feature flags (can override phase-based)
  const dynamicFlagEnabled = useFeatureFlag(feature, { defaultValue: null });

  // If dynamic flag exists and is explicitly set, use it
  if (dynamicFlagEnabled !== null) {
    if (dynamicFlagEnabled) {
      return <>{children}</>;
    }
  } else {
    // Fall back to phase-based check if no dynamic flag exists
    const currentPhase = (import.meta.env.VITE_DEPLOYMENT_PHASE || 'P0') as DeploymentPhase;
    const phaseEnabled = isFeatureAvailable(feature, currentPhase);

    if (phaseEnabled) {
      return <>{children}</>;
    }
  }

  // Feature is disabled - render fallback

  // Use custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Use ComingSoon with custom config if provided
  if (comingSoonConfig) {
    return <ComingSoon {...comingSoonConfig} />;
  }

  // Default ComingSoon based on feature from registry
  const featureConfig = FEATURES[feature];
  const defaultConfig = getDefaultComingSoonConfig(featureConfig);

  return <ComingSoon {...defaultConfig} />;
}

/**
 * Get default "Coming Soon" configuration for a feature
 */
function getDefaultComingSoonConfig(
  feature: Feature
): {
  title: string;
  description: string;
  icon: 'construction' | 'sparkles';
  estimatedRelease: string;
} {
  // Determine icon based on feature category and status
  const icon: 'construction' | 'sparkles' =
    feature.category === 'analytics' || feature.category === 'collaboration'
      ? 'construction'
      : 'sparkles';

  // Build title from feature name and status
  const title = `${feature.name} ${feature.statusMessage}`;

  return {
    title,
    description: feature.fullDescription,
    icon,
    estimatedRelease: feature.estimatedRelease,
  };
}
