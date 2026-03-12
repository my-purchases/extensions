/**
 * Amazon order HTML parser.
 *
 * Unlike other providers that parse JSON API responses, Amazon returns
 * server-rendered HTML. This parser extracts order data from HTML strings
 * using DOMParser and CSS selectors.
 *
 * Verified Amazon DOM structure (from real amazon.pl HTML, 2026):
 *   - Order cards: div.order-card.js-order-card
 *   - Order header: .order-header (contains columns for date, total, ship-to, order-id)
 *   - Order ID: .yohtmlc-order-id → span[dir="ltr"] contains "###-#######-#######"
 *   - Order date: First .a-column.a-span3 in .order-header → second <span> with class a-color-secondary
 *   - Order total: .a-column.a-span2 in .order-header → <span> with class a-color-secondary (contains price)
 *   - Delivery box: .delivery-box (contains shipment info + items)
 *   - Status: .yohtmlc-shipment-status-primaryText span
 *   - Items: .item-box (inside .delivery-box)
 *   - Item title: .yohtmlc-product-title a
 *   - Item link/ASIN: href contains /dp/XXXXXXXXXX
 *   - Item image: .product-image img (src attribute)
 *
 * The order header uses a fixed-grid layout:
 *   Column 1 (.a-span3): Date label + date value
 *   Column 2 (.a-span2): Total label + total value
 *   Column 3 (.a-span3): Ship-to label + address
 *   Column 4 (.a-span2): Order ID label + order ID value + action links
 */

import type { OrderItem } from '@/types/order';

// ─── Types ──────────────────────────────────────────────────

interface AmazonParsedOrder {
  orderId: string;
  orderDate: string;
  orderTotal: string;
  orderTotalCurrency: string;
  status: string;
  items: AmazonParsedItem[];
}

interface AmazonParsedItem {
  title: string;
  price: string;
  currency: string;
  quantity: number;
  productUrl: string;
  imageUrl: string;
  seller: string;
  sellerUrl: string;
}

// ─── Main parser ────────────────────────────────────────────

/**
 * Parse Amazon order HTML (from a fetched page or live DOM innerHTML) into OrderItem[].
 * @param html  The HTML string of the order history page
 * @param domain  The Amazon domain (e.g. "amazon.de") for constructing absolute URLs
 */
export function parseAmazonOrdersHtml(html: string, domain: string): OrderItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return parseAmazonOrdersFromDocument(doc, domain);
}

/**
 * Parse Amazon orders from a Document (either DOMParser result or live document).
 * This can be used directly with the live page: parseAmazonOrdersFromDocument(document, domain)
 */
export function parseAmazonOrdersFromDocument(doc: Document, domain: string): OrderItem[] {
  const orderCards = findOrderCards(doc);
  const items: OrderItem[] = [];

  for (const card of orderCards) {
    const parsed = parseOrderCard(card, domain);
    if (parsed) {
      for (const item of parsed.items) {
        const orderItem = mapToOrderItem(parsed, item, domain);
        if (orderItem) {
          items.push(orderItem);
        }
      }
      // If no items found but we have order-level data, create a single entry
      if (parsed.items.length === 0 && parsed.orderId) {
        const orderItem = mapToOrderItem(parsed, null, domain);
        if (orderItem) {
          items.push(orderItem);
        }
      }
    }
  }

  return items;
}

/**
 * Extract the total number of orders from the page (for pagination calculation).
 * Amazon shows "N orders" or "N zamówień" etc. in a .num-orders span.
 */
export function extractTotalOrderCount(html: string): number {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return extractTotalOrderCountFromDocument(doc);
}

