import type { OrderItem } from '../types/order';

/**
 * Export orders to a standalone HTML file with a styled table.
 */
export function exportToHtml(orders: OrderItem[]): string {
  const rows = orders
    .map(
      (o) => `    <tr>
      <td>${esc(o.orderDate)}</td>
      <td>${esc(o.orderId)}</td>
      <td>
        ${o.imageUrl ? `<img src="${esc(o.imageUrl)}" alt="" width="48" height="48" style="vertical-align:middle;margin-right:8px;">` : ''}
        ${o.productUrl ? `<a href="${esc(o.productUrl)}" target="_blank">${esc(o.title)}</a>` : esc(o.title)}
      </td>
      <td>${o.quantity}</td>
      <td>${esc(o.price)}</td>
      <td>${esc(o.status)}</td>
      <td>${o.storePageUrl ? `<a href="${esc(o.storePageUrl)}" target="_blank">${esc(o.storeName)}</a>` : esc(o.storeName)}</td>
      <td>${esc(o.attributes)}</td>
      <td>${esc(o.tags.join(', '))}</td>
    </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Purchases - Export (${orders.length} orders)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f8fafc; color: #1e293b; }
    h1 { margin-bottom: 16px; font-size: 1.5rem; }
    .meta { color: #64748b; margin-bottom: 20px; font-size: 0.875rem; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #3b82f6; color: white; text-align: left; padding: 12px; font-weight: 600; font-size: 0.813rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; vertical-align: middle; }
    tr:hover td { background: #f1f5f9; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { border-radius: 4px; }
  </style>
</head>
<body>
  <h1>My Purchases Export</h1>
  <p class="meta">${orders.length} orders &middot; Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Order ID</th>
        <th>Product</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Status</th>
        <th>Store</th>
        <th>Attributes</th>
        <th>Tags</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
