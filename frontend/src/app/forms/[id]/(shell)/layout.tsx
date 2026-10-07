import { notFound } from "next/navigation";
import { FormShell } from "@/components/forms/FormShell";

export default async function FormLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const formId = Number((await params).id);
  if (!Number.isInteger(formId)) notFound();
  return <FormShell formId={formId}>{children}</FormShell>;
}
