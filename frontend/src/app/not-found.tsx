import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">The page you are looking for does not exist or was moved.</p>
      <Link href="/workspace">
        <Button>Go to my workspace</Button>
      </Link>
    </main>
  );
}
