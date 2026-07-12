/**
 * generatedImagesService — lists the signed-in user's coach-generated images.
 *
 * WHAT: reads the private `brand-assets` bucket under `{userId}/coach/generated/**`
 * (where the `gemini-image-generate` edge fn / `generate_listing_image` MCP tool
 * persist their output) and returns short-lived signed display URLs, newest first.
 *
 * WHY: the connector coach can generate listing images, but they only lived in the
 * chat. This surfaces them in the app so they're not lost. The per-user storage RLS
 * (`brand-assets read own`: foldername[1] = auth.uid()) means the AUTHED CLIENT can
 * list + sign its OWN objects directly — no service-role edge fn needed.
 *
 * NO FABRICATION: returns only objects that actually exist in the bucket; an empty
 * gallery is an honest empty, never a placeholder image.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'brand-assets';
const SIGNED_TTL_SECONDS = 3600;
/** Bound the per-call work: scan at most this many recent generation folders. */
const MAX_FOLDERS = 60;

export interface GeneratedImage {
  /** Full storage path, stable id for the item. */
  path: string;
  /** Short-lived signed display URL (null if signing failed). */
  signedUrl: string | null;
  /** ISO timestamp the object was created, when storage reports it. */
  createdAt: string | null;
}

export type GeneratedImagesResult =
  | { status: 'ok'; images: GeneratedImage[] }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string };

/**
 * List the caller's generated images (newest first). Two-level scan: the path layout
 * is `{uid}/coach/generated/{jobFolder}/{n}.{ext}`, so we list the generation folders,
 * then the files inside each, then batch-sign. `client` is injectable for tests.
 */
export async function listGeneratedImages(
  client: SupabaseClient = supabase,
): Promise<GeneratedImagesResult> {
  try {
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { status: 'unauthenticated' };

    const root = `${userId}/coach/generated`;
    const { data: folders, error: folderErr } = await client.storage
      .from(BUCKET)
      .list(root, { limit: MAX_FOLDERS, sortBy: { column: 'created_at', order: 'desc' } });
    if (folderErr) return { status: 'error', message: folderErr.message };
    if (!folders || folders.length === 0) return { status: 'ok', images: [] };

    // Storage marks folders with a null id; keep those, scan each for files.
    const folderNames = folders.filter((e) => e.id === null && e.name).map((e) => e.name);
    const collected: GeneratedImage[] = [];
    for (const folder of folderNames) {
      const prefix = `${root}/${folder}`;
      const { data: files } = await client.storage.from(BUCKET).list(prefix, { limit: 20 });
      for (const f of files ?? []) {
        if (!f.id || !f.name) continue; // skip nested folders / placeholders
        collected.push({
          path: `${prefix}/${f.name}`,
          signedUrl: null,
          createdAt: (f.created_at as string | undefined) ?? null,
        });
      }
    }
    if (collected.length === 0) return { status: 'ok', images: [] };

    // Newest first (fall back to path order when storage omits created_at).
    collected.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.path.localeCompare(a.path));

    // Batch-sign in one call.
    const { data: signed, error: signErr } = await client.storage
      .from(BUCKET)
      .createSignedUrls(collected.map((c) => c.path), SIGNED_TTL_SECONDS);
    if (signErr) return { status: 'error', message: signErr.message };
    const byPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl]));
    return {
      status: 'ok',
      images: collected.map((c) => ({ ...c, signedUrl: byPath.get(c.path) ?? null })),
    };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Could not load generated images' };
  }
}
