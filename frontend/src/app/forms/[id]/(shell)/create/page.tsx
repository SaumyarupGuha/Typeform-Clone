"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { formKey, useForm } from "@/lib/queries";
import { useFormId } from "@/lib/useFormId";
import { useBuilderStore } from "@/store/builderStore";

export default function CreatePage() {
  const formId = useFormId();
  const queryClient = useQueryClient();
  const form = useForm(formId);
  const loadedFormId = useBuilderStore((state) => state.formId);

  // When another form was being edited, save its pending changes, then load this form fresh
  // from the server (the query cache may predate edits made earlier in this session).
  useEffect(() => {
    if (loadedFormId === formId) return;
    let cancelled = false;
    void (async () => {
      const { flush, load } = useBuilderStore.getState();
      await flush();
      try {
        const fresh = await api.getForm(formId);
        if (cancelled) return;
        queryClient.setQueryData(formKey(formId), fresh);
        load(fresh);
      } catch {
        if (!cancelled) toast.error("Could not load the form");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formId, loadedFormId, queryClient]);

  if (!form.data || loadedFormId !== formId) {
    return (
      <div className="flex justify-center py-20 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  return <BuilderShell form={form.data} />;
}
