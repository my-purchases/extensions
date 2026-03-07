/**
 * Main-world content script.
 * Runs in the page's JavaScript context (world: "MAIN").
 * Monkey-patches fetch() and XMLHttpRequest to intercept order API responses.
 * Sends captured data to the isolated-world script via window.postMessage().
 *
 * Multi-provider support:
 *   - Detects the current site (AliExpress, Temu) from window.location.hostname
 *   - Uses provider-specific URL patterns and data detection
 *   - For Temu: discovery mode with verbose logging of all API traffic
 *
 * AliExpress findings:
 *   - API endpoint: acs.aliexpress.com/h5/mtop.aliexpress.trade.buyer.order.list
 *   - Transport: batman.js with dataType 'originaljsonp' (but uses XHR under the hood)
 *   - Response format: BizPlugin/droplet with pc_om_list_order_* keys
 */

const MSG_PREFIX = 'MPC_';
const LOG_PREFIX = '[MPC:main]';

// ─── Provider detection ─────────────────────────────────────

type Provider = 'aliexpress' | 'temu' | 'unknown';

function detectProvider(): Provider {
  const hostname = window.location.hostname;
  if (hostname.includes('aliexpress.com')) return 'aliexpress';
  if (hostname.includes('temu.com')) return 'temu';
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

/**
 * Check if a URL is an order API URL for the current provider.
 */
function checkUrl(url: string): boolean {
  if (currentProvider === 'aliexpress') return isAliExpressOrderApiUrl(url);
  if (currentProvider === 'temu') return isTemuOrderApiUrl(url);
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

// ─── Unified data check & post ──────────────────────────────

function containsOrderData(body: unknown): boolean {
  if (currentProvider === 'aliexpress') return containsAliExpressOrderData(body);
  if (currentProvider === 'temu') return containsTemuOrderData(body);
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
