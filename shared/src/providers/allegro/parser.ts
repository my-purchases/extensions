/**
 * Allegro order parser.
 *
 * Parses the Allegro `myorder-api/myorders` API response into OrderItem[].
 *
 * Response structure (confirmed from real API):
 *   {
 *     orderGroups: [
 *       {
 *         groupId: "uuid",
 *         myorders: [
 *           {
 *             id: "uuid",
 *             purchaseId: "uuid",
 *             seller: { id: "12345", login: "ShopName" },
 *             offers: [
 *               {
 *                 id: "123456789",       // numeric string = offer ID
 *                 title: "Product name",
 *                 friendlyUrl: "https://allegro.pl/oferta/...",
 *                 unitPrice: { amount: "7.50", currency: "PLN" },
 *                 offerPrice: { amount: "15.00", currency: "PLN" },
 *                 quantity: 2,
 *                 imageUrl: "https://...",
 *                 productId: "uuid",
 *                 orderOfferId: "uuid",
 *               }
 *             ],
 *             delivery: { ... },
 *             totalCost: { amount: "22.50", currency: "PLN" },
 *             payment: { ... },
 *             orderDate: "2025-11-15T10:30:00.000Z",
 *             status: {
 *               primary: { status: "DELIVERED" },
 *               primaryCustom: { label: "Przesyłka odebrana" }
 *             }
 *           }
 *         ],
 *         totalCost: { ... },
 *         status: { ... },
 *         delivery: { ... }
 *       }
 *     ],
 *     total: 252
 *   }
 */

import type { OrderItem, ProviderId } from '../../types/order';

// ─── Types for Allegro API response ─────────────────────────

interface AllegroPrice {
  amount?: string;
  currency?: string;
}

interface AllegroSeller {
  id?: string;
  login?: string;
}

interface AllegroOffer {
  id?: string;
  title?: string;
  friendlyUrl?: string;
  unitPrice?: AllegroPrice;
  offerPrice?: AllegroPrice;
  quantity?: number;
  imageUrl?: string;
  productId?: string;
  orderOfferId?: string;
}

interface AllegroStatus {
  primary?: {
    status?: string;
  };
  primaryCustom?: {
    label?: string;
  };
}

interface AllegroMyOrder {
  id?: string;
  purchaseId?: string;
  seller?: AllegroSeller;
  offers?: AllegroOffer[];
  delivery?: unknown;
  totalCost?: AllegroPrice;
  payment?: unknown;
  orderDate?: string;
  status?: AllegroStatus;
}

interface AllegroOrderGroup {
  groupId?: string;
  myorders?: AllegroMyOrder[];
  totalCost?: AllegroPrice;
  status?: AllegroStatus;
  delivery?: unknown;
}

interface AllegroApiResponse {
  orderGroups?: AllegroOrderGroup[];
  total?: number;
}

// ─── Parser ─────────────────────────────────────────────────

/**
 * Parse an Allegro `myorders` API response into OrderItem[].
 * The providerId is passed in so the same parser works for both allegro-pl and allegro-cz.
 */
export function parseAllegroApiResponse(body: unknown, providerId: ProviderId = 'allegro-pl'): OrderItem[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const response = body as AllegroApiResponse;
  const orderGroups = response.orderGroups;

  if (!Array.isArray(orderGroups) || orderGroups.length === 0) {
    return [];
  }

  const items: OrderItem[] = [];
  const domain = providerId === 'allegro-cz' ? 'allegro.cz' : 'allegro.pl';

  for (const group of orderGroups) {
    const myorders = group.myorders;
    if (!Array.isArray(myorders)) continue;

    for (const order of myorders) {
      const offers = order.offers;
      if (!Array.isArray(offers)) continue;

      for (const offer of offers) {
        const item = mapToOrderItem(order, offer, group, providerId, domain);
        if (item) {
          items.push(item);
        }
      }
    }
  }

  return items;
}

// ─── Field mapping ──────────────────────────────────────────

function mapToOrderItem(
  order: AllegroMyOrder,
  offer: AllegroOffer,
  group: AllegroOrderGroup,
  providerId: ProviderId,
  domain: string,
): OrderItem | null {
  const orderId = order.id || group.groupId || '';
  const orderOfferId = offer.orderOfferId || '';
  const offerId = offer.id || '';
  const productId = offer.productId || '';

  if (!orderId && !offerId) return null;

  // Composite ID: "{orderOfferId}-{offerId}-{productId}" — deterministic dedup key
  const id = [orderOfferId, offerId, productId].filter(Boolean).join('-');
  if (!id) return null;

  // Price: use unitPrice (per-item price)
  const unitPrice = offer.unitPrice;
  const amount = unitPrice?.amount || '';
  const currency = unitPrice?.currency || offer.offerPrice?.currency || order.totalCost?.currency || 'PLN';

  const price = amount ? `${amount} ${currency}` : '';
  const priceInfo = buildPriceInfo(price, amount);

  // Date
  const orderDateIso = order.orderDate ? formatIsoDate(order.orderDate) : '';
  const orderDate = order.orderDate ? formatDisplayDate(order.orderDate) : '';

  // Status: prefer localized primaryCustom.label, fall back to primary.status
  const status = order.status?.primaryCustom?.label
    || mapStatusEnum(order.status?.primary?.status)
    || group.status?.primaryCustom?.label
    || mapStatusEnum(group.status?.primary?.status)
    || '';

  // Seller / store
  const sellerLogin = order.seller?.login || '';
  const sellerId = order.seller?.id || '';
  const storePageUrl = sellerId
    ? `https://${domain}/uzytkownik/${sellerLogin}`
    : '';

  // Product URL: use friendlyUrl from offer, or construct from offer ID
  const productUrl = offer.friendlyUrl || (offerId ? `https://${domain}/oferta/${offerId}` : '');

  return {
    id,
    orderId,
    orderLineId: orderOfferId,
    productId,
    skuId: offerId,
    title: offer.title || '',
    price,
    priceInfo,
    currency,
    quantity: offer.quantity || 1,
    orderDate,
    orderDateIso,
    status,
    storeName: sellerLogin || 'Allegro',
    storePageUrl,
    productUrl,
    imageUrl: offer.imageUrl || '',
    attributes: '',
    timestamp: Date.now(),
    ignoreExport: false,
    tags: [],
    providerId,
  };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Extract ISO date (YYYY-MM-DD) from an ISO 8601 date string.
 */
function formatIsoDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Format a human-readable date from ISO 8601 string.
 */
function formatDisplayDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Build pipe-separated price info: "7.50 PLN|7|50"
 */
function buildPriceInfo(displayPrice: string, rawAmount: string): string {
  if (!rawAmount) return displayPrice;

  const parts = rawAmount.split('.');
  const integer = parts[0] || '0';
  const decimal = parts[1] || '00';

  return `${displayPrice}|${integer}|${decimal}`;
}

/**
 * Map Allegro status enum to human-readable text (fallback when localized label is missing).
 */
function mapStatusEnum(status?: string): string {
  if (!status) return '';

  const map: Record<string, string> = {
    'DELIVERED': 'Delivered',
    'IN_PREPARATION': 'In Preparation',
    'READY_FOR_PICKUP': 'Ready for Pickup',
    'IN_TRANSIT': 'In Transit',
    'SENT': 'Sent',
    'RETURNED': 'Returned',
    'CANCELLED': 'Cancelled',
    'NEW': 'New',
    'PROCESSING': 'Processing',
    'BOUGHT': 'Bought',
    'FILLED_IN': 'Filled In',
    'READY_FOR_SHIPMENT': 'Ready for Shipment',
  };

  return map[status] || status;
}
