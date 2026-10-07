"use client";

import { motion } from "framer-motion";

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Form progress"
      className="absolute inset-x-0 top-0 z-20 h-1.5 bg-[color-mix(in_srgb,var(--r-fg)_12%,transparent)]"
    >
      <motion.div
        className="h-full bg-[var(--r-accent)]"
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}
