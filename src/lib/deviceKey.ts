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
const ENCRYPTED_MFA_SESSION_ID = "encrypted-mfa-session";
const FALLBACK_STORAGE_KEY = "kloak-device-credentials-v1";

type FallbackCredentials = {
  keyHash?: string;
  mfaSession?: string;
};

function isValidStoredSecret(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function readFallbackCredentials(): FallbackCredentials {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FallbackCredentials | null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFallbackCredentials(next: FallbackCredentials): void {
  try {
    const current = readFallbackCredentials();
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // ignore storage failures
  }
}

function deleteFallbackCredential(key: keyof FallbackCredentials): void {
  try {
    const current = readFallbackCredentials();
    delete current[key];
    if (current.keyHash || current.mfaSession) {
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(current));
    } else {
      localStorage.removeItem(FALLBACK_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

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

async function encryptAndStoreValue(storageId: string, value: string): Promise<void> {
  const deviceKey = await getOrCreateDeviceKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, deviceKey, encoder.encode(value));

  const db = await openDB();
  await idbPut(db, storageId, {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  });
}

async function decryptStoredValue(storageId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const stored = await idbGet<{ iv: number[]; data: number[] }>(db, storageId);
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

export async function encryptAndStoreKeyHash(keyHash: string): Promise<void> {
  writeFallbackCredentials({ keyHash });
  try {
    await encryptAndStoreValue(ENCRYPTED_KEYHASH_ID, keyHash);
  } catch {
    // The localStorage fallback keeps session restore working when IndexedDB
    // or stored CryptoKeys are unavailable after a browser restart.
  }
}

export async function decryptKeyHash(): Promise<string | null> {
  const encrypted = await decryptStoredValue(ENCRYPTED_KEYHASH_ID);
  if (encrypted) return encrypted;

  const fallback = readFallbackCredentials().keyHash;
  return isValidStoredSecret(fallback) ? fallback.toLowerCase() : null;
}

export async function encryptAndStoreMfaSession(sessionToken: string): Promise<void> {
  writeFallbackCredentials({ mfaSession: sessionToken });
  try {
    await encryptAndStoreValue(ENCRYPTED_MFA_SESSION_ID, sessionToken);
  } catch {
    // See key-hash storage fallback above.
  }
}

export async function decryptMfaSession(): Promise<string | null> {
  const encrypted = await decryptStoredValue(ENCRYPTED_MFA_SESSION_ID);
  if (encrypted) return encrypted;

  const fallback = readFallbackCredentials().mfaSession;
  return isValidStoredSecret(fallback) ? fallback.toLowerCase() : null;
}

export async function clearMfaSession(): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, ENCRYPTED_MFA_SESSION_ID);
  } catch {
    // ignore cleanup errors
  }
  deleteFallbackCredential("mfaSession");
}

export async function clearDeviceCredentials(): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, ENCRYPTED_KEYHASH_ID);
    await idbDelete(db, ENCRYPTED_MFA_SESSION_ID);
    // Keep the device key itself so re-login reuses it
  } catch {
    // ignore cleanup errors
  }
  try {
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
  } catch {
    // ignore cleanup errors
  }
}

export async function clearAllDeviceData(): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, ENCRYPTED_KEYHASH_ID);
    await idbDelete(db, ENCRYPTED_MFA_SESSION_ID);
    await idbDelete(db, DEVICE_KEY_ID);
  } catch {
    // ignore cleanup errors
  }
  try {
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
  } catch {
    // ignore cleanup errors
  }
}
