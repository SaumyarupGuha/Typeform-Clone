import { ComingSoon } from "@/components/ui/ComingSoon";
import { PanelFrame } from "./PanelFrame";

export function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <PanelFrame title={title}>
      <ComingSoon title={title} description={description} />
    </PanelFrame>
  );
}
