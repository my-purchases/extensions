import type { OrderItem } from '../types/order';

/**
 * Export orders as tab-separated text for pasting into Google Sheets / Excel.
 */
export function exportToClipboard(orders: OrderItem[]): string {
  const headers = [
    'Order Date',
    'Order ID',
    'Title',
    'Qty',
    'Price',
    'Currency',
    'Status',
    'Store',
    'Product URL',
    'Image URL',
    'Attributes',
    'Tags',
  ];

  const rows = orders.map((o) =>
    [
      o.orderDate,
      o.orderId,
      o.title,
      String(o.quantity),
      o.price,
      o.currency,
      o.status,
      o.storeName,
      o.productUrl,
      o.imageUrl,
      o.attributes,
      o.tags.join('; '),
    ].join('\t'),
  );

  return [headers.join('\t'), ...rows].join('\n');
}
