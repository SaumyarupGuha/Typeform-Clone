import { TriangleAlert } from "lucide-react";

export function ErrorMessage({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#fdeceb] px-3 py-1.5 text-sm font-medium text-[#c0392b]"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
