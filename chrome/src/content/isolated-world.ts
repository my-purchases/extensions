/**
 * Isolated-world content script.
 * Runs in the extension's isolated context (world: "ISOLATED").
 * - Bridges window.postMessage from main-world to chrome.runtime.sendMessage
 * - Handles auto-collect: finds and clicks the pagination/"View orders" button
 * - Multi-provider aware: detects AliExpress vs Temu vs Allegro vs Amazon
 *   and uses appropriate selectors / strategies
 *
 * Amazon-specific behavior:
 *   - On page load, parses the live DOM for order data and sends to service worker
 *   - Auto-collect uses fetch() + DOMParser to iterate through years and pages
 *     without navigating away from the current page
 *   - Amazon uses "Siege CSD" (Client-Side Decryption) — order data in fetched HTML
 *     is encrypted. We append `disableCsd=missing-library` to fetch URLs so the
 *     server returns unencrypted, server-rendered HTML instead.
 */

import type { RuntimeMessage } from '@/shared/messages';
import { AMAZON_ORDER_PAGE_PATHS, AMAZON_ORDERS_PER_PAGE, AMAZON_DOMAINS } from '@/shared/constants';
import { parseAmazonOrdersHtml, extractTotalOrderCount, extractNextPageUrl } from '@/providers/amazon/parser';

const MSG_PREFIX = 'MPC_';
const LOG_PREFIX = '[MPC:isolated]';

// ─── Provider detection ─────────────────────────────────────

type Provider = 'aliexpress' | 'temu' | 'allegro-pl' | 'allegro-cz' | 'amazon' | 'unknown';

function detectProvider(): Provider {
  const hostname = window.location.hostname;
  if (hostname.includes('aliexpress.com')) return 'aliexpress';
  if (hostname.includes('temu.com')) return 'temu';
  if (hostname.includes('allegro.pl')) return 'allegro-pl';
  if (hostname.includes('allegro.cz')) return 'allegro-cz';
  if (AMAZON_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))) return 'amazon';
  return 'unknown';
}

const currentProvider = detectProvider();

// ─── Bridge: main-world → service-worker ────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.type !== MSG_PREFIX) return;

  try {
    if (data.action === 'ORDERS_CAPTURED') {
      const message: RuntimeMessage & { _rawApiResponse?: unknown; _providerId?: string } = {
        type: 'ORDERS_CAPTURED',
        orders: data.orders ?? [],
        _rawApiResponse: data._rawApiResponse,
      };
      // Forward the provider ID so service worker knows which parser to use
      (message as Record<string, unknown>)._providerId = data._providerId || currentProvider;
      chrome.runtime.sendMessage(message);
    } else if (data.action === 'COLLECTION_STATUS') {
      const message: RuntimeMessage = {
        type: 'COLLECTION_STATUS',
        status: data.status,
      };
      chrome.runtime.sendMessage(message);
    }
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to forward message:', err);
  }
});

// ─── Auto-collect: pagination automation ────────────────────

let autoCollectRunning = false;
let autoCollectPage = 0;

// ─── AliExpress selectors ───────────────────────────────────

const ALIEXPRESS_LOAD_MORE_SELECTORS = [
  '.order-more button',
  '.order-more .comet-btn',
  'div[data-pl="order_more"] button',
  '.comet-pagination-next:not(.comet-pagination-disabled)',
  '.comet-pagination-next:not(.comet-pagination-disabled) button',
];

const ALIEXPRESS_LOAD_MORE_TEXTS = ['View orders', 'Load more', 'Show more'];

// ─── Temu selectors (discovery — best guesses) ──────────────

const TEMU_LOAD_MORE_SELECTORS = [
  // Common pagination patterns on Temu
  '[class*="loadMore"]',
  '[class*="load-more"]',
  '[class*="LoadMore"]',
  '[class*="pagination"] button:last-child',
  '[class*="Pagination"] button:last-child',
  'button[class*="next"]',
  'button[class*="Next"]',
  'a[class*="next"]',
  'a[class*="Next"]',
  // Generic pagination
  '.pagination .next:not(.disabled)',
  '.pagination-next:not(.disabled)',
];

const TEMU_LOAD_MORE_TEXTS = ['Load more', 'Show more', 'View more', 'See more', 'Next', 'Next page'];

// ─── Allegro selectors ──────────────────────────────────────
// Allegro uses offset-based pagination with "Pokaż więcej" / "Zobrazit více" buttons
// or standard pagination links

