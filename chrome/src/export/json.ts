import type { OrderItem } from '@/types/order';

/**
 * Export orders to JSON format compatible with AliExpress Shopper Inventory.
 * This is the same format the web app expects for import.
 */
export function exportToJson(orders: OrderItem[]): string {
  return JSON.stringify(orders, null, 2);
}
