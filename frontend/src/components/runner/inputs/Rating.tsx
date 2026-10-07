import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { QuestionInputProps } from "./types";

export function Rating({ question, value, onChange }: QuestionInputProps) {
  const steps = typeof question.properties.steps === "number" ? question.properties.steps : 5;
  const [hovered, setHovered] = useState<number | null>(null);
  const current = typeof value === "number" ? value : 0;
  const highlighted = hovered ?? current; // stars up to this number are drawn filled

  return (
    <div role="radiogroup" aria-label={question.title || "Rating"} className="flex flex-wrap gap-x-2 gap-y-4">
      {Array.from({ length: steps }, (_, index) => index + 1).map((step) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={current === step}
          aria-label={`${step} of ${steps}`}
          onClick={() => onChange(step)}
          onMouseEnter={() => setHovered(step)}
          onMouseLeave={() => setHovered(null)}
          className="flex w-12 flex-col items-center gap-2 sm:w-14"
        >
          <Star
            className={cn("size-10 transition-colors sm:size-11", current === step && "animate-blink")}
            strokeWidth={1.5}
            style={{ color: "var(--r-accent)" }}
            fill={step <= highlighted ? "var(--r-accent)" : "transparent"}
          />
          <span className="text-sm opacity-70">{step}</span>
        </button>
      ))}
    </div>
  );
}
