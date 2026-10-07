"use client";

import { ChevronDown, Download } from "lucide-react";
import { useState } from "react";
import { Menu } from "@/components/ui/Menu";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import type { ResponseStatusFilter } from "@/lib/types";
import { ResponsesTable } from "./ResponsesTable";
import { SummaryTab } from "./SummaryTab";

type ResultsTab = "summary" | "responses";

const TABS: TabItem<ResultsTab>[] = [
  { id: "summary", label: "Summary" },
  { id: "responses", label: "Responses" },
];

export function ResultsView({ formId }: { formId: number }) {
  const [tab, setTab] = useState<ResultsTab>("summary");

  // The server answers with Content-Disposition: attachment, so navigating to the URL downloads the file.
  const download = (status: ResponseStatusFilter) => () => window.location.assign(api.csvExportUrl(formId, status));

  return (
    <div className="min-h-[calc(100dvh-92px)] rounded-panel bg-surface px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line">
          <Tabs items={TABS} value={tab} onChange={setTab} />
          <div className="mb-2">
            <Menu
              label="Download CSV"
              triggerClassName="inline-flex h-9 items-center gap-2 rounded-control border border-line bg-card px-3 text-sm font-medium hover:bg-surface-strong"
              trigger={
                <>
                  <Download className="size-4" />
                  Download CSV
                  <ChevronDown className="size-4 text-ink-muted" />
                </>
              }
              items={[
                { label: "Completed responses", onSelect: download("completed") },
                { label: "All responses, including partial", onSelect: download("all") },
              ]}
            />
          </div>
        </div>
        {tab === "summary" ? <SummaryTab formId={formId} /> : <ResponsesTable formId={formId} />}
      </div>
    </div>
  );
}
