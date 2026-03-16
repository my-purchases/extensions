/** Storage key for orders in chrome.storage.local */
export const STORAGE_KEY_ORDERS = 'mpc_orders';

/** Storage key for collection status */
export const STORAGE_KEY_STATUS = 'mpc_status';

/** Storage key for user settings */
export const STORAGE_KEY_SETTINGS = 'mpc_settings';

// ─── AliExpress ─────────────────────────────────────────────

/** AliExpress order page URL patterns */
export const ALIEXPRESS_ORDER_PATTERNS = [
  '*://*.aliexpress.com/p/order/*',
  '*://*.aliexpress.com/p/order/index.html*',
] as const;

/**
 * AliExpress API URL patterns to intercept.
 * Updated based on real traffic observation:
 *   acs.aliexpress.com/h5/mtop.aliexpress.trade.buyer.order.list
 */
export const ALIEXPRESS_API_PATTERNS = [
  'mtop.aliexpress.trade.buyer.order',
  'mtop.aliexpress.order',
  'acs.aliexpress.com',
  '/api/order/',
  '/api/my_order/',
  '/fn/buyer/order/',
  '/buyer/order/list',
  '/order/list/render',
] as const;

/** Key prefix for BizPlugin/droplet order entries in response data */
export const BIZPLUGIN_ORDER_KEY_PREFIX = 'pc_om_list_order_';

// ─── Temu ───────────────────────────────────────────────────

/** Temu order page URL patterns */
export const TEMU_ORDER_PATTERNS = [
  '*://*.temu.com/*/bgt_orders.html*',
  '*://*.temu.com/bgt_orders.html*',
  '*://*.temu.com/*/orders.html*',
  '*://*.temu.com/orders.html*',
  '*://*.temu.com/*/order*',
  '*://*.temu.com/order*',
] as const;

/**
 * Temu API URL patterns to intercept.
 * Based on real traffic observation:
 *   POST https://www.temu.com/pl/api/bg/aristotle/user_order_list
 * The locale prefix (/pl/) varies, so we match on the API path suffix.
 */
export const TEMU_API_PATTERNS = [
  'api/bg/aristotle/user_order_list',
  'api/bg/aristotle/order',
] as const;

/**
 * Temu broad API discovery patterns.
 * In discovery mode, we log Temu API calls that match these broad
 * patterns so we can identify additional order-related endpoints.
 */
export const TEMU_DISCOVERY_PATTERNS = [
  '/api/bg/aristotle/',
  '/api/bg/',
  'temu.com/api/',
] as const;

// ─── Allegro ────────────────────────────────────────────────

/** Allegro order page URL patterns (PL + CZ) */
export const ALLEGRO_ORDER_PATTERNS = [
  '*://*.allegro.pl/moje-allegro/zakupy/kupione*',
  '*://*.allegro.pl/moje-allegro/zakupy/*',
  '*://*.allegro.cz/moje-allegro/nakupy/historie-nakupu*',
  '*://*.allegro.cz/moje-allegro/nakupy/*',
] as const;

/**
 * Allegro API URL patterns to intercept.
 * Based on real traffic observation:
 *   GET https://edge.allegro.pl/myorder-api/myorders?filter=all&limit=15&offset=0
 * The domain varies: edge.allegro.pl, edge.allegro.cz
 */
export const ALLEGRO_API_PATTERNS = [
  'myorder-api/myorders',
  'myorder-api/myorder/',
] as const;

// ─── Amazon ─────────────────────────────────────────────────

/**
 * All known Amazon marketplace domains.
 * Used for provider detection, host permissions, and content script matching.
 */
export const AMAZON_DOMAINS = [
  // Americas
  'amazon.com',
  'amazon.ca',
  'amazon.com.mx',
  'amazon.com.br',
  // Europe
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.es',
  'amazon.nl',
  'amazon.pl',
  'amazon.se',
  'amazon.com.be',
  'amazon.com.tr',
  // Middle East & Africa
  'amazon.ae',
  'amazon.sa',
  'amazon.eg',
  // Asia Pacific
  'amazon.co.jp',
  'amazon.in',
  'amazon.com.au',
  'amazon.sg',
] as const;

/** Amazon order page URL patterns (for tab detection in service worker) */
export const AMAZON_ORDER_PATTERNS = [
  '*://*.amazon.com/gp/css/order-history*',
  '*://*.amazon.com/your-orders/orders*',
  '*://*.amazon.ca/gp/css/order-history*',
  '*://*.amazon.ca/your-orders/orders*',
  '*://*.amazon.com.mx/gp/css/order-history*',
  '*://*.amazon.com.mx/your-orders/orders*',
  '*://*.amazon.com.br/gp/css/order-history*',
  '*://*.amazon.com.br/your-orders/orders*',
  '*://*.amazon.co.uk/gp/css/order-history*',
  '*://*.amazon.co.uk/your-orders/orders*',
  '*://*.amazon.de/gp/css/order-history*',
  '*://*.amazon.de/your-orders/orders*',
  '*://*.amazon.fr/gp/css/order-history*',
  '*://*.amazon.fr/your-orders/orders*',
  '*://*.amazon.it/gp/css/order-history*',
  '*://*.amazon.it/your-orders/orders*',
  '*://*.amazon.es/gp/css/order-history*',
  '*://*.amazon.es/your-orders/orders*',
  '*://*.amazon.nl/gp/css/order-history*',
  '*://*.amazon.nl/your-orders/orders*',
  '*://*.amazon.pl/gp/css/order-history*',
  '*://*.amazon.pl/your-orders/orders*',
  '*://*.amazon.se/gp/css/order-history*',
  '*://*.amazon.se/your-orders/orders*',
  '*://*.amazon.com.be/gp/css/order-history*',
  '*://*.amazon.com.be/your-orders/orders*',
  '*://*.amazon.com.tr/gp/css/order-history*',
  '*://*.amazon.com.tr/your-orders/orders*',
  '*://*.amazon.ae/gp/css/order-history*',
  '*://*.amazon.ae/your-orders/orders*',
  '*://*.amazon.sa/gp/css/order-history*',
  '*://*.amazon.sa/your-orders/orders*',
  '*://*.amazon.eg/gp/css/order-history*',
  '*://*.amazon.eg/your-orders/orders*',
  '*://*.amazon.co.jp/gp/css/order-history*',
  '*://*.amazon.co.jp/your-orders/orders*',
  '*://*.amazon.in/gp/css/order-history*',
  '*://*.amazon.in/your-orders/orders*',
  '*://*.amazon.com.au/gp/css/order-history*',
  '*://*.amazon.com.au/your-orders/orders*',
  '*://*.amazon.sg/gp/css/order-history*',
  '*://*.amazon.sg/your-orders/orders*',
] as const;

/**
 * Amazon order page path prefixes — used by content scripts
 * to determine if the current page is an order history page.
 */
export const AMAZON_ORDER_PAGE_PATHS = [
  '/gp/css/order-history',
  '/your-orders/orders',
] as const;

/**
 * Amazon orders per page (used for pagination startIndex increments).
 */
export const AMAZON_ORDERS_PER_PAGE = 10;

/** Default popup dimensions */
export const POPUP_WIDTH = 420;
export const POPUP_HEIGHT = 560;
