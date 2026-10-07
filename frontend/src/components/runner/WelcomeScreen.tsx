import type { WelcomeScreen as WelcomeSettings } from "@/lib/types";
import { OkButton } from "./OkButton";

export function WelcomeScreen({ settings, onStart }: { settings: WelcomeSettings; onStart: () => void }) {
  return (
    <div>
      <h1 className="text-3xl leading-snug sm:text-5xl">{settings.title}</h1>
      <OkButton label={settings.button_text} showCheck={false} onClick={onStart} />
    </div>
  );
}
