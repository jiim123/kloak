/**
 * Device Key module for encrypting keyHash at rest.
 *
 * Uses a non-extractable AES-256-GCM CryptoKey stored in IndexedDB.
 * The keyHash is encrypted before storage and decrypted into memory on session init.
 */

const DB_NAME = "kloak-device";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const DEVICE_KEY_ID = "device-key";
const ENCRYPTED_KEYHASH_ID = "encrypted-keyhash";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const db = await openDB();
  const existing = await idbGet<CryptoKey>(db, DEVICE_KEY_ID);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );

  await idbPut(db, DEVICE_KEY_ID, key);
  return key;
}

export async function encryptAndStoreKeyHash(keyHash: string): Promise<void> {
  const deviceKey = await getOrCreateDeviceKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, deviceKey, encoder.encode(keyHash));

  const db = await openDB();
  await idbPut(db, ENCRYPTED_KEYHASH_ID, {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  });
}

export async function decryptKeyHash(): Promise<string | null> {
  try {
    const db = await openDB();
    const stored = await idbGet<{ iv: number[]; data: number[] }>(db, ENCRYPTED_KEYHASH_ID);
    if (!stored) return null;

    const deviceKey = await idbGet<CryptoKey>(db, DEVICE_KEY_ID);
    if (!deviceKey) return null;

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(stored.iv) },
      deviceKey,
      new Uint8Array(stored.data),
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function clearDeviceCredentials(): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, ENCRYPTED_KEYHASH_ID);
    // Keep the device key itself so re-login reuses it
  } catch {
    // ignore cleanup errors
  }
}

export async function clearAllDeviceData(): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, ENCRYPTED_KEYHASH_ID);
    await idbDelete(db, DEVICE_KEY_ID);
  } catch {
    // ignore cleanup errors
  }
}
