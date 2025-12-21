/**
 * Cryptographic utilities for Nomo
 * Handles secret key generation, hashing, and validation
 */

/**
 * Generate a cryptographically secure 64-character hex secret key
 */
export const generateSecretKey = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Hash a secret key using SHA-256
 * @param secretKey - The 64-character hex secret key
 * @returns Promise resolving to the 64-character hex hash
 */
export const hashSecretKey = async (secretKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(secretKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate that a string is a valid 64-character hex secret key
 * @param key - The key to validate
 * @returns true if valid, false otherwise
 */
export const isValidSecretKey = (key: string): boolean => {
  if (typeof key !== 'string') return false;
  if (key.length !== 64) return false;
  return /^[0-9a-fA-F]{64}$/.test(key);
};
