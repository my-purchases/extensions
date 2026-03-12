/**
 * Main-world content script.
 * Runs in the page's JavaScript context (world: "MAIN").
 * Monkey-patches fetch() and XMLHttpRequest to intercept order API responses.
 * Sends captured data to the isolated-world script via window.postMessage().
 *
 * Multi-provider support:
 *   - Detects the current site (AliExpress, Temu, Allegro, Amazon) from window.location.hostname
 *   - Uses provider-specific URL patterns and data detection
 *
 * Amazon note:
 *   - Amazon does NOT expose JSON APIs for order data — all pages return HTML.
 *   - The main-world script on Amazon only handles provider detection and status notification.
 *   - Actual order data extraction happens in isolated-world.ts via DOM parsing.
 *
 * AliExpress findings:
 *   - API endpoint: acs.aliexpress.com/h5/mtop.aliexpress.trade.buyer.order.list
 *   - Transport: batman.js with dataType 'originaljsonp' (but uses XHR under the hood)
 *   - Response format: BizPlugin/droplet with pc_om_list_order_* keys
 */

const MSG_PREFIX = 'MPC_';
const LOG_PREFIX = '[MPC:main]';

// ─── Provider detection ─────────────────────────────────────

type Provider = 'aliexpress' | 'temu' | 'allegro-pl' | 'allegro-cz' | 'amazon' | 'unknown';

function detectProvider(): Provider {
  const hostname = window.location.hostname;
  if (hostname.includes('aliexpress.com')) return 'aliexpress';
  if (hostname.includes('temu.com')) return 'temu';
  if (hostname.includes('allegro.pl')) return 'allegro-pl';
  if (hostname.includes('allegro.cz')) return 'allegro-cz';
  if (hostname.includes('amazon.')) return 'amazon';
  return 'unknown';
}

const currentProvider = detectProvider();

// ─── AliExpress URL matching ────────────────────────────────

const ALIEXPRESS_API_PATTERNS = [
  'mtop.aliexpress.trade.buyer.order',
  'mtop.aliexpress.order',
  'acs.aliexpress.com',
  '/api/order/',
  '/api/my_order/',
  '/fn/buyer/order/',
  '/buyer/order/list',
  '/order/list/render',
];

function isAliExpressOrderApiUrl(url: string): boolean {
  if (!url) return false;
  const normalized = url.startsWith('//') ? 'https:' + url : url;
  return ALIEXPRESS_API_PATTERNS.some((pattern) => normalized.includes(pattern));
}

// ─── Temu URL matching ──────────────────────────────────────
// Real endpoint: POST /pl/api/bg/aristotle/user_order_list
// Locale prefix varies (/pl/, /de/, /en/, etc.)

const TEMU_API_PATTERNS = [
  'api/bg/aristotle/user_order_list',
  'api/bg/aristotle/order',
];

function isTemuOrderApiUrl(url: string): boolean {
  if (!url) return false;
  const normalized = url.startsWith('//') ? 'https:' + url : url;
  return TEMU_API_PATTERNS.some((pattern) => normalized.includes(pattern));
}

// ─── Unified URL check ──────────────────────────────────────

// ─── Allegro URL matching ───────────────────────────────────
// Real endpoint: GET edge.allegro.{pl|cz}/myorder-api/myorders
// API is on edge.allegro.* subdomain but we intercept fetch from allegro.* pages

const ALLEGRO_API_PATTERNS = [
  'myorder-api/myorders',
  'myorder-api/myorder/',
];

function isAllegroOrderApiUrl(url: string): boolean {
  if (!url) return false;
  const normalized = url.startsWith('//') ? 'https:' + url : url;
  try {
    const u = new URL(normalized);
    if (!u.hostname.includes('allegro.pl') && !u.hostname.includes('allegro.cz')) return false;
    const full = u.pathname + u.search;
    return ALLEGRO_API_PATTERNS.some((pattern) => full.includes(pattern));
  } catch {
    return ALLEGRO_API_PATTERNS.some((pattern) => normalized.includes(pattern));
  }
}

// ─── Unified URL check (all providers) ──────────────────────

/**
 * Check if a URL is an order API URL for the current provider.
 */
function checkUrl(url: string): boolean {
  if (currentProvider === 'aliexpress') return isAliExpressOrderApiUrl(url);
  if (currentProvider === 'temu') return isTemuOrderApiUrl(url);
  if (currentProvider === 'allegro-pl' || currentProvider === 'allegro-cz') return isAllegroOrderApiUrl(url);
  // Amazon does not use JSON APIs — order data is extracted from HTML DOM.
  // No URL interception is needed.
  return false;
}

