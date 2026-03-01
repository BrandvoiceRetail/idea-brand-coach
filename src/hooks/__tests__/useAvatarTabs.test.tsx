import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAvatarTabs } from '../useAvatarTabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Avatar } from '@/types/avatar';

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/use-toast');

describe('useAvatarTabs', () => {
  let mockToast: ReturnType<typeof vi.fn>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Setup localStorage mock
    localStorageMock = {};

    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    } as Storage;

    // Setup toast mock
    mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });

    // Setup auth mock
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isLoading: false,
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with empty avatars when localStorage is empty', () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      expect(result.current.avatars).toEqual([]);
      expect(result.current.activeAvatarId).toBeNull();
      expect(result.current.activeAvatar).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should auto-create avatar when none exists and autoCreate is true', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatars).toHaveLength(1);
      expect(result.current.avatars[0].name).toBe('My First Avatar');
      expect(result.current.activeAvatarId).toBe(result.current.avatars[0].id);
    });

    it('should use custom default name for auto-created avatar', async () => {
      const { result } = renderHook(() =>
        useAvatarTabs({ autoCreate: true, defaultAvatarName: 'Custom Name' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatars[0].name).toBe('Custom Name');
    });

    it('should load avatars from localStorage on mount', () => {
      const mockAvatars: Avatar[] = [
        {
          id: 'avatar-1',
          name: 'Test Avatar 1',
          completion_percentage: 50,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        {
          id: 'avatar-2',
          name: 'Test Avatar 2',
          completion_percentage: 75,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-04T00:00:00Z',
        },
      ];

      localStorageMock['idea-brand-coach:avatars'] = JSON.stringify(mockAvatars);

      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      expect(result.current.avatars).toHaveLength(2);
      // Should be sorted by most recent first (avatar-2 has newer updated_at)
      expect(result.current.avatars[0].id).toBe('avatar-2');
      expect(result.current.avatars[1].id).toBe('avatar-1');
    });

    it('should restore active avatar ID from localStorage', () => {
      const mockAvatars: Avatar[] = [
        {
          id: 'avatar-1',
          name: 'Avatar 1',
          completion_percentage: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'avatar-2',
          name: 'Avatar 2',
          completion_percentage: 0,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      localStorageMock['idea-brand-coach:avatars'] = JSON.stringify(mockAvatars);
      localStorageMock['idea-brand-coach:activeAvatarId'] = 'avatar-1';

      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      expect(result.current.activeAvatarId).toBe('avatar-1');
      expect(result.current.activeAvatar?.id).toBe('avatar-1');
    });

    it('should handle invalid data in localStorage gracefully', () => {
      localStorageMock['idea-brand-coach:avatars'] = 'invalid json';

      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      expect(result.current.avatars).toEqual([]);
      expect(result.current.error).toBeNull(); // Should not throw, just log error
    });
  });

  describe('createAvatar', () => {
    it('should create a new avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let newAvatar: Avatar | undefined;

      await act(async () => {
        newAvatar = await result.current.createAvatar({ name: 'New Avatar' });
      });

      expect(newAvatar).toBeDefined();
      expect(newAvatar?.name).toBe('New Avatar');
      expect(newAvatar?.completion_percentage).toBe(0);
      expect(result.current.avatars).toHaveLength(1);
      expect(result.current.activeAvatarId).toBe(newAvatar?.id);
    });

    it('should validate avatar name', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await expect(
        act(() => result.current.createAvatar({ name: '' }))
      ).rejects.toThrow('Avatar name cannot be empty');

      await expect(
        act(() =>
          result.current.createAvatar({
            name: 'a'.repeat(51), // 51 characters
          })
        )
      ).rejects.toThrow('Avatar name must be 50 characters or less');
    });

    it('should save new avatar to localStorage', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await act(async () => {
        await result.current.createAvatar({ name: 'Test Avatar' });
      });

      const storedAvatars = JSON.parse(
        localStorageMock['idea-brand-coach:avatars'] || '[]'
      );
      expect(storedAvatars).toHaveLength(1);
      expect(storedAvatars[0].name).toBe('Test Avatar');
    });

    it('should show toast notification on success', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await act(async () => {
        await result.current.createAvatar({ name: 'New Avatar' });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Avatar Created',
        description: '"New Avatar" has been created.',
      });
    });

    it('should show error toast on failure', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await expect(
        act(() => result.current.createAvatar({ name: '' }))
      ).rejects.toThrow();

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error Creating Avatar',
          variant: 'destructive',
        })
      );
    });

    it('should include metadata when provided', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let newAvatar: Avatar | undefined;

      await act(async () => {
        newAvatar = await result.current.createAvatar({
          name: 'Avatar with Metadata',
          metadata: {
            color: '#ff0000',
            icon: '🚀',
            description: 'Test description',
          },
        });
      });

      expect(newAvatar?.metadata?.color).toBe('#ff0000');
      expect(newAvatar?.metadata?.icon).toBe('🚀');
      expect(newAvatar?.metadata?.description).toBe('Test description');
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar name', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'Original Name' });
        avatarId = avatar.id;
      });

      await act(async () => {
        await result.current.updateAvatar(avatarId, { name: 'Updated Name' });
      });

      const updatedAvatar = result.current.avatars.find((a) => a.id === avatarId);
      expect(updatedAvatar?.name).toBe('Updated Name');
    });

    it('should validate name on update', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'Test' });
        avatarId = avatar.id;
      });

      await expect(
        act(() => result.current.updateAvatar(avatarId, { name: '' }))
      ).rejects.toThrow('Avatar name cannot be empty');
    });

    it('should update completion percentage', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'Test' });
        avatarId = avatar.id;
      });

      await act(async () => {
        await result.current.updateAvatar(avatarId, { completion_percentage: 50 });
      });

      const updatedAvatar = result.current.avatars.find((a) => a.id === avatarId);
      expect(updatedAvatar?.completion_percentage).toBe(50);
    });

    it('should update updated_at timestamp', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;
      let originalUpdatedAt: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'Test' });
        avatarId = avatar.id;
        originalUpdatedAt = avatar.updated_at;
      });

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await act(async () => {
        await result.current.updateAvatar(avatarId, { name: 'Updated' });
      });

      const updatedAvatar = result.current.avatars.find((a) => a.id === avatarId);
      expect(updatedAvatar?.updated_at).not.toBe(originalUpdatedAt);
    });

    it('should throw error for non-existent avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await expect(
        act(() => result.current.updateAvatar('non-existent-id', { name: 'Test' }))
      ).rejects.toThrow('Avatar not found');
    });
  });

  describe('deleteAvatar', () => {
    it('should delete an avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'To Delete' });
        avatarId = avatar.id;
      });

      expect(result.current.avatars).toHaveLength(1);

      await act(async () => {
        await result.current.deleteAvatar(avatarId);
      });

      expect(result.current.avatars).toHaveLength(0);
    });

    it('should switch to another avatar when deleting active avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatar1Id: string;
      let avatar2Id: string;

      await act(async () => {
        const avatar1 = await result.current.createAvatar({ name: 'Avatar 1' });
        avatar1Id = avatar1.id;
        const avatar2 = await result.current.createAvatar({ name: 'Avatar 2' });
        avatar2Id = avatar2.id;
      });

      // Avatar 2 should be active (most recent)
      expect(result.current.activeAvatarId).toBe(avatar2Id);

      await act(async () => {
        await result.current.deleteAvatar(avatar2Id);
      });

      // Should switch to the remaining avatar
      expect(result.current.activeAvatarId).not.toBeNull();
      expect(result.current.avatars).toHaveLength(1);
      expect(result.current.avatars[0].id).toBe(avatar1Id);
    });

    it('should set activeAvatarId to null when deleting last avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'Last Avatar' });
        avatarId = avatar.id;
      });

      await act(async () => {
        await result.current.deleteAvatar(avatarId);
      });

      expect(result.current.activeAvatarId).toBeNull();
    });

    it('should show toast notification on success', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatarId: string;

      await act(async () => {
        const avatar = await result.current.createAvatar({ name: 'To Delete' });
        avatarId = avatar.id;
      });

      await act(async () => {
        await result.current.deleteAvatar(avatarId);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Avatar Deleted',
        description: '"To Delete" has been deleted.',
      });
    });

    it('should throw error for non-existent avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await expect(
        act(() => result.current.deleteAvatar('non-existent-id'))
      ).rejects.toThrow('Avatar not found');
    });
  });

  describe('switchAvatar', () => {
    it('should switch to a different avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatar1Id: string;
      let avatar2Id: string;

      await act(async () => {
        const avatar1 = await result.current.createAvatar({ name: 'Avatar 1' });
        avatar1Id = avatar1.id;
        const avatar2 = await result.current.createAvatar({ name: 'Avatar 2' });
        avatar2Id = avatar2.id;
      });

      // Avatar 2 should be active (most recently created)
      expect(result.current.activeAvatarId).toBe(avatar2Id);

      // Switch to Avatar 1
      await act(() => {
        result.current.switchAvatar(avatar1Id);
      });

      await waitFor(() => {
        expect(result.current.activeAvatarId).toBe(avatar1Id);
      });

      expect(result.current.activeAvatar?.name).toBe('Avatar 1');
    });

    it('should update last_accessed_at when switching', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatar1Id: string;
      let avatar2Id: string;

      await act(async () => {
        const avatar1 = await result.current.createAvatar({ name: 'Avatar 1' });
        avatar1Id = avatar1.id;
        const avatar2 = await result.current.createAvatar({ name: 'Avatar 2' });
        avatar2Id = avatar2.id;
      });

      const originalLastAccessed =
        result.current.avatars.find((a) => a.id === avatar1Id)?.last_accessed_at;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Switch to Avatar 1
      await act(() => {
        result.current.switchAvatar(avatar1Id);
      });

      await waitFor(() => {
        const updatedLastAccessed =
          result.current.avatars.find((a) => a.id === avatar1Id)?.last_accessed_at;
        expect(updatedLastAccessed).toBeDefined();
        expect(updatedLastAccessed).not.toBe(originalLastAccessed);
      });
    });

    it('should show error for non-existent avatar', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      act(() => {
        result.current.switchAvatar('non-existent-id');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Avatar not found.',
        variant: 'destructive',
      });
    });
  });

  describe('refresh', () => {
    it('should reload avatars from localStorage', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      await act(async () => {
        await result.current.createAvatar({ name: 'Avatar 1' });
      });

      // Manually modify localStorage
      const storedAvatars = JSON.parse(
        localStorageMock['idea-brand-coach:avatars'] || '[]'
      );
      storedAvatars.push({
        id: 'external-avatar',
        name: 'External Avatar',
        completion_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      localStorageMock['idea-brand-coach:avatars'] = JSON.stringify(storedAvatars);

      act(() => {
        result.current.refresh();
      });

      expect(result.current.avatars).toHaveLength(2);
      expect(result.current.avatars.some((a) => a.id === 'external-avatar')).toBe(true);
    });

    it('should reset active avatar if it no longer exists', async () => {
      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      let avatar1Id: string;

      await act(async () => {
        const avatar1 = await result.current.createAvatar({ name: 'Avatar 1' });
        avatar1Id = avatar1.id;
        await result.current.createAvatar({ name: 'Avatar 2' });
      });

      // Switch to Avatar 1
      act(() => {
        result.current.switchAvatar(avatar1Id);
      });

      // Remove Avatar 1 from localStorage directly
      const storedAvatars = JSON.parse(
        localStorageMock['idea-brand-coach:avatars'] || '[]'
      ).filter((a: Avatar) => a.id !== avatar1Id);
      localStorageMock['idea-brand-coach:avatars'] = JSON.stringify(storedAvatars);

      act(() => {
        result.current.refresh();
      });

      // Should switch to another avatar
      expect(result.current.activeAvatarId).not.toBe(avatar1Id);
    });
  });

  describe('Avatar sorting', () => {
    it('should sort avatars by most recent first', async () => {
      const mockAvatars: Avatar[] = [
        {
          id: 'avatar-1',
          name: 'Oldest',
          completion_percentage: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'avatar-2',
          name: 'Newest',
          completion_percentage: 0,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
        },
        {
          id: 'avatar-3',
          name: 'Middle',
          completion_percentage: 0,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      localStorageMock['idea-brand-coach:avatars'] = JSON.stringify(mockAvatars);

      const { result } = renderHook(() => useAvatarTabs({ autoCreate: false }));

      expect(result.current.avatars[0].name).toBe('Newest');
      expect(result.current.avatars[1].name).toBe('Middle');
      expect(result.current.avatars[2].name).toBe('Oldest');
    });
  });
});
