/**
 * Bleed-firewall invariant guard (Multi-Avatar design §2.2 / §6 XC-1).
 *
 * THE INVARIANT THIS FILE PROTECTS
 * --------------------------------
 * When the coach switches the current avatar, every per-avatar react-query
 * cache MUST be invalidated and re-fetched so that data from avatar A can never
 * "bleed" into a view scoped to avatar B. The mechanism is a query-key
 * NAMESPACE: every avatar-scoped react-query key starts with the literal
 * segment `'avatar'` followed by the avatarId —
 *
 *     ['avatar', avatarId, ...rest]
 *
 * The single switch path (`AvatarContext.setCurrentAvatar`) invalidates with
 *     predicate: q => q.queryKey[0] === 'avatar'
 * so the prefix is load-bearing: a key that forgets the prefix silently
 * survives a switch and leaks stale avatar data. `avatarScopedKey()` is the ONE
 * constructor that produces these keys; this test pins its shape.
 *
 * SECONDARY GUARD
 * ---------------
 * The three-stores-to-one collapse (design §4.1) deletes the legacy
 * `useAvatarService` switch mechanism. Two tokens must NOT reappear anywhere in
 * `src/` except inside a clearly-marked one-time migration shim:
 *   - localStorage key  'brandCoach_currentAvatarId'
 *   - window event      'avatarChanged'
 * Their return would resurrect a second, un-invalidated avatar store and
 * reopen the bleed.
 *
 * Written test-first: the helpers under test live in `src/lib/queryKeys.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import {
  avatarScopedKey,
  AVATAR_KEY_PREFIX,
  avatarChatSessionsKey,
  avatarChatMessagesKey,
  avatarFieldValuesKey,
  avatarArtifactsKey,
} from '../queryKeys';

const SRC_ROOT = resolve(__dirname, '..', '..');

/** Recursively collect every .ts/.tsx source file under src/, skipping tests. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'test') continue;
      out.push(...collectSourceFiles(full));
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
      out.push(full);
    }
  }
  return out;
}

describe('avatarScopedKey — bleed-firewall key shape', () => {
  it('always starts with the [avatar, avatarId, ...] namespace', () => {
    const key = avatarScopedKey('chat-sessions', 'avatar-123');
    expect(key[0]).toBe(AVATAR_KEY_PREFIX);
    expect(key[0]).toBe('avatar');
    expect(key[1]).toBe('avatar-123');
    expect(key[2]).toBe('chat-sessions');
  });

  it('appends arbitrary trailing segments after the domain', () => {
    expect(avatarScopedKey('chat-sessions', 'a1', 'field', 'f9')).toEqual([
      'avatar',
      'a1',
      'chat-sessions',
      'field',
      'f9',
    ]);
  });

  it('is matched by the switch-invalidation predicate (queryKey[0] === "avatar")', () => {
    const predicate = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === AVATAR_KEY_PREFIX;
    expect(predicate({ queryKey: avatarScopedKey('artifacts', 'a1') })).toBe(true);
    // a non-namespaced key (e.g. brand-level ['avatars']) must NOT match
    expect(predicate({ queryKey: ['avatars'] })).toBe(false);
    expect(predicate({ queryKey: ['avatars', 'templates'] })).toBe(false);
  });

  it('uses a stable string for the prefix constant', () => {
    expect(AVATAR_KEY_PREFIX).toBe('avatar');
  });
});

describe('avatar-scoped key-family helpers', () => {
  it('chat-sessions helper folds the brand fallback into the avatar segment', () => {
    // design §4.1: ['avatar', avatarId ?? 'brand', 'chat-sessions', chatbotType]
    expect(avatarChatSessionsKey(undefined, 'idea-framework-consultant')).toEqual([
      'avatar',
      'brand',
      'chat-sessions',
      'idea-framework-consultant',
    ]);
    expect(avatarChatSessionsKey('a1', 'idea-framework-consultant')).toEqual([
      'avatar',
      'a1',
      'chat-sessions',
      'idea-framework-consultant',
    ]);
  });

  it('chat-messages helper folds the brand fallback into the avatar segment', () => {
    // §2.1/§2.2: per-session messages must live under the firewall too, so a
    // switch invalidation (queryKey[0] === 'avatar') nukes them.
    expect(avatarChatMessagesKey(undefined, 'idea-framework-consultant', 's1')).toEqual([
      'avatar',
      'brand',
      'chat-messages',
      'idea-framework-consultant',
      's1',
    ]);
    expect(avatarChatMessagesKey('a1', 'idea-framework-consultant', 's1')).toEqual([
      'avatar',
      'a1',
      'chat-messages',
      'idea-framework-consultant',
      's1',
    ]);
    // Undefined sessionId collapses to '' (matches react-query enabled gate).
    expect(avatarChatMessagesKey('a1', 'idea-framework-consultant', undefined)[4]).toBe('');
  });

  it('every family helper produces a namespaced key', () => {
    const keys = [
      avatarChatSessionsKey('a1', 'idea-framework-consultant'),
      avatarChatMessagesKey('a1', 'idea-framework-consultant', 's1'),
      avatarFieldValuesKey('a1'),
      avatarArtifactsKey('a1'),
    ];
    for (const k of keys) {
      expect(k[0]).toBe(AVATAR_KEY_PREFIX);
      expect(k[1]).toBe('a1');
    }
  });
});

describe('deprecated avatar-store tokens are not reintroduced (design §4.1)', () => {
  const sourceFiles = collectSourceFiles(SRC_ROOT);

  // The ONLY place these legacy tokens may live is a clearly-marked one-time
  // migration shim. Until that shim exists, ZERO occurrences are allowed.
  // To add the shim: name the file `*legacy-avatar-store-shim*` (or annotate the
  // line with `// LEGACY-AVATAR-SHIM`) and it will be exempted here.
  const SHIM_ALLOWLIST = /legacy-avatar-store-shim/i;
  const SHIM_LINE_MARKER = /LEGACY-AVATAR-SHIM/;

  for (const token of ['brandCoach_currentAvatarId', 'avatarChanged']) {
    it(`'${token}' appears only inside the migration shim`, () => {
      const offenders: string[] = [];
      for (const file of sourceFiles) {
        if (SHIM_ALLOWLIST.test(file)) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (line.includes(token) && !SHIM_LINE_MARKER.test(line)) {
            offenders.push(`${file}:${i + 1}`);
          }
        });
      }
      expect(
        offenders,
        `Deprecated avatar-store token '${token}' found outside the migration shim:\n` +
          offenders.join('\n') +
          `\nCollapse to AvatarContext.setCurrentAvatar (design §4.1) or move into a *legacy-avatar-store-shim* file.`,
      ).toEqual([]);
    });
  }
});
