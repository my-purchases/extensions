/**
 * Platform-agnostic background message handler.
 *
 * Extracted from chrome/src/background/service-worker.ts so that both
 * Chrome and Safari can share the same business logic. All browser-specific
 * API calls go through the injected BrowserAPI instance.
 *
 * Usage (in each platform's service-worker / background script):
 *
 *   import { createBackgroundHandler } from '@my-purchases/shared/background';
 *   const api = new ChromeBrowserAPI();           // or SafariBrowserAPI
 *   const { handleMessage, onInstalled } = createBackgroundHandler(api);
 *   // wire up listeners…
 */

import type { BrowserAPI, BrowserTab } from '../browser/types';
import type { RuntimeMessage, RuntimeResponse, AutoCollectState } from '../messages';
import type { OrderItem, ProviderId } from '../types/order';

import { parseApiResponse } from '../providers/aliexpress/parser';
import { parseTemuApiResponse } from '../providers/temu/parser';
import { parseAllegroApiResponse } from '../providers/allegro/parser';
import {
  AMAZON_ORDER_PATTERNS,
  TEMU_ORDER_PATTERNS,
  ALLEGRO_ORDER_PATTERNS,
} from '../constants';

import {
  getOrders,
  mergeOrders,
  deleteOrders,
  updateOrder,
  clearOrders,
  getStatus,
  updateStatus,
} from '../storage/orders';

import { exportToCsv } from '../export/csv';
import { exportToJson } from '../export/json';
import { exportToHtml } from '../export/html';
import { exportToClipboard } from '../export/clipboard';

const LOG_PREFIX = '[MPC:sw]';

// ─── Public interface returned by createBackgroundHandler ────

export interface BackgroundHandler {
  /** Handle an incoming RuntimeMessage and return a RuntimeResponse. */
  handleMessage(
    message: RuntimeMessage & { _rawApiResponse?: unknown; _providerId?: string },
  ): Promise<RuntimeResponse>;

  /** Call on extension install/update (wire to runtime.onInstalled). */
  onInstalled(reason: string): void;

  /** Current auto-collect state (read-only snapshot). */
  getAutoCollectState(): AutoCollectState;
}

// ─── Factory ────────────────────────────────────────────────

