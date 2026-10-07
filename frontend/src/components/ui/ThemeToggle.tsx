"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { savePreference, useColorPreference, type ColorPreference } from "@/lib/colorScheme";
import { Menu } from "./Menu";

const OPTIONS: { value: ColorPreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** The appearance menu (Light, Dark or follow the system), shown in the creator headers. */
export function ThemeToggle() {
  const preference = useColorPreference();
  const Current = OPTIONS.find((option) => option.value === preference)?.icon ?? Monitor;

  return (
    <Menu
      label="Appearance"
      trigger={<Current className="size-5" />}
      items={OPTIONS.map(({ value, label, icon: Icon }) => ({
        label,
        icon: preference === value ? <Check className="size-4" /> : <Icon className="size-4 text-ink-muted" />,
        onSelect: () => savePreference(value),
      }))}
    />
  );
}