const ALLEGRO_LOAD_MORE_SELECTORS = [
  // "Show more" button patterns
  '[data-role="load-more"]',
  '[data-testid="load-more"]',
  'button[class*="loadMore"]',
  'button[class*="load-more"]',
  // Pagination links
  '[data-role="pagination-next"]',
  '[data-testid="pagination-next"]',
  'a[class*="pagination"][class*="next"]',
  'button[class*="pagination"][class*="next"]',
  // Generic next page patterns
  'a[rel="next"]',
  'button[aria-label="next"]',
  'button[aria-label="następna"]',
  'button[aria-label="další"]',
];

const ALLEGRO_LOAD_MORE_TEXTS = ['Pokaż więcej', 'Zobrazit více', 'Show more', 'Load more', 'Następna', 'Další', 'Next'];

// ─── Provider-aware selectors ───────────────────────────────

function getLoadMoreSelectors(): string[] {
  if (currentProvider === 'temu') return TEMU_LOAD_MORE_SELECTORS;
  if (currentProvider === 'allegro-pl' || currentProvider === 'allegro-cz') return ALLEGRO_LOAD_MORE_SELECTORS;
  // Amazon uses fetch-based auto-collect, not button clicking
  return ALIEXPRESS_LOAD_MORE_SELECTORS;
}

function getLoadMoreTexts(): string[] {
  if (currentProvider === 'temu') return TEMU_LOAD_MORE_TEXTS;
  if (currentProvider === 'allegro-pl' || currentProvider === 'allegro-cz') return ALLEGRO_LOAD_MORE_TEXTS;
  return ALIEXPRESS_LOAD_MORE_TEXTS;
}

/**
 * Try to find the "View orders" / "Load more" / next-page button on the page.
 */
function findNextPageButton(): HTMLElement | null {
  const selectors = getLoadMoreSelectors();
  const texts = getLoadMoreTexts();

  // Strategy 1: Try known selectors
  for (const selector of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && isVisible(el) && !isDisabled(el)) {
        return el;
      }
    } catch {
      // Invalid selector — skip
    }
  }

  // Strategy 2: Text-based fallback — find any button/link with matching text
  const buttons = document.querySelectorAll<HTMLElement>('button, a[role="button"]');
  for (const btn of buttons) {
    const text = btn.textContent?.trim() || '';
    if (
      texts.some((t) => text.includes(t)) &&
      isVisible(btn) &&
      !isDisabled(btn)
    ) {
      return btn;
    }
  }

  return null;
}

function isVisible(el: HTMLElement): boolean {
  if (!el.offsetParent && el.style.position !== 'fixed') return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function isDisabled(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return true;
  if (el.getAttribute('aria-disabled') === 'true') return true;
  if (el.classList.contains('comet-pagination-disabled')) return true;
  if (el.classList.contains('disabled')) return true;
  const parent = el.closest('[class*="pagination"]');
  if (parent?.classList.contains('comet-pagination-disabled')) return true;
  return false;
}

/** Wait for new order data to appear after clicking (watch for intercepted API calls). */
function waitForDataLoad(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type === MSG_PREFIX && event.data?.action === 'ORDERS_CAPTURED') {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('message', onMessage);
          // Give a small extra delay for the DOM to settle
          setTimeout(() => resolve(true), 500);
        }
      }
    };

    window.addEventListener('message', onMessage);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('message', onMessage);
        resolve(false);
      }
    }, timeoutMs);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Standard auto-collect (AliExpress, Temu, Allegro) ──────

async function runAutoCollectStandard(): Promise<void> {
  while (autoCollectRunning) {
    autoCollectPage++;

    // Scroll to bottom so the button is visible
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await sleep(1000);

    const loadMoreBtn = findNextPageButton();
    if (!loadMoreBtn) {
      reportProgress(autoCollectPage - 1, true);
      break;
    }


    // Scroll the button into view and click
    loadMoreBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    loadMoreBtn.click();

    // Wait for new data to arrive via the API interception
    const loaded = await waitForDataLoad(8000);
    if (!loaded) {
      // Timeout — try to continue anyway
    }

    reportProgress(autoCollectPage, false);

    // Pause between clicks to be gentle on the server
    await sleep(2000);
  }
}

// ─── Amazon auto-collect (year iteration + fetch pagination) ─

/**
 * Amazon auto-collect strategy:
 * 1. Determine available years (current year down to oldest)
 * 2. For each year, fetch order pages via fetch() (same-origin, cookies included)
 * 3. Parse HTML with DOMParser, extract orders, send to service worker
 * 4. Paginate within each year using startIndex
 * 5. Stop when a year returns 0 orders
 *
 * This approach does NOT navigate away from the current page —
 * the user stays on the orders page while collection runs in the background.
 */

