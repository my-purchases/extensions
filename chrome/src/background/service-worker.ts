/**
 * Service Worker (Manifest V3 background script).
 * Receives orders from content scripts, manages storage, handles export requests from popup.
 * Forwards auto-collect commands to content scripts via chrome.tabs.sendMessage.
 */

import type { RuntimeMessage, RuntimeResponse, AutoCollectState } from '@/shared/messages';
import { parseApiResponse } from '@/providers/aliexpress/parser';
import {
  getOrders,
  mergeOrders,
  deleteOrders,
  updateOrder,
  clearOrders,
  getStatus,
  updateStatus,
} from '@/storage/orders';
import { exportToCsv } from '@/export/csv';
import { exportToJson } from '@/export/json';
import { exportToHtml } from '@/export/html';
import { exportToClipboard } from '@/export/clipboard';
import type { OrderItem } from '@/types/order';

const LOG_PREFIX = '[MPC:sw]';

// ─── Auto-collect state (tracked in service worker) ─────────

let autoCollectState: AutoCollectState = {
  isRunning: false,
  currentPage: 0,
  totalOrders: 0,
};

// ─── Message handler ────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage & { _rawApiResponse?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: RuntimeResponse) => void,
  ) => {
    console.debug(LOG_PREFIX, 'Received message:', message.type);

    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        console.error(LOG_PREFIX, 'Error handling message:', err);
        sendResponse({ success: false, error: String(err) });
      });

    // Return true to indicate async response
    return true;
  },
);

async function handleMessage(
  message: RuntimeMessage & { _rawApiResponse?: unknown },
): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'ORDERS_CAPTURED': {
      // Parse raw API response if available, otherwise use pre-parsed orders
      let orders: OrderItem[] = message.orders ?? [];

      if (message._rawApiResponse) {
        const parsed = parseApiResponse(message._rawApiResponse);
        if (parsed.length > 0) {
          orders = parsed;
        }
      }

      if (orders.length === 0) {
        return { success: true, orders: [] };
      }

      const addedCount = await mergeOrders(orders);
      const allOrders = await getOrders();

      await updateStatus({
        ordersCollected: allOrders.length,
        lastCollectedAt: new Date().toISOString(),
        error: null,
      });

      // Update auto-collect state with current total
      if (autoCollectState.isRunning) {
        autoCollectState.totalOrders = allOrders.length;
      }

      console.debug(LOG_PREFIX, `Merged ${orders.length} orders (${addedCount} new). Total: ${allOrders.length}`);

      // Notify popup about update via badge
      try {
        await chrome.action.setBadgeText({ text: String(allOrders.length) });
        await chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
      } catch {
        // Badge API might not be available
      }

      return { success: true, orders: allOrders };
    }

    case 'COLLECTION_STATUS': {
      const status = await updateStatus(message.status);
      return { success: true, status };
    }

    case 'GET_ORDERS': {
      let orders = await getOrders();

      // Apply filters if provided
      if (message.filters) {
        const { search, status, dateFrom, dateTo } = message.filters;

        if (search) {
          const q = search.toLowerCase();
          orders = orders.filter(
            (o) =>
              o.title.toLowerCase().includes(q) ||
              o.orderId.toLowerCase().includes(q) ||
              o.storeName.toLowerCase().includes(q),
          );
        }
        if (status) {
          orders = orders.filter((o) => o.status === status);
        }
        if (dateFrom) {
          orders = orders.filter((o) => o.orderDateIso >= dateFrom);
        }
        if (dateTo) {
          orders = orders.filter((o) => o.orderDateIso <= dateTo);
        }
      }

      return { success: true, orders };
    }

    case 'GET_STATUS': {
      const status = await getStatus();
      return { success: true, status };
    }

    case 'CLEAR_ORDERS': {
      await clearOrders();
      await updateStatus({ ordersCollected: 0 });
      try {
        await chrome.action.setBadgeText({ text: '' });
      } catch {
        // Ignore
      }
      return { success: true };
    }

    case 'DELETE_ORDERS': {
      await deleteOrders(message.ids);
      const remaining = await getOrders();
      await updateStatus({ ordersCollected: remaining.length });
      return { success: true, orders: remaining };
    }

    case 'UPDATE_ORDER': {
      await updateOrder(message.id, message.updates);
      return { success: true };
    }

    case 'EXPORT_ORDERS': {
      const allOrders = await getOrders();
      const ordersToExport = message.ids
        ? allOrders.filter((o) => message.ids!.includes(o.id))
        : allOrders.filter((o) => !o.ignoreExport);

      let data: string;
      switch (message.format) {
        case 'csv':
          data = exportToCsv(ordersToExport);
          break;
        case 'json':
          data = exportToJson(ordersToExport);
          break;
        case 'html':
          data = exportToHtml(ordersToExport);
          break;
        case 'clipboard':
          data = exportToClipboard(ordersToExport);
          break;
        default:
          return { success: false, error: `Unknown export format: ${message.format}` };
      }

      return { success: true, data };
    }

    // ─── Auto-collect ─────────────────────────────────────────

    case 'START_AUTO_COLLECT': {
      const tab = await findAliExpressOrderTab();
      if (!tab?.id) {
        return { success: false, error: 'No AliExpress orders page found. Open the orders page first.' };
      }

      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'START_AUTO_COLLECT' });
        autoCollectState = {
          isRunning: true,
          currentPage: 0,
          totalOrders: (await getOrders()).length,
        };
        return { success: true, autoCollect: autoCollectState };
      } catch (err) {
        return { success: false, error: `Failed to start: ${String(err)}` };
      }
    }

    case 'STOP_AUTO_COLLECT': {
      const tab = await findAliExpressOrderTab();
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTO_COLLECT' });
        } catch {
          // Tab might have closed
        }
      }
      autoCollectState.isRunning = false;
      return { success: true, autoCollect: autoCollectState };
    }

    case 'AUTO_COLLECT_STATUS': {
      return { success: true, autoCollect: autoCollectState };
    }

    case 'AUTO_COLLECT_PROGRESS': {
      // Received from isolated-world content script
      const allOrders = await getOrders();
      autoCollectState = {
        isRunning: !message.done,
        currentPage: message.page,
        totalOrders: allOrders.length,
        error: message.error,
      };
      console.debug(LOG_PREFIX, `Auto-collect progress: page ${message.page}, total ${allOrders.length}, done=${message.done}`);
      return { success: true, autoCollect: autoCollectState };
    }

    default:
      return { success: false, error: `Unknown message type` };
  }
}

// ─── Helpers ────────────────────────────────────────────────

async function findAliExpressOrderTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({
    url: '*://*.aliexpress.com/p/order/*',
  });
  // Prefer the active one, otherwise take the first match
  return tabs.find((t) => t.active) ?? tabs[0];
}

// ─── Extension install / update ─────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.debug(LOG_PREFIX, 'Extension installed/updated:', details.reason);
  if (details.reason === 'install') {
    updateStatus({
      providerId: 'aliexpress',
      isCollecting: false,
      ordersCollected: 0,
      lastCollectedAt: null,
      error: null,
    });
  }
});
