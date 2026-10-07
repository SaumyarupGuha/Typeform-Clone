"use client";

import { WelcomeScreen } from "@/components/runner/WelcomeScreen";
import { FIELD_CLASS, SettingLabel, ToggleRow } from "../TypeSettings/fields";
import { PanelFrame } from "./PanelFrame";
import { ScreenPreview } from "./ScreenPreview";
import type { AutosavedSettings } from "./useAutosavedSettings";

export function WelcomePanel({ editor }: { editor: AutosavedSettings }) {
  const { welcome_screen: screen, theme } = editor.settings;
  const setScreen = (changes: Partial<typeof screen>) => editor.update({ welcome_screen: { ...screen, ...changes } });

  return (
    <PanelFrame title="Welcome screen" description="An optional first screen before question 1." status={editor.status}>
      <ToggleRow label="Show a welcome screen" checked={screen.enabled} onChange={(enabled) => setScreen({ enabled })} />
      <div className={screen.enabled ? "" : "pointer-events-none opacity-50"}>
        <label className="mt-2 block">
          <SettingLabel>Title</SettingLabel>
          <input
            value={screen.title}
            maxLength={200}
            onChange={(event) => setScreen({ title: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="mt-4 block">
          <SettingLabel>Button text</SettingLabel>
          <input
            value={screen.button_text}
            maxLength={40}
            onChange={(event) => setScreen({ button_text: event.target.value })}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Preview</h3>
      <ScreenPreview theme={theme}>
        <WelcomeScreen settings={screen} onStart={() => undefined} />
      </ScreenPreview>
    </PanelFrame>
  );
}
