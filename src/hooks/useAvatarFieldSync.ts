import { useEffect, useRef } from 'react';

interface UseAvatarFieldSyncProps {
  currentAvatarId: string | undefined;
  clearFields: () => void;
}

/**
 * Custom hook to handle field clearing when avatar changes
 * Follows Single Responsibility Principle
 */
export function useAvatarFieldSync({
  currentAvatarId,
  clearFields,
}: UseAvatarFieldSyncProps): void {
  const previousAvatarId = useRef<string | undefined>(currentAvatarId);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Skip on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      previousAvatarId.current = currentAvatarId;
      return;
    }

    // Only clear when actually switching between different avatars
    const isActualSwitch =
      previousAvatarId.current !== undefined &&
      currentAvatarId !== undefined &&
      previousAvatarId.current !== currentAvatarId;

    if (isActualSwitch) {
      console.log(`Clearing fields: switching from ${previousAvatarId.current} to ${currentAvatarId}`);
      clearFields();
    }

    previousAvatarId.current = currentAvatarId;
  }, [currentAvatarId]); // clearFields excluded intentionally if it's stable
}