/**
 * Main-world content script.
 * Runs in the page's JavaScript context (world: "MAIN").
 * Monkey-patches fetch() and XMLHttpRequest to intercept AliExpress order API responses.
 * Sends captured data to the isolated-world script via window.postMessage().
 *
 * Key findings from real AliExpress traffic:
 *   - API endpoint: acs.aliexpress.com/h5/mtop.aliexpress.trade.buyer.order.list
 *   - Transport: batman.js with dataType 'originaljsonp' (but uses XHR under the hood)
 *   - Response format: BizPlugin/droplet with pc_om_list_order_* keys
 */

const MSG_PREFIX = 'MPC_';
const LOG_PREFIX = '[MPC:main]';

// ─── URL matching ───────────────────────────────────────────

const API_PATTERNS = [
  'mtop.aliexpress.trade.buyer.order',
  'mtop.aliexpress.order',
  'acs.aliexpress.com',
  '/api/order/',
  '/api/my_order/',
  '/fn/buyer/order/',
  '/buyer/order/list',
  '/order/list/render',
];

function isOrderApiUrl(url: string): boolean {
  if (!url) return false;
  // Normalize protocol-relative URLs (//acs.aliexpress.com/...)
  const normalized = url.startsWith('//') ? 'https:' + url : url;
  return API_PATTERNS.some((pattern) => normalized.includes(pattern));
}

// ─── Data detection ─────────────────────────────────────────

const ORDER_KEY_PREFIX = 'pc_om_list_order_';

/**
 * Check if a response body contains order data.
 * Handles multiple formats:
 *   1. BizPlugin/droplet: { data: { pc_om_list_order_*: { fields: {...} } } }
 *   2. Classic API: { data: { orderList: [...] } }
 *   3. Wrapped: { data: { data: { ... } } }
 */
function containsOrderData(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;

  // Format 1: BizPlugin/droplet — keys starting with 'pc_om_list_order_'
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.some((k) => k.startsWith(ORDER_KEY_PREFIX))) return true;

    // Classic API formats
    if (Array.isArray(data.orderList)) return true;
    if (Array.isArray(data.list)) return true;
    if (Array.isArray(data.orders)) return true;

    // Nested data
    const nested = data.data as Record<string, unknown> | undefined;
    if (nested && typeof nested === 'object') {
      const nestedKeys = Object.keys(nested);
      if (nestedKeys.some((k) => k.startsWith(ORDER_KEY_PREFIX))) return true;
    }
  }

  // Result wrapper
  const result = obj.result as Record<string, unknown> | undefined;
  if (result && typeof result === 'object') {
    if (Array.isArray(result.orderList)) return true;
    if (Array.isArray(result.resultList)) return true;
  }

  // Top-level BizPlugin response (the full onRequest payload)
  const topKeys = Object.keys(obj);
  if (topKeys.some((k) => k.startsWith(ORDER_KEY_PREFIX))) return true;

  return false;
}

// ─── Post data to isolated-world ────────────────────────────

function postOrderData(jsonBody: unknown, source: string): void {
  if (!containsOrderData(jsonBody)) {
    return;
  }

  console.log(LOG_PREFIX, `Order data detected via ${source}`, jsonBody);

  window.postMessage(
    {
      type: MSG_PREFIX,
      action: 'ORDERS_CAPTURED',
      orders: [],
      _rawApiResponse: jsonBody,
    },
    '*',
  );
}

/**
 * Try to parse various response formats (text, JSONP callback wrappers, etc.)
 */
function tryParseResponse(text: string): unknown {
  // Try plain JSON first
  try {
    return JSON.parse(text);
  } catch {
    // Not plain JSON
  }

  // Try JSONP: callbackName({...})
  const jsonpMatch = text.match(/^\s*\w+\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
  if (jsonpMatch) {
    try {
      return JSON.parse(jsonpMatch[1]);
    } catch {
      // Not parseable JSONP
    }
  }

  // Try mtopjsonp format: mtopjsonpN({...})
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

    if (isOrderApiUrl(url)) {
      console.log(LOG_PREFIX, 'Intercepted fetch:', url);
      const clone = response.clone();
      clone.text().then((text) => {
        const parsed = tryParseResponse(text);
        if (parsed) postOrderData(parsed, 'fetch');
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

  if (url && isOrderApiUrl(url)) {
    console.log(LOG_PREFIX, 'Intercepted XHR:', url);

    xhr.addEventListener('load', () => {
      try {
        let parsed: unknown = null;
        if (xhr.responseType === '' || xhr.responseType === 'text') {
          parsed = tryParseResponse(xhr.responseText);
        } else if (xhr.responseType === 'json') {
          parsed = xhr.response;
        }
        if (parsed) postOrderData(parsed, 'xhr');
      } catch {
        // Silently ignore
      }
    });
  }

  return originalXhrSend.call(this, body);
};

// ─── Patch JSONP script injection ───────────────────────────
// batman.js may create <script> tags for JSONP — intercept those too.
// Monitor script tags being added that look like JSONP for order APIs.

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLScriptElement && node.src && isOrderApiUrl(node.src)) {
        console.log(LOG_PREFIX, 'Detected JSONP script tag:', node.src);
        // The callback will be intercepted by our hookJsonpCallbacks below
      }
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

// ─── Hook into global JSONP callbacks ───────────────────────
// AliExpress mtop uses callback names like "mtopjsonpN".
// Strategy 1: Intercept Object.defineProperty to catch callbacks as they're created.
// Strategy 2: Poll for new mtopjsonp* globals as a fallback.

const hookedCallbacks = new Set<string>();

function wrapJsonpCallback(key: string): void {
  if (hookedCallbacks.has(key)) return;
  const original = (window as unknown as Record<string, unknown>)[key];
  if (typeof original !== 'function') return;

  hookedCallbacks.add(key);
  (window as unknown as Record<string, unknown>)[key] = function (this: unknown, ...args: unknown[]) {
    try {
      if (args[0]) {
        console.log(LOG_PREFIX, 'JSONP callback intercepted:', key);
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

  // If someone defines a mtopjsonp* property on window, wrap it
  if (obj === window && typeof prop === 'string' && prop.startsWith('mtopjsonp')) {
    try {
      wrapJsonpCallback(prop);
    } catch {
      // Don't break defineProperty
    }
  }

  return result;
};

// Strategy 2: Poll for new JSONP callbacks (fallback for direct assignment)
function hookJsonpCallbacks(): void {
  const keys = Object.keys(window).filter(
    (k) => k.startsWith('mtopjsonp') && !hookedCallbacks.has(k),
  );
  for (const key of keys) {
    wrapJsonpCallback(key);
  }
}

setInterval(hookJsonpCallbacks, 200);

// ─── Notify that interception is active ─────────────────────

window.postMessage(
  {
    type: MSG_PREFIX,
    action: 'COLLECTION_STATUS',
    status: { isCollecting: true, providerId: 'aliexpress' },
  },
  '*',
);

console.log(LOG_PREFIX, 'API interception active on', window.location.href);
console.log(LOG_PREFIX, 'Monitoring patterns:', API_PATTERNS);
