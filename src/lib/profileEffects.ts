type GlobModule = { default: string };

const titleCase = (input: string) =>
  input
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Auto-load all profile effects from src/assets/profile-effects
// Note: When you add/remove files, Vite may require a dev server restart to pick up new files.
const modules = import.meta.glob("/src/assets/profile-effects/*.{png,gif,webp}", {
  eager: true,
}) as Record<string, GlobModule>;

export type ProfileEffect = {
  id: string; // filename without extension
  name: string; // human readable
  src: string; // resolved url
};

export const PROFILE_EFFECTS: ProfileEffect[] = Object.entries(modules)
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

export const getProfileEffectSrc = (effectId: string | null | undefined): string | null => {
  if (!effectId) return null;
  return PROFILE_EFFECTS.find((e) => e.id === effectId)?.src ?? null;
};
