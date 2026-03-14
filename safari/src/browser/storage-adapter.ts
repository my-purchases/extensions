/**
 * Safari implementation of the StorageAdapter interface.
 * Safari MV3 supports `chrome.storage.local`, so this is identical
 * to the Chrome adapter.
 *
 * Note: Safari does NOT support `unlimitedStorage` permission.
 * Storage is limited to ~10MB. This is sufficient for typical order data.
 */

import type { StorageAdapter } from '@shared/storage/orders';

export class SafariStorageAdapter implements StorageAdapter {
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
