import type { CSSProperties } from "react";
import type { UserNameStyle } from "@/types";

/**
 * Display Name Style (Kloak Prime exclusive)
 *
 * Mirrors Discord's "Display Name Style" feature:
 *  - Fonts are real web fonts (loaded in index.html from Google Fonts) applied
 *    via CSS `font-family`, plus a few CSS-based styles (bold, italic, wide,
 *    small caps). The styled name keeps the user's actual characters, so it
 *    stays searchable/copyable and degrades gracefully if a font can't load.
 *  - Effects and colors are CSS, applied by the <StyledName /> component.
 */

// ============================================
// Fonts
// ============================================

export interface NameFontOption {
  id: string;
  label: string;
  /** CSS font-family stack (required for real web fonts) */
  stack?: string;
  /** Font weight to force (e.g. 700 for Playfair Display) */
  weight?: number;
  /** Italicize the name */
  italic?: boolean;
  /** Extra letter spacing (CSS length, e.g. "0.3em") */
  letterSpacing?: string;
  /** Render in small caps (CSS font-variant) */
  smallCaps?: boolean;
}

/**
 * Real web fonts are self-hosted in public/fonts (declared in
 * public/fonts/name-style.css, loaded once in index.html): Bebas Neue,
 * Cinzel Decorative, Dancing Script, Fredoka, Great Vibes, JetBrains Mono,
 * Orbitron, Pacifico, Playfair Display, Press Start 2P, UnifrakturMaguntia.
 */
export const AVAILABLE_NAME_FONTS: NameFontOption[] = [
  { id: "default", label: "Default" },
  // Real web fonts
  { id: "script", label: "Script", stack: "'Pacifico', cursive" },
  { id: "boldScript", label: "Dancing", stack: "'Dancing Script', cursive", weight: 700 },
  { id: "elegant", label: "Elegant", stack: "'Playfair Display', serif", weight: 700 },
  { id: "fantasy", label: "Fantasy", stack: "'Cinzel Decorative', serif", weight: 700 },
  { id: "fraktur", label: "Fraktur", stack: "'UnifrakturMaguntia', serif" },
  { id: "display", label: "Display", stack: "'Bebas Neue', sans-serif" },
  { id: "pixel", label: "Pixel", stack: "'Press Start 2P', monospace" },
  { id: "calligraphy", label: "Calligraphy", stack: "'Great Vibes', cursive" },
  { id: "rounded", label: "Rounded", stack: "'Fredoka', sans-serif", weight: 600 },
  { id: "futuristic", label: "Futuristic", stack: "'Orbitron', sans-serif", weight: 700 },
  { id: "mono", label: "Mono", stack: "'JetBrains Mono', monospace", weight: 500 },
  // CSS-based styles
  { id: "bold", label: "Bold", weight: 800 },
  { id: "italic", label: "Italic", italic: true },
  { id: "wide", label: "Wide", letterSpacing: "0.32em" },
  { id: "smallCaps", label: "Small Caps", smallCaps: true },
];

const VALID_FONT_IDS = new Set(AVAILABLE_NAME_FONTS.map((f) => f.id));

/**
 * Legacy unicode-font ids -> closest real-font equivalents.
 * Mirrors the remap performed by migration 20260908000000 so styles saved
 * before the switch still render sensibly even pre-migration.
 */
const LEGACY_FONT_REMAP: Record<string, string> = {
  doubleStruck: "display",
  sans: "rounded",
  sansBold: "bold",
  fullwidth: "wide",
};

/**
 * Build the CSS needed to render text in the given name font.
 * Returns an empty object for the default font / unknown ids, so the app's
 * regular font is used.
 */
export function getNameFontCss(fontId?: string | null): CSSProperties {
  if (!fontId || fontId === "default") return {};
  const font = AVAILABLE_NAME_FONTS.find((f) => f.id === fontId);
  if (!font) return {};

  const css: CSSProperties = {};
  if (font.stack) {
    css.fontFamily = font.stack;
  }
  if (font.weight !== undefined) {
    css.fontWeight = font.weight;
  }
  if (font.italic) {
    css.fontStyle = "italic";
  }
  if (font.letterSpacing) {
    css.letterSpacing = font.letterSpacing;
  }
  if (font.smallCaps) {
    css.fontVariant = "small-caps";
    if (!css.letterSpacing) css.letterSpacing = "0.03em";
  }
  return css;
}

// ============================================
// Effects
// ============================================

export interface NameEffectOption {
  id: string;
  label: string;
}

export const AVAILABLE_NAME_EFFECTS: NameEffectOption[] = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "neon", label: "Neon" },
  { id: "toon", label: "Toon" },
  { id: "pop", label: "Pop" },
  { id: "gummy", label: "Gummy" },
  { id: "prism", label: "Prism" },
];

const VALID_EFFECT_IDS = new Set(AVAILABLE_NAME_EFFECTS.map((e) => e.id));

// ============================================
// Colors
// ============================================

