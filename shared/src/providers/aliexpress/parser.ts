import type { OrderItem } from '../../types/order';
import { BIZPLUGIN_ORDER_KEY_PREFIX } from '../../constants';

/**
 * Parse AliExpress API response into OrderItem[].
 *
 * Handles multiple response formats:
 *   1. BizPlugin/droplet: response.data has pc_om_list_order_* keys
 *   2. Classic API: response.data.orderList / result.orderList
 *   3. Raw JSONP wrapper: response.data.data (nested)
 */
export function parseApiResponse(body: unknown): OrderItem[] {
  if (!body || typeof body !== 'object') return [];

  // Strategy 1: BizPlugin/droplet format
  const bizPluginOrders = parseBizPluginFormat(body);
  if (bizPluginOrders.length > 0) return bizPluginOrders;

  // Strategy 2: Classic API format
  const classicOrders = parseClassicFormat(body);
  if (classicOrders.length > 0) return classicOrders;

  // Strategy 3: Deep scan — look for anything that looks like an order
  const deepOrders = parseDeepScan(body);
  if (deepOrders.length > 0) return deepOrders;

  return [];
}

// ─── BizPlugin/droplet format ───────────────────────────────
// Real response structure (confirmed from live data):
//
// data: {
//   pc_om_list_order_3068481379959913: {
//     fields: {
//       orderId: "3068481379959913",
//       orderDateText: "Feb 10, 2026",
//       statusText: "Awaiting delivery",
//       storeName: "Savior Global Store",
//       storePageUrl: "//www.aliexpress.com/store/1102197259",
//       formatPriceInfo: "US $25.09|25|09",
//       totalPriceText: "US $25.09",
//       currencyCode: "USD",
//       orderDetailUrl: "https://www.aliexpress.com/p/order/detail.html?orderId=...",
//       orderLines: [{ ... product data with images ... }],
//       orderLineSize: 1,
//       ...
//     },
//     id: "3068481379959913",
//     position: "body",
//     scriptKey: "Pc_om_list_order_110655",
//     status: "normal",
//     tag: "pc_om_list_order",
//     type: "pc_om_list_order",
//   }
// }

function parseBizPluginFormat(body: unknown): OrderItem[] {
  const obj = body as Record<string, unknown>;
  const orders: OrderItem[] = [];

  // Try data, data.data, and top-level
  const candidates = [
    obj.data,
    (obj.data as Record<string, unknown> | undefined)?.data,
    obj,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const data = candidate as Record<string, unknown>;

    const orderKeys = Object.keys(data).filter((k) => k.startsWith(BIZPLUGIN_ORDER_KEY_PREFIX));
    if (orderKeys.length === 0) continue;

    for (const key of orderKeys) {
      const entry = data[key] as Record<string, unknown> | undefined;
      if (!entry) continue;

      const orderId = String(entry.id ?? key.replace(BIZPLUGIN_ORDER_KEY_PREFIX, ''));
      const fields = entry.fields as Record<string, unknown> | undefined;

      const items = mapBizPluginEntry(orderId, fields);
      orders.push(...items);
    }

    if (orders.length > 0) return orders;
  }

  return orders;
}

/**
 * Map a BizPlugin order entry to one or more OrderItems.
 * Multi-product orders produce multiple items.
 */