// ─── AliExpress data detection ──────────────────────────────

const ORDER_KEY_PREFIX = 'pc_om_list_order_';

function containsAliExpressOrderData(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;

  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.some((k) => k.startsWith(ORDER_KEY_PREFIX))) return true;
    if (Array.isArray(data.orderList)) return true;
    if (Array.isArray(data.list)) return true;
    if (Array.isArray(data.orders)) return true;

    const nested = data.data as Record<string, unknown> | undefined;
    if (nested && typeof nested === 'object') {
      const nestedKeys = Object.keys(nested);
      if (nestedKeys.some((k) => k.startsWith(ORDER_KEY_PREFIX))) return true;
    }
  }

  const result = obj.result as Record<string, unknown> | undefined;
  if (result && typeof result === 'object') {
    if (Array.isArray(result.orderList)) return true;
    if (Array.isArray(result.resultList)) return true;
  }

  const topKeys = Object.keys(obj);
  if (topKeys.some((k) => k.startsWith(ORDER_KEY_PREFIX))) return true;

  return false;
}

// ─── Temu data detection ────────────────────────────────────
// Checks for the `view_orders` array — the confirmed response format
// from the `user_order_list` endpoint.

function containsTemuOrderData(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const obj = body as Record<string, unknown>;

  // Primary: view_orders array at top level
  if (Array.isArray(obj.view_orders)) return true;

  // Nested: some responses wrap in result/data
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && Array.isArray(data.view_orders)) return true;

  const result = obj.result as Record<string, unknown> | undefined;
  if (result && typeof result === 'object' && Array.isArray(result.view_orders)) return true;

  return false;
}

// ─── Allegro data detection ─────────────────────────────────
// Checks for the `orderGroups` array — the confirmed response format
// from the `myorders` endpoint.

function containsAllegroOrderData(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const obj = body as Record<string, unknown>;

  // Primary: orderGroups array at top level
  if (Array.isArray(obj.orderGroups)) return true;

  return false;
}

// ─── Unified data check & post ──────────────────────────────

function containsOrderData(body: unknown): boolean {
  if (currentProvider === 'aliexpress') return containsAliExpressOrderData(body);
  if (currentProvider === 'temu') return containsTemuOrderData(body);
  if (currentProvider === 'allegro-pl' || currentProvider === 'allegro-cz') return containsAllegroOrderData(body);
  return false;
}

function postOrderData(jsonBody: unknown, source: string): void {
  if (!containsOrderData(jsonBody)) {
    return;
  }

  window.postMessage(
    {
      type: MSG_PREFIX,
      action: 'ORDERS_CAPTURED',
      orders: [],
      _rawApiResponse: jsonBody,
      _providerId: currentProvider,
    },
    '*',
  );
}

/**
 * Process an intercepted response — detect order data and forward it.
 */
function processInterceptedResponse(url: string, body: unknown, source: string): void {
  const match = checkUrl(url);
  if (!match) return;

  if (containsOrderData(body)) {
    postOrderData(body, source);
  }
}

// ─── Response parsing ───────────────────────────────────────

function tryParseResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Not plain JSON
  }

  // JSONP: callbackName({...})
  const jsonpMatch = text.match(/^\s*\w+\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
  if (jsonpMatch) {
    try {
      return JSON.parse(jsonpMatch[1]);
    } catch {
      // Not parseable JSONP
    }
  }

  // mtopjsonp format: mtopjsonpN({...})
  const mtopMatch = text.match(/mtopjsonp\d*\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
  if (mtopMatch) {
    try {
      return JSON.parse(mtopMatch[1]);
    } catch {
      // Not parseable mtopjsonp
    }
  }

  return null;
}

// ─── Patch fetch() ──────────────────────────────────────────

const originalFetch = window.fetch;

window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await originalFetch.call(this, input, init);

  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = checkUrl(url);

    if (match) {
      const clone = response.clone();
      clone.text().then((text) => {
        const parsed = tryParseResponse(text);
        if (parsed) processInterceptedResponse(url, parsed, 'fetch');
      }).catch(() => {});
    }
  } catch {
    // Don't break the page
  }

  return response;
};

// ─── Patch XMLHttpRequest ───────────────────────────────────

const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function patchedOpen(
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
): void {
  (this as XMLHttpRequest & { _mpcUrl?: string })._mpcUrl =
    typeof url === 'string' ? url : url.href;
  return originalXhrOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
};

