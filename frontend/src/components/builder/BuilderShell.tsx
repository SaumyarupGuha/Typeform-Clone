"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Form, QuestionType } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { AddQuestionModal } from "./AddQuestionModal";
import { QuestionCanvas } from "./QuestionCanvas";
import { QuestionSidebar } from "./QuestionSidebar";
import { SettingsPanel } from "./SettingsPanel";
import type { BuilderView } from "./builderViews";
import { ComingSoonPanel } from "./panels/ComingSoonPanel";
import { ThankYouEditor } from "./panels/ThankYouEditor";
import { ThemePanel } from "./panels/ThemePanel";
import { WelcomePanel } from "./panels/WelcomePanel";
import { useAutosavedSettings } from "./panels/useAutosavedSettings";

/** The builder: question list on the left, the centre view (a question or a form-level panel), settings on the right. */
export function BuilderShell({ form }: { form: Form }) {
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<BuilderView>("question");
  // Lives here (not in each panel) so edits keep saving while the creator switches panels,
  // and so the canvas picks up theme changes immediately.
  const settingsEditor = useAutosavedSettings(form);

  // New questions go right after the selected one, as in Typeform.
  function addQuestion(type: QuestionType) {
    const { questions, selectedId, addQuestion: add } = useBuilderStore.getState();
    const index = questions.findIndex((q) => q.id === selectedId);
    setView("question");
    void add(type, index === -1 ? questions.length : index + 1);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] gap-4 lg:h-[calc(100dvh-92px)]",
        view === "question" ? "lg:grid-cols-[280px_minmax(0,1fr)_300px]" : "lg:grid-cols-[280px_minmax(0,1fr)]",
      )}
    >
      <QuestionSidebar onAdd={() => setAddOpen(true)} view={view} onViewChange={setView} />

      {view === "question" && <QuestionCanvas theme={settingsEditor.settings.theme} onAddQuestion={() => setAddOpen(true)} />}
      {view === "welcome" && <WelcomePanel editor={settingsEditor} />}
      {view === "ending" && <ThankYouEditor editor={settingsEditor} />}
      {view === "theme" && <ThemePanel editor={settingsEditor} />}
      {view === "logic" && (
        <ComingSoonPanel title="Logic jumps" description="Show different questions depending on earlier answers. Coming soon." />
      )}
      {view === "integrations" && (
        <ComingSoonPanel title="Integrations" description="Send responses to your other tools with webhooks. Coming soon." />
      )}
      {view === "team" && (
        <ComingSoonPanel title="Share with team" description="Invite teammates to build and review this form together. Coming soon." />
      )}

      {view === "question" && <SettingsPanel />}

      <AddQuestionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onPick={(type) => {
          setAddOpen(false);
          addQuestion(type);
        }}
      />
    </div>
  );
}
