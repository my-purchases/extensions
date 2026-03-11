/**
 * Service Worker (Manifest V3 background script).
 * Receives orders from content scripts, manages storage, handles export requests from popup.
 * Forwards auto-collect commands to content scripts via chrome.tabs.sendMessage.
 * Supports multiple providers: AliExpress (full parsing), Temu, and Allegro (PL + CZ).
 */

import type { RuntimeMessage, RuntimeResponse, AutoCollectState } from '@/shared/messages';
import { parseApiResponse } from '@/providers/aliexpress/parser';
import { parseTemuApiResponse } from '@/providers/temu/parser';
import { parseAllegroApiResponse } from '@/providers/allegro/parser';
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
import type { OrderItem, ProviderId } from '@/types/order';

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
  message: RuntimeMessage & { _rawApiResponse?: unknown; _providerId?: string },
): Promise<RuntimeResponse> {
  switch (message.type) {
    case 'ORDERS_CAPTURED': {
      // Parse raw API response if available, routing to the correct provider parser
      let orders: OrderItem[] = message.orders ?? [];
      const providerId = message._providerId || 'aliexpress';

      if (message._rawApiResponse) {
        let parsed: OrderItem[] = [];
        if (providerId === 'temu') {
          parsed = parseTemuApiResponse(message._rawApiResponse);
        } else if (providerId === 'allegro-pl' || providerId === 'allegro-cz') {
          parsed = parseAllegroApiResponse(message._rawApiResponse, providerId as ProviderId);
        } else {
          parsed = parseApiResponse(message._rawApiResponse);
        }
        if (parsed.length > 0) {
          orders = parsed;
        }
      }

      if (orders.length === 0) {
        return { success: true, orders: [] };
      }

      // Tag orders with provider ID
      orders = orders.map((o) => ({ ...o, providerId: (o.providerId || providerId) as ProviderId }));

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

      console.debug(LOG_PREFIX, `Merged: ${addedCount} new, ${allOrders.length} total`);

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
        const { search, status, dateFrom, dateTo, providerId } = message.filters;

        if (providerId) {
          if (Array.isArray(providerId)) {
            orders = orders.filter((o) => providerId.includes(o.providerId || 'aliexpress'));
          } else {
            orders = orders.filter((o) => (o.providerId || 'aliexpress') === providerId);
          }
        }
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
      const tab = await findOrderTab();
      if (!tab?.id) {
        return { success: false, error: 'No orders page found. Open the AliExpress, Temu, or Allegro orders page first.' };
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
      const tab = await findOrderTab();
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
      return { success: true, autoCollect: autoCollectState };
    }

    default:
      return { success: false, error: `Unknown message type` };
  }
}

// ─── Helpers ────────────────────────────────────────────────

async function findOrderTab(): Promise<chrome.tabs.Tab | undefined> {
  // Try AliExpress first
  const aliTabs = await chrome.tabs.query({
    url: '*://*.aliexpress.com/p/order/*',
  });
  if (aliTabs.length > 0) {
    return aliTabs.find((t) => t.active) ?? aliTabs[0];
  }

  // Try Temu
  const temuTabs = await chrome.tabs.query({
    url: [
      '*://*.temu.com/*/bgt_orders.html*',
      '*://*.temu.com/bgt_orders.html*',
      '*://*.temu.com/*/orders.html*',
      '*://*.temu.com/orders.html*',
      '*://*.temu.com/*/order*',
      '*://*.temu.com/order*',
    ],
  });
  if (temuTabs.length > 0) {
    return temuTabs.find((t) => t.active) ?? temuTabs[0];
  }

  // Try Allegro PL
  const allegroPLTabs = await chrome.tabs.query({
    url: [
      '*://*.allegro.pl/moje-allegro/zakupy/kupione*',
      '*://*.allegro.pl/moje-allegro/zakupy/*',
    ],
  });
  if (allegroPLTabs.length > 0) {
    return allegroPLTabs.find((t) => t.active) ?? allegroPLTabs[0];
  }

  // Try Allegro CZ
  const allegroCZTabs = await chrome.tabs.query({
    url: [
      '*://*.allegro.cz/moje-allegro/nakupy/historie-nakupu*',
      '*://*.allegro.cz/moje-allegro/nakupy/*',
    ],
  });
  if (allegroCZTabs.length > 0) {
    return allegroCZTabs.find((t) => t.active) ?? allegroCZTabs[0];
  }

  return undefined;
}

// ─── Extension install / update ─────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
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
