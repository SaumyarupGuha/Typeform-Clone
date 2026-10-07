"use client";

import { ResultsView } from "@/components/results/ResultsView";
import { useFormId } from "@/lib/useFormId";

export default function ResultsPage() {
  return <ResultsView formId={useFormId()} />;
}