function mapBizPluginEntry(
  orderId: string,
  fields: Record<string, unknown> | undefined,
): OrderItem[] {
  if (!fields) {
    return [buildMinimalOrder(orderId)];
  }

  const f = fields;

  // ── Order-level data (confirmed field names from real API) ──
  const orderDate = str(f.orderDateText) || str(f.orderDate);
  const status = str(f.statusText) || str(f.status) || str(f.orderStatus);
  const storeName = str(f.storeName);
  const storePageUrl = normalizeUrl(str(f.storePageUrl));
  const currency = str(f.currencyCode) || str(f.baseCurrency) || str(f.intentionCurrency) || 'USD';

  // formatPriceInfo is already in "US $25.09|25|09" format (= priceInfo)
  const formatPriceInfo = str(f.formatPriceInfo);
  const totalPriceText = str(f.totalPriceText);
  const orderDetailUrl = str(f.orderDetailUrl);

  // ── Product-level data from orderLines ──
  const orderLines = f.orderLines as unknown[] | undefined;

  if (Array.isArray(orderLines) && orderLines.length > 0) {
    const items: OrderItem[] = [];

    for (let i = 0; i < orderLines.length; i++) {
      const line = orderLines[i] as Record<string, unknown> | undefined;
      if (!line) continue;

      // orderLines entries may have their own `fields` or be flat objects
      const lineFields = (line.fields as Record<string, unknown> | undefined) ?? line;
      const lf = lineFields;

      // Extract product data from line — try known field names and fallbacks
      const title = str(lf.title) || str(lf.productTitle) || str(lf.productName)
        || str(lf.itemTitle) || str(lf.name) || str(lf.subject) || `Order ${orderId}`;

      const imageUrl = str(lf.itemImgUrl) || str(lf.imageUrl) || str(lf.imgUrl)
        || str(lf.productImgUrl) || str(lf.mainPic) || str(lf.pic)
        || str(lf.thumbnail) || str(lf.productImage) || str(lf.image) || '';

      const productUrl = str(lf.itemDetailUrl) || str(lf.productUrl) || str(lf.itemUrl)
        || str(lf.detailUrl) || str(lf.link) || '';

      const productId = str(lf.productId) || str(lf.itemId) || str(lf.product_id)
        || extractProductIdFromUrl(productUrl) || '';
      const skuId = str(lf.skuId) || str(lf.skuCode) || str(lf.sku_id) || '';

      const attributes = str(lf.skuAttr) || str(lf.attributes) || str(lf.skuText)
        || str(lf.skuInfo) || str(lf.specs) || str(lf.properties) || str(lf.variant) || '';

      const quantity = num(lf.quantity) || num(lf.qty) || num(lf.count) || 1;

      // Line-level price (if different from order total)
      const linePrice = str(lf.formatPriceInfo) || str(lf.price) || str(lf.totalPrice)
        || str(lf.actualPayPrice) || str(lf.unitPrice) || '';

      // Use line price if available, otherwise fall back to order-level price
      const priceInfo = linePrice && linePrice.includes('|') ? linePrice : formatPriceInfo;
      const priceDisplay = priceInfo ? priceInfo.split('|')[0] : totalPriceText;

      const orderLineId = str(lf.orderLineId) || str(line.id) || `${orderId}-${i}`;

      const { dateStr, dateIso } = parseDateStrings(orderDate);
      const id = `${orderLineId}-${productId || '0'}-${skuId || '0'}`;

      items.push({
        id,
        orderId,
        orderLineId,
        productId: productId || orderId,
        skuId,
        title,
        price: priceDisplay,
        priceInfo: priceInfo || buildPriceInfo(priceDisplay, currency),
        currency,
        quantity,
        orderDate: dateStr,
        orderDateIso: dateIso,
        status: status || 'Unknown',
        storeName,
        storePageUrl,
        productUrl: normalizeUrl(productUrl) || buildProductUrl(productId),
        imageUrl: normalizeUrl(imageUrl),
        attributes,
        timestamp: Date.now(),
        ignoreExport: false,
        tags: [],
      });
    }

    if (items.length > 0) return items;
  }

  // ── No orderLines — build a single order from order-level data ──
  const { dateStr, dateIso } = parseDateStrings(orderDate);
  const orderLineId = `${orderId}-0`;
  const id = `${orderLineId}-${orderId}-0`;

  return [{
    id,
    orderId,
    orderLineId,
    productId: orderId,
    skuId: '',
    title: `Order ${orderId}`,
    price: totalPriceText || (formatPriceInfo ? formatPriceInfo.split('|')[0] : ''),
    priceInfo: formatPriceInfo || buildPriceInfo(totalPriceText, currency),
    currency,
    quantity: 1,
    orderDate: dateStr,
    orderDateIso: dateIso,
    status: status || 'Unknown',
    storeName,
    storePageUrl,
    productUrl: normalizeUrl(str(fields.orderDetailUrl)) || '',
    imageUrl: '',
    attributes: '',
    timestamp: Date.now(),
    ignoreExport: false,
    tags: [],
  }];
}

