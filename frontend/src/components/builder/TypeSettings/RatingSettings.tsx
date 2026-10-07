import { FIELD_CLASS, propertyNumber, SettingLabel, type QuestionSettingsProps } from "./fields";

const STEP_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];

export function RatingSettings({ question, onChange }: QuestionSettingsProps) {
  const steps = propertyNumber(question, "steps") ?? 5;
  return (
    <>
      <label className="block py-2">
        <SettingLabel>Steps</SettingLabel>
        <select value={steps} onChange={(event) => onChange({ steps: Number(event.target.value) })} className={FIELD_CLASS}>
          {STEP_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="block py-2">
        <SettingLabel>Shape</SettingLabel>
        <select disabled value="star" className={FIELD_CLASS}>
          <option value="star">Star</option>
        </select>
      </label>
    </>
  );
}
