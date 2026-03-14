/**
 * Platform-agnostic browser extension API abstraction.
 *
 * Chrome provides `chrome.*`, Safari provides `browser.*` (and also `chrome.*`
 * in MV3). This flat interface unifies both so that shared business logic
 * (message handler, auto-collect orchestration) can work on either platform.
 *
 * Each platform provides its own implementation — see chrome/src/browser/
 * and safari/src/browser/ respectively.
 */

// ─── Tab types ──────────────────────────────────────────────

export interface BrowserTab {
  id?: number;
  url?: string;
  active?: boolean;
}

export interface TabQueryInfo {
  url?: string | string[];
  active?: boolean;
  currentWindow?: boolean;
}

export interface TabChangeInfo {
  status?: string;
}

// ─── Listener helpers ───────────────────────────────────────

/** A function that removes the listener when called. */
export type Unsubscribe = () => void;

// ─── BrowserAPI ─────────────────────────────────────────────

export interface BrowserAPI {
  // ── Tabs ────────────────────────────────────────────────
  queryTabs(queryInfo: TabQueryInfo): Promise<BrowserTab[]>;
  createTab(url: string): Promise<BrowserTab>;
  sendTabMessage(tabId: number, message: unknown): Promise<unknown>;
  reloadTab(tabId: number): Promise<void>;
  /**
   * Subscribe to tab update events.
   * Returns an unsubscribe function.
   */
  onTabUpdated(
    callback: (tabId: number, changeInfo: TabChangeInfo) => void,
  ): Unsubscribe;

  // ── Action / Badge ──────────────────────────────────────
  setBadgeText(text: string): Promise<void>;
  setBadgeBackgroundColor(color: string): Promise<void>;

  // ── Runtime messaging ───────────────────────────────────
  /**
   * Send a message through the extension runtime (content-script / popup → background).
   */
  sendRuntimeMessage<T = unknown>(message: unknown): Promise<T>;

  /**
   * Listen for runtime messages.
   * The callback receives the message, an opaque sender object, and a
   * `sendResponse` function. Return `true` from the callback to indicate
   * the response will be sent asynchronously.
   */
  onRuntimeMessage(
    callback: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean | void,
  ): Unsubscribe;

  // ── Storage events ──────────────────────────────────────
  /**
   * Listen for storage changes (any key).
   * Returns an unsubscribe function.
   */
  onStorageChanged(callback: () => void): Unsubscribe;

  // ── Lifecycle ─────────────────────────────────────────────
  /**
   * Register a callback for extension install/update events.
   */
  onInstalled(callback: (details: { reason: string }) => void): void;
}
