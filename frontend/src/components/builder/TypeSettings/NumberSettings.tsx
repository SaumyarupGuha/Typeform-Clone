import { useState } from "react";
import { NumberSetting, propertyNumber, type QuestionSettingsProps } from "./fields";

const CROSSED_MESSAGE = "Minimum cannot be greater than maximum";

export function NumberSettings({ question, onChange }: QuestionSettingsProps) {
  const min = propertyNumber(question, "min");
  const max = propertyNumber(question, "max");
  const [rangeError, setRangeError] = useState<string | undefined>(undefined);

  // A crossed range is never saved (the server would reject it); the message tells the creator why.
  function change(key: "min" | "max", value: number | null) {
    const nextMin = key === "min" ? value : min;
    const nextMax = key === "max" ? value : max;
    if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
      setRangeError(CROSSED_MESSAGE);
      return;
    }
    setRangeError(undefined);
    onChange({ [key]: value });
  }

  return (
    <>
      <NumberSetting label="Minimum" value={min} clearable onChange={(value) => change("min", value)} />
      <NumberSetting label="Maximum" value={max} clearable onChange={(value) => change("max", value)} error={rangeError} />
      <p className="text-xs text-ink-faint">Leave a field empty for no limit.</p>
    </>
  );
}
