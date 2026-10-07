import { propertyFlag, propertyString, TextSetting, ToggleRow, type QuestionSettingsProps } from "./fields";

export function DropdownSettings({ question, onChange }: QuestionSettingsProps) {
  return (
    <>
      <TextSetting
        label="Placeholder"
        value={propertyString(question, "placeholder")}
        placeholder="Type or select an option"
        onChange={(placeholder) => onChange({ placeholder })}
      />
      <ToggleRow
        label="Alphabetical order"
        checked={propertyFlag(question, "alphabetical")}
        onChange={(alphabetical) => onChange({ alphabetical })}
      />
    </>
  );
}
