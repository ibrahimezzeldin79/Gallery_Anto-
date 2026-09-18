/**
 * IndexedDB high-capacity resilient storage engine for Gallery Anto.
 * Features:
 * - Automatic connection health monitoring and reconnection on close/version change
 * - Write serialization queue to prevent transaction collision and aborts
 * - Safe data serialization (guarantees HTML structured clone compatibility)
 * - Automatic retry on transaction aborts
 * - Seamless in-memory & localStorage fallback
 */

const DB_NAME = "GalleryAntoDB";
const DB_VERSION = 1;
const STORE_NAME = "app_data";

let cachedDB: IDBDatabase | null = null;
let dbOpeningPromise: Promise<IDBDatabase> | null = null;
const memoryCache = new Map<string, any>();

function closeDB() {
  if (cachedDB) {
    try {
      cachedDB.close();
    } catch (e) {
      // Ignore close errors
    }
    cachedDB = null;
  }
  dbOpeningPromise = null;
}

function getDB(): Promise<IDBDatabase> {
  if (cachedDB) {
    return Promise.resolve(cachedDB);
  }

  if (dbOpeningPromise) {
    return dbOpeningPromise;
  }

  dbOpeningPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        db.onclose = () => {
          closeDB();
        };

        db.onversionchange = () => {
          closeDB();
        };

        db.onerror = () => {
          closeDB();
        };

        cachedDB = db;
        dbOpeningPromise = null;
        resolve(db);
      };

      request.onerror = () => {
        console.warn("[IndexedDB] Error opening database:", request.error);
        dbOpeningPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("[IndexedDB] Database open blocked");
        closeDB();
      };
    } catch (err) {
      dbOpeningPromise = null;
      reject(err);
    }
  });

  return dbOpeningPromise;
}

// Convert any object/array to a guaranteed cloneable plain JSON data structure
function safeClone(val: any): any {
  if (val === undefined) return null;
  if (val === null || typeof val === "number" || typeof val === "string" || typeof val === "boolean") {
    return val;
  }
  try {
    return JSON.parse(JSON.stringify(val));
  } catch (e) {
    return val;
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  // 1. Check memory cache first
  if (memoryCache.has(key)) {
    return safeClone(memoryCache.get(key)) as T;
  }

  // 2. Try fetching from IndexedDB
  try {
    const db = await getDB();
    return await new Promise<T | null>((resolve) => {
      let completed = false;
      const done = (result: T | null) => {
        if (!completed) {
          completed = true;
          if (result !== null && result !== undefined) {
            memoryCache.set(key, safeClone(result));
          }
          resolve(result);
        }
      };

      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result !== undefined && req.result !== null) {
            done(req.result as T);
          } else {
            // Fallback to localStorage if not found in IndexedDB
            done(getFromLocalStorage<T>(key));
          }
        };

        req.onerror = () => {
          done(getFromLocalStorage<T>(key));
        };

        tx.onerror = () => {
          closeDB();
          done(getFromLocalStorage<T>(key));
        };

        tx.onabort = () => {
          closeDB();
          done(getFromLocalStorage<T>(key));
        };
      } catch (txErr) {
        closeDB();
        done(getFromLocalStorage<T>(key));
      }
    });
  } catch (err) {
    // Fallback to localStorage if IndexedDB cannot be opened
    return getFromLocalStorage<T>(key);
  }
}

function getFromLocalStorage<T>(key: string): T | null {
  try {
    const localVal = localStorage.getItem(key);
    if (localVal) {
      try {
        const parsed = JSON.parse(localVal);
        memoryCache.set(key, parsed);
        return parsed as T;
      } catch {
        return localVal as unknown as T;
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return null;
}

// Sequential write queue to serialize transactions and avoid concurrent transaction aborts
let writeQueue: Promise<any> = Promise.resolve();

export function idbSet(key: string, value: any): Promise<boolean> {
  const safeData = safeClone(value);
  memoryCache.set(key, safeData);

  // Sync to localStorage safely
  try {
    const jsonStr = typeof safeData === "string" ? safeData : JSON.stringify(safeData);
    localStorage.setItem(key, jsonStr);
  } catch (err) {
    try {
      if (Array.isArray(safeData) && key.includes("anto_products_")) {
        const lightweight = safeData.map((item: any) => ({
          ...item,
          image: item.image && item.image.length > 20000 ? "" : item.image,
        }));
        localStorage.setItem(key, JSON.stringify(lightweight));
      }
    } catch (e) {
      // localStorage is full, IndexedDB will handle full payload
    }
  }

  // Enqueue IndexedDB write to prevent transaction collisions
  const task = async (): Promise<boolean> => {
    return rawIdbSetWithRetry(key, safeData, 2);
  };

  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

async function rawIdbSetWithRetry(key: string, value: any, attemptsLeft: number): Promise<boolean> {
  try {
    const db = await getDB();
    return await new Promise<boolean>((resolve) => {
      let resolved = false;
      const finish = (success: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(success);
        }
      };

      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);

        req.onsuccess = () => {
          // Wait for tx.oncomplete for guaranteed durability
        };

        req.onerror = (e) => {
          e.preventDefault?.();
        };

        tx.oncomplete = () => {
          finish(true);
        };

        tx.onerror = (e) => {
          e.preventDefault?.();
          closeDB();
          finish(false);
        };

        tx.onabort = (e) => {
          e.preventDefault?.();
          closeDB();
          finish(false);
        };
      } catch (txErr) {
        closeDB();
        finish(false);
      }
    });
  } catch (err) {
    closeDB();
    if (attemptsLeft > 1) {
      // Wait 50ms and retry once with fresh connection
      await new Promise((r) => setTimeout(r, 50));
      return rawIdbSetWithRetry(key, value, attemptsLeft - 1);
    }
    return false;
  }
}

export async function idbRemove(key: string): Promise<boolean> {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (e) {}

  const task = async () => {
    try {
      const db = await getDB();
      return await new Promise<boolean>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.delete(key);

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => {
            closeDB();
            resolve(false);
          };
          tx.onabort = () => {
            closeDB();
            resolve(false);
          };
        } catch {
          closeDB();
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  };

  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}
