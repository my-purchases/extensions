/**
 * Safari implementation of the BrowserAPI interface.
 * Safari MV3 supports the `chrome.*` namespace, so this is identical
 * to the Chrome adapter.
 */

import type { BrowserAPI, BrowserTab, TabQueryInfo, TabChangeInfo, Unsubscribe } from '@shared/browser/types';

export class SafariBrowserAPI implements BrowserAPI {
  // ── Tabs ────────────────────────────────────────────────

  async queryTabs(queryInfo: TabQueryInfo): Promise<BrowserTab[]> {
    return chrome.tabs.query(queryInfo);
  }

  async createTab(url: string): Promise<BrowserTab> {
    return chrome.tabs.create({ url });
  }

  async sendTabMessage(tabId: number, message: unknown): Promise<unknown> {
    return chrome.tabs.sendMessage(tabId, message);
  }

  async reloadTab(tabId: number): Promise<void> {
    await chrome.tabs.reload(tabId);
  }

  onTabUpdated(
    callback: (tabId: number, changeInfo: TabChangeInfo) => void,
  ): Unsubscribe {
    const listener = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      callback(tabId, changeInfo);
    };
    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  }

  // ── Action / Badge ──────────────────────────────────────

  async setBadgeText(text: string): Promise<void> {
    await chrome.action.setBadgeText({ text });
  }

  async setBadgeBackgroundColor(color: string): Promise<void> {
    await chrome.action.setBadgeBackgroundColor({ color });
  }

  // ── Runtime messaging ───────────────────────────────────

  async sendRuntimeMessage<T = unknown>(message: unknown): Promise<T> {
    return chrome.runtime.sendMessage(message);
  }

  onRuntimeMessage(
    callback: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean | void,
  ): Unsubscribe {
    const listener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ): boolean | void => {
      return callback(message, sender, sendResponse);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }

  // ── Storage events ──────────────────────────────────────

  onStorageChanged(callback: () => void): Unsubscribe {
    const listener = () => callback();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  // ── Lifecycle ─────────────────────────────────────────────

  onInstalled(callback: (details: { reason: string }) => void): void {
    chrome.runtime.onInstalled.addListener(callback);
  }
}
