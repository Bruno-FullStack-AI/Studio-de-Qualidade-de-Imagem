/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RepositoryItem } from '../types/upscayl';

const DB_NAME = 'upscayl_studio_repo_db';
const DB_VERSION = 1;
const STORE_NAME = 'enhanced_photos';
const FALLBACK_KEY = 'upscayl_studio_repo_fallback';

function openRepoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRepositoryItems(): Promise<RepositoryItem[]> {
  try {
    const db = await openRepoDatabase();
    return await new Promise<RepositoryItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as RepositoryItem[]) || [];
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function saveRepositoryItem(item: RepositoryItem): Promise<void> {
  try {
    const db = await openRepoDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const existing = await getAllRepositoryItems();
      const updated = [item, ...existing.filter((i) => i.id !== item.id)].slice(0, 15);
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors in fallback
    }
  }
}

export async function deleteRepositoryItem(id: string): Promise<void> {
  try {
    const db = await openRepoDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const existing = await getAllRepositoryItems();
      const filtered = existing.filter((i) => i.id !== id);
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
  }
}

export async function clearAllRepositoryItems(): Promise<void> {
  try {
    const db = await openRepoDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(FALLBACK_KEY);
  }
}