export function extractTotalOrderCountFromDocument(doc: Document): number {
  // Try .num-orders span (common across marketplaces)
  const numOrdersEl = doc.querySelector('.num-orders');
  if (numOrdersEl) {
    const text = numOrdersEl.textContent?.trim() || '';
    const match = text.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  // Try counting order cards as fallback
  const cards = findOrderCards(doc);
  return cards.length;
}

/**
 * Check if there's a next page in the pagination.
 * Returns the next page URL (relative) or null.
 */
export function extractNextPageUrl(html: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return extractNextPageUrlFromDocument(doc);
}

export function extractNextPageUrlFromDocument(doc: Document): string | null {
  // Amazon pagination: .a-pagination .a-last a (if not .a-disabled)
  const lastPageLink = doc.querySelector('.a-pagination .a-last:not(.a-disabled) a');
  if (lastPageLink) {
    return lastPageLink.getAttribute('href');
  }

  // Alternative: look for next page link in pagination
  const paginationLinks = doc.querySelectorAll('.a-pagination li a');
  const currentPage = doc.querySelector('.a-pagination .a-selected a');
  if (currentPage && paginationLinks.length > 0) {
    const currentPageNum = parseInt(currentPage.textContent?.trim() || '0', 10);
    for (const link of paginationLinks) {
      const pageNum = parseInt(link.textContent?.trim() || '0', 10);
      if (pageNum === currentPageNum + 1) {
        return link.getAttribute('href');
      }
    }
  }

  return null;
}

// ─── Order card finding ─────────────────────────────────────

/**
 * Find order card elements in the document.
 * Primary selector: div.order-card.js-order-card (confirmed from real HTML).
 * Falls back to other known selectors for different Amazon page versions.
 */
function findOrderCards(doc: Document): Element[] {
  // Primary: confirmed from real Amazon HTML (2026)
  const primary = doc.querySelectorAll('div.order-card.js-order-card');
  if (primary.length > 0) return Array.from(primary);

  // Fallback selectors for potential variations
  const fallbacks = [
    '.order-card',
    '.js-order-card',
    '[data-component="orderCard"]',
    '.a-box-group.order-card',
    '.a-box-group.js-order-card',
  ] as const;

  for (const selector of fallbacks) {
    const cards = doc.querySelectorAll(selector);
    if (cards.length > 0) return Array.from(cards);
  }

  return [];
}

// ─── Order card parsing ─────────────────────────────────────

function parseOrderCard(card: Element, domain: string): AmazonParsedOrder | null {
  const orderId = extractOrderId(card);
  const orderDate = extractOrderDate(card);
  const { total: orderTotal, currency: orderTotalCurrency } = extractOrderTotal(card);
  const status = extractOrderStatus(card);
  const items = extractItems(card, domain);

  if (!orderId && items.length === 0) return null;

  return {
    orderId,
    orderDate,
    orderTotal,
    orderTotalCurrency,
    status,
    items,
  };
}

// ─── Field extraction ───────────────────────────────────────

/**
 * Extract order ID from an order card.
 *
 * Real HTML structure:
 *   <div class="yohtmlc-order-id">
 *     <span class="a-color-secondary ...">Numer zamówienia</span>
 *     <span class="a-color-secondary ..." dir="ltr">405-1863629-2469930</span>
 *   </div>
 */
function extractOrderId(card: Element): string {
  // Strategy 1: .yohtmlc-order-id span[dir="ltr"] (most reliable — confirmed from real HTML)
  const dirLtr = card.querySelector('.yohtmlc-order-id span[dir="ltr"]');
  if (dirLtr) {
    const text = dirLtr.textContent?.trim() || '';
    if (text) return text;
  }

  // Strategy 2: .yohtmlc-order-id — get last span (order ID is always the second/last span)
  const orderIdContainer = card.querySelector('.yohtmlc-order-id');
  if (orderIdContainer) {
    const spans = orderIdContainer.querySelectorAll('span');
    for (const span of Array.from(spans).reverse()) {
      const text = span.textContent?.trim() || '';
      // Order ID pattern: ###-#######-#######
      if (/^\d{3}-\d{7}-\d{7}$/.test(text)) return text;
    }
    // Fallback: get any text that matches order ID pattern
    const allText = orderIdContainer.textContent || '';
    const match = allText.match(/(\d{3}-\d{7}-\d{7})/);
    if (match) return match[1];
  }

  // Strategy 3: [data-component="orderId"]
  const dataComp = card.querySelector('[data-component="orderId"]');
  if (dataComp) {
    const span = dataComp.querySelector('span[dir="ltr"], span.value, span:last-child');
    const text = span?.textContent?.trim() || dataComp.textContent?.trim() || '';
    const match = text.match(/(\d{3}-\d{7}-\d{7})/);
    if (match) return match[1];
  }

  // Strategy 4: regex scan of entire card text (last resort)
  const allText = card.textContent || '';
  const orderIdMatch = allText.match(/\b(\d{3}-\d{7}-\d{7})\b/);
  if (orderIdMatch) return orderIdMatch[1];

  return '';
}

/**
 * Extract order date from an order card.
 *
 * Real HTML structure (inside .order-header):
 *   <div class="a-column a-span3">
 *     <div>
 *       <span class="a-size-base a-color-secondary ...">Data złożenia zamówienia</span>
 *     </div>
 *     <div>
 *       <span class="a-size-base a-color-secondary aok-break-word">28 lutego 2026</span>
 *     </div>
 *   </div>
 *
 * The date column is the FIRST .a-column in .order-header.
 * The date value is in a span.a-color-secondary inside the SECOND div child of that column.
 */
function extractOrderDate(card: Element): string {
  // Strategy 1: First column in .order-header (positional — confirmed from real HTML)
  const header = card.querySelector('.order-header');
  if (header) {
    // The header contains columns: date (.a-span3), total (.a-span2), ship-to (.a-span3), order-id
    // Date is in the first .a-column
    const columns = header.querySelectorAll('.a-column');
    if (columns.length > 0) {
      const dateColumn = columns[0];
      // Get secondary-colored spans (skip the label, find the value)
      const spans = dateColumn.querySelectorAll('span.a-color-secondary');
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        // The date value contains a digit and is NOT a label
        // Dates look like "28 lutego 2026", "January 1, 2025", "1. Januar 2025"
        if (text && /\d/.test(text) && /\d{4}/.test(text)) {
          // Exclude order IDs and prices
          if (!text.match(/\d{3}-\d{7}-\d{7}/) && !text.match(/[€$£¥₹]/) && !text.includes('zł') && !text.includes('kr')) {
            return text;
          }
        }
      }
    }
  }

  // Strategy 2: Look for .a-span3 directly (some layouts may not have .order-header wrapper)
  const dateSpan3 = card.querySelector('.a-span3 span.a-color-secondary.aok-break-word');
  if (dateSpan3) {
    const text = dateSpan3.textContent?.trim() || '';
    if (text && /\d{4}/.test(text) && !text.match(/\d{3}-\d{7}-\d{7}/)) {
      return text;
    }
  }

  // Strategy 3: [data-component="orderDate"]
  const dataComp = card.querySelector('[data-component="orderDate"]');
  if (dataComp) {
    return dataComp.textContent?.trim() || '';
  }

  // Strategy 4: Search for date patterns in header
  if (header) {
    const spans = header.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent?.trim() || '';
      // Match common date patterns: "1 January 2025", "January 1, 2025", "1. ledna 2025"
      if (/\b\d{1,2}[\s.]\s*\w+\s+\d{4}\b/.test(text) || /\b\w+\s+\d{1,2},?\s+\d{4}\b/.test(text)) {
        return text;
      }
    }
  }

  return '';
}

