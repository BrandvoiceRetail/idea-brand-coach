/**
 * Avatar-scoped react-query key namespace — the bleed firewall.
 *
 * Multi-Avatar design §2.2: every per-avatar react-query cache MUST be keyed
 * under a single namespace so that ONE invalidation predicate, fired by the
 * single switch path (`AvatarContext.setCurrentAvatar`), nukes every avatar's
 * caches on a switch. Without the shared prefix a cache silently survives the
 * switch and leaks avatar A's data into a view scoped to avatar B.
 *
 *     avatarScopedKey('chat-sessions', avatarId)  ->  ['avatar', avatarId, 'chat-sessions']
 *
 * Switch invalidation (in AvatarContext, design §2.2):
 *     queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === AVATAR_KEY_PREFIX })
 *
 * NOTE — what is NOT avatar-scoped: the avatar *list* (`['avatars']`,
 * `['avatars','templates']` in useAvatars) is brand-level (it enumerates the
 * avatars themselves) and intentionally stays OUTSIDE this namespace, so a
 * switch does not blow away the list the switcher reads from.
 *
 * The invariant is enforced by `src/lib/__tests__/queryKeys.guard.test.ts`.
 */

/** The literal first segment of every avatar-scoped query key. Load-bearing. */
export const AVATAR_KEY_PREFIX = 'avatar' as const;

/** Domains that live under the avatar namespace. Extend as hooks are migrated. */
export type AvatarScopedDomain =
  | 'chat-sessions'
  | 'chat-messages'
  | 'field-values'
  | 'artifacts'
  | 'diagnostic';

/**
 * Build an avatar-scoped react-query key.
 *
 * @param domain   the avatar-scoped data family (e.g. 'chat-sessions')
 * @param avatarId the current avatar id (callers that have a brand fallback
 *                 should pass `avatarId ?? 'brand'` — see avatarChatSessionsKey)
 * @param rest     any further key segments (filters, ids)
 */
export function avatarScopedKey(
  domain: AvatarScopedDomain,
  avatarId: string,
  ...rest: readonly (string | number)[]
): readonly (string | number)[] {
  return [AVATAR_KEY_PREFIX, avatarId, domain, ...rest];
}

/**
 * Chat-session list key (design §4.1). Brand-level threads (no current avatar)
 * collapse to the literal `'brand'` segment so they share one cache bucket and
 * are still namespaced (so a switch invalidates them too).
 */
export function avatarChatSessionsKey(
  avatarId: string | undefined,
  chatbotType: string,
  ...rest: readonly (string | number)[]
): readonly (string | number)[] {
  return avatarScopedKey('chat-sessions', avatarId ?? 'brand', chatbotType, ...rest);
}

/**
 * Per-session chat-message list key (design §2.1 / §2.2). Folded under the
 * avatar namespace so the switch-invalidation predicate
 * (`q.queryKey[0] === 'avatar'`) nukes a prior avatar's cached messages on a
 * switch — the firewall must cover messages, not just the session list. Brand-
 * level threads (no current avatar) collapse to the `'brand'` segment, mirroring
 * `avatarChatSessionsKey`. `sessionId` may be undefined before a thread is
 * selected (matches react-query's `enabled: !!sessionId` gate downstream).
 */
export function avatarChatMessagesKey(
  avatarId: string | undefined,
  chatbotType: string,
  sessionId: string | undefined,
): readonly (string | number)[] {
  return avatarScopedKey('chat-messages', avatarId ?? 'brand', chatbotType, sessionId ?? '');
}

/** Avatar profile/field-values key (design §2.2 AVATAR-scoped). */
export function avatarFieldValuesKey(
  avatarId: string,
  ...rest: readonly (string | number)[]
): readonly (string | number)[] {
  return avatarScopedKey('field-values', avatarId, ...rest);
}

/** Strategy-artifacts key (design §2.2 AVATAR-scoped). */
export function avatarArtifactsKey(
  avatarId: string,
  ...rest: readonly (string | number)[]
): readonly (string | number)[] {
  return avatarScopedKey('artifacts', avatarId, ...rest);
}

/**
 * Per-avatar diagnostic-overlay key (Diagnostic BOTH, locked #5). The brand
 * BASELINE (avatar_id NULL) collapses to the literal `'brand'` segment so it
 * shares one cache bucket and is still namespaced (a switch invalidates it too,
 * which is harmless — the baseline is brand-stable). An avatar overlay keys on
 * its own id. `kind` distinguishes baseline vs overlay reads under one avatar.
 */
export function avatarDiagnosticKey(
  avatarId: string | undefined,
  kind: 'baseline' | 'overlay',
): readonly (string | number)[] {
  return avatarScopedKey('diagnostic', avatarId ?? 'brand', kind);
}
