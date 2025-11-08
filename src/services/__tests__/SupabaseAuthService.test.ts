import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseAuthService } from '../SupabaseAuthService';
import { supabase } from '@/integrations/supabase/client';

describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(() => {
    service = new SupabaseAuthService();
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString(),
      };

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: mockUser as any,
          session: null,
        },
        error: null,
      });

      const result = await service.signUp('test@example.com', 'password123', 'Test User');

      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'Test User',
          },
          emailRedirectTo: expect.stringContaining('/'),
        },
      });
    });

    it('should handle signup errors', async () => {
      const mockError = new Error('Email already exists');

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: null,
          session: null,
        },
        error: mockError as any,
      });

      const result = await service.signUp('test@example.com', 'password123');

      expect(result.user).toBeNull();
      expect(result.error).toBe(mockError);
    });
  });

  describe('signIn', () => {
    it('should sign in a user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockSession = {
        access_token: 'token-123',
        user: mockUser,
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockUser as any,
          session: mockSession as any,
        },
        error: null,
      });

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('should handle invalid credentials', async () => {
      const mockError = new Error('Invalid credentials');

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: null,
          session: null,
        },
        error: mockError as any,
      });

      const result = await service.signIn('wrong@example.com', 'wrongpassword');

      expect(result.user).toBeNull();
      expect(result.error).toBe(mockError);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      });

      const result = await service.signOut();

      expect(result.error).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      const result = await service.getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('should return null when no user', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await service.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await service.resetPassword('test@example.com');

      expect(result.error).toBeNull();
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth?mode=reset'),
        })
      );
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: { user: {} as any },
        error: null,
      });

      const result = await service.updatePassword('newpassword123');

      expect(result.error).toBeNull();
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });
  });
});
