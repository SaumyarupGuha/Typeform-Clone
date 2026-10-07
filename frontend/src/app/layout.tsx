import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { ThemeSync } from "@/components/ThemeSync";
import { NO_FLASH_SCRIPT } from "@/lib/noFlashScript";
import "./globals.css";

// Typeform's own typeface is proprietary; Inter is the closest free geometric sans.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Typeform Clone",
  description: "Build forms people enjoy filling in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets data-theme before React loads.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <ThemeSync />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