export const NAME_COLOR_PRESETS: string[] = [
  "#FF4D8D", // pink
  "#23A55A", // green
  "#1DB8A5", // teal
  "#3B9EFF", // blue
  "#9B6DFF", // purple
  "#E048D8", // magenta
  "#FFC94D", // gold
  "#FF7A45", // orange
];

/** Fallback color used by effects that need one when the user has not picked a color */
export const DEFAULT_EFFECT_COLOR = "#9B6DFF";

export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// ============================================
// Style helpers
// ============================================

const RAINBOW_GRADIENT =
  "linear-gradient(90deg, #ff4d8d, #ffc94d, #4ade80, #38bdf8, #9b6dff, #ff4d8d)";

/** Lighten a #RRGGBB color by mixing it with white (amount 0..1) */
function lighten(hex: string, amount: number): string {
  if (!HEX_COLOR_RE.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

export interface NameStyleCssOptions {
  /**
   * When false (e.g. the user has a server role color), the chosen color is
   * skipped so role colors stay meaningful. Effects still apply.
   */
  allowColor?: boolean;
}

/**
 * Build inline CSS for a name style's effect + color. Returns an empty object
 * for default styles. Use getNameFontCss for the font portion.
 */
export function getNameStyleCss(
  style: UserNameStyle | null | undefined,
  options: NameStyleCssOptions = {},
): CSSProperties {
  const { allowColor = true } = options;
  if (!style) return {};

  const effect = style.effect && VALID_EFFECT_IDS.has(style.effect) ? style.effect : null;
  const color = allowColor && style.color && HEX_COLOR_RE.test(style.color) ? style.color : null;
  const c = color ?? DEFAULT_EFFECT_COLOR;

  switch (effect) {
    case "solid":
      return color ? { color } : {};
    case "gradient":
      return {
        backgroundImage: `linear-gradient(92deg, ${c} 15%, ${lighten(c, 0.4)} 85%)`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      };
    case "neon":
      return {
        color: color ?? c,
        textShadow: `0 0 4px ${c}E6, 0 0 12px ${c}99, 0 0 22px ${c}59`,
      };
    case "toon":
      return {
        color: "#FFFFFF",
        WebkitTextStroke: "1.2px #17181C",
        paintOrder: "stroke fill",
        textShadow: "0 2px 0 rgba(0, 0, 0, 0.35)",
      };
    case "pop":
      return {
        color: color ?? c,
        textShadow: `0.07em 0.09em 0 rgba(0, 0, 0, 0.55), -0.02em -0.02em 0 ${c}40`,
      };
    case "gummy":
      return {
        color: color ?? c,
        WebkitTextStroke: `0.55px ${lighten(c, 0.75)}`,
        paintOrder: "stroke fill",
        textShadow: `0 0.07em 0.03em ${c}80`,
      };
    case "prism":
      return {
        backgroundImage: RAINBOW_GRADIENT,
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        animation: "kloak-prism 6s linear infinite",
      };
    default:
      return color ? { color } : {};
  }
}

/** True when the style changes how the name renders at all */
export function hasNameStyle(style: UserNameStyle | null | undefined): boolean {
  if (!style) return false;
  return Boolean(
    (style.font && style.font !== "default") ||
      (style.effect && VALID_EFFECT_IDS.has(style.effect)) ||
      (style.color && HEX_COLOR_RE.test(style.color)),
  );
}

// ============================================
// Parsing / sanitizing
// ============================================

/** Safely parse a name_style value coming from the DB or a client payload */
export function parseNameStyle(raw: unknown): UserNameStyle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const parsed = sanitizeNameStyle(candidate);
  return parsed;
}

/**
 * Validate and normalize a name style before saving/rendering.
 * Returns null when nothing meaningful is set.
 */
export function sanitizeNameStyle(input: unknown): UserNameStyle | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  const rawFont = typeof raw.font === "string" ? raw.font : null;
  const fontId =
    rawFont && !(VALID_FONT_IDS.has(rawFont)) && LEGACY_FONT_REMAP[rawFont]
      ? LEGACY_FONT_REMAP[rawFont]
      : rawFont;
  const font =
    fontId && VALID_FONT_IDS.has(fontId) && fontId !== "default" ? fontId : null;
  const effect =
    typeof raw.effect === "string" && VALID_EFFECT_IDS.has(raw.effect) && raw.effect !== "solid"
      ? raw.effect
      : null;
  const color =
    typeof raw.color === "string" && HEX_COLOR_RE.test(raw.color) ? raw.color : null;

  if (!font && !effect && !color) return null;
  return { font, effect, color };
}

/** Pick a random font/effect/color combination — powers "Surprise Me" */
export function randomNameStyle(): UserNameStyle {
  const fonts = AVAILABLE_NAME_FONTS.filter((f) => f.id !== "default");
  const effects = AVAILABLE_NAME_EFFECTS.filter((e) => e.id !== "solid");
  const font = fonts[Math.floor(Math.random() * fonts.length)];
  const effect = effects[Math.floor(Math.random() * effects.length)];
  const color = NAME_COLOR_PRESETS[Math.floor(Math.random() * NAME_COLOR_PRESETS.length)];
  return { font: font.id, effect: effect.id, color };
}
