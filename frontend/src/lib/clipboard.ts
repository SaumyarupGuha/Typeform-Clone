import { toast } from "sonner";

export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    // The Clipboard API is only available on secure origins and with permission.
    toast.error("Could not copy the link");
  }
}
