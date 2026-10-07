import { useParams } from "next/navigation";

/** The numeric `[id]` of the current /forms/[id]/... route. */
export function useFormId(): number {
  return Number(useParams<{ id: string }>().id);
}
