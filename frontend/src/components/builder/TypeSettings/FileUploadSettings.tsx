import { ALLOWED_TYPE_OPTIONS, HARD_LIMIT_MB, isAllowedTypes } from "@/lib/fileTypes";
import { FIELD_CLASS, NumberSetting, propertyNumber, SettingLabel, type QuestionSettingsProps } from "./fields";

export function FileUploadSettings({ question, onChange }: QuestionSettingsProps) {
  const allowed = isAllowedTypes(question.properties.allowed_types) ? question.properties.allowed_types : "any";
  return (
    <>
      <label className="block py-2">
        <SettingLabel>Allowed files</SettingLabel>
        <select value={allowed} onChange={(event) => onChange({ allowed_types: event.target.value })} className={FIELD_CLASS}>
          {ALLOWED_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <NumberSetting
        label={`Max file size (MB, up to ${HARD_LIMIT_MB})`}
        value={propertyNumber(question, "max_size_mb") ?? 10}
        min={1}
        onChange={(value) => {
          if (value !== null && value <= HARD_LIMIT_MB) onChange({ max_size_mb: Math.round(value) });
        }}
      />
      <p className="text-xs text-ink-faint">Programs such as .exe files are never accepted.</p>
    </>
  );
}