/** Minimum year to check for orders (stop iterating if empty before this) */
const AMAZON_MIN_YEAR = 2005;

/** Number of consecutive empty years before stopping */
const AMAZON_MAX_EMPTY_YEARS = 2;

function getAmazonBaseUrl(): string {
  return `${window.location.protocol}//${window.location.host}`;
}

function getAmazonDomainForParser(): string {
  const hostname = window.location.hostname;
  for (const domain of AMAZON_DOMAINS) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return domain;
    }
  }
  return hostname;
}

/**
 * Fetch an Amazon order page and return the HTML text.
 * Uses same-origin fetch with credentials so session cookies are included.
 *
 * IMPORTANT: We append `disableCsd=missing-library` to the URL.
 * Amazon uses "Siege Client-Side Decryption" (CSD) by default — order data
 * (IDs, titles, prices, dates) is delivered as encrypted base64 blobs inside
 * `<div class="csd-encrypted-sensitive">` elements. The `SiegeClientSideDecryption`
 * JS library decrypts them at runtime, but DOMParser doesn't execute JavaScript.
 * When the server sees `disableCsd`, it returns server-rendered, unencrypted HTML
 * that our parser can read directly.
 */
async function fetchAmazonPage(url: string): Promise<string> {
  const fetchUrl = new URL(url);
  fetchUrl.searchParams.set('disableCsd', 'missing-library');

  const response = await fetch(fetchUrl.toString(), {
    credentials: 'include',
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Parse Amazon HTML and extract order data, then send to service worker.
 * Parsing is done HERE in the content script because DOMParser is NOT
 * available in the Service Worker context. The parsed OrderItem[] are
 * sent directly — the service worker just merges them into storage.
 *
 * Returns the number of order items found on this page.
 */
function parseAndSendAmazonOrders(html: string, domain: string): number {
  const orders = parseAmazonOrdersHtml(html, domain);

  if (orders.length === 0) {
    console.log(LOG_PREFIX, 'Amazon: no orders parsed from HTML');
    return 0;
  }

  console.log(LOG_PREFIX, `Amazon: parsed ${orders.length} order items`);

  // Send pre-parsed orders to service worker (no raw HTML — SW can't use DOMParser)
  try {
    chrome.runtime.sendMessage({
      type: 'ORDERS_CAPTURED',
      orders,
      _providerId: 'amazon',
    } as RuntimeMessage & { _providerId?: string });
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to send Amazon orders:', err);
  }

  return orders.length;
}

/**
 * Extract total number of orders from Amazon page HTML.
 * Uses the parser's extractTotalOrderCount which handles .num-orders span.
 */
function extractAmazonTotalOrders(html: string): number {
  return extractTotalOrderCount(html);
}

/**
 * Check if there's a next page in Amazon pagination.
 * Uses the parser's extractNextPageUrl which checks .a-pagination .a-last.
 */
function amazonHasNextPage(html: string): boolean {
  return extractNextPageUrl(html) !== null;
}

async function runAutoCollectAmazon(): Promise<void> {
  const baseUrl = getAmazonBaseUrl();
  const domain = getAmazonDomainForParser();
  const currentYear = new Date().getFullYear();
  let consecutiveEmptyYears = 0;
  let totalPagesProcessed = 0;

  console.log(LOG_PREFIX, `Amazon auto-collect starting. Base URL: ${baseUrl}, Years: ${currentYear} → ${AMAZON_MIN_YEAR}`);

  // First, parse the current page (the one the user is looking at)
  const currentPageOrders = parseAndSendAmazonOrders(document.documentElement.outerHTML, domain);
  if (currentPageOrders > 0) {
    totalPagesProcessed++;
    reportProgress(totalPagesProcessed, false);
  }

  // Now iterate through years
  for (let year = currentYear; year >= AMAZON_MIN_YEAR && autoCollectRunning; year--) {
    console.log(LOG_PREFIX, `Amazon: collecting year ${year}...`);

    // Fetch first page for this year
    const firstPageUrl = `${baseUrl}/your-orders/orders?timeFilter=year-${year}&startIndex=0`;

    let html: string;
    try {
      html = await fetchAmazonPage(firstPageUrl);
    } catch (err) {
      console.error(LOG_PREFIX, `Amazon: failed to fetch year ${year}:`, err);
      // Continue to next year
      continue;
    }

    await sleep(500); // Small delay to avoid hammering

    const totalOrders = extractAmazonTotalOrders(html);
    const ordersOnPage = parseAndSendAmazonOrders(html, domain);

    if (ordersOnPage === 0 && totalOrders === 0) {
      consecutiveEmptyYears++;
      if (consecutiveEmptyYears >= AMAZON_MAX_EMPTY_YEARS) {
        console.log(LOG_PREFIX, `Amazon: ${AMAZON_MAX_EMPTY_YEARS} consecutive empty years, stopping.`);
        break;
      }
      continue;
    }

    consecutiveEmptyYears = 0;
    totalPagesProcessed++;
    reportProgress(totalPagesProcessed, false);

    // Paginate within this year
    if (totalOrders > AMAZON_ORDERS_PER_PAGE) {
      let startIndex = AMAZON_ORDERS_PER_PAGE;

      while (startIndex < totalOrders && autoCollectRunning) {
        const pageUrl = `${baseUrl}/your-orders/orders?timeFilter=year-${year}&startIndex=${startIndex}`;

        try {
          const pageHtml = await fetchAmazonPage(pageUrl);
          const pageOrders = parseAndSendAmazonOrders(pageHtml, domain);

          if (pageOrders === 0) break; // No more orders on this page

          totalPagesProcessed++;
          reportProgress(totalPagesProcessed, false);

          // Also check if there's actually a next page link
          if (!amazonHasNextPage(pageHtml)) break;
        } catch (err) {
          console.error(LOG_PREFIX, `Amazon: failed to fetch page startIndex=${startIndex}:`, err);
          break; // Stop pagination for this year on error
        }

        startIndex += AMAZON_ORDERS_PER_PAGE;

        // Pause between requests to be gentle
        await sleep(1500);
      }
    }

    // Pause between years
    await sleep(1000);
  }

  reportProgress(totalPagesProcessed, true);
  console.log(LOG_PREFIX, `Amazon auto-collect finished. Total pages processed: ${totalPagesProcessed}`);
}

// ─── Unified auto-collect entry point ───────────────────────

async function runAutoCollect(): Promise<void> {
  autoCollectRunning = true;
  autoCollectPage = 0;
  reportProgress(0, false);

  if (currentProvider === 'amazon') {
    await runAutoCollectAmazon();
  } else {
    await runAutoCollectStandard();
  }

  autoCollectRunning = false;
}

function stopAutoCollect(): void {
  autoCollectRunning = false;
}

function reportProgress(page: number, done: boolean, error?: string): void {
  try {
    chrome.runtime.sendMessage({
      type: 'AUTO_COLLECT_PROGRESS',
      page,
      totalOrders: 0, // Will be filled by service worker from storage
      done,
      error,
    } satisfies RuntimeMessage);
  } catch {
    // Extension context might be invalidated
  }
}

// ─── Amazon: auto-parse on page load ────────────────────────
// When the user navigates to an Amazon order page, automatically parse
// the visible orders and send them to the service worker.

if (currentProvider === 'amazon') {
  const isOrderPage = AMAZON_ORDER_PAGE_PATHS.some((p) =>
    window.location.pathname.startsWith(p),
  );

  if (isOrderPage) {
    const parseCurrentPage = () => {
      const domain = getAmazonDomainForParser();
      const html = document.documentElement.outerHTML;
      const count = parseAndSendAmazonOrders(html, domain);
      console.log(LOG_PREFIX, `Amazon: auto-parsed ${count} orders from current page.`);
    };

    // Wait for the page to fully load before parsing
    if (document.readyState === 'complete') {
      setTimeout(parseCurrentPage, 1000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(parseCurrentPage, 1000);
      });
    }
  }
}

// ─── Listen for messages from service-worker / popup ────────

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === 'START_AUTO_COLLECT') {
      if (autoCollectRunning) {
        sendResponse({ success: false, error: 'Already running' });
        return;
      }
      runAutoCollect().catch((err) => {
        console.error(LOG_PREFIX, 'Auto-collect error:', err);
        reportProgress(autoCollectPage, true, String(err));
      });
      sendResponse({ success: true });
    } else if (message.type === 'STOP_AUTO_COLLECT') {
      stopAutoCollect();
      sendResponse({ success: true });
    } else if (message.type === 'AUTO_COLLECT_STATUS') {
      sendResponse({
        success: true,
        autoCollect: {
          isRunning: autoCollectRunning,
          currentPage: autoCollectPage,
        },
      });
    }
  },
);
