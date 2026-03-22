import type { Avatar } from '@/types/avatar';

/**
 * Interface for avatar persistence operations.
 * Abstracts the storage mechanism so the hook remains testable
 * and the backing store can be swapped (localStorage, IndexedDB, etc.).
 */
export interface IAvatarStorageAdapter {
  /** Load all avatars from storage */
  loadAvatars(): Avatar[];
  /** Persist the full avatar list to storage */
  saveAvatars(avatars: Avatar[]): void;
  /** Load the active avatar ID from storage */
  loadActiveAvatarId(): string | null;
  /** Persist the active avatar ID (pass null to clear) */
  saveActiveAvatarId(id: string | null): void;
}

/**
 * localStorage-backed implementation of IAvatarStorageAdapter.
 * All read errors return safe defaults; write errors for avatars
 * are re-thrown so callers can surface them to the user.
 */
export class LocalStorageAvatarAdapter implements IAvatarStorageAdapter {
  private static readonly AVATARS_KEY = 'idea-brand-coach:avatars';
  private static readonly ACTIVE_ID_KEY = 'idea-brand-coach:activeAvatarId';

  loadAvatars(): Avatar[] {
    try {
      const stored = localStorage.getItem(LocalStorageAvatarAdapter.AVATARS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[AvatarStorageAdapter] Failed to load avatars:', error);
      return [];
    }
  }

  saveAvatars(avatars: Avatar[]): void {
    try {
      localStorage.setItem(LocalStorageAvatarAdapter.AVATARS_KEY, JSON.stringify(avatars));
    } catch (error) {
      console.error('[AvatarStorageAdapter] Failed to save avatars:', error);
      throw new Error('Failed to save avatar list');
    }
  }

  loadActiveAvatarId(): string | null {
    try {
      return localStorage.getItem(LocalStorageAvatarAdapter.ACTIVE_ID_KEY);
    } catch (error) {
      console.error('[AvatarStorageAdapter] Failed to load active avatar ID:', error);
      return null;
    }
  }

  saveActiveAvatarId(id: string | null): void {
    try {
      if (id === null) {
        localStorage.removeItem(LocalStorageAvatarAdapter.ACTIVE_ID_KEY);
      } else {
        localStorage.setItem(LocalStorageAvatarAdapter.ACTIVE_ID_KEY, id);
      }
    } catch (error) {
      console.error('[AvatarStorageAdapter] Failed to save active avatar ID:', error);
    }
  }
}
