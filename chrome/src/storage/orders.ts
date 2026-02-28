import type { OrderItem, CollectionStatus } from '@/types/order';
import { STORAGE_KEY_ORDERS, STORAGE_KEY_STATUS } from '@/shared/constants';

// ─── Orders ─────────────────────────────────────────────────

/** Get all stored orders */
export async function getOrders(): Promise<OrderItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_ORDERS);
  return (result[STORAGE_KEY_ORDERS] as OrderItem[]) ?? [];
}

/** Save orders (replaces all) */
export async function setOrders(orders: OrderItem[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_ORDERS]: orders });
}

/**
 * Merge new orders with existing ones.
 * Deduplicates by order ID — newer entries replace older ones.
 * Returns the count of newly added orders.
 */
export async function mergeOrders(newOrders: OrderItem[]): Promise<number> {
  const existing = await getOrders();
  const map = new Map<string, OrderItem>();

  // Existing orders first
  for (const order of existing) {
    map.set(order.id, order);
  }

  // New orders overwrite existing with same ID
  let addedCount = 0;
  for (const order of newOrders) {
    if (!map.has(order.id)) {
      addedCount++;
    }
    map.set(order.id, order);
  }

  const merged = Array.from(map.values());
  // Sort by date descending (newest first)
  merged.sort((a, b) => {
    const dateA = new Date(a.orderDateIso || a.orderDate).getTime() || 0;
    const dateB = new Date(b.orderDateIso || b.orderDate).getTime() || 0;
    return dateB - dateA;
  });

  await setOrders(merged);
  return addedCount;
}

/** Delete orders by IDs */
export async function deleteOrders(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const existing = await getOrders();
  const filtered = existing.filter((o) => !idSet.has(o.id));
  await setOrders(filtered);
}

/** Update a single order */
export async function updateOrder(id: string, updates: Partial<OrderItem>): Promise<void> {
  const existing = await getOrders();
  const idx = existing.findIndex((o) => o.id === id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...updates };
    await setOrders(existing);
  }
}

/** Clear all orders */
export async function clearOrders(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_ORDERS);
}

// ─── Collection Status ──────────────────────────────────────

const defaultStatus: CollectionStatus = {
  providerId: 'aliexpress',
  isCollecting: false,
  ordersCollected: 0,
  lastCollectedAt: null,
  error: null,
};

export async function getStatus(): Promise<CollectionStatus> {
  const result = await chrome.storage.local.get(STORAGE_KEY_STATUS);
  return { ...defaultStatus, ...(result[STORAGE_KEY_STATUS] as Partial<CollectionStatus>) };
}

export async function updateStatus(updates: Partial<CollectionStatus>): Promise<CollectionStatus> {
  const current = await getStatus();
  const updated = { ...current, ...updates };
  await chrome.storage.local.set({ [STORAGE_KEY_STATUS]: updated });
  return updated;
}
