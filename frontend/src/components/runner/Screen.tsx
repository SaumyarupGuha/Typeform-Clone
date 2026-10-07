"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useRef } from "react";

const SLIDE_DISTANCE = "30%";

/**
 * `direction` arrives through `custom`, so even a screen that is already leaving gets
 * the latest direction (AnimatePresence passes it to exiting children too).
 */
const variants: Variants = {
  enter: (direction: 1 | -1) => ({ y: direction > 0 ? SLIDE_DISTANCE : `-${SLIDE_DISTANCE}`, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: 1 | -1) => ({ y: direction > 0 ? `-${SLIDE_DISTANCE}` : SLIDE_DISTANCE, opacity: 0 }),
};

interface ScreenProps {
  direction: 1 | -1;
  children: React.ReactNode;
}

/** One full-screen page of the form. Rendered inside AnimatePresence, keyed per question. */
export function Screen({ direction, children }: ScreenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="absolute inset-0 overflow-y-auto"
      // Once the slide has finished, move the cursor into the new question's field.
      onAnimationComplete={(definition) => {
        if (definition === "center") {
          ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
        }
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 pb-28 pt-20">{children}</div>
    </motion.div>
  );
}
