"use client";

import { ThankYouScreen } from "@/components/runner/ThankYouScreen";
import { FIELD_CLASS, SettingLabel } from "../TypeSettings/fields";
import { PanelFrame } from "./PanelFrame";
import { ScreenPreview } from "./ScreenPreview";
import type { AutosavedSettings } from "./useAutosavedSettings";

export function ThankYouEditor({ editor }: { editor: AutosavedSettings }) {
  const { thank_you_screen: screen, theme } = editor.settings;
  const setScreen = (changes: Partial<typeof screen>) => editor.update({ thank_you_screen: { ...screen, ...changes } });

  return (
    <PanelFrame title="Thank-you screen" description="Shown to respondents right after they submit." status={editor.status}>
      <label className="block">
        <SettingLabel>Title</SettingLabel>
        <input
          value={screen.title}
          maxLength={200}
          onChange={(event) => setScreen({ title: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
      <label className="mt-4 block">
        <SettingLabel>Description</SettingLabel>
        <textarea
          value={screen.description}
          maxLength={1000}
          rows={3}
          onChange={(event) => setScreen({ description: event.target.value })}
          className="w-full rounded-control border border-line bg-card px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </label>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Preview</h3>
      <ScreenPreview theme={theme}>
        <ThankYouScreen settings={screen} />
      </ScreenPreview>
    </PanelFrame>
  );
}
