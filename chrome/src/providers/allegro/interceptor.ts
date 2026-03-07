import { ALLEGRO_API_PATTERNS } from '@/shared/constants';

/**
 * Check if a URL matches known Allegro order API patterns.
 * Primary endpoint: edge.allegro.{pl|cz}/myorder-api/myorders
 */
export function isAllegroOrderApiUrl(url: string): boolean {
  try {
    const normalized = url.startsWith('//') ? 'https:' + url : url;
    const u = new URL(normalized);
    const hostname = u.hostname;
    if (!hostname.includes('allegro.pl') && !hostname.includes('allegro.cz')) return false;

    const full = u.pathname + u.search;
    return ALLEGRO_API_PATTERNS.some((pattern) => full.includes(pattern));
  } catch {
    return ALLEGRO_API_PATTERNS.some((pattern) => url.includes(pattern));
  }
}

/**
 * Check if a response body looks like an Allegro order list response.
 * Looks for the `orderGroups` array which is the confirmed response format
 * from the `myorders` endpoint.
 */
export function looksLikeAllegroOrderResponse(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const obj = body as Record<string, unknown>;

  // Primary: orderGroups array at top level
  if (Array.isArray(obj.orderGroups)) {
    return true;
  }

  return false;
}
