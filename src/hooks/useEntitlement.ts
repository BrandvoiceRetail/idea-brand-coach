/**
 * useEntitlement — React access to the free-trial vs membership signal.
 *
 * Wraps `isMember()` in react-query so the UI can gate the funnel (a non-member is
 * held to FREE_TRIAL_PIECE_LIMIT pieces) without each component re-reading
 * `user_subscriptions`. Fails safe: while loading or on error, `isMember` is false
 * (the trial gate applies), never a silent grant of paid access.
 */
import { useQuery } from '@tanstack/react-query';
import { isMember as readIsMember } from '@/lib/entitlement';

export interface Entitlement {
  /** True only when an active/trialing subscription exists. */
  isMember: boolean;
  /** True while the membership read is in flight. */
  isLoading: boolean;
}

export function useEntitlement(): Entitlement {
  const { data, isLoading } = useQuery({
    queryKey: ['entitlement', 'is-member'],
    queryFn: readIsMember,
    staleTime: 60_000,
    retry: 1,
  });
  return { isMember: data ?? false, isLoading };
}
