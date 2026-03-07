/**
 * Order item format — fully compatible with AliExpress Shopper Inventory
 * extension format used by the my-purchases web app importer.
 *
 * @see web/src/providers/aliexpress/types.ts → AliexpressShopperInventoryItem
 */
export interface OrderItem {
  /** Composite key: "{orderLineId}-{productId}-{skuId}" */
  id: string;
  orderId: string;
  orderLineId: string;
  productId: string;
  skuId: string;
  title: string;
  /** Display price, e.g. "US $120.95" or "129,46zł" */
  price: string;
  /** Pipe-separated price info, e.g. "US $120.95|120|95" */
  priceInfo: string;
  /** ISO 4217 currency code, e.g. "USD", "PLN" */
  currency: string;
  quantity: number;
  /** Human-readable date, e.g. "Feb 21, 2026" */
  orderDate: string;
  /** ISO date string, e.g. "2026-02-20" */
  orderDateIso: string;
  /** Order status, e.g. "Completed", "Expired", "In Transit" */
  status: string;
  storeName: string;
  storePageUrl: string;
  productUrl: string;
  imageUrl: string;
  /** Attributes/variants, e.g. "Color: 6L, Ships From: GERMANY" */
  attributes: string;
  /** Unix timestamp (ms) when order was captured */
  timestamp: number;
  /** Whether to exclude from exports */
  ignoreExport: boolean;
  /** User-assigned tags */
  tags: string[];
  /** Which provider this order came from */
  providerId?: ProviderId;
}

/** Supported provider IDs */
export type ProviderId = 'aliexpress' | 'temu';

/** Collection status per provider */
export interface CollectionStatus {
  providerId: ProviderId;
  isCollecting: boolean;
  ordersCollected: number;
  lastCollectedAt: string | null;
  error: string | null;
}