/**
 * Extract order total from an order card.
 *
 * Real HTML structure (inside .order-header):
 *   <div class="a-column a-span2">
 *     <div>
 *       <span class="a-size-base a-color-secondary ...">Suma</span>
 *     </div>
 *     <div>
 *       <span class="a-size-base a-color-secondary aok-break-word">139,00&nbsp;zł</span>
 *     </div>
 *   </div>
 *
 * The total column is the SECOND .a-column in .order-header (first .a-span2).
 */
function extractOrderTotal(card: Element): { total: string; currency: string } {
  const header = card.querySelector('.order-header');

  // Strategy 1: Find .a-span2 columns in header — the first one is typically the total
  if (header) {
    const span2Columns = header.querySelectorAll('.a-column.a-span2');
    for (const col of span2Columns) {
      const spans = col.querySelectorAll('span.a-color-secondary');
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        // Price contains digits and either a currency symbol or currency text
        if (text && /\d/.test(text) && isPriceLike(text)) {
          return { total: text, currency: extractCurrency(text) };
        }
      }
    }
  }

  // Strategy 2: .yohtmlc-order-total (older layout)
  const totalEl = card.querySelector('.yohtmlc-order-total .value, .yohtmlc-order-total .a-color-price');
  if (totalEl) {
    const text = totalEl.textContent?.trim() || '';
    return { total: text, currency: extractCurrency(text) };
  }

  // Strategy 3: Search all .a-color-secondary spans in header for price-like text
  if (header) {
    const spans = header.querySelectorAll('span.a-color-secondary');
    for (const span of spans) {
      const text = span.textContent?.trim() || '';
      if (text && isPriceLike(text)) {
        return { total: text, currency: extractCurrency(text) };
      }
    }
  }

  return { total: '', currency: '' };
}