export function createBackgroundHandler(api: BrowserAPI): BackgroundHandler {
  // ── Auto-collect state (mutable, service-worker-scoped) ───

  let autoCollectState: AutoCollectState = {
    isRunning: false,
    currentPage: 0,
    totalOrders: 0,
  };

  // ── Helpers ───────────────────────────────────────────────

  /**
   * Reload a tab and wait for it to finish loading.
   * Used to re-inject content scripts when the extension context is invalidated.
   */
  async function reloadTabAndWait(tabId: number): Promise<void> {
    await api.reloadTab(tabId);
    await new Promise<void>((resolve) => {
      const unsub = api.onTabUpdated((updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          unsub();
          resolve();
        }
      });
      // Timeout fallback — don't hang forever
      setTimeout(() => {
        unsub();
        resolve();
      }, 15000);
    });
    // Extra delay for content scripts to fully initialize
    await new Promise((r) => setTimeout(r, 1000));
  }

  /**
   * Find an open tab showing an orders page (AliExpress, Temu, Allegro, or Amazon).
   */
  async function findOrderTab(): Promise<BrowserTab | undefined> {
    // Try AliExpress first
    const aliTabs = await api.queryTabs({
      url: '*://*.aliexpress.com/p/order/*',
    });
    if (aliTabs.length > 0) {
      return aliTabs.find((t) => t.active) ?? aliTabs[0];
    }

    // Try Temu
    const temuTabs = await api.queryTabs({
      url: TEMU_ORDER_PATTERNS as unknown as string[],
    });
    if (temuTabs.length > 0) {
      return temuTabs.find((t) => t.active) ?? temuTabs[0];
    }

    // Try Allegro PL
    const allegroPLTabs = await api.queryTabs({
      url: [
        '*://*.allegro.pl/moje-allegro/zakupy/kupione*',
        '*://*.allegro.pl/moje-allegro/zakupy/*',
      ],
    });
    if (allegroPLTabs.length > 0) {
      return allegroPLTabs.find((t) => t.active) ?? allegroPLTabs[0];
    }

    // Try Allegro CZ
    const allegroCZTabs = await api.queryTabs({
      url: [
        '*://*.allegro.cz/moje-allegro/nakupy/historie-nakupu*',
        '*://*.allegro.cz/moje-allegro/nakupy/*',
      ],
    });
    if (allegroCZTabs.length > 0) {
      return allegroCZTabs.find((t) => t.active) ?? allegroCZTabs[0];
    }

    // Try Amazon (all marketplaces)
    const amazonTabs = await api.queryTabs({
      url: AMAZON_ORDER_PATTERNS as unknown as string[],
    });
    if (amazonTabs.length > 0) {
      return amazonTabs.find((t) => t.active) ?? amazonTabs[0];
    }

    return undefined;
  }

  // ── Message handler ───────────────────────────────────────

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
            parsed = parseAllegroApiResponse(
              message._rawApiResponse,
              providerId as ProviderId,
            );
          } else if (providerId === 'amazon') {
            // Amazon orders are parsed in the content script (DOMParser unavailable in SW).
            // They arrive as pre-parsed OrderItem[] in message.orders — nothing to do here.
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
        orders = orders.map((o) => ({
          ...o,
          providerId: (o.providerId || providerId) as ProviderId,
        }));

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
          await api.setBadgeText(String(allOrders.length));
          await api.setBadgeBackgroundColor('#3B82F6');
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
              orders = orders.filter((o) =>
                providerId.includes(o.providerId || 'aliexpress'),
              );
            } else {
              orders = orders.filter(
                (o) => (o.providerId || 'aliexpress') === providerId,
              );
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
          await api.setBadgeText('');
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
            return {
              success: false,
              error: `Unknown export format: ${message.format}`,
            };
        }

        return { success: true, data };
      }

      // ─── Auto-collect ─────────────────────────────────────

      case 'START_AUTO_COLLECT': {
        const tab = await findOrderTab();
        if (!tab?.id) {
          return {
            success: false,
            error:
              'No orders page found. Open the AliExpress, Temu, Allegro, or Amazon orders page first.',
          };
        }

        try {
          await api.sendTabMessage(tab.id, { type: 'START_AUTO_COLLECT' });
          autoCollectState = {
            isRunning: true,
            currentPage: 0,
            totalOrders: (await getOrders()).length,
          };
          return { success: true, autoCollect: autoCollectState };
        } catch {
          // Content script not active (e.g. extension was reloaded) — reload tab and retry
          try {
            console.log(
              LOG_PREFIX,
              'Content script not responding, reloading tab...',
            );
            await reloadTabAndWait(tab.id);
            await api.sendTabMessage(tab.id, { type: 'START_AUTO_COLLECT' });
            autoCollectState = {
              isRunning: true,
              currentPage: 0,
              totalOrders: (await getOrders()).length,
            };
            return { success: true, autoCollect: autoCollectState };
          } catch (retryErr) {
            return {
              success: false,
              error: `Failed to start: ${String(retryErr)}. Try refreshing the orders page.`,
            };
          }
        }
      }

      case 'STOP_AUTO_COLLECT': {
        const tab = await findOrderTab();
        if (tab?.id) {
          try {
            await api.sendTabMessage(tab.id, { type: 'STOP_AUTO_COLLECT' });
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

  // ── Lifecycle ─────────────────────────────────────────────

  function onInstalled(reason: string): void {
    if (reason === 'install') {
      updateStatus({
        providerId: 'aliexpress',
        isCollecting: false,
        ordersCollected: 0,
        lastCollectedAt: null,
        error: null,
      });
    }
  }

  // ── Return public interface ───────────────────────────────

  return {
    handleMessage,
    onInstalled,
    getAutoCollectState: () => ({ ...autoCollectState }),
  };
}
