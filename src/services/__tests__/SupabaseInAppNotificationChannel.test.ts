import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseInAppNotificationChannel } from '../SupabaseInAppNotificationChannel';
import { supabase } from '@/integrations/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

const alertRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'alert-1',
  avatar_id: 'a-1',
  category: 'listing-integrity',
  threatened_dimension: 'distinctive',
  severity: 'high',
  title: 'Listing changed',
  interpretation: 'Threatens your Distinctive pillar.',
  source_payload: { source: 'titan-stub', coverage: 'unverified' },
  drafted_response: { status: 'pending-generation' },
  ledger_request_id: null,
  read_at: null,
  created_at: '2026-06-18T00:00:00Z',
  ...overrides,
});

describe('SupabaseInAppNotificationChannel', () => {
  let channel: SupabaseInAppNotificationChannel;

  beforeEach(() => {
    channel = new SupabaseInAppNotificationChannel();
    vi.clearAllMocks();
  });

  it('is the in-app channel', () => {
    expect(channel.channel).toBe('in-app');
  });

  describe('listAlerts', () => {
    it('maps rows to the domain type, newest first', async () => {
      const order = vi.fn().mockResolvedValue({ data: [alertRow(), alertRow({ id: 'alert-2', read_at: 't' })], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await channel.listAlerts('a-1');

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data![0].id).toBe('alert-1');
      expect(data![0].threatened_dimension).toBe('distinctive');
      expect(data![0].source_payload.coverage).toBe('unverified');
      expect(eq).toHaveBeenCalledWith('avatar_id', 'a-1');
      expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns an error result (never throws) on a query error', async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
      vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }) } as any);

      const { data, error } = await channel.listAlerts('a-1');
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });
  });

  describe('getUnreadCount', () => {
    it('counts unread alerts via head + is(read_at, null)', async () => {
      const is = vi.fn().mockResolvedValue({ count: 3, error: null });
      const eq = vi.fn().mockReturnValue({ is });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await channel.getUnreadCount('a-1');

      expect(error).toBeNull();
      expect(data).toBe(3);
      expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(is).toHaveBeenCalledWith('read_at', null);
    });

    it('returns 0 when count is null', async () => {
      const is = vi.fn().mockResolvedValue({ count: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is }) }) } as any);

      const { data } = await channel.getUnreadCount('a-1');
      expect(data).toBe(0);
    });
  });

  describe('markRead', () => {
    it('stamps read_at and returns true', async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ update } as any);

      const { data, error } = await channel.markRead('alert-1');

      expect(error).toBeNull();
      expect(data).toBe(true);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
      expect(eq).toHaveBeenCalledWith('id', 'alert-1');
    });

    it('returns an error result (never throws) on failure', async () => {
      const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
      vi.mocked(supabase.from).mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) } as any);

      const { data, error } = await channel.markRead('alert-1');
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });
  });
});
