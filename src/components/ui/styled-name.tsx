import { memo, type CSSProperties, type MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import { getNameFontCss, getNameStyleCss } from "@/lib/nameStyle";
import type { UserNameStyle } from "@/types";

interface StyledNameUser {
  display_name?: string | null;
  username?: string;
  name_style?: UserNameStyle | null;
}

interface StyledNameProps {
  /** User providing the name + style; resolved as display_name || username */
  user?: StyledNameUser | null;
  /** Explicit name override (e.g. server nickname). Falls back to user resolution. */
  name?: string;
  fallback?: string;
  className?: string;
  /** Caller styles (role colors etc.) — merged before the name style */
  style?: CSSProperties;
  /** When false, the user's chosen color is skipped (e.g. role colors present) */
  allowColor?: boolean;
  /** When true, skip effect/color entirely (server role colors win) — font still applies */
  suppressEffect?: boolean;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  title?: string;
}

/**
 * Renders a display name with the user's Kloak Prime name style applied
 * (unicode font + effect/color CSS). Degrades to a plain span when the user
 * has no style.
 */
export const StyledName = memo(function StyledName({
  user,
  name,
  fallback,
  className,
  style,
  allowColor = true,
  suppressEffect = false,
  onClick,
  title,
}: StyledNameProps) {
  const text = name || user?.display_name || user?.username || fallback || "";
  const nameStyle = user?.name_style;
  const fontCss = getNameFontCss(nameStyle?.font);
  const effectCss = suppressEffect ? {} : getNameStyleCss(nameStyle, { allowColor });

  if (Object.keys(fontCss).length === 0 && Object.keys(effectCss).length === 0) {
    return (
      <span className={className} style={style} onClick={onClick} title={title}>
        {text}
      </span>
    );
  }

  return (
    <span
      className={cn(className)}
      style={{ ...style, ...fontCss, ...effectCss }}
      onClick={onClick}
      title={title}
    >
      {text}
    </span>
  );
});

StyledName.displayName = "StyledName";