/**
 * Check if a text string looks like a price value.
 */
function isPriceLike(text: string): boolean {
  // Must contain at least one digit
  if (!/\d/.test(text)) return false;
  // Must contain a currency symbol, code, or known currency text
  if (/[€$£¥₹]/.test(text)) return true;
  if (/\b(PLN|SEK|NOK|DKK|CZK|HUF|TRY|AED|SAR|EGP|MXN|CAD|AUD|NZD|SGD|INR|BRL|JPY|CNY|KRW|USD|EUR|GBP)\b/i.test(text)) return true;
  if (/zł|kr|lei|Ft|Kč/.test(text)) return true;
  // Price-like pattern with comma or dot as decimal: "139,00" or "12.99"
  if (/\d+[.,]\d{2}\b/.test(text)) return true;
  return false;
}

/**
 * Extract order/shipment status from an order card.
 *
 * Real HTML structure:
 *   <div class="yohtmlc-shipment-status-primaryText">
 *     <span>Odebrano w dniu: 3 marca</span>
 *   </div>
 */
function extractOrderStatus(card: Element): string {
  // Strategy 1: .yohtmlc-shipment-status-primaryText (confirmed from real HTML)
  const statusEl = card.querySelector('.yohtmlc-shipment-status-primaryText');
  if (statusEl) {
    // Get the innermost text span
    const span = statusEl.querySelector('span');
    const text = span?.textContent?.trim() || statusEl.textContent?.trim() || '';
    if (text) return text;
  }

  // Strategy 2: Other known status selectors
  const altSelectors = [
    '.shipment-status-primaryText',
    '[data-component="shipmentStatus"]',
    '.delivery-box__primary-text',
    '.a-size-medium.a-color-success',
  ] as const;

  for (const sel of altSelectors) {
    const el = card.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim() || '';
      if (text && text.length < 200) return text;
    }
  }

  // Strategy 3: look for status-like colored spans
  const statusCandidates = card.querySelectorAll('.a-color-success, .a-color-state');
  for (const el of statusCandidates) {
    const text = el.textContent?.trim() || '';
    if (text && text.length < 100) return text;
  }

  return '';
}

/**
 * Extract items from an order card.
 *
 * Real HTML structure:
 *   <div class="delivery-box">
 *     <div class="shipment-is-delivered"> (status section)
 *     <div class="a-fixed-left-grid item-box"> (each item)
 *       <div class="a-fixed-left-grid-inner">
 *         <div class="a-fixed-left-grid-col a-col-left"> → .product-image img
 *         <div class="a-fixed-left-grid-col a-col-right"> → .yohtmlc-product-title a, etc.
 *       </div>
 *     </div>
 *   </div>
 */
function extractItems(card: Element, domain: string): AmazonParsedItem[] {
  // Primary: .item-box within delivery-box (confirmed from real HTML)
  const itemBoxes = card.querySelectorAll('.item-box');
  if (itemBoxes.length > 0) {
    return Array.from(itemBoxes)
      .map((el) => extractItemFromElement(el, domain))
      .filter((item): item is AmazonParsedItem => item !== null);
  }

  // Fallback selectors
  const fallbacks = [
    '.yohtmlc-item',
    '[data-component="purchasedItems"] [data-component="item"]',
    '.a-fixed-left-grid.item-box',
    '.shipment-item',
  ] as const;

  for (const sel of fallbacks) {
    const els = card.querySelectorAll(sel);
    if (els.length > 0) {
      return Array.from(els)
        .map((el) => extractItemFromElement(el, domain))
        .filter((item): item is AmazonParsedItem => item !== null);
    }
  }

  // Last resort: try to extract a single item from the card
  const item = extractSingleItemFromCard(card, domain);
  return item ? [item] : [];
}

function extractItemFromElement(el: Element, domain: string): AmazonParsedItem | null {
  const title = extractItemTitle(el);
  if (!title) return null;

  const { price, currency } = extractItemPrice(el);
  const productUrl = extractItemUrl(el, domain);
  const imageUrl = extractItemImage(el);
  const { seller, sellerUrl } = extractSeller(el, domain);
  const quantity = extractQuantity(el);

  return {
    title,
    price,
    currency,
    quantity,
    productUrl,
    imageUrl,
    seller,
    sellerUrl,
  };
}

