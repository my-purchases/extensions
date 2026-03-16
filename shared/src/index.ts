// ─── Types ──────────────────────────────────────────────────
export type { OrderItem, ProviderId, CollectionStatus } from './types/order';
export type {
  WindowOrdersMessage,
  WindowStatusMessage,
  WindowMessage,
  RuntimeMessage,
  RuntimeResponse,
  ExportFormat,
  OrderFilters,
  AutoCollectState,
} from './messages';

// ─── Constants ──────────────────────────────────────────────
export {
  STORAGE_KEY_ORDERS,
  STORAGE_KEY_STATUS,
  STORAGE_KEY_SETTINGS,
  ALIEXPRESS_ORDER_PATTERNS,
  ALIEXPRESS_API_PATTERNS,
  BIZPLUGIN_ORDER_KEY_PREFIX,
  TEMU_ORDER_PATTERNS,
  TEMU_API_PATTERNS,
  TEMU_DISCOVERY_PATTERNS,
  ALLEGRO_ORDER_PATTERNS,
  ALLEGRO_API_PATTERNS,
  AMAZON_DOMAINS,
  AMAZON_ORDER_PATTERNS,
  AMAZON_ORDER_PAGE_PATHS,
  AMAZON_ORDERS_PER_PAGE,
  POPUP_WIDTH,
  POPUP_HEIGHT,
} from './constants';

// ─── Messages ───────────────────────────────────────────────
export { WINDOW_MSG_PREFIX } from './messages';

// ─── Storage ────────────────────────────────────────────────
export type { StorageAdapter } from './storage/orders';
export {
  initStorage,
  getOrders,
  setOrders,
  mergeOrders,
  deleteOrders,
  updateOrder,
  clearOrders,
  getStatus,
  updateStatus,
} from './storage/orders';

// ─── Providers ──────────────────────────────────────────────
export {
  // AliExpress
  parseApiResponse,
  isOrderApiUrl,
  looksLikeOrderResponse,
  // Temu
  parseTemuApiResponse,
  isTemuOrderApiUrl,
  isTemuDiscoveryUrl,
  looksLikeTemuOrderResponse,
  // Allegro
  parseAllegroApiResponse,
  isAllegroOrderApiUrl,
  looksLikeAllegroOrderResponse,
  // Amazon
  isAmazonHost,
  getAmazonDomain,
  isAmazonOrderPage,
  buildAmazonOrderUrl,
  isAmazonOrderApiUrl,
  looksLikeAmazonOrderResponse,
  parseAmazonOrdersHtml,
  parseAmazonOrdersFromDocument,
  extractTotalOrderCount,
  extractTotalOrderCountFromDocument,
  extractNextPageUrl,
  extractNextPageUrlFromDocument,
} from './providers';

// ─── Export ─────────────────────────────────────────────────
export {
  exportToCsv,
  exportToJson,
  exportToHtml,
  exportToClipboard,
} from './export';

// ─── Browser API abstraction ────────────────────────────────
export type {
  BrowserAPI,
  BrowserTab,
  TabQueryInfo,
  TabChangeInfo,
  Unsubscribe,
} from './browser';

// ─── Background message handler ─────────────────────────────
export { createBackgroundHandler } from './background';
export type { BackgroundHandler } from './background';

// ─── i18n ───────────────────────────────────────────────────
export { default as i18n, SUPPORTED_LANGUAGES } from './i18n';
export type { SupportedLanguage } from './i18n';
