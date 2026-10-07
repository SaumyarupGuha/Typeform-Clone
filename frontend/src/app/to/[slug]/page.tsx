import type { Metadata } from "next";
import { cache } from "react";
import { ClosedScreen } from "@/components/runner/ClosedScreen";
import { FormRunner } from "@/components/runner/FormRunner";
import { api, ApiError } from "@/lib/api";
import type { PublicForm } from "@/lib/types";

// `cache` lets generateMetadata and the page share one request.
const loadForm = cache(async (slug: string): Promise<PublicForm | null> => {
  try {
    return await api.getPublicForm(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null; // draft, unpublished or missing
    throw error;
  }
});

// A free API host (Render) sleeps when idle and takes up to a minute to wake. Without this, the
// hosting platform would cut this page off long before the API answers the first visitor.
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const form = await loadForm((await params).slug);
  return { title: form ? form.title : "Form not available" };
}

export default async function RespondentPage({ params }: PageProps) {
  const form = await loadForm((await params).slug);
  if (!form) return <ClosedScreen />;
  return <FormRunner form={form} />;
}
