/**
 * Isolated-world content script.
 * Runs in the extension's isolated context (world: "ISOLATED").
 * - Bridges window.postMessage from main-world to chrome.runtime.sendMessage
 * - Handles auto-collect: finds and clicks the pagination/"View orders" button
 */

import type { RuntimeMessage } from '@/shared/messages';

const MSG_PREFIX = 'MPC_';
const LOG_PREFIX = '[MPC:isolated]';

// ─── Bridge: main-world → service-worker ────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.type !== MSG_PREFIX) return;

  console.debug(LOG_PREFIX, 'Received from main-world:', data.action);

  try {
    if (data.action === 'ORDERS_CAPTURED') {
      const message: RuntimeMessage & { _rawApiResponse?: unknown } = {
        type: 'ORDERS_CAPTURED',
        orders: data.orders ?? [],
        _rawApiResponse: data._rawApiResponse,
      };
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

/**
 * Known selectors for the "View orders" / "Load more" / pagination button
 * on AliExpress order list page. Ordered by specificity — most reliable first.
 */
const LOAD_MORE_SELECTORS = [
  // Primary: the exact "View orders" button inside div.order-more
  '.order-more button',
  '.order-more .comet-btn',
  'div[data-pl="order_more"] button',
  // Comet pagination (if they switch to paginated view)
  '.comet-pagination-next:not(.comet-pagination-disabled)',
  '.comet-pagination-next:not(.comet-pagination-disabled) button',
];

/**
 * Try to find the "View orders" / "Load more" / next-page button on the page.
 */
function findNextPageButton(): HTMLElement | null {
  // Strategy 1: Try known selectors
  for (const selector of LOAD_MORE_SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el && isVisible(el) && !isDisabled(el)) {
        console.log(LOG_PREFIX, 'Found "load more" button via selector:', selector);
        return el;
      }
    } catch {
      // Invalid selector — skip
    }
  }

  // Strategy 2: Text-based fallback — find any button containing "View orders"
  const buttons = document.querySelectorAll<HTMLElement>('button');
  for (const btn of buttons) {
    const text = btn.textContent?.trim() || '';
    if (
      (text.includes('View orders') || text.includes('Load more') || text.includes('Show more')) &&
      isVisible(btn) &&
      !isDisabled(btn)
    ) {
      console.log(LOG_PREFIX, 'Found "load more" button via text search:', text);
      return btn;
    }
  }

  console.log(LOG_PREFIX, 'No "load more" button found — all orders loaded');
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

async function runAutoCollect(): Promise<void> {
  autoCollectRunning = true;
  autoCollectPage = 0;

  console.log(LOG_PREFIX, 'Auto-collect started');
  reportProgress(0, false);

  while (autoCollectRunning) {
    autoCollectPage++;
    console.log(LOG_PREFIX, `Auto-collect: batch ${autoCollectPage} — looking for "View orders" button...`);

    // Scroll to bottom so the "View orders" button is visible
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await sleep(1000);

    const loadMoreBtn = findNextPageButton();
    if (!loadMoreBtn) {
      console.log(LOG_PREFIX, 'Auto-collect: no more "View orders" button — all orders loaded');
      reportProgress(autoCollectPage - 1, true);
      break;
    }

    console.log(LOG_PREFIX, `Auto-collect: clicking "View orders" (batch ${autoCollectPage})...`);

    // Scroll the button into view and click
    loadMoreBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    loadMoreBtn.click();

    // Wait for new data to arrive via the API interception
    const loaded = await waitForDataLoad(8000);
    if (loaded) {
      console.log(LOG_PREFIX, `Auto-collect: batch ${autoCollectPage} data received`);
    } else {
      console.log(LOG_PREFIX, `Auto-collect: batch ${autoCollectPage} timeout, trying to continue...`);
    }

    reportProgress(autoCollectPage, false);

    // Pause between clicks to be gentle on the server
    await sleep(2000);
  }

  autoCollectRunning = false;
  console.log(LOG_PREFIX, `Auto-collect finished. Batches: ${autoCollectPage}`);
}

function stopAutoCollect(): void {
  console.log(LOG_PREFIX, 'Auto-collect stopped by user');
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

console.debug(LOG_PREFIX, 'Bridge + auto-collect active, listening for messages');
