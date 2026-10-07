import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, type FormFilters } from "./api";
import type { Form, FormSettings, ResponseStatusFilter } from "./types";

export const formsKey = (filters: FormFilters = {}) => ["forms", filters] as const;

export const formKey = (id: number) => ["form", id] as const;

/** One form with its questions. The builder, share page and top bar all read this. */
export function useForm(id: number) {
  return useQuery({ queryKey: formKey(id), queryFn: () => api.getForm(id) });
}

export function useForms(filters: FormFilters) {
  return useQuery({ queryKey: formsKey(filters), queryFn: () => api.listForms(filters) });
}

/**
 * Wraps the repeated pattern of every workspace mutation: call the API, refresh the
 * list, then show a toast (success text on success, the server's message on failure).
 */
function useFormMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: (result: TResult, variables: TVariables) => string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast.success(successMessage(result, variables));
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong");
    },
  });
}

export function useCreateForm() {
  return useFormMutation((title: string) => api.createForm(title), () => "Form created");
}

export function useRenameForm() {
  return useFormMutation(
    ({ id, title }: { id: number; title: string }) => api.updateForm(id, { title }),
    () => "Form renamed",
  );
}

export function useDuplicateForm() {
  return useFormMutation((id: number) => api.duplicateForm(id), (copy) => `Created "${copy.title}"`);
}

export function useDeleteForm() {
  return useFormMutation(
    ({ id }: { id: number; title: string }) => api.deleteForm(id),
    (_result, { title }) => `"${title}" deleted`,
  );
}

/**
 * Mutations on the form being edited. They put the server's answer straight into the
 * cache so the top bar and Share page update without a refetch, and refresh the workspace list.
 */
function useFormEditMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<Form>,
  successMessage?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (form) => {
      queryClient.setQueryData(formKey(form.id), form);
      void queryClient.invalidateQueries({ queryKey: ["forms"] });
      if (successMessage) toast.success(successMessage);
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong");
    },
  });
}

export function useRenameFormTitle(id: number) {
  return useFormEditMutation((title: string) => api.updateForm(id, { title }), "Form renamed");
}

export function useUpdateFormSettings(id: number) {
  return useFormEditMutation((settings: FormSettings) => api.updateForm(id, { settings }));
}

export function usePublishForm(id: number) {
  return useFormEditMutation(() => api.publishForm(id), "Your form is live");
}

export function useUnpublishForm(id: number) {
  return useFormEditMutation(() => api.unpublishForm(id), "Form unpublished");
}

// ----- Results -----

export const RESPONSES_PAGE_SIZE = 20;

export function useSummary(formId: number) {
  // staleTime 0: results change whenever someone responds, so refetch on every visit.
  return useQuery({ queryKey: ["summary", formId], queryFn: () => api.getSummary(formId), staleTime: 0 });
}

export function useResponses(formId: number, page: number, status: ResponseStatusFilter) {
  return useQuery({
    queryKey: ["responses", formId, page, status],
    queryFn: () => api.listResponses(formId, page, RESPONSES_PAGE_SIZE, status),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
    staleTime: 0,
  });
}

export function useResponse(formId: number, responseId: number | null) {
  return useQuery({
    queryKey: ["response", formId, responseId],
    queryFn: () => api.getResponse(formId, responseId as number),
    enabled: responseId !== null,
  });
}

export function useDeleteResponse(formId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (responseId: number) => api.deleteResponse(formId, responseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["responses", formId] });
      void queryClient.invalidateQueries({ queryKey: ["summary", formId] });
      void queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast.success("Response deleted");
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong");
    },
  });
}
