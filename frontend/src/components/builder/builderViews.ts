import { Hand, Palette, PartyPopper, Plug, Users, type LucideIcon } from "lucide-react";

/** What the centre of the builder shows: a question, or one of the form-level panels. */
export type BuilderView = "question" | "welcome" | "ending" | "theme" | "integrations" | "team";

export interface PanelLink {
  view: Exclude<BuilderView, "question">;
  label: string;
  icon: LucideIcon;
  /** Out-of-scope features are listed but open a "Coming soon" panel. */
  comingSoon: boolean;
}

export const PANEL_LINKS: PanelLink[] = [
  { view: "welcome", label: "Welcome screen", icon: Hand, comingSoon: false },
  { view: "ending", label: "Thank-you screen", icon: PartyPopper, comingSoon: false },
  { view: "theme", label: "Design", icon: Palette, comingSoon: false },
  { view: "integrations", label: "Integrations", icon: Plug, comingSoon: true },
  { view: "team", label: "Share with team", icon: Users, comingSoon: true },
];
