

## Encrypt keyHash at rest using AES-256-GCM device key

### Summary
Replace plaintext `keyHash` storage in `localStorage` with encrypted-at-rest storage using a non-extractable AES-256-GCM key in IndexedDB. The keyHash will only exist in plaintext in memory during active sessions.

### Changes

#### 1. Create `src/lib/deviceKey.ts`
New module with IndexedDB helpers and Web Crypto operations:
- `openDB()` — opens/creates `kloak-device` IndexedDB with a `keys` object store
- `idbGet/idbPut/idbDelete` — typed IndexedDB CRUD wrappers
- `getOrCreateDeviceKey()` — generates or retrieves a non-extractable AES-256-GCM CryptoKey
- `encryptAndStoreKeyHash(keyHash)` — encrypts keyHash with the device key, stores IV+ciphertext in IndexedDB
- `decryptKeyHash()` — retrieves and decrypts keyHash from IndexedDB; returns `null` on any failure
- `clearDeviceCredentials()` — removes encrypted keyHash (keeps device key for re-login)
- `clearAllDeviceData()` — removes both encrypted keyHash and device key

#### 2. Update `src/stores/authStore.ts`
- **Migration**: Replace `clearLegacySecretKey` with async `migrateToEncryptedStorage()` that moves any plaintext `keyHash` from localStorage to encrypted IndexedDB, then deletes it from localStorage. Called inside `initializeAuth`.
- **`initializeAuth`**: Run migration first, then call `decryptKeyHash()` to load keyHash into memory and apply via `setKeyHashHeader()`. Then proceed with existing `checkAuth` flow.
- **`login`**: After hashing, call `encryptAndStoreKeyHash(keyHash)` before setting in-memory state.
- **`createAccount`**: Same — call `encryptAndStoreKeyHash` after registration succeeds.
- **`resetSecretKey`**: Same — call `encryptAndStoreKeyHash` after reset succeeds.
- **`logout`**: Call `clearDeviceCredentials()` to wipe encrypted keyHash from IndexedDB.
- **`partialize`**: Remove `keyHash` from persisted fields (only `manualStatus` remains).
- **Remove `onRehydrateStorage`**: No longer needed since keyHash isn't in localStorage.

#### 3. Update `src/integrations/supabase/client.ts`
- `tryGetPersistedKeyHash()` and `tryGetPersistedSecretKey()` will naturally return `null` after migration since keyHash is removed from localStorage. The `ensureKeyHash` function's fast path becomes a no-op for new sessions; `currentKeyHash` is set by `initializeAuth` before any queries run.
- No structural changes needed — the in-memory `currentKeyHash` variable and `setKeyHashHeader()` continue to work as before.

### What stays the same
- `x-key-hash` header mechanism unchanged
- `hashSecretKey` unchanged
- All backend functions unchanged
- `secretKey` handling unchanged (never persisted, in-memory only for onboarding display)

### Technical details
- AES-256-GCM with 12-byte random IV per encryption
- CryptoKey stored as non-extractable in IndexedDB (cannot be read via JS, only used for encrypt/decrypt)
- Graceful fallback: if IndexedDB or Web Crypto fails, `decryptKeyHash` returns `null` → user must re-login
- Device key persists across logouts so re-login reuses it