function extractSingleItemFromCard(card: Element, domain: string): AmazonParsedItem | null {
  // Try to extract from less-structured order cards
  const titleLink = card.querySelector(
    '.yohtmlc-product-title a, a.a-link-normal[href*="/dp/"], a.a-link-normal[href*="/gp/product/"]',
  );
  if (!titleLink) return null;

  const title = titleLink.textContent?.trim() || '';
  if (!title) return null;

  const href = titleLink.getAttribute('href') || '';
  const productUrl = href.startsWith('http') ? href : href.startsWith('/') ? `https://www.${domain}${href}` : '';
  const img = card.querySelector('.product-image img, img') as HTMLImageElement | null;
  const imageUrl = img?.getAttribute('src') || '';
  const { seller, sellerUrl } = extractSeller(card, domain);
  const { price, currency } = extractItemPrice(card);

  return {
    title,
    price,
    currency,
    quantity: 1,
    productUrl,
    imageUrl,
    seller,
    sellerUrl,
  };
}

// ─── Item field helpers ─────────────────────────────────────

/**
 * Extract item title.
 *
 * Real HTML: <a class="a-link-normal yohtmlc-product-title" href="/dp/B0991W1HKT?...">
 *              Product title text
 *            </a>
 */
function extractItemTitle(el: Element): string {
  // Primary: .yohtmlc-product-title (can be <a> itself or contain <a>)
  const productTitle = el.querySelector('.yohtmlc-product-title');
  if (productTitle) {
    const text = productTitle.textContent?.trim() || '';
    if (text) return text;
  }

  // Fallback selectors
  const fallbacks = [
    'a[class*="itemLink"]',
    '[data-component="itemTitle"] a',
    'a.a-link-normal[href*="/dp/"]',
    'a.a-link-normal[href*="/gp/product/"]',
  ] as const;

  for (const sel of fallbacks) {
    const titleEl = el.querySelector(sel);
    if (titleEl) {
      const text = titleEl.textContent?.trim() || '';
      if (text) return text;
    }
  }

  return '';
}

/**
 * Extract item price.
 * Individual item prices may not always be visible in order history;
 * falls back to order total when per-item price is unavailable.
 */
function extractItemPrice(el: Element): { price: string; currency: string } {
  const selectors = [
    '.a-color-price',
    '[data-component="unitPrice"]',
    '.item-view-left-col-inner .a-text-bold',
  ] as const;

  for (const sel of selectors) {
    const priceEl = el.querySelector(sel);
    if (priceEl) {
      const text = priceEl.textContent?.trim() || '';
      if (text && /\d/.test(text)) {
        return { price: text, currency: extractCurrency(text) };
      }
    }
  }

  return { price: '', currency: '' };
}

/**
 * Extract item product URL.
 *
 * Real HTML: <a class="a-link-normal yohtmlc-product-title" href="/dp/B0991W1HKT?ref=...">
 * The href is relative, starting with /dp/ASIN.
 */
function extractItemUrl(el: Element, domain: string): string {
  const link = el.querySelector(
    '.yohtmlc-product-title[href], .yohtmlc-product-title a[href], a[href*="/dp/"], a[href*="/gp/product/"]',
  ) as HTMLAnchorElement | null;
  if (!link) return '';

  const href = link.getAttribute('href') || '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `https://www.${domain}${href}`;
  return '';
}

/**
 * Extract item image URL.
 *
 * Real HTML: <div class="product-image">
 *              <img alt="" src="https://m.media-amazon.com/images/I/...._AC_US140_.jpg">
 *            </div>
 */
function extractItemImage(el: Element): string {
  // Primary: .product-image img (confirmed from real HTML)
  const productImg = el.querySelector('.product-image img') as HTMLImageElement | null;
  if (productImg) {
    return productImg.getAttribute('src') || productImg.getAttribute('data-src') || '';
  }

  // Fallback: any img in the element
  const img = el.querySelector('img') as HTMLImageElement | null;
  if (!img) return '';
  return img.getAttribute('src') || img.getAttribute('data-src') || '';
}

