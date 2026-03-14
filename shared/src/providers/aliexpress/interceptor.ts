import { ALIEXPRESS_API_PATTERNS, BIZPLUGIN_ORDER_KEY_PREFIX } from '../../constants';

/**
 * Check if a URL matches known AliExpress order API patterns.
 */
export function isOrderApiUrl(url: string): boolean {
  try {
    // Handle protocol-relative URLs
    const normalized = url.startsWith('//') ? 'https:' + url : url;
    const u = new URL(normalized);
    const hostname = u.hostname;
    if (!hostname.includes('aliexpress.com')) return false;

    const full = u.pathname + u.search;
    return ALIEXPRESS_API_PATTERNS.some((pattern) => full.includes(pattern));
  } catch {
    // If URL parsing fails, do a simple string match
    return ALIEXPRESS_API_PATTERNS.some((pattern) => url.includes(pattern));
  }
}

/**
 * Heuristic: check if a response body looks like an order list response.
 * Handles both classic API format and BizPlugin/droplet format.
 */
export function looksLikeOrderResponse(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const obj = body as Record<string, unknown>;

  // BizPlugin/droplet format: data has pc_om_list_order_* keys
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.some((k) => k.startsWith(BIZPLUGIN_ORDER_KEY_PREFIX))) return true;

    // Classic API formats
    if (Array.isArray(data.orderList)) return true;
    if (Array.isArray(data.list)) return true;
    if (Array.isArray(data.orders)) return true;

    // Nested data wrapper
    const nested = data.data as Record<string, unknown> | undefined;
    if (nested && typeof nested === 'object') {
      const nestedKeys = Object.keys(nested);
      if (nestedKeys.some((k) => k.startsWith(BIZPLUGIN_ORDER_KEY_PREFIX))) return true;
    }
  }

  // Result wrapper (classic)
  const result = obj.result as Record<string, unknown> | undefined;
  if (result && typeof result === 'object') {
    if (Array.isArray(result.orderList)) return true;
    if (Array.isArray(result.resultList)) return true;
  }

  // Top-level BizPlugin keys
  const topKeys = Object.keys(obj);
  if (topKeys.some((k) => k.startsWith(BIZPLUGIN_ORDER_KEY_PREFIX))) return true;

  return false;
}
