import { useEffect, useRef } from "react";

/** True when the user is typing into a field, where letters and arrows must not be hijacked. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export interface RunnerHotkeys {
  onNext: () => void;
  onPrevious: () => void;
  /** A plain letter or digit pressed outside any field. `key` is lower case. */
  onKey: (key: string) => void;
}

/**
 * Document-level keyboard handling for the respondent flow:
 *   Enter / ArrowDown -> next      ArrowUp -> previous      letters and digits -> answer shortcuts
 * Inputs handle their own special keys (dropdown, Shift+Enter) and call preventDefault(),
 * which is how this handler knows to stay out of the way.
 */
export function useRunnerHotkeys(handlers: RunnerHotkeys, enabled: boolean): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      const typing = isTypingTarget(event.target);
      const onActionButton = event.target instanceof HTMLElement && event.target.closest("[data-runner-action]");

      if (event.key === "Enter") {
        if (event.shiftKey || onActionButton) return; // Shift+Enter is a line break; buttons click natively
        event.preventDefault();
        latest.current.onNext();
      } else if (!typing && event.key === "ArrowDown") {
        event.preventDefault();
        latest.current.onNext();
      } else if (!typing && event.key === "ArrowUp") {
        event.preventDefault();
        latest.current.onPrevious();
      } else if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && /^[a-z0-9]$/i.test(event.key)) {
        latest.current.onKey(event.key.toLowerCase());
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
