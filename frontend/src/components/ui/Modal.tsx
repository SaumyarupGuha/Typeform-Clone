"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** "right" turns the dialog into a full-height drawer sliding in from the right edge. */
  placement?: "center" | "right";
}

export function Modal({ open, onClose, title, children, className, placement = "center" }: ModalProps) {
  const isDrawer = placement === "right";
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // While open: close on Escape, keep Tab inside the dialog, and give focus back afterwards.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  // `document` only exists in the browser, so render nothing during server rendering.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn("fixed inset-0 z-50 flex bg-black/40", isDrawer ? "justify-end" : "items-center justify-center p-4")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            // Focus the first field (autoFocus inputs win); otherwise the dialog itself.
            onAnimationStart={() => {
              if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
            }}
            className={cn(
              "relative w-full bg-card p-6 shadow-modal outline-none",
              isDrawer
                ? "h-full max-w-lg overflow-y-auto rounded-l-panel"
                : "max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto rounded-panel", // long dialogs scroll inside the screen
              className,
            )}
            initial={isDrawer ? { x: "100%" } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={isDrawer ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isDrawer ? { x: "100%" } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-1 rounded-control p-2 text-ink-muted hover:bg-surface-strong"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
