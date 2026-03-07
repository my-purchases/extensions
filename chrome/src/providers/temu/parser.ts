/**
 * Temu order parser.
 *
 * Parses the Temu `user_order_list` API response into OrderItem[].
 *
 * Response structure (confirmed from real API):
 *   {
 *     view_orders: [
 *       {
 *         parent_order_sn: "PO-162-...",
 *         parent_order_time: 1699996065,          // unix seconds
 *         parent_order_time_format: "14 lis. 2023", // localized
 *         status_prompt: "Doręczona",
 *         price_desc: { currency: "PLN", display_amount_with_symbol: "70,48 zł", ... },
 *         order_list: [
 *           {
 *             order_sn: "162-...",
 *             order_goods: {                       // single object, NOT array
 *               goods_name: "...",
 *               goods_price_with_symbol_display: "70,48 zł",
 *               goods_price_display: "70.48",
 *               goods_number: 1,
 *               goods_id: 601099520349894,
 *               sku_id: 17592232681688,
 *               thumb_url: "https://img.kwcdn.com/...",
 *               spec: "Minikarta 40 sztuk",
 *               goods_link_url: "goods.html?...&goods_id=601099520349894",
 *             },
 *             ...
 *           }
 *         ],
 *         ...
 *       }
 *     ],
 *     has_next_page: false,
 *     offset_map: { ... }
 *   }
 */

import type { OrderItem } from '@/types/order';

// ─── Types for Temu API response ────────────────────────────

interface TemuOrderGoods {
  goods_name?: string;
  goods_price?: number;
  goods_price_display?: string;
  goods_price_with_symbol_display?: string;
  goods_retail_price_with_symbol_display?: string;
  goods_number?: number;
  goods_id?: number;
  sku_id?: number;
  thumb_url?: string;
  spec?: string;
  goods_link_url?: string;
  symbol?: string;
}

interface TemuSubOrder {
  order_sn?: string;
  market_region?: number;
  goods_amount?: number;
  order_goods?: TemuOrderGoods;
  is_giveaway_order?: boolean;
}

interface TemuPriceDesc {
  currency?: string;
  display_amount?: string;
  display_amount_with_symbol?: string;
  symbol?: string;
  item_count?: number;
}

interface TemuViewOrder {
  parent_order_sn?: string;
  parent_order_time?: number;
  parent_order_time_format?: string;
  parent_receive_time?: number;
  parent_receive_time_format?: string;
  status_prompt?: string;
  parent_status?: number;
  order_list?: TemuSubOrder[];
  price_desc?: TemuPriceDesc;
  order_link_url?: string;
  trade_transaction_sn?: string;
}

interface TemuApiResponse {
  server_time?: number;
  view_orders?: TemuViewOrder[];
  has_next_page?: boolean;
  offset_map?: Record<string, string>;
}

// ─── Parser ─────────────────────────────────────────────────

/**
 * Parse a Temu `user_order_list` API response into OrderItem[].
 */
