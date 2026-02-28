import type { OrderItem, CollectionStatus } from '@/types/order';

// ─── Message directions ─────────────────────────────────────
// main-world.ts → (postMessage) → isolated-world.ts → (chrome.runtime) → service-worker.ts
// popup → (chrome.runtime) → service-worker.ts
// service-worker.ts → (chrome.tabs.sendMessage) → isolated-world.ts (for auto-collect)

/** Message types for window.postMessage (main-world ↔ isolated-world) */
export const WINDOW_MSG_PREFIX = 'MPC_' as const;

export interface WindowOrdersMessage {
  type: typeof WINDOW_MSG_PREFIX;
  action: 'ORDERS_CAPTURED';
  orders: OrderItem[];
}

export interface WindowStatusMessage {
  type: typeof WINDOW_MSG_PREFIX;
  action: 'COLLECTION_STATUS';
  status: Partial<CollectionStatus>;
}

export type WindowMessage = WindowOrdersMessage | WindowStatusMessage;

/** Message types for chrome.runtime (isolated-world / popup ↔ service-worker) */
export type RuntimeMessage =
  | { type: 'ORDERS_CAPTURED'; orders: OrderItem[] }
  | { type: 'COLLECTION_STATUS'; status: Partial<CollectionStatus> }
  | { type: 'GET_ORDERS'; filters?: OrderFilters }
  | { type: 'GET_STATUS' }
  | { type: 'CLEAR_ORDERS' }
  | { type: 'DELETE_ORDERS'; ids: string[] }
  | { type: 'UPDATE_ORDER'; id: string; updates: Partial<OrderItem> }
  | { type: 'EXPORT_ORDERS'; format: ExportFormat; ids?: string[] }
  | { type: 'START_AUTO_COLLECT' }
  | { type: 'STOP_AUTO_COLLECT' }
  | { type: 'AUTO_COLLECT_STATUS' }
  | { type: 'AUTO_COLLECT_PROGRESS'; page: number; totalOrders: number; done: boolean; error?: string };

/** Response types from service worker */
export type RuntimeResponse =
  | { success: true; orders?: OrderItem[]; status?: CollectionStatus; data?: string; autoCollect?: AutoCollectState }
  | { success: false; error: string };

/** Export format options */
export type ExportFormat = 'csv' | 'json' | 'html' | 'clipboard';

/** Order filter criteria */
export interface OrderFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  providerId?: string;
}

/** Auto-collect state */
export interface AutoCollectState {
  isRunning: boolean;
  currentPage: number;
  totalOrders: number;
  error?: string;
}
