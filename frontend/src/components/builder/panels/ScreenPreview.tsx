import { themeStyle } from "@/lib/theme";
import type { FormTheme } from "@/lib/types";

/** A scaled-down, themed stage for showing how a welcome/thank-you/sample screen will look. */
export function ScreenPreview({ theme, children }: { theme: FormTheme; children: React.ReactNode }) {
  return (
    <div
      style={{ ...themeStyle(theme), zoom: 0.6 }}
      className="flex min-h-64 items-center justify-center rounded-panel bg-[var(--r-bg)] p-8 text-[var(--r-fg)] shadow-[0_0_0_1px_var(--color-line)]"
    >
      {children}
    </div>
  );
}
