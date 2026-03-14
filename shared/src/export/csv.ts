import type { OrderItem } from '../types/order';

const CSV_HEADERS = [
  'Order Date',
  'Order ID',
  'Title',
  'Qty',
  'Price',
  'Store',
  'Product ID',
  'SKU ID',
  'Attributes',
  'Price Info',
  'Currency',
  'Status',
  'Product Url',
  'Product Image Url',
  'Store Url',
  'Tags',
] as const;

/**
 * Export orders to CSV format compatible with AliExpress Shopper Inventory.
 */
export function exportToCsv(orders: OrderItem[]): string {
  const rows: string[] = [];

  // Header row
  rows.push(CSV_HEADERS.join(','));

  for (const order of orders) {
    const row = [
      escapeCsv(order.orderDate),
      escapeCsv(order.orderId),
      escapeCsv(order.title),
      String(order.quantity),
      escapeCsv(order.price),
      escapeCsv(order.storeName),
      escapeCsv(order.productId),
      escapeCsv(order.skuId),
      escapeCsv(order.attributes),
      escapeCsv(order.priceInfo),
      escapeCsv(order.currency),
      escapeCsv(order.status),
      escapeCsv(order.productUrl),
      escapeCsv(order.imageUrl),
      escapeCsv(order.storePageUrl),
      escapeCsv(order.tags.join('; ')),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function escapeCsv(value: string): string {
  if (!value) return '';
  // If value contains comma, quote, or newline, wrap in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
