"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { themeStyle } from "@/lib/theme";
import { FONT_OPTIONS, sameTheme, THEME_PRESETS } from "@/lib/themePresets";
import type { FormTheme } from "@/lib/types";
import { FIELD_CLASS, SettingLabel } from "../TypeSettings/fields";
import { PanelFrame } from "./PanelFrame";
import { ScreenPreview } from "./ScreenPreview";
import type { AutosavedSettings } from "./useAutosavedSettings";

export function ThemePanel({ editor }: { editor: AutosavedSettings }) {
  const theme = editor.settings.theme;
  const setTheme = (changes: Partial<FormTheme>) => editor.update({ theme: { ...theme, ...changes } });

  return (
    <PanelFrame title="Design" description="Choose how your form looks to respondents." status={editor.status}>
      <h3 className="mb-3 text-sm font-semibold">Themes</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEME_PRESETS.map((preset) => {
          const selected = sameTheme(preset, theme);
          return (
            <button
              key={preset.name}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme({ background: preset.background, primary: preset.primary, font: preset.font })}
              className={cn(
                "overflow-hidden rounded-control text-left shadow-[0_0_0_1px_var(--color-line)] transition-shadow hover:shadow-popover",
                selected && "shadow-[0_0_0_2px_var(--color-ink)]",
              )}
            >
              <span style={themeStyle(preset)} className="block bg-[var(--r-bg)] px-3 py-3 text-[var(--r-fg)]">
                <span className="block text-sm">Question</span>
                <span className="block text-sm text-[var(--r-accent)]">Answer</span>
                <span className="mt-2 block h-3 w-8 rounded-sm bg-[var(--r-accent)]" />
              </span>
              <span className="flex items-center justify-between bg-white px-3 py-2 text-sm">
                {preset.name}
                {selected && <Check className="size-4" aria-label="Selected" />}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Customize</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <ColorField label="Background" value={theme.background} onChange={(background) => setTheme({ background })} />
        <ColorField label="Buttons and answers" value={theme.primary} onChange={(primary) => setTheme({ primary })} />
        <label className="block">
          <SettingLabel>Font</SettingLabel>
          <select value={theme.font} onChange={(event) => setTheme({ font: event.target.value })} className={FIELD_CLASS}>
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Preview</h3>
      <ScreenPreview theme={theme}>
        <div className="w-full max-w-md">
          <p className="text-2xl">1 → How was your visit?</p>
          <div className="runner-choice mt-5">
            <span className="runner-choice-key">A</span>Great
          </div>
          <div className="runner-choice mt-2" aria-checked="true">
            <span className="runner-choice-key">B</span>Okay
          </div>
          <span className="mt-5 inline-block rounded-md bg-[var(--r-accent)] px-5 py-2.5 text-lg font-semibold text-[var(--r-on-accent)]">
            OK
          </span>
        </div>
      </ScreenPreview>
    </PanelFrame>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <SettingLabel>{label}</SettingLabel>
      <span className="flex h-10 items-center gap-3 rounded-control border border-line bg-white px-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-7 cursor-pointer border-0 bg-transparent p-0"
        />
        <span className="text-sm uppercase text-ink-muted">{value}</span>
      </span>
    </label>
  );
}
