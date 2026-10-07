import { propertyFlag, ToggleRow, type QuestionSettingsProps } from "./fields";

export function MultipleChoiceSettings({ question, onChange }: QuestionSettingsProps) {
  return (
    <>
      <ToggleRow
        label="Multiple selection"
        checked={propertyFlag(question, "allow_multiple")}
        onChange={(allow_multiple) => onChange({ allow_multiple })}
      />
      <ToggleRow
        label="Randomize"
        checked={propertyFlag(question, "randomize")}
        onChange={(randomize) => onChange({ randomize })}
      />
      <ToggleRow
        label="Vertical alignment"
        checked={question.properties.vertical !== false}
        onChange={(vertical) => onChange({ vertical })}
      />
    </>
  );
}