function extractSeller(el: Element, domain: string): { seller: string; sellerUrl: string } {
  // Strategy 1: seller link
  const sellerLink = el.querySelector('a[href*="/gp/help/seller/"], a[href*="/sp?"]') as HTMLAnchorElement | null;
  if (sellerLink) {
    const seller = sellerLink.textContent?.trim() || '';
    const href = sellerLink.getAttribute('href') || '';
    const sellerUrl = href.startsWith('http') ? href : href.startsWith('/') ? `https://www.${domain}${href}` : '';
    return { seller, sellerUrl };
  }

  // Strategy 2: "Sold by" / "Sprzedawca:" text
  const textContent = el.textContent || '';
  const soldByPatterns = [
    /(?:Sold by|Sprzedawca[:\s]|Verkauft von|Vendu par|Venduto da|Vendido por|Verkocht door|Säljs av)\s*[:.]?\s*(.+?)(?:\n|$)/i,
  ];
  for (const pattern of soldByPatterns) {
    const match = textContent.match(pattern);
    if (match) {
      return { seller: match[1].trim(), sellerUrl: '' };
    }
  }

  return { seller: '', sellerUrl: '' };
}

function extractQuantity(el: Element): number {
  const text = el.textContent || '';

  // "Qty: 2", "Ilość: 2", "Menge: 2", "Qté: 2", etc.
  const qtyMatch = text.match(/(?:Qty|Ilość|Menge|Qté|Quantità|Cantidad|Aantal|Antal|Adet|数量|मात्रा|الكمية)[:\s]*(\d+)/i);
  if (qtyMatch) return parseInt(qtyMatch[1], 10);

  return 1;
}

// ─── Mapping to OrderItem ───────────────────────────────────

function mapToOrderItem(
  order: AmazonParsedOrder,
  item: AmazonParsedItem | null,
  domain: string,
): OrderItem | null {
  const orderId = order.orderId;
  const title = item?.title || 'Unknown item';
  const productUrl = item?.productUrl || '';

  // Extract product ID from URL: /dp/B0XXXXX or /gp/product/B0XXXXX
  const productId = extractProductId(productUrl);

  // Composite ID for dedup
  const id = [orderId, productId, title.slice(0, 30)].filter(Boolean).join('-');
  if (!id) return null;

  // Price
  const priceDisplay = item?.price || order.orderTotal || '';
  const currency = item?.currency || order.orderTotalCurrency || '';
  const priceInfo = buildPriceInfo(priceDisplay);

  // Date
  const orderDateIso = parseAmazonDate(order.orderDate);
  const orderDate = order.orderDate;

  return {
    id,
    orderId,
    orderLineId: '',
    productId,
    skuId: '',
    title,
    price: priceDisplay,
    priceInfo,
    currency,
    quantity: item?.quantity || 1,
    orderDate,
    orderDateIso,
    status: order.status,
    storeName: item?.seller || 'Amazon',
    storePageUrl: item?.sellerUrl || '',
    productUrl,
    imageUrl: item?.imageUrl || '',
    attributes: '',
    timestamp: Date.now(),
    ignoreExport: false,
    tags: [],
    providerId: 'amazon',
  };
}

// ─── Helpers ────────────────────────────────────────────────

function extractProductId(url: string): string {
  if (!url) return '';

  // /dp/B0XXXXXXX
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
  if (dpMatch) return dpMatch[1];

  // /gp/product/B0XXXXXXX
  const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/);
  if (gpMatch) return gpMatch[1];

  return '';
}

/**
 * Extract ISO 4217 currency code from a price string.
 */
function extractCurrency(text: string): string {
  if (!text) return '';

  // Symbol → code mapping
  const symbolMap: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    'R$': 'BRL',
    'S$': 'SGD',
  };

  // Check multi-char symbols first (R$, S$) before single-char ($)
  for (const symbol of ['R$', 'S$']) {
    if (text.includes(symbol)) return symbolMap[symbol];
  }
  for (const [symbol, code] of Object.entries(symbolMap)) {
    if (symbol.length === 1 && text.includes(symbol)) return code;
  }

  // Text-based currency codes
  const codeMatch = text.match(/\b(PLN|SEK|NOK|DKK|CZK|HUF|TRY|AED|SAR|EGP|MXN|CAD|AUD|NZD|SGD|INR|BRL|JPY|CNY|KRW|THB|MYR|IDR|PHP|VND|USD|EUR|GBP)\b/i);
  if (codeMatch) return codeMatch[1].toUpperCase();

  // Amazon-specific: "zł" for PLN, "kr" for SEK/NOK/DKK
  if (text.includes('zł')) return 'PLN';
  if (text.includes('kr')) return 'SEK'; // Could be NOK/DKK too — SEK as default
  if (text.includes('Kč')) return 'CZK';
  if (text.includes('Ft')) return 'HUF';
  if (text.includes('lei')) return 'RON';

  return '';
}

