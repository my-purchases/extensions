/**
 * Amazon order URL matching and domain utilities.
 *
 * Amazon has 21+ marketplace domains that all share the same
 * order history URL structure:
 *   - /gp/css/order-history
 *   - /your-orders/orders?timeFilter=year-YYYY&startIndex=N
 *
 * Unlike other providers, Amazon does NOT expose a JSON API for order data.
 * All order pages return server-rendered HTML. The "interception" for Amazon
 * is therefore DOM-based: the content script parses the rendered page or
 * fetches HTML pages and parses them with DOMParser.
 */

import { AMAZON_DOMAINS, AMAZON_ORDER_PAGE_PATHS } from '@/shared/constants';

// ─── Domain detection ───────────────────────────────────────

/**
 * Check if a hostname belongs to an Amazon marketplace.
 * Handles subdomains like www.amazon.de, smile.amazon.com, etc.
 */
export function isAmazonHost(hostname: string): boolean {
  return AMAZON_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith('.' + domain),
  );
}

/**
 * Extract the Amazon marketplace domain from a hostname.
 * e.g. "www.amazon.de" → "amazon.de", "amazon.co.uk" → "amazon.co.uk"
 */
export function getAmazonDomain(hostname: string): string | null {
  for (const domain of AMAZON_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return domain;
    }
  }
  return null;
}

// ─── URL matching ───────────────────────────────────────────

/**
 * Check if the current page is an Amazon order history page.
 */
export function isAmazonOrderPage(pathname: string): boolean {
  return AMAZON_ORDER_PAGE_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Build the Amazon order history URL for a specific year and page.
 * @param baseUrl  The origin, e.g. "https://www.amazon.de"
 * @param year     The year filter, e.g. 2025
 * @param startIndex  Pagination offset (0, 10, 20, ...)
 */
export function buildAmazonOrderUrl(baseUrl: string, year: number, startIndex = 0): string {
  return `${baseUrl}/your-orders/orders?timeFilter=year-${year}&startIndex=${startIndex}`;
}

/**
 * Check if a URL is an Amazon order-related URL.
 * Used by main-world.ts for URL matching (minimal — Amazon doesn't have JSON API endpoints).
 */
export function isAmazonOrderApiUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url);
    if (!isAmazonHost(u.hostname)) return false;
    return isAmazonOrderPage(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Amazon doesn't return JSON from order pages, so this always returns false.
 * Included for API consistency with other providers.
 */
export function looksLikeAmazonOrderResponse(_body: unknown): boolean {
  // Amazon uses HTML, not JSON. Order data is parsed from the DOM.
  // This check is only relevant for JSON-based providers.
  return false;
}
