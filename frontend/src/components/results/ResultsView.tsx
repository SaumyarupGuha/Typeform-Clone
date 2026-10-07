"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import { ResponsesTable } from "./ResponsesTable";
import { SummaryTab } from "./SummaryTab";

type ResultsTab = "summary" | "responses";

const TABS: TabItem<ResultsTab>[] = [
  { id: "summary", label: "Summary" },
  { id: "responses", label: "Responses" },
];

export function ResultsView({ formId }: { formId: number }) {
  const [tab, setTab] = useState<ResultsTab>("summary");

  return (
    <div className="min-h-[calc(100dvh-92px)] rounded-panel bg-surface px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line">
          <Tabs items={TABS} value={tab} onChange={setTab} />
          {/* A plain link: the server answers with Content-Disposition: attachment, so the browser downloads it. */}
          <a
            href={api.csvExportUrl(formId)}
            className="mb-2 inline-flex h-9 items-center gap-2 rounded-control border border-line bg-white px-3 text-sm font-medium hover:bg-surface-strong"
          >
            <Download className="size-4" />
            Download CSV
          </a>
        </div>
        {tab === "summary" ? <SummaryTab formId={formId} /> : <ResponsesTable formId={formId} />}
      </div>
    </div>
  );
}