function buildMinimalOrder(orderId: string): OrderItem {
  const now = new Date();
  return {
    id: `${orderId}-0-${orderId}-0`,
    orderId,
    orderLineId: `${orderId}-0`,
    productId: orderId,
    skuId: '',
    title: `Order ${orderId}`,
    price: '',
    priceInfo: '',
    currency: 'USD',
    quantity: 1,
    orderDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    orderDateIso: now.toISOString().slice(0, 10),
    status: 'Unknown',
    storeName: '',
    storePageUrl: '',
    productUrl: '',
    imageUrl: '',
    attributes: '',
    timestamp: Date.now(),
    ignoreExport: false,
    tags: [],
  };
}

// ─── Classic API format ─────────────────────────────────────

function parseClassicFormat(body: unknown): OrderItem[] {
  const obj = body as Record<string, unknown>;
  const data = obj.data as Record<string, unknown> | undefined;
  const result = obj.result as Record<string, unknown> | undefined;

  const orderList: unknown[] =
    (data?.orderList as unknown[]) ??
    (data?.list as unknown[]) ??
    (data?.orders as unknown[]) ??
    (result?.orderList as unknown[]) ??
    (result?.resultList as unknown[]) ??
    [];

  if (!Array.isArray(orderList) || orderList.length === 0) return [];

  const orders: OrderItem[] = [];
  for (const order of orderList) {
    if (!order || typeof order !== 'object') continue;
    const o = order as Record<string, unknown>;
    const orderId = String(o.orderId ?? o.id ?? o.order_id ?? '');
    if (!orderId) continue;

    const status = String(o.orderStatus ?? o.status ?? o.statusText ?? '');
    const createTime = String(o.createTime ?? o.gmtCreate ?? o.gmt_create ?? '');
    const storeInfo = o.storeInfo as Record<string, unknown> | undefined;
    const sellerInfo = o.sellerInfo as Record<string, unknown> | undefined;
    const storeName = String(storeInfo?.storeName ?? sellerInfo?.storeName ?? '');
    const storeUrl = String(storeInfo?.storeUrl ?? sellerInfo?.storeUrl ?? '');

    const products: unknown[] =
      (o.productList as unknown[]) ??
      (o.orderItemList as unknown[]) ??
      (o.childOrderList as unknown[]) ??
      [];

    if (Array.isArray(products) && products.length > 0) {
      for (const product of products) {
        if (!product || typeof product !== 'object') continue;
        const p = product as Record<string, unknown>;

        const { dateStr, dateIso } = parseDateStrings(createTime);
        const productId = String(p.productId ?? p.product_id ?? p.itemId ?? '');
        const skuId = String(p.skuId ?? p.sku_id ?? '');
        const orderLineId = `${orderId}-${productId || '0'}`;
        const id = `${orderLineId}-${productId || '0'}-${skuId || '0'}`;
        const priceRaw = String(p.actualPayPrice ?? p.totalPrice ?? p.price ?? p.unitPrice ?? '');
        const currency = String(p.currency ?? p.currencyCode ?? 'USD');

        orders.push({
          id,
          orderId,
          orderLineId,
          productId: productId || orderId,
          skuId,
          title: String(p.title ?? p.productName ?? p.product_name ?? ''),
          price: priceRaw,
          priceInfo: buildPriceInfo(priceRaw, currency),
          currency,
          quantity: Number(p.quantity ?? p.count ?? 1),
          orderDate: dateStr,
          orderDateIso: dateIso,
          status,
          storeName,
          storePageUrl: storeUrl,
          productUrl: String(p.productUrl ?? ''),
          imageUrl: String(p.productImgUrl ?? p.imageUrl ?? p.imgUrl ?? ''),
          attributes: String(p.skuAttr ?? p.skuText ?? p.attributes ?? ''),
          timestamp: Date.now(),
          ignoreExport: false,
          tags: [],
        });
      }
    } else {
      const { dateStr, dateIso } = parseDateStrings(createTime);
      const orderLineId = `${orderId}-0`;
      const id = `${orderLineId}-${orderId}-0`;
      const priceRaw = String(o.totalPrice ?? o.price ?? o.payAmount ?? '');
      const currency = String(o.currency ?? 'USD');

      orders.push({
        id,
        orderId,
        orderLineId,
        productId: orderId,
        skuId: '',
        title: String(o.title ?? o.subject ?? `Order ${orderId}`),
        price: priceRaw,
        priceInfo: buildPriceInfo(priceRaw, currency),
        currency,
        quantity: 1,
        orderDate: dateStr,
        orderDateIso: dateIso,
        status,
        storeName,
        storePageUrl: storeUrl,
        productUrl: '',
        imageUrl: String(o.imageUrl ?? o.imgUrl ?? ''),
        attributes: '',
        timestamp: Date.now(),
        ignoreExport: false,
        tags: [],
      });
    }
  }

  return orders;
}

