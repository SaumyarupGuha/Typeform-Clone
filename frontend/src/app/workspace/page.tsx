import type { Metadata } from "next";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";

export const metadata: Metadata = { title: "My workspace · Typeform Clone" };

export default function WorkspacePage() {
  return (
    <>
      <WorkspaceHeader />
      <WorkspaceView />
    </>
  );
}
