type GlobModule = { default: string };

const titleCase = (input: string) =>
  input
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Auto-load all decorations from src/assets/avatar-decos
// Note: When you add/remove files, Vite may require a dev server restart to pick up new files.
const modules = import.meta.glob("/src/assets/avatar-decos/*.{png,gif,webp}", {
  eager: true,
}) as Record<string, GlobModule>;

export type AvatarDecorationTransform = {
  // Multiplier applied to the decoration image (1 = original).
  scale: number;
  // Translation in % of the decoration box (positive moves right/down).
  offsetXPercent: number;
  offsetYPercent: number;
};

export const DEFAULT_AVATAR_DECORATION_TRANSFORM: AvatarDecorationTransform = {
  scale: 1,
  offsetXPercent: 0,
  offsetYPercent: 0,
};

// Per-decoration transform overrides.
// Add entries keyed by file id (filename without extension), for example:
// "bunny-headset": { scale: 1.08, offsetYPercent: -2 }
export const AVATAR_DECORATION_TRANSFORMS: Record<string, Partial<AvatarDecorationTransform>> = {
  "bunny-headset": { scale: 1.6, offsetXPercent: -3.75, offsetYPercent: -16.25 },
  "pink-cat-heart": { scale: 1.49, offsetXPercent: 0.75, offsetYPercent: -3 },
  "flower": { scale: 1.39, offsetXPercent: 3.75, offsetYPercent: -2.25 },
  "fox": { scale: 1.38, offsetXPercent: 0, offsetYPercent: -6 },
  "frog": { scale: 1.49, offsetXPercent: 0, offsetYPercent: 6 },
  "rainbow": { scale: 1.48, offsetXPercent: 0, offsetYPercent: 1.5 },
};

const resolveAvatarDecorationTransform = (
  transform?: Partial<AvatarDecorationTransform>,
): AvatarDecorationTransform => ({
  scale: transform?.scale ?? DEFAULT_AVATAR_DECORATION_TRANSFORM.scale,
  offsetXPercent: transform?.offsetXPercent ?? DEFAULT_AVATAR_DECORATION_TRANSFORM.offsetXPercent,
  offsetYPercent: transform?.offsetYPercent ?? DEFAULT_AVATAR_DECORATION_TRANSFORM.offsetYPercent,
});

export type AvatarDecoration = {
  id: string; // filename without extension
  name: string; // human readable
  src: string; // resolved url
  transform: AvatarDecorationTransform; // per-decoration render adjustments
};

export const AVATAR_DECORATIONS: AvatarDecoration[] = Object.entries(modules)
  .map(([path, mod]) => {
    const file = path.split("/").pop() ?? path;
    const id = file.replace(/\.(png|gif|webp)$/i, "");
    return {
      id,
      name: titleCase(id),
      src: mod.default,
      transform: resolveAvatarDecorationTransform(AVATAR_DECORATION_TRANSFORMS[id]),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const getAvatarDecoration = (decorationId: string | null | undefined): AvatarDecoration | null => {
  if (!decorationId) return null;
  return AVATAR_DECORATIONS.find((d) => d.id === decorationId) ?? null;
};

export const getAvatarDecorationSrc = (decorationId: string | null | undefined): string | null => {
  return getAvatarDecoration(decorationId)?.src ?? null;
};

export const getAvatarDecorationTransform = (
  decorationId: string | null | undefined,
): AvatarDecorationTransform => getAvatarDecoration(decorationId)?.transform ?? DEFAULT_AVATAR_DECORATION_TRANSFORM;
