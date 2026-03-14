/**
 * Service Worker (Manifest V3 background script) — Safari platform.
 *
 * Thin wrapper: initializes the Safari-specific adapters, then delegates
 * all business logic to the shared background message handler.
 */

import type { RuntimeMessage, RuntimeResponse } from '@shared/messages';
import { initStorage } from '@shared/storage/orders';
import { createBackgroundHandler } from '@shared/background';
import { SafariBrowserAPI } from '@/browser/adapter';
import { SafariStorageAdapter } from '@/browser/storage-adapter';

// ── Initialize platform adapters ────────────────────────────

const browserAPI = new SafariBrowserAPI();
initStorage(new SafariStorageAdapter());

const { handleMessage, onInstalled } = createBackgroundHandler(browserAPI);

// ── Wire up message listener ────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage & { _rawApiResponse?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: RuntimeResponse) => void,
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        console.error('[MPC:sw]', 'Error handling message:', err);
        sendResponse({ success: false, error: String(err) });
      });

    // Return true to indicate async response
    return true;
  },
);

// ── Wire up lifecycle listener ──────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  onInstalled(details.reason);
});
