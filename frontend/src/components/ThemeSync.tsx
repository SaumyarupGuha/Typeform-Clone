"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyScheme, useColorPreference } from "@/lib/colorScheme";
import { DARK_QUERY } from "@/lib/noFlashScript";

/**
 * Keeps <html data-theme> correct while the app navigates without a page load (for example from
 * a creator screen to a respondent one), when the saved preference changes, and, for "system",
 * when the operating system switches between light and dark. Renders nothing.
 */
export function ThemeSync() {
  const pathname = usePathname();
  const preference = useColorPreference();

  useEffect(() => {
    applyScheme(pathname);
    if (preference !== "system") return;
    // "system" has no value of its own that changes, so listen to the OS setting directly.
    const media = window.matchMedia(DARK_QUERY);
    const onSystemChange = () => applyScheme(pathname);
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [pathname, preference]);

  return null;
}
