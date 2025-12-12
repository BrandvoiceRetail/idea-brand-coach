/**
 * Hook to calculate module completion status based on persisted fields
 *
 * Returns completion status for IDEA Insights and Avatar modules:
 * - 'pending': No fields completed
 * - 'completed': All required fields have values
 * - 'fully-optimized': Future state for refined/optimized content
 */

import { useMemo } from 'react';
import { usePersistedField } from './usePersistedField';

export type CompletionStatus = 'pending' | 'completed' | 'fully-optimized';

interface ModuleCompletionResult {
  insightsStatus: CompletionStatus;
  avatarStatus: CompletionStatus;
  insightsProgress: number;
  avatarProgress: number;
}

/**
 * Hook to track completion status of IDEA Insights and Avatar modules
 */
export function useModuleCompletionStatus(): ModuleCompletionResult {
  // IDEA Insights fields (Interactive IDEA Framework - 5 steps)
  const insightsStep1 = usePersistedField({
    fieldIdentifier: 'insights_framework_step1_response',
    category: 'insights',
  });
  const insightsStep2 = usePersistedField({
    fieldIdentifier: 'insights_framework_step2_response',
    category: 'insights',
  });
  const insightsStep3 = usePersistedField({
    fieldIdentifier: 'insights_framework_step3_response',
    category: 'insights',
  });
  const insightsStep4 = usePersistedField({
    fieldIdentifier: 'insights_framework_step4_response',
    category: 'insights',
  });
  const insightsStep5 = usePersistedField({
    fieldIdentifier: 'insights_framework_step5_response',
    category: 'insights',
  });

  // Avatar fields (required fields from AvatarBuilder)
  const avatarName = usePersistedField({
    fieldIdentifier: 'avatar_name',
    category: 'avatar',
  });
  const avatarAge = usePersistedField({
    fieldIdentifier: 'avatar_demographics_age',
    category: 'avatar',
  });
  const avatarIncome = usePersistedField({
    fieldIdentifier: 'avatar_demographics_income',
    category: 'avatar',
  });
  const avatarLocation = usePersistedField({
    fieldIdentifier: 'avatar_demographics_location',
    category: 'avatar',
  });
  const avatarLifestyle = usePersistedField({
    fieldIdentifier: 'avatar_demographics_lifestyle',
    category: 'avatar',
  });
  const avatarValues = usePersistedField({
    fieldIdentifier: 'avatar_psychology_values',
    category: 'avatar',
  });
  const avatarFears = usePersistedField({
    fieldIdentifier: 'avatar_psychology_fears',
    category: 'avatar',
  });
  const avatarDesires = usePersistedField({
    fieldIdentifier: 'avatar_psychology_desires',
    category: 'avatar',
  });
  const avatarTriggers = usePersistedField({
    fieldIdentifier: 'avatar_psychology_triggers',
    category: 'avatar',
  });
  const avatarBuyingIntent = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_intent',
    category: 'avatar',
  });
  const avatarDecisionFactors = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_decision_factors',
    category: 'avatar',
  });
  const avatarShoppingStyle = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_shopping_style',
    category: 'avatar',
  });
  const avatarPriceConsciousness = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_price_consciousness',
    category: 'avatar',
  });

  // Calculate completion status
  const result = useMemo(() => {
    // IDEA Insights: all 5 steps must be completed
    const insightsFields = [
      insightsStep1.value,
      insightsStep2.value,
      insightsStep3.value,
      insightsStep4.value,
      insightsStep5.value,
    ];
    const insightsCompleted = insightsFields.filter(Boolean).length;
    const insightsTotal = insightsFields.length;
    const insightsProgress = Math.round((insightsCompleted / insightsTotal) * 100);

    // Avatar: key fields must be completed
    const avatarFields = [
      avatarName.value,
      avatarAge.value,
      avatarIncome.value,
      avatarLocation.value,
      avatarLifestyle.value,
      avatarValues.value,
      avatarFears.value,
      avatarDesires.value,
      avatarTriggers.value,
      avatarBuyingIntent.value,
      avatarDecisionFactors.value,
      avatarShoppingStyle.value,
      avatarPriceConsciousness.value,
    ];
    const avatarCompleted = avatarFields.filter(Boolean).length;
    const avatarTotal = avatarFields.length;
    const avatarProgress = Math.round((avatarCompleted / avatarTotal) * 100);

    // Determine status
    const getStatus = (progress: number): CompletionStatus => {
      if (progress === 100) return 'completed';
      // Future: could add 'fully-optimized' based on additional criteria
      return 'pending';
    };

    return {
      insightsStatus: getStatus(insightsProgress),
      avatarStatus: getStatus(avatarProgress),
      insightsProgress,
      avatarProgress,
    };
  }, [
    insightsStep1.value,
    insightsStep2.value,
    insightsStep3.value,
    insightsStep4.value,
    insightsStep5.value,
    avatarName.value,
    avatarAge.value,
    avatarIncome.value,
    avatarLocation.value,
    avatarLifestyle.value,
    avatarValues.value,
    avatarFears.value,
    avatarDesires.value,
    avatarTriggers.value,
    avatarBuyingIntent.value,
    avatarDecisionFactors.value,
    avatarShoppingStyle.value,
    avatarPriceConsciousness.value,
  ]);

  return result;
}

/**
 * Get display label for completion status
 */
export function getStatusLabel(status: CompletionStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'fully-optimized':
      return 'Fully Optimized';
    case 'pending':
    default:
      return 'Pending';
  }
}

/**
 * Get badge variant for completion status
 */
export function getStatusVariant(status: CompletionStatus): 'default' | 'outline' | 'secondary' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'fully-optimized':
      return 'secondary';
    case 'pending':
    default:
      return 'outline';
  }
}
