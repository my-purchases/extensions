/** Storage key for orders in chrome.storage.local */
export const STORAGE_KEY_ORDERS = 'mpc_orders';

/** Storage key for collection status */
export const STORAGE_KEY_STATUS = 'mpc_status';

/** Storage key for user settings */
export const STORAGE_KEY_SETTINGS = 'mpc_settings';

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

/** Default popup dimensions */
export const POPUP_WIDTH = 420;
export const POPUP_HEIGHT = 560;
