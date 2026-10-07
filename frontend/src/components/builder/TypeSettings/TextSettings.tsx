import { NumberSetting, propertyNumber, propertyString, TextSetting, type QuestionSettingsProps } from "./fields";

/** Short text and long text share these settings; they differ only in the default limit. */
export function TextSettings({ question, onChange }: QuestionSettingsProps) {
  const fallbackMax = question.type === "long_text" ? 5000 : 255;
  return (
    <>
      <TextSetting
        label="Placeholder"
        value={propertyString(question, "placeholder")}
        placeholder="Type your answer here..."
        onChange={(placeholder) => onChange({ placeholder })}
      />
      <NumberSetting
        label="Max characters"
        value={propertyNumber(question, "max_length") ?? fallbackMax}
        min={1}
        onChange={(value) => value !== null && onChange({ max_length: Math.round(value) })}
      />
    </>
  );
}
