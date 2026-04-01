import { FETCH_TIMEOUT_MS } from './config.ts';

// ============================================================================
// RETRY & DELAY UTILITIES
// ============================================================================

export const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  label: string = 'fetch'
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) return response;

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const backoffMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(2000 * Math.pow(2, attempt), 30000);
        console.warn(`[${label}] ${response.status} on attempt ${attempt + 1}, retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 30000);
        console.warn(`[${label}] Error on attempt ${attempt + 1}: ${error.message}, retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`[${label}] All ${maxRetries + 1} attempts failed`);
}
