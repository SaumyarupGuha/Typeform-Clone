import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { create } from "zustand";
import { api, ApiError } from "@/lib/api";
import { QUESTION_TYPES } from "@/lib/questionTypes";
import type { Form, Question, QuestionType, QuestionUpdate } from "@/lib/types";

/** How long typing must pause before a question is saved. */
const AUTOSAVE_DELAY_MS = 600;

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Fields the creator can edit on a question; saved together as one PATCH. */
export type QuestionEdit = Partial<Pick<Question, "title" | "description" | "required" | "properties" | "options">>;

interface BuilderState {
  formId: number | null;
  questions: Question[];
  selectedId: number | null;
  saveState: SaveState;
  /** Set after adding a question so the canvas can focus its title. */
  focusRequestId: number | null;

  load: (form: Form) => void;
  select: (id: number) => void;
  clearFocusRequest: () => void;
  addQuestion: (type: QuestionType, position?: number) => Promise<void>;
  editQuestion: (id: number, changes: QuestionEdit) => void;
  changeType: (id: number, type: QuestionType) => Promise<void>;
  duplicateQuestion: (id: number) => Promise<void>;
  deleteQuestion: (id: number) => Promise<void>;
  reorder: (fromIndex: number, toIndex: number) => Promise<void>;
  /** Saves everything pending right now; await it before publishing or previewing. */
  flush: () => Promise<void>;
}

// Bookkeeping for autosave. It lives outside React state because it never affects
// rendering directly; only `saveState` (derived from it) does.
const timers = new Map<number, ReturnType<typeof setTimeout>>(); // debounce timer per question
const dirty = new Set<number>(); // edited locally, not yet sent
const inFlight = new Map<number, Promise<void>>(); // one running save chain per question
const resaveQueued = new Set<number>(); // edited again while a save was running

let tempOptionId = 0;
/** Options created in the browser get negative ids until the server assigns real ones. */
export const newTempOptionId = () => --tempOptionId;

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong";
}

