import { forwardRef, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface InlineEditableProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  maxLength?: number;
}

/**
 * Text that is edited where it is shown: a borderless textarea that grows with its
 * content. Enter does not add a line break (titles are one paragraph); it just leaves the field.
 */
export const InlineEditable = forwardRef<HTMLTextAreaElement, InlineEditableProps>(function InlineEditable(
  { value, onChange, placeholder, ariaLabel, className, maxLength },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  // Resize to fit after every change, before the browser paints.
  useLayoutEffect(() => {
    const element = innerRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(element) => {
        innerRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:italic placeholder:text-ink-faint",
        className,
      )}
    />
  );
});
