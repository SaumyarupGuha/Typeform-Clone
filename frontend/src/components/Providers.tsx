"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so each browser session gets its own cache, not one shared across requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            // Retry once for network hiccups and server errors, never for 4xx (a 404 will not fix itself).
            retry: (failureCount, error) =>
              failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "flex items-center gap-3 rounded-control bg-ink px-4 py-3 text-sm font-medium text-white shadow-popover",
            error: "!bg-danger",
          },
        }}
      />
    </QueryClientProvider>
  );
}