export const useBuilderStore = create<BuilderState>()((set, get) => {
  const replaceQuestion = (updated: Question) =>
    set((state) => ({ questions: state.questions.map((q) => (q.id === updated.id ? updated : q)) }));

  const refreshSaveState = () => {
    if (get().saveState === "error" && dirty.size === 0 && inFlight.size === 0) return;
    set({ saveState: dirty.size > 0 || inFlight.size > 0 ? "saving" : "saved" });
  };

  /** Throws away local state and reloads from the server: the rollback for any failed write. */
  const resync = async () => {
    const formId = get().formId;
    if (formId === null) return;
    try {
      const form = await api.getForm(formId);
      timers.forEach(clearTimeout);
      timers.clear();
      dirty.clear();
      const selectedId = form.questions.some((q) => q.id === get().selectedId)
        ? get().selectedId
        : (form.questions[0]?.id ?? null);
      set({ questions: form.questions, selectedId });
    } catch {
      // Offline: keep what we have; the error toast was already shown.
    }
  };

  /** Sends one PATCH with the question's current state. */
  const sendOnce = async (id: number) => {
    dirty.delete(id);
    const question = get().questions.find((q) => q.id === id);
    if (!question) return;

    const payload: QuestionUpdate = {
      title: question.title,
      description: question.description,
      required: question.required,
      properties: question.properties,
    };
    if (QUESTION_TYPES[question.type].hasOptions) {
      // Temporary (negative) ids are omitted so the server creates those options.
      payload.options = question.options.map((o) => (o.id > 0 ? { id: o.id, label: o.label } : { label: o.label }));
    }

    try {
      const saved = await api.updateQuestion(id, payload);
      // Adopt the server's option ids, unless the user already typed something newer.
      if (!dirty.has(id)) {
        const current = get().questions.find((q) => q.id === id);
        if (current) replaceQuestion({ ...current, options: saved.options });
      }
    } catch (error) {
      toast.error(errorMessage(error));
      set({ saveState: "error" });
      await resync();
    }
  };

  /**
   * Saves a question, strictly one request at a time per question. If it is edited again
   * while a request runs, one more request follows afterwards, so an older response can
   * never overwrite a newer one on the server.
   */
  const saveQuestion = (id: number): Promise<void> => {
    const running = inFlight.get(id);
    if (running) {
      resaveQueued.add(id);
      return running;
    }
    const chain = (async () => {
      do {
        resaveQueued.delete(id);
        await sendOnce(id);
      } while (resaveQueued.has(id));
    })().finally(() => {
      inFlight.delete(id);
      refreshSaveState();
    });
    inFlight.set(id, chain);
    return chain;
  };

  /** Cancels the debounce wait for one question and saves it immediately (if it has changes). */
  const flushQuestion = async (id: number): Promise<void> => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    if (dirty.has(id)) await saveQuestion(id);
    else await inFlight.get(id); // nothing new to send; just wait for the running save
  };

  return {
    formId: null,
    questions: [],
    selectedId: null,
    saveState: "idle",
    focusRequestId: null,

    load: (form) => {
      timers.forEach(clearTimeout);
      timers.clear();
      dirty.clear();
      set({
        formId: form.id,
        questions: form.questions,
        selectedId: form.questions[0]?.id ?? null,
        saveState: "idle",
        focusRequestId: null,
      });
    },

    select: (id) => set({ selectedId: id }),
    clearFocusRequest: () => set({ focusRequestId: null }),

    addQuestion: async (type, position) => {
      const formId = get().formId;
      if (formId === null) return;
      try {
        const question = await api.addQuestion(formId, type, position);
        set((state) => {
          const questions = [...state.questions];
          questions.splice(position ?? questions.length, 0, question);
          return { questions: questions.map((q, index) => ({ ...q, position: index })), selectedId: question.id, focusRequestId: question.id };
        });
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    editQuestion: (id, changes) => {
      set((state) => ({ questions: state.questions.map((q) => (q.id === id ? { ...q, ...changes } : q)), saveState: "saving" }));
      dirty.add(id);
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          void saveQuestion(id);
        }, AUTOSAVE_DELAY_MS),
      );
    },

    changeType: async (id, type) => {
      const question = get().questions.find((q) => q.id === id);
      if (!question || question.type === type) return;
      await flushQuestion(id);
      try {
        replaceQuestion(await api.updateQuestion(id, { type }));
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    duplicateQuestion: async (id) => {
      await flushQuestion(id);
      try {
        const copy = await api.duplicateQuestion(id);
        const questions = [...get().questions];
        questions.splice(copy.position, 0, copy);
        set({ questions: questions.map((q, index) => ({ ...q, position: index })), selectedId: copy.id });
        toast.success("Question duplicated");
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    deleteQuestion: async (id) => {
      const question = get().questions.find((q) => q.id === id);
      if (!question) return;
      clearTimeout(timers.get(id));
      timers.delete(id);
      dirty.delete(id);
      try {
        await api.deleteQuestion(id);
        set((state) => {
          const index = state.questions.findIndex((q) => q.id === id);
          const questions = state.questions.filter((q) => q.id !== id).map((q, position) => ({ ...q, position }));
          const selectedId =
            state.selectedId === id ? (questions[Math.min(index, questions.length - 1)]?.id ?? null) : state.selectedId;
          return { questions, selectedId };
        });
        toast.success(`"${question.title || "Untitled question"}" deleted`);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },

    reorder: async (fromIndex, toIndex) => {
      const { formId, questions } = get();
      if (formId === null || fromIndex === toIndex) return;
      // Optimistic: show the new order now, undo (reload) if the server refuses.
      const reordered = arrayMove(questions, fromIndex, toIndex).map((q, position) => ({ ...q, position }));
      set({ questions: reordered });
      try {
        await api.reorderQuestions(formId, reordered.map((q) => q.id));
      } catch (error) {
        toast.error(errorMessage(error));
        await resync();
      }
    },

    flush: async () => {
      const ids = new Set([...dirty, ...inFlight.keys()]);
      await Promise.all([...ids].map((id) => flushQuestion(id)));
    },
  };
});