XMLHttpRequest.prototype.send = function patchedSend(
  body?: Document | XMLHttpRequestBodyInit | null,
): void {
  const xhr = this as XMLHttpRequest & { _mpcUrl?: string };
  const url = xhr._mpcUrl;

  if (url && checkUrl(url)) {
    xhr.addEventListener('load', () => {
      try {
        let parsed: unknown = null;
        if (xhr.responseType === '' || xhr.responseType === 'text') {
          parsed = tryParseResponse(xhr.responseText);
        } else if (xhr.responseType === 'json') {
          parsed = xhr.response;
        }
        if (parsed) processInterceptedResponse(url, parsed, 'xhr');
      } catch {
        // Silently ignore
      }
    });
  }

  return originalXhrSend.call(this, body);
};

// ─── Patch JSONP script injection (AliExpress-specific) ─────
// batman.js may create <script> tags for JSONP — intercept those too.

if (currentProvider === 'aliexpress') {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement && node.src && isAliExpressOrderApiUrl(node.src)) {
          // Detected JSONP script tag for order API
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ─── Hook into global JSONP callbacks ───────────────────────
  const hookedCallbacks = new Set<string>();

  function wrapJsonpCallback(key: string): void {
    if (hookedCallbacks.has(key)) return;
    const original = (window as unknown as Record<string, unknown>)[key];
    if (typeof original !== 'function') return;

    hookedCallbacks.add(key);
    (window as unknown as Record<string, unknown>)[key] = function (this: unknown, ...args: unknown[]) {
      try {
        if (args[0]) {
          postOrderData(args[0], 'jsonp-' + key);
        }
      } catch {
        // Don't break
      }
      return (original as Function).apply(this, args);
    };
  }

  // Strategy 1: Hook Object.defineProperty on window
  const originalDefineProperty = Object.defineProperty;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Object as any).defineProperty = function <T>(
    obj: T,
    prop: PropertyKey,
    descriptor: PropertyDescriptor & ThisType<unknown>,
  ): T {
    const result = originalDefineProperty.call(Object, obj, prop, descriptor) as T;

    if (obj === window && typeof prop === 'string' && prop.startsWith('mtopjsonp')) {
      try {
        wrapJsonpCallback(prop);
      } catch {
        // Don't break defineProperty
      }
    }

    return result;
  };

  // Strategy 2: Poll for new JSONP callbacks (fallback)
  function hookJsonpCallbacks(): void {
    const keys = Object.keys(window).filter(
      (k) => k.startsWith('mtopjsonp') && !hookedCallbacks.has(k),
    );
    for (const key of keys) {
      wrapJsonpCallback(key);
    }
  }

  setInterval(hookJsonpCallbacks, 200);
}

// ─── Allegro: proactively fetch first page ──────────────────
// Allegro may serve the initial order data via SSR or an early fetch that
// completes before our interception patch is active. To ensure the first
// page (offset=0) is always captured, we explicitly re-fetch it once the
// page is ready. Our patched fetch() will intercept and process the response.

if (currentProvider === 'allegro-pl' || currentProvider === 'allegro-cz') {
  const ALLEGRO_ORDER_PAGE_PATHS_PL = ['/moje-allegro/zakupy/kupione', '/moje-allegro/zakupy/'];
  const ALLEGRO_ORDER_PAGE_PATHS_CZ = ['/moje-allegro/nakupy/historie-nakupu', '/moje-allegro/nakupy/'];

  const orderPagePaths = currentProvider === 'allegro-cz'
    ? ALLEGRO_ORDER_PAGE_PATHS_CZ
    : ALLEGRO_ORDER_PAGE_PATHS_PL;

  const isOrderPage = orderPagePaths.some((p) => window.location.pathname.startsWith(p));

  if (isOrderPage) {
    const fetchFirstPage = () => {
      const domain = currentProvider === 'allegro-cz' ? 'allegro.cz' : 'allegro.pl';
      const apiUrl = `https://edge.${domain}/myorder-api/myorders?filter=all&limit=15&offset=0&sort=orderdate&order=DESC`;
      fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.allegro.public.v3+json',
        },
        credentials: 'include',
      }).catch(() => {
        // Auth may not be ready yet or CORS error — ignore silently
      });
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fetchFirstPage, 2000);
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(fetchFirstPage, 2000);
      });
    }
  }
}

// ─── Notify that interception is active ─────────────────────

window.postMessage(
  {
    type: MSG_PREFIX,
    action: 'COLLECTION_STATUS',
    status: { isCollecting: true, providerId: currentProvider },
  },
  '*',
);

console.log(LOG_PREFIX, `Active (provider: ${currentProvider})`);
