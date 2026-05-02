"use client";

/**
 * Wrapper minimal IndexedDB pour stocker :
 * - Les opérations en attente de sync (queue)
 * - Les idées créées offline (cache local visible avant sync)
 * - Les blobs audio en attente d'upload
 */

const DB_NAME = "insta-vault-offline";
const DB_VERSION = 1;

export const STORES = {
  queue: "queue",
  ideas: "ideas",
  audios: "audios",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non supporté"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.queue)) {
        const s = db.createObjectStore(STORES.queue, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORES.ideas)) {
        db.createObjectStore(STORES.ideas, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.audios)) {
        db.createObjectStore(STORES.audios, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = fn(store);
    if (result instanceof Promise) {
      result.then(resolve, reject);
      return;
    }
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
  });
}

export async function putItem<T>(storeName: string, value: T): Promise<void> {
  await tx(storeName, "readwrite", (s) => s.put(value as never));
}

export async function getItem<T>(
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return tx<T | undefined>(storeName, "readonly", (s) => s.get(key));
}

export async function deleteItem(
  storeName: string,
  key: IDBValidKey,
): Promise<void> {
  await tx(storeName, "readwrite", (s) => s.delete(key));
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  return tx<T[]>(storeName, "readonly", (s) => s.getAll());
}

export async function clearStore(storeName: string): Promise<void> {
  await tx(storeName, "readwrite", (s) => s.clear());
}

export async function countStore(storeName: string): Promise<number> {
  return tx<number>(storeName, "readonly", (s) => s.count());
}
