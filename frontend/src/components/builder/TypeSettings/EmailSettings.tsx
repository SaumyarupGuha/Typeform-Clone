import { propertyString, TextSetting, type QuestionSettingsProps } from "./fields";

export function EmailSettings({ question, onChange }: QuestionSettingsProps) {
  return (
    <TextSetting
      label="Placeholder"
      value={propertyString(question, "placeholder")}
      placeholder="name@example.com"
      onChange={(placeholder) => onChange({ placeholder })}
    />
  );
}
