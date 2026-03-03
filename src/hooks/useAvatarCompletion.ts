/**
 * Hook to calculate avatar completion status based on persisted fields
 *
 * Returns completion status for avatar sections:
 * - demographics: name, age, income, location, lifestyle
 * - psychographics: values, fears, desires, triggers
 * - behavior: intent, decision factors, shopping style, price consciousness
 * - voice: customer feedback
 */

import { useMemo } from 'react';
import { usePersistedField } from './usePersistedField';
import type { AvatarCompletionStatus } from '@/types/avatar';

/**
 * Hook to track completion status of avatar fields
 */
export function useAvatarCompletion(): AvatarCompletionStatus {
  // Demographics fields (5 fields)
  const avatarName = usePersistedField({
    fieldIdentifier: 'avatar_name',
    category: 'avatar',
  });
  const age = usePersistedField({
    fieldIdentifier: 'avatar_demographics_age',
    category: 'avatar',
  });
  const income = usePersistedField({
    fieldIdentifier: 'avatar_demographics_income',
    category: 'avatar',
  });
  const location = usePersistedField({
    fieldIdentifier: 'avatar_demographics_location',
    category: 'avatar',
  });
  const lifestyle = usePersistedField({
    fieldIdentifier: 'avatar_demographics_lifestyle',
    category: 'avatar',
  });

  // Psychographics/Psychology fields (4 fields - stored as JSON arrays)
  const values = usePersistedField({
    fieldIdentifier: 'avatar_psychology_values',
    category: 'avatar',
  });
  const fears = usePersistedField({
    fieldIdentifier: 'avatar_psychology_fears',
    category: 'avatar',
  });
  const desires = usePersistedField({
    fieldIdentifier: 'avatar_psychology_desires',
    category: 'avatar',
  });
  const triggers = usePersistedField({
    fieldIdentifier: 'avatar_psychology_triggers',
    category: 'avatar',
  });

  // Buying Behavior fields (4 fields)
  const intent = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_intent',
    category: 'avatar',
  });
  const decisionFactors = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_decision_factors',
    category: 'avatar',
  });
  const shoppingStyle = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_shopping_style',
    category: 'avatar',
  });
  const priceConsciousness = usePersistedField({
    fieldIdentifier: 'avatar_buying_behavior_price_consciousness',
    category: 'avatar',
  });

  // Voice of Customer field (1 field)
  const voiceOfCustomer = usePersistedField({
    fieldIdentifier: 'avatar_voice_customer_feedback',
    category: 'avatar',
  });

  // Calculate completion status
  const result = useMemo(() => {
    // Helper to check if a field has a non-empty value
    const hasValue = (value: string): boolean => {
      if (!value || value.trim() === '') return false;
      // For JSON arrays (or strings that look like they should be JSON arrays)
      if (value.trim().startsWith('[')) {
        try {
          const arr = JSON.parse(value);
          return Array.isArray(arr) && arr.length > 0;
        } catch {
          // Malformed JSON should be treated as empty
          return false;
        }
      }
      return true;
    };

    // Demographics: name, age, income, location, lifestyle (5 fields)
    const demographicsFields = [
      avatarName.value,
      age.value,
      income.value,
      location.value,
      lifestyle.value,
    ];
    const demographicsCompleted = demographicsFields.filter(hasValue).length;
    const demographicsTotal = demographicsFields.length;
    const demographicsPercentage = Math.round((demographicsCompleted / demographicsTotal) * 100);

    // Psychographics: values, fears, desires, triggers (4 fields)
    const psychographicsFields = [
      values.value,
      fears.value,
      desires.value,
      triggers.value,
    ];
    const psychographicsCompleted = psychographicsFields.filter(hasValue).length;
    const psychographicsTotal = psychographicsFields.length;
    const psychographicsPercentage = Math.round((psychographicsCompleted / psychographicsTotal) * 100);

    // Behavior: intent, decision factors, shopping style, price consciousness (4 fields)
    const behaviorFields = [
      intent.value,
      decisionFactors.value,
      shoppingStyle.value,
      priceConsciousness.value,
    ];
    const behaviorCompleted = behaviorFields.filter(hasValue).length;
    const behaviorTotal = behaviorFields.length;
    const behaviorPercentage = Math.round((behaviorCompleted / behaviorTotal) * 100);

    // Voice: customer feedback (1 field)
    const voiceFields = [voiceOfCustomer.value];
    const voiceCompleted = voiceFields.filter(hasValue).length;
    const voiceTotal = voiceFields.length;
    const voicePercentage = Math.round((voiceCompleted / voiceTotal) * 100);

    // Overall completion
    const allFields = [
      ...demographicsFields,
      ...psychographicsFields,
      ...behaviorFields,
      ...voiceFields,
    ];
    const filledFields = allFields.filter(hasValue).length;
    const totalFields = allFields.length;
    const percentage = Math.round((filledFields / totalFields) * 100);

    return {
      percentage,
      filledFields,
      totalFields,
      sectionCompletions: {
        demographics: demographicsPercentage,
        psychographics: psychographicsPercentage,
        behavior: behaviorPercentage,
        voice: voicePercentage,
      },
    };
  }, [
    avatarName.value,
    age.value,
    income.value,
    location.value,
    lifestyle.value,
    values.value,
    fears.value,
    desires.value,
    triggers.value,
    intent.value,
    decisionFactors.value,
    shoppingStyle.value,
    priceConsciousness.value,
    voiceOfCustomer.value,
  ]);

  return result;
}

/**
 * Get display label for completion percentage
 */
export function getCompletionLabel(percentage: number): string {
  if (percentage === 0) return 'Not Started';
  if (percentage === 100) return 'Complete';
  if (percentage >= 75) return 'Almost Done';
  if (percentage >= 50) return 'In Progress';
  if (percentage >= 25) return 'Getting Started';
  return 'Just Started';
}

/**
 * Get badge variant for completion percentage
 */
export function getCompletionVariant(percentage: number): 'default' | 'outline' | 'secondary' {
  if (percentage === 100) return 'default';
  if (percentage >= 50) return 'secondary';
  return 'outline';
}