/**
 * Parse a date string from Amazon into ISO format (YYYY-MM-DD).
 * Amazon uses locale-specific date formats:
 *   - "January 1, 2025" (en-US)
 *   - "1 January 2025" (en-GB)
 *   - "1. Januar 2025" (de)
 *   - "1 janvier 2025" (fr)
 *   - "28 lutego 2026" (pl)
 *   - etc.
 */
function parseAmazonDate(dateStr: string): string {
  if (!dateStr) return '';

  // Try extracting day/month/year manually for European formats first
  // "28 lutego 2026", "1. ledna 2025", "1 januari 2025", "1 janvier 2025", etc.
  const euroMatch = dateStr.match(/(\d{1,2})[.\s]+(\w+)\s+(\d{4})/);
  if (euroMatch) {
    const day = parseInt(euroMatch[1], 10);
    const monthStr = euroMatch[2].toLowerCase();
    const year = parseInt(euroMatch[3], 10);
    const month = parseMonthName(monthStr);
    if (month > 0) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // US format: "January 1, 2025"
  const usMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (usMatch) {
    const monthStr = usMatch[1].toLowerCase();
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);
    const month = parseMonthName(monthStr);
    if (month > 0) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Numeric formats: "01/01/2025", "01-01-2025", "01.01.2025"
  const numMatch = dateStr.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (numMatch) {
    const a = parseInt(numMatch[1], 10);
    const b = parseInt(numMatch[2], 10);
    const year = parseInt(numMatch[3], 10);
    // Assume day/month/year for most locales (not US)
    if (a <= 12 && b <= 31) {
      return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
    } else if (b <= 12 && a <= 31) {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  // Try native Date parsing as last resort (works for many formats)
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    return formatIsoDate(d);
  }

  return '';
}

/**
 * Map month name (in various languages) to month number (1-12).
 */
function parseMonthName(name: string): number {
  const monthMap: Record<string, number> = {
    // English
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    // German
    januar: 1, februar: 2, märz: 3, mai: 5, juni: 6, juli: 7, oktober: 10, dezember: 12,
    // French
    janvier: 1, février: 2, mars: 3, avril: 4, juin: 6, juillet: 7,
    août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
    // Spanish
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    // Italian
    gennaio: 1, febbraio: 2, aprile: 4, maggio: 5, giugno: 6,
    luglio: 7, settembre: 9, ottobre: 10, dicembre: 12,
    // Portuguese
    janeiro: 1, fevereiro: 2, março: 3, maio: 5, junho: 6,
    julho: 7, setembro: 9, outubro: 10, dezembro: 12,
    // Dutch
    januari: 1, maart: 3, mei: 5, augustus: 8,
    // Polish
    stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
    lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12,
    // Swedish (unique entries only — februari/juni/juli already covered by German/Dutch)
    maj: 5, augusti: 8,
    // Turkish
    ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
    temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
    // Arabic
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
    يوليو: 7, أغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
  };

  return monthMap[name] || 0;
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build pipe-separated price info from a display price string.
 * e.g. "139,00 zł" → "139,00 zł|139|00", "$12.99" → "$12.99|12|99"
 */
function buildPriceInfo(displayPrice: string): string {
  if (!displayPrice) return '';

  // Extract numeric amount: "139,00 zł" → "139,00", "$1,234.56" → "1,234.56"
  const cleaned = displayPrice.replace(/[^\d.,]/g, '');
  if (!cleaned) return displayPrice;

  // Determine decimal separator (last . or , if followed by exactly 2 digits)
  let amount = cleaned;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot && cleaned.length - lastComma === 3) {
    // European: "1.234,56" → "1234.56" or "139,00" → "139.00"
    amount = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && cleaned.length - lastDot === 3) {
    // US: "1,234.56" → "1234.56"
    amount = cleaned.replace(/,/g, '');
  }

  const parts = amount.split('.');
  const integer = parts[0] || '0';
  const decimal = parts[1] || '00';

  return `${displayPrice}|${integer}|${decimal}`;
}
