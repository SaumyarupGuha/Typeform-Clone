import type { FormTheme } from "./types";

export interface ThemePreset extends FormTheme {
  name: string;
}

/** Ready-made looks, in the spirit of Typeform's gallery. */
export const THEME_PRESETS: ThemePreset[] = [
  { name: "Pearl White", background: "#FAFAFA", primary: "#262627", font: "Inter" },
  { name: "Classic Blue", background: "#FFFFFF", primary: "#0445AF", font: "Inter" },
  { name: "Inky Black", background: "#262627", primary: "#FFFFFF", font: "Inter" },
  { name: "Plain Teal", background: "#FFFFFF", primary: "#2E9E9A", font: "Inter" },
  { name: "Warm Sand", background: "#FBF3E4", primary: "#B4531A", font: "Georgia" },
  { name: "Forest", background: "#EEF6F0", primary: "#1B6B4A", font: "Inter" },
  { name: "Lavender", background: "#F4F0FF", primary: "#5B3FD0", font: "Inter" },
  { name: "Midnight", background: "#10213F", primary: "#7FB2FF", font: "Inter" },
];

/** Fonts that need no download: Inter ships with the app, the rest are system fonts. */
export const FONT_OPTIONS = ["Inter", "Georgia", "Trebuchet MS", "Verdana", "Courier New"];

export const sameTheme = (a: FormTheme, b: FormTheme) =>
  a.background.toLowerCase() === b.background.toLowerCase() &&
  a.primary.toLowerCase() === b.primary.toLowerCase() &&
  a.font === b.font;