export function parseTemuApiResponse(body: unknown): OrderItem[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const response = body as TemuApiResponse;
  const viewOrders = response.view_orders;

  if (!Array.isArray(viewOrders) || viewOrders.length === 0) {
    return [];
  }

  const items: OrderItem[] = [];

  for (const parentOrder of viewOrders) {
    const subOrders = parentOrder.order_list;
    if (!Array.isArray(subOrders)) continue;

    for (const subOrder of subOrders) {
      const goods = subOrder.order_goods;
      if (!goods) continue;

      // Skip giveaway orders
      if (subOrder.is_giveaway_order) continue;

      const item = mapToOrderItem(parentOrder, subOrder, goods);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

// ─── Field mapping ──────────────────────────────────────────

function mapToOrderItem(
  parent: TemuViewOrder,
  sub: TemuSubOrder,
  goods: TemuOrderGoods,
): OrderItem | null {
  const parentOrderSn = parent.parent_order_sn || '';
  const orderSn = sub.order_sn || '';
  const goodsId = String(goods.goods_id || '');
  const skuId = String(goods.sku_id || '');

  if (!parentOrderSn && !orderSn) return null;

  // Composite ID: "{orderSn}-{goodsId}-{skuId}"
  const id = [orderSn || parentOrderSn, goodsId, skuId].filter(Boolean).join('-');

  // Price: prefer goods-level price, fall back to parent price_desc
  const price = goods.goods_price_with_symbol_display
    || goods.goods_retail_price_with_symbol_display
    || parent.price_desc?.display_amount_with_symbol
    || '';

  // Price info: "70,48 zł|70|48" format
  const priceInfo = buildPriceInfo(
    price,
    goods.goods_price_display || parent.price_desc?.display_amount || '',
  );

  // Currency
  const currency = parent.price_desc?.currency || extractCurrencyFromSymbol(goods.symbol || parent.price_desc?.symbol || '');

  // Date: derive ISO from unix timestamp
  const orderDateIso = parent.parent_order_time
    ? formatIsoDate(parent.parent_order_time)
    : '';
  const orderDate = parent.parent_order_time_format || orderDateIso;

  // Product URL: prepend Temu base if it's a relative link
  const productUrl = buildProductUrl(goods.goods_link_url || '', goodsId);

  return {
    id,
    orderId: parentOrderSn,
    orderLineId: orderSn,
    productId: goodsId,
    skuId,
    title: goods.goods_name || '',
    price,
    priceInfo,
    currency,
    quantity: goods.goods_number || 1,
    orderDate,
    orderDateIso,
    status: parent.status_prompt || mapNumericStatus(parent.parent_status),
    storeName: 'Temu',
    storePageUrl: 'https://www.temu.com',
    productUrl,
    imageUrl: goods.thumb_url || '',
    attributes: goods.spec || '',
    timestamp: Date.now(),
    ignoreExport: false,
    tags: [],
    providerId: 'temu',
  };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Convert unix timestamp (seconds) to ISO date string (YYYY-MM-DD).
 */
function formatIsoDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build pipe-separated price info: "70,48 zł|70|48"
 */
function buildPriceInfo(displayPrice: string, rawAmount: string): string {
  if (!rawAmount) return displayPrice;

  // rawAmount is like "70.48" — split into integer and decimal
  const parts = rawAmount.split('.');
  const integer = parts[0] || '0';
  const decimal = parts[1] || '00';

  return `${displayPrice}|${integer}|${decimal}`;
}

/**
 * Map currency symbol to ISO 4217 code.
 */
function extractCurrencyFromSymbol(symbol: string): string {
  const map: Record<string, string> = {
    'zł': 'PLN',
    'PLN': 'PLN',
    '$': 'USD',
    'US $': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'CNY',
    'R$': 'BRL',
    'kr': 'SEK',
    'Kč': 'CZK',
    'Ft': 'HUF',
    'lei': 'RON',
    'лв': 'BGN',
  };
  return map[symbol] || symbol || 'USD';
}

/**
 * Build absolute product URL from Temu's relative link.
 */
function buildProductUrl(goodsLinkUrl: string, goodsId: string): string {
  if (!goodsLinkUrl && !goodsId) return '';

  // If it already starts with http, return as-is
  if (goodsLinkUrl.startsWith('http')) return goodsLinkUrl;

  // Temu returns relative links like "goods.html?_bg_fs=1&goods_id=601099520349894"
  if (goodsLinkUrl) {
    return `https://www.temu.com/${goodsLinkUrl}`;
  }

  // Fallback: construct from goods_id
  return `https://www.temu.com/goods.html?goods_id=${goodsId}`;
}

/**
 * Map numeric parent_status to a human-readable string (fallback).
 * Known values from observation:
 *   4 = Delivered / Doręczona
 */
function mapNumericStatus(status?: number): string {
  switch (status) {
    case 0: return 'Pending';
    case 1: return 'Processing';
    case 2: return 'Shipped';
    case 3: return 'In Transit';
    case 4: return 'Delivered';
    case 5: return 'Cancelled';
    case 6: return 'Refunded';
    default: return status != null ? `Status ${status}` : 'Unknown';
  }
}
