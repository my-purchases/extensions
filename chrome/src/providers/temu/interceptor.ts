import { TEMU_API_PATTERNS, TEMU_DISCOVERY_PATTERNS } from '@/shared/constants';

const LOG_PREFIX = '[MPC:temu:interceptor]';

/**
 * Check if a URL matches known Temu order API patterns.
 * Primary endpoint: /api/bg/aristotle/user_order_list
 */
export function isTemuOrderApiUrl(url: string): boolean {
  try {
    const normalized = url.startsWith('//') ? 'https:' + url : url;
    const u = new URL(normalized);
    const hostname = u.hostname;
    if (!hostname.includes('temu.com')) return false;

    const full = u.pathname + u.search;
    return TEMU_API_PATTERNS.some((pattern) => full.includes(pattern));
  } catch {
    return TEMU_API_PATTERNS.some((pattern) => url.includes(pattern));
  }
}

/**
 * Check if a URL matches Temu discovery patterns (broad matching for logging).
 */
export function isTemuDiscoveryUrl(url: string): boolean {
  try {
    const normalized = url.startsWith('//') ? 'https:' + url : url;
    return TEMU_DISCOVERY_PATTERNS.some((pattern) => normalized.includes(pattern));
  } catch {
    return false;
  }
}

/**
 * Check if a response body is a Temu order list response.
 * Looks for the `view_orders` array which is the confirmed response format
 * from the `user_order_list` endpoint.
 */
export function looksLikeTemuOrderResponse(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const obj = body as Record<string, unknown>;

  // Primary: view_orders array (confirmed format)
  if (Array.isArray(obj.view_orders)) {
    return true;
  }

  // Nested: some responses wrap in result/data
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && Array.isArray(data.view_orders)) {
    return true;
  }

  const result = obj.result as Record<string, unknown> | undefined;
  if (result && typeof result === 'object' && Array.isArray(result.view_orders)) {
    return true;
  }

  return false;
}

/**
 * Log a discovery API response with full details for analysis.
 */
export function logDiscoveryResponse(url: string, body: unknown, source: string): void {
  const separator = '='.repeat(80);

  console.log(
    `\n${separator}\n` +
    `${LOG_PREFIX} DISCOVERY: API response captured\n` +
    `  Source: ${source}\n` +
    `  URL: ${url}\n` +
    `  Timestamp: ${new Date().toISOString()}\n` +
    `${separator}`,
  );

  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const topKeys = Object.keys(obj);
    console.log(LOG_PREFIX, 'Top-level keys:', topKeys);

    for (const key of topKeys) {
      const val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        console.log(LOG_PREFIX, `  ${key} keys:`, Object.keys(val as object));
      } else if (Array.isArray(val)) {
        console.log(LOG_PREFIX, `  ${key}: Array[${val.length}]`);
        if (val.length > 0 && typeof val[0] === 'object') {
          console.log(LOG_PREFIX, `  ${key}[0] keys:`, Object.keys(val[0] as object));
        }
      } else {
        console.log(LOG_PREFIX, `  ${key}:`, typeof val, '=', String(val).slice(0, 100));
      }
    }

    if (looksLikeTemuOrderResponse(body)) {
      const viewOrders = (obj.view_orders as unknown[]) || [];
      console.log(
        `\n${LOG_PREFIX} *** TEMU ORDER DATA DETECTED (${viewOrders.length} orders) ***`,
      );
    }
  }
}
