/**
 * Chrome implementation of the StorageAdapter interface.
 * Wraps `chrome.storage.local` for use with the shared storage module.
 */

import type { StorageAdapter } from '@shared/storage/orders';

export class ChromeStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(key);
  }

  async set(items: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.set(items);
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
