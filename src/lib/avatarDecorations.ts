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

export type AvatarDecoration = {
  id: string; // filename without extension
  name: string; // human readable
  src: string; // resolved url
};

export const AVATAR_DECORATIONS: AvatarDecoration[] = Object.entries(modules)
  .map(([path, mod]) => {
    const file = path.split("/").pop() ?? path;
    const id = file.replace(/\.(png|gif|webp)$/i, "");
    return {
      id,
      name: titleCase(id),
      src: mod.default,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const getAvatarDecorationSrc = (decorationId: string | null | undefined): string | null => {
  if (!decorationId) return null;
  return AVATAR_DECORATIONS.find((d) => d.id === decorationId)?.src ?? null;
};