// ─── Deep scan ──────────────────────────────────────────────
// Recursively look for anything that looks like order data

function parseDeepScan(body: unknown, depth = 0): OrderItem[] {
  if (depth > 5 || !body || typeof body !== 'object') return [];

  const obj = body as Record<string, unknown>;
  const orders: OrderItem[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith(BIZPLUGIN_ORDER_KEY_PREFIX)) {
      const entry = value as Record<string, unknown>;
      const orderId = String(entry.id ?? key.replace(BIZPLUGIN_ORDER_KEY_PREFIX, ''));
      const items = mapBizPluginEntry(orderId, entry.fields as Record<string, unknown> | undefined);
      orders.push(...items);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = parseDeepScan(value, depth + 1);
      orders.push(...nested);
    }
  }

  return orders;
}

// ─── Utility functions ──────────────────────────────────────

/** Safely extract a string from a value that might be a string, object with text/value, etc. */
function str(val: unknown): string {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.displayValue === 'string') return obj.displayValue;
  }
  return '';
}

/** Safely extract a number from a value. */
function num(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Normalize protocol-relative URLs (//domain.com/...) to https. */
function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  return url;
}

/** Parse a price string to get the numeric value. */
function parsePrice(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(cleaned.replace(/,/g, '')) || 0;
}

/**
 * Build priceInfo in the format "US $25.09|25|09".
 * If the input already contains pipe separators, return as-is.
 */
function buildPriceInfo(priceDisplay: string, currency: string): string {
  if (!priceDisplay) return '';
  if (priceDisplay.includes('|')) return priceDisplay;

  const priceNum = parsePrice(priceDisplay);
  const intPart = Math.floor(priceNum);
  const decPart = Math.round((priceNum - intPart) * 100);
  return `${priceDisplay}|${intPart}|${decPart}`;
}

function buildProductUrl(productId: string): string {
  if (!productId) return '';
  return `https://www.aliexpress.com/item/${productId}.html`;
}

/** Extract product ID from a URL like //www.aliexpress.com/item/1005010315497582.html */
function extractProductIdFromUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/\/item\/(\d+)\.html/);
  return match ? match[1] : '';
}

function parseDateStrings(raw: string): { dateStr: string; dateIso: string } {
  if (!raw) {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dateIso: now.toISOString().slice(0, 10),
    };
  }

  // Handle timestamp (number or numeric string)
  const asNum = Number(raw);
  if (!isNaN(asNum) && asNum > 1e12) {
    const d = new Date(asNum);
    return {
      dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dateIso: d.toISOString().slice(0, 10),
    };
  }

  // Already formatted like "Feb 10, 2026" — try to parse
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return {
        dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dateIso: d.toISOString().slice(0, 10),
      };
    }
  } catch {
    // Fall through
  }

  // Can't parse — return raw string as-is
  return { dateStr: raw, dateIso: raw };
}
