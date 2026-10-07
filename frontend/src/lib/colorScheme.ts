/**
 * Light / dark mode for the creator app (workspace, builder, results).
 *
 * The choice is "light", "dark" or "system" (follow the operating system) and is remembered in
 * localStorage. It is applied as `data-theme` on <html>, where globals.css swaps the colour tokens.
 * Respondent pages (/to/...) are always light: each form brings its own theme there.
 * The same decision is made before first paint by the inline script in noFlashScript.ts.
 */
import { useSyncExternalStore } from "react";
import { COLOR_STORAGE_KEY, DARK_QUERY } from "./noFlashScript";

export type ColorPreference = "light" | "dark" | "system";

const CHANGE_EVENT = "color-scheme-change";

export function readPreference(): ColorPreference {
  try {
    const stored = localStorage.getItem(COLOR_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system"; // storage can be blocked; the OS setting is a sensible default
  }
}

/** Respondent pages never go dark. */
export const isRespondentPath = (pathname: string) => pathname.startsWith("/to/");

export function resolveScheme(preference: ColorPreference, pathname: string): "light" | "dark" {
  if (isRespondentPath(pathname)) return "light";
  if (preference === "system") return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  return preference;
}

export function applyScheme(pathname: string): void {
  document.documentElement.dataset.theme = resolveScheme(readPreference(), pathname);
}

export function savePreference(preference: ColorPreference): void {
  try {
    localStorage.setItem(COLOR_STORAGE_KEY, preference);
  } catch {
    // ignore: the choice then lasts until the page is reloaded
  }
  applyScheme(window.location.pathname);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

/** The saved preference, kept in step across the page and other tabs. */
export function useColorPreference(): ColorPreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}
