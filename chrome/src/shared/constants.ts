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

/** Default popup dimensions */
export const POPUP_WIDTH = 420;
export const POPUP_HEIGHT = 560;
