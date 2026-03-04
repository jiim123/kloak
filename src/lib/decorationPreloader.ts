/**
 * Decoration Preloader — DISABLED
 * 
 * Avatar decorations are currently disabled. This module is a no-op stub
 * that preserves the API so imports don't break.
 */

export interface DecorationAsset {
  isAnimated: boolean;
  stillSrc: string | null;
}

/**
 * Always returns null — decorations are disabled.
 */
export function useDecorationAsset(_src: string | null): DecorationAsset | null {
  return null;
}

/**
 * No-op — decorations are disabled.
 */
export function ensureDecorationPreloaded(_src: string) {}
