import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a database asset key into a full URL.
 * @param key - The short key stored in the DB (e.g., 'sparkle')
 * @param type - The category of the asset
 */
export function getAssetUrl(key: string | null | undefined, type: "decoration" | "effect" | "banner") {
  if (!key) return null;

  // If it's already a full URL (legacy data), return it as is
  if (key.startsWith("http")) return key;

  // Base path for your assets (can be a CDN URL or a local path)
  const basePaths = {
    decoration: "/assets/decorations/",
    effect: "/assets/effects/",
    banner: "/assets/banners/",
  };

  return `${basePaths[type]}${key}.webp`; // Using .webp for best performance
}
