import { Copy, CopyPlus, ExternalLink, MoreHorizontal, Pencil, BarChart3, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { copyLink } from "@/lib/clipboard";
import type { FormSummary } from "@/lib/types";
import { Menu } from "@/components/ui/Menu";

interface FormRowMenuProps {
  form: FormSummary;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ICON = "size-4";

export function FormRowMenu({ form, onRename, onDuplicate, onDelete }: FormRowMenuProps) {
  const router = useRouter();

  return (
    <Menu
      label={`Actions for ${form.title}`}
      trigger={<MoreHorizontal className="size-5" />}
      items={[
        { label: "Open", icon: <ExternalLink className={ICON} />, onSelect: () => router.push(`/forms/${form.id}/create`) },
        { label: "View results", icon: <BarChart3 className={ICON} />, onSelect: () => router.push(`/forms/${form.id}/results`) },
        { label: "Rename", icon: <Pencil className={ICON} />, onSelect: onRename },
        { label: "Duplicate", icon: <CopyPlus className={ICON} />, onSelect: onDuplicate },
        { label: "Copy link", icon: <Copy className={ICON} />, onSelect: () => void copyLink(form.public_url), hidden: form.status !== "published" },
        { label: "Delete", icon: <Trash2 className={ICON} />, onSelect: onDelete, danger: true },
      ]}
    />
  );
}
