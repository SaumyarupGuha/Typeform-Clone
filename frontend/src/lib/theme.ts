import type { CSSProperties } from "react";
import type { FormTheme } from "./types";

/** Black or white, whichever is readable on `background` (WCAG relative luminance). */
export function readableTextColor(background: string): string {
  const channels = [1, 3, 5].map((start) => parseInt(background.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#262627" : "#ffffff";
}

/**
 * The respondent screens style themselves from three CSS variables, so a form's
 * theme only has to set them on one wrapping element.
 */
export function themeStyle(theme: FormTheme): CSSProperties {
  return {
    "--r-bg": theme.background,
    "--r-fg": readableTextColor(theme.background),
    "--r-accent": theme.primary,
    "--r-on-accent": readableTextColor(theme.primary),
    // The keyboard focus ring must stay visible on dark backgrounds too.
    "--focus-ring": readableTextColor(theme.background),
    fontFamily: `"${theme.font}", var(--font-sans)`,
  } as CSSProperties;
}
