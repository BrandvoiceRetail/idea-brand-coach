/**
 * useV4ContextAutofill — one-shot bridge that pre-fills the /v4 onboarding
 * context from the user's EXISTING Brand Coach data (canonical avatar + legacy
 * BrandData), so the surface stops re-asking "tell me about your brand" and the
 * Analyse gate (customer + problem) passes for anyone who already built an avatar.
 *
 * Lives in V4Layout (wraps every /v4/* route, inside Avatar/Brand providers —
 * V4ContextProvider sits ABOVE them, so it cannot do this itself). Runs once per
 * mount when the synced v4 store has loaded WITHOUT a customer/problem yet; writes
 * only the empty slots, never overwrites the user's own input, never fabricates.
 */
import { useEffect, useRef } from 'react';
import { useV4Context } from '@/contexts/V4ContextStore';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useBrand } from '@/contexts/BrandContext';
import { deriveContextFromBrand } from '@/lib/v4/deriveContextFromBrand';

export function useV4ContextAutofill(): void {
  const { fillMap, isLoading, provideContext } = useV4Context();
  const { currentAvatar, avatars } = useAvatarContext();
  const { brandData } = useBrand();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current || isLoading) return;

    const filled = (k: string): boolean => fillMap.some((s) => s.key === k && Boolean(s.value));
    // Gate-critical context already present (user onboarded via megaprompt, or a
    // prior autofill persisted server-side) → nothing to do.
    if (filled('customer') && filled('problem')) {
      doneRef.current = true;
      return;
    }
    // Avatar list still loading → wait (don't consume the one shot).
    if (avatars === undefined) return;
    // List loaded but the ACTIVE avatar hasn't resolved yet — on a fresh browser
    // selectedAvatarId is hydrated async from the profile, so currentAvatar lags
    // the list by a render. Wait for it; firing now would derive from a null
    // avatar, write nothing, and burn the one shot (leaving Analyse gated).
    if (avatars.length > 0 && !currentAvatar) return;

    const emptyKeys = new Set(fillMap.filter((s) => !s.value).map((s) => s.key));
    const answers = deriveContextFromBrand(currentAvatar, brandData, emptyKeys);
    doneRef.current = true; // one shot regardless — avoid re-deriving every render
    if (answers.length > 0) provideContext(answers);
  }, [isLoading, fillMap, currentAvatar, avatars, brandData, provideContext]);
}
