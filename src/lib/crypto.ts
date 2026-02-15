/**
 * Cryptographic utilities for Kloak
 * Handles secret key generation, hashing, validation,
 * and E2E encryption key derivation.
 *
 * IMPORTANT: iOS Safari requires a secure context (HTTPS) for crypto.subtle
 */

// ============================================
// EXISTING FUNCTIONS (unchanged)
// ============================================

/**
 * Check if Web Crypto API is available (requires secure context on iOS Safari)
 */
export const isWebCryptoAvailable = (): boolean => {
  return !!(typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function");
};

/**
 * Generate a cryptographically secure 64-character hex secret key
 * Uses crypto.getRandomValues which is available in all modern browsers
 */
export const generateSecretKey = (): string => {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Crypto API not available. Please use a modern browser.");
  }

  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Hash a secret key using SHA-256
 * Falls back to a pure JS implementation if crypto.subtle is unavailable (non-HTTPS on iOS)
 * @param secretKey - The 64-character hex secret key
 * @returns Promise resolving to the 64-character hex hash
 */
export const hashSecretKey = async (secretKey: string): Promise<string> => {
  if (isWebCryptoAvailable()) {
    const encoder = new TextEncoder();
    const data = encoder.encode(secretKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  console.warn("crypto.subtle unavailable, using JS fallback for SHA-256");
  return sha256Fallback(secretKey);
};

/**
 * Validate that a string is a valid 64-character hex secret key
 * @param key - The key to validate
 * @returns true if valid, false otherwise
 */
export const isValidSecretKey = (key: string): boolean => {
  if (typeof key !== "string") return false;
  if (key.length !== 64) return false;
  return /^[0-9a-fA-F]{64}$/.test(key);
};

// ============================================
// NEW: E2E ENCRYPTION KEY DERIVATION
// ============================================

/**
 * Derive an AES-256-GCM encryption key from the user's secret key using HKDF.
 * This key is used to encrypt/decrypt the E2E identity private key.
 *
 * Flow: secretKey (hex string) → raw bytes → HKDF → AES-256 CryptoKey
 *
 * The salt is generated randomly on first setup and stored alongside
 * the encrypted backup. The same salt must be used for recovery.
 *
 * @param secretKey - The user's 64-char hex secret key
 * @param salt - Random salt bytes (generate with generateSalt() on first use)
 * @returns AES-256-GCM CryptoKey for encrypting/decrypting private keys
 */
export const deriveE2EEncryptionKey = async (secretKey: string, salt: Uint8Array): Promise<CryptoKey> => {
  if (!isWebCryptoAvailable()) {
    throw new Error("Web Crypto API required for E2E encryption. Use HTTPS.");
  }

  // Convert hex secret key to raw bytes
  const keyBytes = hexToBytes(secretKey);

  // Import as raw key material for HKDF
  const keyMaterial = await crypto.subtle.importKey("raw", keyBytes, "HKDF", false, ["deriveKey"]);

  // Derive AES-256-GCM key using HKDF with SHA-256
  // The info parameter binds this derivation to Kloak's E2E context
  const encoder = new TextEncoder();
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: encoder.encode("kloak-e2e-identity-v1"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // not extractable — the derived key stays in Web Crypto
    ["encrypt", "decrypt"],
  );

  return derivedKey;
};

/**
 * Generate a random salt for HKDF key derivation.
 * Must be stored alongside the encrypted backup for recovery.
 * @returns 32 random bytes
 */
export const generateSalt = (): Uint8Array => {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  return salt;
};

/**
 * Generate a random initialization vector for AES-256-GCM.
 * Must be stored alongside the ciphertext for decryption.
 * @returns 12 random bytes (standard GCM nonce size)
 */
export const generateIV = (): Uint8Array => {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
};

/**
 * Encrypt data using AES-256-GCM.
 * Used to encrypt the E2E identity private key before server backup.
 *
 * @param plaintext - The data to encrypt (as Uint8Array)
 * @param key - AES-256-GCM CryptoKey from deriveE2EEncryptionKey()
 * @param iv - Initialization vector from generateIV()
 * @returns Encrypted ciphertext as Uint8Array
 */
export const encryptAES256GCM = async (plaintext: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> => {
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return new Uint8Array(ciphertext);
};

/**
 * Decrypt data using AES-256-GCM.
 * Used to recover the E2E identity private key from server backup.
 *
 * @param ciphertext - The encrypted data (as Uint8Array)
 * @param key - AES-256-GCM CryptoKey from deriveE2EEncryptionKey()
 * @param iv - The same IV used during encryption
 * @returns Decrypted plaintext as Uint8Array
 */
export const decryptAES256GCM = async (ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> => {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new Uint8Array(plaintext);
};

/**
 * Compute SHA-256 fingerprint of a public key for verification.
 * Users can compare fingerprints out-of-band to verify identity.
 *
 * @param publicKey - Base64-encoded public key
 * @returns 64-char hex string fingerprint
 */
export const computeKeyFingerprint = async (publicKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Generate a random device ID (integer).
 * Used to identify this device in multi-device scenarios.
 * @returns Random integer between 1 and 2^31-1
 */
export const generateDeviceId = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Ensure positive non-zero integer
  return (array[0] % 2147483646) + 1;
};

// ============================================
// ENCODING UTILITIES
// ============================================

/**
 * Convert a hex string to Uint8Array
 */
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

/**
 * Convert Uint8Array to hex string
 */
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Convert Uint8Array to Base64 string
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to Uint8Array
 */
export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Convert ArrayBuffer to Base64 string
 */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  return bytesToBase64(new Uint8Array(buffer));
};

/**
 * Convert Base64 string to ArrayBuffer
 */
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  return base64ToBytes(base64).buffer;
};

// ============================================
// SHA-256 FALLBACK (unchanged)
// ============================================

function sha256Fallback(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const sigma0 = (x: number) => rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
  const sigma1 = (x: number) => rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
  const gamma0 = (x: number) => rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
  const gamma1 = (x: number) => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);

  const encoder = new TextEncoder();
  const msgBytes = encoder.encode(message);
  const msgLen = msgBytes.length;
  const bitLen = msgLen * 8;
  const paddingLen = (msgLen + 8) % 64 < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64);
  const padded = new Uint8Array(msgLen + paddingLen + 8);
  padded.set(msgBytes);
  padded[msgLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  const h = [...H];
  for (let i = 0; i < padded.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      w[j] = (gamma1(w[j - 2]) + w[j - 7] + gamma0(w[j - 15]) + w[j - 16]) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j++) {
      const t1 = (hh + sigma1(e) + ch(e, f, g) + K[j] + w[j]) >>> 0;
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((v) => v.toString(16).padStart(8, "0")).join("");
}
