import { AssetItem } from '../types';

const DB_NAME = 'AeroBridge_Studio_DB';
const DB_VERSION = 1;

export interface SavedDirectoryRecord {
  id: string;
  name: string;
  path: string;
  addedAt: string;
  itemCount?: number;
  handle: any; // FileSystemDirectoryHandle
}

export interface SessionStateRecord {
  id: string;
  favoriteFolders: string[];
  activeFolder: string;
  sortField: string;
  sortOrder: string;
  lastUpdated: string;
}

/**
 * Initializes and returns the IndexedDB instance
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB není v tomto prohlížeči podporováno.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store 1: Directory handles for native file system access
      if (!db.objectStoreNames.contains('directories')) {
        db.createObjectStore('directories', { keyPath: 'id' });
      }

      // Store 2: Persisted assets with metadata and blobs
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }

      // Store 3: App session configuration (favorites, view mode, etc.)
      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a FileSystemDirectoryHandle to IndexedDB
 */
export async function saveDirectoryHandle(
  name: string,
  handle: any
): Promise<SavedDirectoryRecord> {
  const db = await openDB();
  const record: SavedDirectoryRecord = {
    id: `dir-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`,
    name,
    path: `/${name}`,
    addedAt: new Date().toISOString(),
    handle,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('directories', 'readwrite');
    const store = tx.objectStore('directories');
    const req = store.put(record);

    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all saved directory handles from IndexedDB
 */
export async function getSavedDirectoryHandles(): Promise<SavedDirectoryRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('directories', 'readonly');
      const store = tx.objectStore('directories');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load saved directories from IndexedDB:', err);
    return [];
  }
}

/**
 * Removes a directory handle from IndexedDB
 */
export async function removeSavedDirectory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('directories', 'readwrite');
    const store = tx.objectStore('directories');
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Verifies or requests permission for a stored FileSystemDirectoryHandle
 */
export async function verifyDirectoryPermission(
  handle: any,
  readWrite = false
): Promise<boolean> {
  if (!handle || typeof handle.queryPermission !== 'function') {
    return false;
  }

  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (e) {
    console.warn('Permission query/request failed:', e);
  }
  return false;
}

/**
 * Saves or updates custom imported assets in IndexedDB
 */
export async function saveAssetsToIndexedDB(assets: AssetItem[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('assets', 'readwrite');
    const store = tx.objectStore('assets');

    // Only persist custom or modified assets
    for (const asset of assets) {
      // Create clean record without complex non-cloneable runtime refs if any
      const record = {
        ...asset,
        blob: asset.blob instanceof Blob ? asset.blob : undefined,
        fileRef: undefined, // fileRef cannot always be cloned, blob can
      };
      store.put(record);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save assets to IndexedDB:', err);
  }
}

/**
 * Loads all saved custom assets from IndexedDB
 */
export async function loadAssetsFromIndexedDB(): Promise<AssetItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const req = store.getAll();

      req.onsuccess = () => {
        const rawAssets: AssetItem[] = req.result || [];
        // Re-generate object URLs for any stored blobs
        const rehydrated = rawAssets.map((asset) => {
          if (asset.blob && asset.url.startsWith('blob:')) {
            try {
              const freshUrl = URL.createObjectURL(asset.blob);
              return { ...asset, url: freshUrl };
            } catch {
              return asset;
            }
          }
          return asset;
        });
        resolve(rehydrated);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not load assets from IndexedDB:', err);
    return [];
  }
}

/**
 * Saves current workspace state (favorites, active folder, sort)
 */
export async function saveWorkspaceSession(
  favoriteFolders: string[],
  activeFolder: string,
  sortField: string,
  sortOrder: string
): Promise<void> {
  try {
    const db = await openDB();
    const record: SessionStateRecord = {
      id: 'current_session',
      favoriteFolders,
      activeFolder,
      sortField,
      sortOrder,
      lastUpdated: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('session', 'readwrite');
      const store = tx.objectStore('session');
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save session state:', err);
  }
}

/**
 * Loads workspace session from IndexedDB
 */
export async function loadWorkspaceSession(): Promise<SessionStateRecord | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('session', 'readonly');
      const store = tx.objectStore('session');
      const req = store.get('current_session');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load session state:', err);
    return null;
  }
}
