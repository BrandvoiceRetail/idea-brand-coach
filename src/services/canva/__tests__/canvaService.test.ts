import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import {
  canvaService,
  CanvaServiceError,
  startConnect,
  getStatus,
  disconnect,
  listDesigns,
  listImports,
  addImport,
  removeImport,
} from '../canvaService';
import type { CanvaDesign, ImportedDesign } from '../types';

// The global test setup (src/test/setup.ts) mocks '@/integrations/supabase/client'
// with `functions.invoke` as a vi.fn(); we drive it per-test here.
const invokeMock = vi.mocked(supabase.functions.invoke);

/** Resolve `invoke` with a data payload (no error). */
function resolveData(data: unknown): void {
  invokeMock.mockResolvedValue({ data, error: null } as never);
}

describe('canvaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startConnect', () => {
    it('calls canva-oauth-start with the returnPath and maps { url }', async () => {
      resolveData({ url: 'https://www.canva.com/api/oauth/authorize?state=x' });

      const res = await startConnect('/v1/integrations');

      expect(invokeMock).toHaveBeenCalledWith('canva-oauth-start', {
        body: { returnPath: '/v1/integrations' },
      });
      expect(res.url).toBe('https://www.canva.com/api/oauth/authorize?state=x');
    });

    it('passes undefined returnPath through when omitted', async () => {
      resolveData({ url: 'https://canva/authorize' });
      await startConnect();
      expect(invokeMock).toHaveBeenCalledWith('canva-oauth-start', {
        body: { returnPath: undefined },
      });
    });
  });

  describe('getStatus', () => {
    it('calls canva-status with no body and returns the status', async () => {
      resolveData({ connected: true, displayName: 'Ada', scopes: 'profile:read design:meta:read' });

      const status = await getStatus();

      expect(invokeMock).toHaveBeenCalledWith('canva-status', { body: undefined });
      expect(status.connected).toBe(true);
      expect(status.displayName).toBe('Ada');
    });
  });

  describe('disconnect', () => {
    it('calls canva-disconnect and returns the result', async () => {
      resolveData({ disconnected: true });
      const res = await disconnect();
      expect(invokeMock).toHaveBeenCalledWith('canva-disconnect', { body: undefined });
      expect(res.disconnected).toBe(true);
    });
  });

  describe('listDesigns', () => {
    it('calls canva-list-designs with continuation and maps designs + continuation', async () => {
      const designs: CanvaDesign[] = [
        { id: 'd1', title: 'Poster', thumbnailUrl: 'https://t/1', editUrl: 'https://e/1', viewUrl: 'https://v/1', updatedAt: '2026-06-01' },
      ];
      resolveData({ designs, continuation: 'cursor-2' });

      const res = await listDesigns('cursor-1');

      expect(invokeMock).toHaveBeenCalledWith('canva-list-designs', {
        body: { continuation: 'cursor-1' },
      });
      expect(res.designs).toEqual(designs);
      expect(res.continuation).toBe('cursor-2');
    });
  });

  describe('listImports', () => {
    it("calls canva-imports with action 'list' and returns the designs array", async () => {
      const designs: ImportedDesign[] = [
        {
          id: 'i1', canvaDesignId: 'd1', title: 'Poster',
          thumbnailUrl: null, editUrl: null, viewUrl: null, importedAt: '2026-06-10',
        },
      ];
      resolveData({ designs });

      const res = await listImports();

      expect(invokeMock).toHaveBeenCalledWith('canva-imports', { body: { action: 'list' } });
      expect(res).toEqual(designs);
    });
  });

  describe('addImport', () => {
    it("calls canva-imports with action 'add' + design and returns the imported design", async () => {
      const imported: ImportedDesign = {
        id: 'i1', canvaDesignId: 'd1', title: 'Poster',
        thumbnailUrl: 'https://t/1', editUrl: 'https://e/1', viewUrl: 'https://v/1', importedAt: '2026-06-10',
      };
      resolveData({ design: imported });

      const res = await addImport({
        id: 'd1', title: 'Poster', thumbnailUrl: 'https://t/1', editUrl: 'https://e/1', viewUrl: 'https://v/1',
      });

      expect(invokeMock).toHaveBeenCalledWith('canva-imports', {
        body: {
          action: 'add',
          design: { id: 'd1', title: 'Poster', thumbnailUrl: 'https://t/1', editUrl: 'https://e/1', viewUrl: 'https://v/1' },
        },
      });
      expect(res).toEqual(imported);
    });
  });

  describe('removeImport', () => {
    it("calls canva-imports with action 'remove' + designId", async () => {
      resolveData({ removed: true });
      const res = await removeImport('d1');
      expect(invokeMock).toHaveBeenCalledWith('canva-imports', {
        body: { action: 'remove', designId: 'd1' },
      });
      expect(res.removed).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws CanvaServiceError when invoke returns a transport error', async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      } as never);

      await expect(getStatus()).rejects.toBeInstanceOf(CanvaServiceError);
    });

    it('surfaces the function error slug as the error code', async () => {
      invokeMock.mockResolvedValue({
        data: { error: 'not_connected' },
        error: { message: 'Edge Function returned a non-2xx status code' },
      } as never);

      await expect(listDesigns()).rejects.toMatchObject({
        name: 'CanvaServiceError',
        code: 'not_connected',
      });
    });

    it('treats a 200 body that still carries an error slug as a failure', async () => {
      resolveData({ error: 'origin_not_allowed' });
      await expect(startConnect()).rejects.toMatchObject({ code: 'origin_not_allowed' });
    });

    it('throws when invoke returns null data without an error', async () => {
      invokeMock.mockResolvedValue({ data: null, error: null } as never);
      await expect(getStatus()).rejects.toBeInstanceOf(CanvaServiceError);
    });
  });

  describe('aggregate export', () => {
    it('exposes every method on the canvaService object', () => {
      expect(Object.keys(canvaService).sort()).toEqual(
        ['addImport', 'disconnect', 'getStatus', 'listDesigns', 'listImports', 'removeImport', 'startConnect'].sort(),
      );
    });
  });
});
