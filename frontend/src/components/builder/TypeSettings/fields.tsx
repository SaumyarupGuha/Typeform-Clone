import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import type { JsonValue, Question } from "@/lib/types";

/** Props of every per-type settings panel. `onChange` merges into the question's properties. */
export interface QuestionSettingsProps {
  question: Question;
  onChange: (changes: Record<string, JsonValue>) => void;
}

const FIELD_CLASS = "h-10 w-full rounded-control border border-line bg-card px-3 text-sm outline-none focus:border-ink";

export function SettingLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-medium text-ink-muted">{children}</span>;
}

export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm">{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

export function TextSetting({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block py-2">
      <SettingLabel>{label}</SettingLabel>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS} />
    </label>
  );
}

interface NumberSettingProps {
  label: string;
  value: number | null;
  /** Called with a valid number, or null when the field was cleared (only if `clearable`). */
  onChange: (value: number | null) => void;
  clearable?: boolean;
  min?: number;
  error?: string;
}

/**
 * A number field that keeps the raw text while typing, so an in-between state like "-"
 * or an empty box is not rewritten under the user's cursor.
 */
export function NumberSetting({ label, value, onChange, clearable = false, min, error }: NumberSettingProps) {
  const [text, setText] = useState(value === null ? "" : String(value));

  function handleChange(next: string) {
    setText(next);
    if (next.trim() === "") {
      if (clearable) onChange(null);
      return;
    }
    const parsed = Number(next);
    if (!Number.isFinite(parsed)) return;
    if (min !== undefined && parsed < min) return;
    onChange(parsed);
  }

  return (
    <label className="block py-2">
      <SettingLabel>{label}</SettingLabel>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={FIELD_CLASS}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function propertyString(question: Question, key: string): string {
  const value = question.properties[key];
  return typeof value === "string" ? value : "";
}

export function propertyNumber(question: Question, key: string): number | null {
  const value = question.properties[key];
  return typeof value === "number" ? value : null;
}

export function propertyFlag(question: Question, key: string): boolean {
  return question.properties[key] === true;
}

export { FIELD_CLASS };
